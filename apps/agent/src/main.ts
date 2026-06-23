// apps/agent/src/main.ts
import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import axios from 'axios';

const execAsync = promisify(exec);
const app = express();
const PORT = 7778;

app.use(cors({ origin: ['http://localhost:5173','http://localhost:3000','http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10mb' }));

// Executa script PowerShell via arquivo temp
const ps = async (script: string, interactive = false): Promise<string> => {
  const tmp = join(tmpdir(), 'ledgr_' + Date.now() + '.ps1');
  writeFileSync(tmp, script, 'utf-8');
  const flags = interactive
    ? '-ExecutionPolicy Bypass'
    : '-NonInteractive -ExecutionPolicy Bypass';
  try {
    const { stdout, stderr } = await execAsync(
      'powershell ' + flags + ' -File "' + tmp + '"',
      { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
    );
    if (stderr?.trim()) console.warn('[PS WARN]', stderr.slice(0,200));
    return stdout;
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
};

app.get('/health', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', name: 'LEDGR Agent', port: PORT });
});

// Lista certificados do Windows Certificate Store (inclui A3 conectados via middleware)
app.get('/certificates', async (_req, res) => {
  const script = [
    '$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("My","CurrentUser")',
    '$store.Open("ReadOnly")',
    '$certs = $store.Certificates | Where-Object { $_.HasPrivateKey }',
    '$result = $certs | ForEach-Object {',
    '  $sub = $_.Subject',
    '  $cnpj = if ($sub -match ":([0-9]{14})") { $Matches[1] } elseif ($sub -match "CNPJ=.?([0-9]{14})") { $Matches[1] } else { "" }',
    '  $cpf  = if ($cnpj -eq "" -and $sub -match ":([0-9]{11})\\b") { $Matches[1] } elseif ($sub -match "CPF=.?([0-9]{11})") { $Matches[1] } else { "" }',
    '  $kt = if ($sub -match "A3" -or $sub -match "e-CNPJ A3" -or $sub -match "e-CPF A3" -or $sub -match "PJ A3" -or $sub -match "PF A3") { "A3/CNG" } else { "A1/Software" }',
    '  @{',
    '    thumbprint = $_.Thumbprint',
    '    subject    = $sub',
    '    issuer     = $_.Issuer',
    '    validFrom  = $_.NotBefore.ToString("yyyy-MM-dd")',
    '    validTo    = $_.NotAfter.ToString("yyyy-MM-dd")',
    '    cnpj       = $cnpj',
    '    cpf        = $cpf',
    '    alias      = $alias',
    '    keyType    = $kt',
    '    isExpired  = ($_.NotAfter -lt (Get-Date))',
    '  }',
    '}',
    '$result | ConvertTo-Json -Depth 3 -Compress',
  ].join('\n');
  try {
    const out = await ps(script);
    let raw: any;
    try { raw = JSON.parse(out.trim() || '[]'); } catch { raw = []; }
    const certs = Array.isArray(raw) ? raw : [raw];
    res.json(certs.filter((c: any) => !c.isExpired));
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Exporta certificado publico em PEM (sem chave privada)
app.post('/certificates/export-pem', async (req, res) => {
  const { thumbprint } = req.body;
  if (!thumbprint) return res.status(400).json({ error: 'thumbprint obrigatorio' });
  const script = [
    '$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("My","CurrentUser")',
    '$store.Open("ReadOnly")',
    '$cert = $store.Certificates | Where-Object { $_.Thumbprint -eq "' + thumbprint + '" } | Select-Object -First 1',
    'Write-Host "Buscando thumbprint: ' + thumbprint + '"',
    'Write-Host "Total certs no store: $($store2.Certificates.Count)"',
    'Write-Host "Thumbprints: $(($store2.Certificates | ForEach-Object { $_.Thumbprint }) -join ",")"',
    'if (-not $cert) { throw "Certificado nao encontrado: ' + thumbprint + '" }',
    '$bytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)',
    '$b64 = [Convert]::ToBase64String($bytes)',
    'Write-Output $b64',
  ].join('\n');
  try {
    const b64 = (await ps(script)).trim();
    const pem = '-----BEGIN CERTIFICATE-----\n' + (b64.match(/.{1,64}/g) || []).join('\n') + '\n-----END CERTIFICATE-----';
    res.json({ pem, thumbprint });
  } catch(e: any) {
    console.error('[SOAP ERROR]', e.message, e.stack?.slice(0,300)); res.status(500).json({ error: e.message });
  }
});

// Executa SOAP com cert A3 via Windows CNG — chave privada nunca sai do token
app.post('/nfse-sp/soap', async (req, res) => {
  const { thumbprint, url, soapAction, soapBody } = req.body;
  if (!thumbprint || !url || !soapBody) {
    return res.status(400).json({ error: 'thumbprint, url, soapBody obrigatorios' });
  }
  // Grava o body SOAP em arquivo temp para evitar problemas de escape no PowerShell
  const bodyTmp = join(tmpdir(), 'soap_' + Date.now() + '.xml');
  writeFileSync(bodyTmp, soapBody, 'utf-8');
  const script = [
    '$store2 = New-Object System.Security.Cryptography.X509Certificates.X509Store("My","CurrentUser")',
    '$store2.Open("ReadOnly")',
    '$cert = $store2.Certificates | Where-Object { $_.Thumbprint -eq "' + thumbprint + '" } | Select-Object -First 1',
    'if (-not $cert) { throw "Certificado nao encontrado: ' + thumbprint + '" }',
    '$body = [System.IO.File]::ReadAllText("' + bodyTmp + '", [System.Text.Encoding]::UTF8)',
    '[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12',
    '[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }',
    'Add-Type -AssemblyName System.Net.Http',
    '$sslHandler = [System.Net.Http.HttpClientHandler]::new()',
    '$sslHandler.ClientCertificates.Add($cert) | Out-Null',
    '$sslHandler.ServerCertificateCustomValidationCallback = { $true }',
    '$httpClient = [System.Net.Http.HttpClient]::new($sslHandler)',
    '$httpClient.DefaultRequestHeaders.Add("SOAPAction", "' + (soapAction || '') + '")',
    '$strContent = [System.Net.Http.StringContent]::new($body, [System.Text.Encoding]::UTF8, "text/xml")',
    '$task = $httpClient.PostAsync("' + url + '", $strContent)',
    '$task.GetAwaiter().GetResult() | Out-Null',
    '$readTask = $task.Result.Content.ReadAsStringAsync()',
    '$readTask.GetAwaiter().GetResult()',
  ].join('\n');
  try {
    const result = await ps(script, true); // interactive para PIN do A3
    if (existsSync(bodyTmp)) unlinkSync(bodyTmp);
    res.json({ success: true, data: result.trim() });
  } catch(e: any) {
    if (existsSync(bodyTmp)) unlinkSync(bodyTmp);
    console.error('[SOAP ERROR]', e.message, e.stack?.slice(0,300)); res.status(500).json({ error: e.message });
  }
});

const buildSoap = (tipo: 'TOMADOR'|'EMITIDAS', cnpj: string, pag: number, dtI?: string, dtF?: string): string => {
  const periodo = dtI && dtF
    ? '<tc:PeriodoInicial>' + dtI.replace(/-/g,'') + '</tc:PeriodoInicial><tc:PeriodoFinal>' + dtF.replace(/-/g,'') + '</tc:PeriodoFinal>'
    : '';
  const tag  = tipo === 'TOMADOR' ? 'ConsultaNFeRecebidas' : 'ConsultaNFeEmitidas';
  const ent  = tipo === 'TOMADOR' ? 'CPFCNPJTomador' : 'CPFCNPJPrestador';
  const xml  = '<p1:' + tag + ' xmlns:p1="http://www.prefeitura.sp.gov.br/nfe" xmlns:tc="http://www.prefeitura.sp.gov.br/nfe/tipos" Versao="1">'
    + '<tc:' + ent + '><tc:CNPJ>' + cnpj + '</tc:CNPJ></tc:' + ent + '>'
    + periodo + '<tc:Pagina>' + pag + '</tc:Pagina></p1:' + tag + '>';
  return '<?xml version="1.0" encoding="UTF-8"?>'
    + '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
    + '<soap:Body><' + tag + ' xmlns="http://www.prefeitura.sp.gov.br/nfe/ws/">'
    + '<VersaoSchema>1</VersaoSchema><MensagemXML><![CDATA[' + xml + ']]></MensagemXML>'
    + '</' + tag + '></soap:Body></soap:Envelope>';
};

const consultar = async (thumbprint: string, cnpj: string, tipo: 'TOMADOR'|'EMITIDAS',
  dtI: string|undefined, dtF: string|undefined, paginas: number, hom: boolean) => {
  const wsUrl  = hom ? 'https://nfehomws.prefeitura.sp.gov.br/lotenfe.asmx' : 'https://nfews.prefeitura.sp.gov.br/lotenfe.asmx';
  const action = tipo === 'TOMADOR'
    ? 'http://www.prefeitura.sp.gov.br/nfe/ws/consultaNFeRecebidas'
    : 'http://www.prefeitura.sp.gov.br/nfe/ws/consultaNFeEmitidas';
  let total = 0;
  const xmlNotas: string[] = [];
  const erros: string[] = [];
  for (let pag = 1; pag <= paginas; pag++) {
    try {
      const r = await axios.post('http://localhost:' + PORT + '/nfse-sp/soap',
        { thumbprint, url: wsUrl, soapAction: action, soapBody: buildSoap(tipo, cnpj, pag, dtI, dtF) });
      const data = r.data?.data || '';
      const matches = [...data.matchAll(/<CompNfse>([\s\S]*?)<\/CompNfse>/g)];
      if (!matches.length) break;
      total += matches.length;
      matches.forEach((m: any) => xmlNotas.push(m[0]));
      if (matches.length < 50) break;
    } catch(e: any) { erros.push('Pag ' + pag + ': ' + e.message); break; }
  }
  return { totalEncontradas: total, xmlNotas, erros };
};

app.post('/nfse-sp/buscar-tomador', async (req, res) => {
  const { thumbprint, cnpj, dtInicio, dtFim, paginas = 5, homologacao = false } = req.body;
  if (!thumbprint || !cnpj) return res.status(400).json({ error: 'thumbprint e cnpj obrigatorios' });
  try { res.json(await consultar(thumbprint, cnpj, 'TOMADOR', dtInicio, dtFim, Number(paginas), Boolean(homologacao))); }
  catch(e: any) { console.error('[SOAP ERROR]', e.message, e.stack?.slice(0,300)); res.status(500).json({ error: e.message }); }
});

app.post('/nfse-sp/buscar-emitidas', async (req, res) => {
  const { thumbprint, cnpj, dtInicio, dtFim, paginas = 5, homologacao = false } = req.body;
  if (!thumbprint || !cnpj) return res.status(400).json({ error: 'thumbprint e cnpj obrigatorios' });
  try { res.json(await consultar(thumbprint, cnpj, 'EMITIDAS', dtInicio, dtFim, Number(paginas), Boolean(homologacao))); }
  catch(e: any) { console.error('[SOAP ERROR]', e.message, e.stack?.slice(0,300)); res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('LEDGR Agent rodando em http://localhost:' + PORT);
  console.log('Acesso a tokens A3 via Windows Certificate Store (CNG)');
});
