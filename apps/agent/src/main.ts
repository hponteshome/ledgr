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
const ps = async (script: string): Promise<string> => {
  const tmp = join(tmpdir(), 'ledgr_' + Date.now() + '.ps1');
  writeFileSync(tmp, script, 'utf-8');
  try {
    const { stdout, stderr } = await execAsync(
      'powershell -ExecutionPolicy Bypass -File "' + tmp + '"',
      { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }
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
    '$certs = Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.HasPrivateKey }',
    '$result = $certs | ForEach-Object {',
    '  $sub = $_.Subject',
    '  $cnpj = if ($sub -match "CNPJ=.?([0-9]{14})") { $Matches[1] } else { "" }',
    '  $cpf  = if ($sub -match "CPF=.?([0-9]{11})")  { $Matches[1] } else { "" }',
    '  $kt = "A1/Software"',
    '  try { if ($_.PrivateKey.GetType().Name -like "*Cng*") { $kt = "A3/CNG" } } catch {}',
    '  $alias = if ($_.FriendlyName) { $_.FriendlyName } else { ($sub -replace "^.*?CN=([^,]+).*$","$1") }',
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
    '$cert = Get-Item "Cert:\\CurrentUser\\My\\' + thumbprint + '" -ErrorAction Stop',
    '$bytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)',
    '$b64 = [Convert]::ToBase64String($bytes)',
    'Write-Output $b64',
  ].join('\n');
  try {
    const b64 = (await ps(script)).trim();
    const pem = '-----BEGIN CERTIFICATE-----\n' + (b64.match(/.{1,64}/g) || []).join('\n') + '\n-----END CERTIFICATE-----';
    res.json({ pem, thumbprint });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
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
    '[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12',
    '$cert = Get-Item "Cert:\\CurrentUser\\My\\' + thumbprint + '" -ErrorAction Stop',
    '$body = [System.IO.File]::ReadAllText("' + bodyTmp + '", [System.Text.Encoding]::UTF8)',
    '$wc = New-Object System.Net.WebClient',
    '$wc.Headers.Add("Content-Type", "text/xml; charset=UTF-8")',
    '$wc.Headers.Add("SOAPAction", "' + (soapAction || '') + '")',
    '$wc.ClientCertificates.Add($cert)',
    '$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)',
    '$resp = $wc.UploadData("' + url + '", "POST", $bytes)',
    '[System.Text.Encoding]::UTF8.GetString($resp)',
  ].join('\n');
  try {
    const result = await ps(script);
    if (existsSync(bodyTmp)) unlinkSync(bodyTmp);
    res.json({ success: true, data: result.trim() });
  } catch(e: any) {
    if (existsSync(bodyTmp)) unlinkSync(bodyTmp);
    res.status(500).json({ error: e.message });
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
  catch(e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/nfse-sp/buscar-emitidas', async (req, res) => {
  const { thumbprint, cnpj, dtInicio, dtFim, paginas = 5, homologacao = false } = req.body;
  if (!thumbprint || !cnpj) return res.status(400).json({ error: 'thumbprint e cnpj obrigatorios' });
  try { res.json(await consultar(thumbprint, cnpj, 'EMITIDAS', dtInicio, dtFim, Number(paginas), Boolean(homologacao))); }
  catch(e: any) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('LEDGR Agent rodando em http://localhost:' + PORT);
  console.log('Acesso a tokens A3 via Windows Certificate Store (CNG)');
});
