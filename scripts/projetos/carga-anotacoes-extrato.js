// scripts/projetos/carga-anotacoes-extrato.js
// Fase 1.11 parte A (04/10/2026): carrega as ANOTACOES da planilha do Financeiro (coluna "Referencia" e seguintes da aba
// Movimento) como APOIO a triagem. Nao copia nenhum outro dado da planilha. Cada anotacao e ligada a transacao do extrato
// ja importada (data, tipo, valor, lancamento e, quando houver, saldo). Idempotente (atualiza o texto se a planilha mudar).
// LGPD: o arquivo fica fora do repositorio; este script so imprime contagens.
// Uso: node scripts/projetos/carga-anotacoes-extrato.js [arquivo] [company_id]
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const ExcelJS = require(require.resolve('exceljs', { paths: [path.join(__dirname, '..', '..', 'apps', 'api'), path.join(__dirname, '..', '..')] }));

const ARQ = process.argv[2] || 'D:/Dados/RecifeOcean/Extrato_Itau_Sunsys.xlsx';
const EMPRESA = process.argv[3] || '6a13e876-7056-4076-a403-9610f7dc37b1';
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const txt = (v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : typeof v === 'object'
  ? String(v.result ?? v.text ?? (v.richText ? v.richText.map((t) => t.text).join('') : '')) : String(v)).trim();
const num = (v) => {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && typeof v.result === 'number') return v.result;
  const s = txt(v).replace(/\s/g, '');
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return isNaN(n) ? null : n;
};
const dataIso = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const m = txt(v).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

(async () => {
  const buf = fs.readFileSync(ARQ);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Movimento');
  if (!ws) throw new Error('aba Movimento nao encontrada');
  let hdr = 0; const cols = {};
  ws.eachRow((r, n) => {
    if (hdr) return;
    const v = (r.values || []).map(txt);
    if (v.includes('Data') && v.some((x) => x.startsWith('Valor'))) { hdr = n; v.forEach((x, i) => { if (x) cols[x] = i; }); }
  });
  if (!hdr) throw new Error('cabecalho nao encontrado');
  const iData = cols['Data'];
  const iLanc = cols['Lançamento'] ?? cols['Lancamento'];
  const iValor = Number(Object.entries(cols).find(([k]) => k.startsWith('Valor'))[1]);
  const iSaldo = Object.entries(cols).find(([k]) => k.startsWith('Saldo'));
  const iRef = cols['Referência'] ?? cols['Referencia'];
  if (!iRef) throw new Error('coluna Referencia nao encontrada');
  const sql = ['BEGIN;'];
  let anotadas = 0;
  ws.eachRow((r, n) => {
    if (n <= hdr) return;
    const data = dataIso(r.getCell(iData).value);
    const valor = num(r.getCell(iValor).value);
    const lanc = txt(r.getCell(iLanc).value);
    if (!data || !valor || !lanc) return;
    const partes = [];
    for (let c = iRef; c <= ws.columnCount; c++) { const t = txt(r.getCell(c).value); if (t && partes[partes.length - 1] !== t) partes.push(t); }
    if (!partes.length) return;
    anotadas++;
    const saldo = iSaldo ? num(r.getCell(Number(iSaldo[1])).value) : null;
    const condSaldo = saldo === null ? '' : ` AND t.balance = ${Math.abs(saldo).toFixed(2)}`;
    sql.push(`INSERT INTO proj_anotacoes_extrato (bank_transaction_id, texto, arquivo_sha256) SELECT t.id, ${q(partes.join(' | ').slice(0, 2000))}, '${sha}' FROM bank_transactions t ` +
      `WHERE t.company_id = '${EMPRESA}' AND t.transaction_date::date = DATE '${data}' AND t.type::text = '${valor < 0 ? 'DEBIT' : 'CREDIT'}' ` +
      `AND t.amount = ${Math.abs(valor).toFixed(2)} AND t.description = ${q(lanc)}${condSaldo} LIMIT 1 ` +
      `ON CONFLICT (bank_transaction_id) DO UPDATE SET texto = EXCLUDED.texto, arquivo_sha256 = EXCLUDED.arquivo_sha256, carregado_em = now();`);
  });
  sql.push('COMMIT;');
  sql.push(`SELECT count(*) AS anotacoes_carregadas, count(*) FILTER (WHERE t.type::text = 'DEBIT') AS em_saidas, count(*) FILTER (WHERE t.type::text = 'CREDIT') AS em_entradas FROM proj_anotacoes_extrato a JOIN bank_transactions t ON t.id = a.bank_transaction_id WHERE t.company_id = '${EMPRESA}';`);
  const tmp = path.join(os.tmpdir(), 'anotacoes-' + Date.now() + '.sql');
  fs.writeFileSync(tmp, sql.join('\n'), 'utf8');
  try {
    execFileSync('docker', ['cp', tmp, 'ledgr-postgres:/tmp/anotacoes.sql']);
    const out = execFileSync('docker', ['exec', 'ledgr-postgres', 'psql', '-U', 'ledgr', '-d', 'ledgr_app', '-v', 'ON_ERROR_STOP=1', '-q', '-f', '/tmp/anotacoes.sql'], { encoding: 'utf8' });
    console.log('Linhas anotadas na planilha: ' + anotadas);
    console.log(out.trim());
  } finally {
    try { execFileSync('docker', ['exec', 'ledgr-postgres', 'rm', '-f', '/tmp/anotacoes.sql']); } catch (e) { /* sem efeito */ }
    fs.unlinkSync(tmp);
  }
})().catch((e) => { console.log('ERRO - ' + e.message); process.exit(1); });