// scripts/projetos/carga-premissas-bp.js
// Kit do Investidor - Etapa 1 (05/10/2026): carrega as ENTRADAS do BP (planilha BP_Investidores_...xlsx) como uma versao de
// premissas, RECALCULA o que a planilha calcula e COMPARA valor a valor. Divergencia = nada e gravado. Mesmo arquivo (hash)
// ja carregado = nada e duplicado. Parametros contratuais confirmados pelo Hpontes em 05/10/2026 entram com essa fonte.
// A planilha foi gerada com XML prefixado (x:) e celulas mescladas repetidas, que o exceljs nao le: o arquivo e normalizado
// em memoria (sem alterar o original) antes da leitura. Uso: node scripts/projetos/carga-premissas-bp.js [arquivo]
// KIT_DRYRUN=1 confere sem acessar o banco.
const path = require('path'); const fs = require('fs'); const os = require('os'); const crypto = require('crypto');
const { execFileSync } = require('child_process');
const exPath = require.resolve('exceljs', { paths: [path.join(__dirname, '..', '..', 'apps', 'api'), path.join(__dirname, '..', '..')] });
const ExcelJS = require(exPath);
const JSZip = require(require.resolve('jszip', { paths: [path.dirname(exPath), path.join(__dirname, '..', '..', 'apps', 'api'), path.join(__dirname, '..', '..')] }));
const ARQ = process.argv[2] || 'D:/Dados/RecifeOcean/BP_Investidores_Waterfall_Cronograma_Atualizado.xlsx';
const SECO = !!process.env.KIT_DRYRUN;
const DECISAO = 'Decisao do Hpontes em 05/10/2026';
const val = (c) => { const x = c && c.value; if (x === null || x === undefined) return null; if (typeof x === 'object' && !(x instanceof Date)) return x.result !== undefined ? x.result : (x.richText ? x.richText.map((t) => t.text).join('') : (x.text ?? null)); return x; };
const txt = (x) => String(x ?? '').trim();
function linha(ws, rotulo) { let r = null; ws.eachRow((row) => { if (!r && txt(val(row.getCell(1))) === String(rotulo)) r = row; }); if (!r) throw new Error(`[${ws.name}] linha "${rotulo}" nao encontrada`); return r; }
function num(ws, rotulo, col) { const x = val(linha(ws, rotulo).getCell(col)); const n = typeof x === 'number' ? x : Number(String(x).replace(',', '.')); if (!isFinite(n)) throw new Error(`[${ws.name}] "${rotulo}" coluna ${col} nao numerica: ${x}`); return n; }
const q = (s) => s === null || s === undefined ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'";
const psql = (sql) => {
  if (SECO) return '';
  const tmp = path.join(os.tmpdir(), 'premissas-' + Date.now() + '.sql'); fs.writeFileSync(tmp, sql, 'utf8');
  try { execFileSync('docker', ['cp', tmp, 'ledgr-postgres:/tmp/premissas.sql']); return execFileSync('docker', ['exec', 'ledgr-postgres', 'psql', '-U', 'ledgr', '-d', 'ledgr_app', '-v', 'ON_ERROR_STOP=1', '-tA', '-f', '/tmp/premissas.sql'], { encoding: 'utf8' }).trim(); }
  finally { try { execFileSync('docker', ['exec', 'ledgr-postgres', 'rm', '-f', '/tmp/premissas.sql']); } catch (e) { /* sem efeito */ } fs.unlinkSync(tmp); }
};
async function normalizar(buf) {
  const zip = await JSZip.loadAsync(buf);
  for (const n of Object.keys(zip.files)) {
    if (!/\.(xml|rels)$/.test(n)) continue;
    const s = await zip.file(n).async('string');
    let t = s.replace(/<(\/?)x:/g, '<$1').replace(/xmlns:x=/g, 'xmlns=');
    if (/worksheets\/sheet\d+\.xml$/.test(n)) t = t.replace(/<mergeCells[\s\S]*?<\/mergeCells>/g, '');
    if (t !== s) zip.file(n, t);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}
function waterfall(resultado, passivo, faixas) {
  let resto = resultado, recebido = 0, anterior = 0;
  for (const f of faixas) {
    const alvo = f.ateMoic === null ? Infinity : (f.ateMoic - anterior) * passivo;
    const consumo = alvo === Infinity ? resto : Math.min(resto, alvo / f.pct);
    recebido += consumo * f.pct; resto -= consumo; anterior = f.ateMoic ?? anterior;
    if (resto <= 1e-6) break;
  }
  return recebido;
}
(async () => {
  const buf = fs.readFileSync(ARQ); const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const ja = psql(`SELECT numero FROM proj_premissa_versoes WHERE arquivo_sha256 = '${sha}' AND cancelado_em IS NULL LIMIT 1;`);
  if (ja) { console.log(`Este arquivo ja esta carregado como versao ${ja}. Nada foi alterado.`); return; }
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await normalizar(buf));
  const bp = wb.getWorksheet('BP_Dez2025'), pr = wb.getWorksheet('Premissas'), se = wb.getWorksheet('Sensibilidade'), wf = wb.getWorksheet('Waterfall_Investidor');
  if (!bp || !pr || !se || !wf) throw new Error('abas esperadas nao encontradas (BP_Dez2025, Premissas, Sensibilidade, Waterfall_Investidor)');
  const P = []; let ordem = 0;
  const add = (op, grupo, codigo, nome, o) => P.push({ op, grupo, codigo, nome, ordem: ++ordem, valor_num: null, valor_texto: null, valor_data: null, unidade: null, ...o });
  const BP = [['VALOR_MEDIO_COTA', 'Valor médio da cota', 'R$'], ['VALOR_MEDIO_PARCELA', 'Valor médio parcela', 'R$'], ['VALOR_MEDIO_AREA_PRIVATIVA', 'Valor médio área privativa', 'R$/m2'],
    ['VGV', 'VGV', 'R$'], ['RECEITAS', 'Receitas', 'R$'], ['DESPESAS', 'Despesas', 'R$'], ['RESULTADO', 'Resultado do empreendimento', 'R$'], ['VPL_6', 'VPL comparável a 6% a.a.', 'R$'],
    ['EXPOSICAO_MAXIMA', 'Exposição máxima', 'R$'], ['MARGEM', 'Margem resultado / receita', '%'], ['ROE', 'ROE resultado / exposição', 'x'], ['TIR_MENSAL', 'TIR mensal', '% a.m.'], ['TIR_ANUAL', 'TIR anual', '% a.a.']];
  BP.forEach(([c, r, u]) => add(null, 'BP_2018', c, r + ' (BP original 2018)', { valor_num: num(bp, r, 2), unidade: u, fonte: `BP_Dez2025, coluna "2018 Original", linha "${r}"` }));
  const IPCA = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
  IPCA.forEach((a) => add(null, 'REEXPRESSAO', 'IPCA_' + a, 'IPCA ' + a, { valor_num: num(pr, 'IPCA ' + a, 2), unidade: '%', fonte: `Premissas, linha "IPCA ${a}" (IBGE)` }));
  add(null, 'REEXPRESSAO', 'DATA_BASE_REEXPRESSAO', 'Data-base da reexpressão', { valor_data: '2025-12-31', valor_texto: 'dez/2025', fonte: 'BP_Dez2025 (base dez/2025)' });
  [['COTAS', 'Cotas', 'un.'], ['UH', 'U.H.', 'un.'], ['VELOCIDADE_VENDA', 'Velocidade de venda', 'meses'], ['PARCELAS', 'Parcelas', 'un.'], ['TAXA_VPL', 'Taxa VPL original', '% a.a.'], ['SELIC_REF', 'Selic dez/2025', '% a.a.']]
    .forEach(([c, r, u]) => add(null, 'PRODUTO', c, r, { valor_num: num(pr, r, 2), unidade: u, fonte: `Premissas, linha "${r}"` }));
  const CEN = [['ESTRESSE', 'Estresse'], ['CONSERVADOR', 'Conservador'], ['BASE', 'Base'], ['UPSIDE', 'Upside'], ['UPSIDE_MAIS', 'Upside +']];
  CEN.forEach(([c, r]) => {
    add(null, 'SENSIBILIDADE', 'SENS_' + c + '_RECEITA', r + ': variação de preço/receita', { valor_num: num(se, r, 2), unidade: '%', fonte: `Sensibilidade, linha "${r}", coluna "Preço / Receita"` });
    add(null, 'SENSIBILIDADE', 'SENS_' + c + '_DESPESA', r + ': variação de despesas', { valor_num: num(se, r, 3), unidade: '%', fonte: `Sensibilidade, linha "${r}", coluna "Despesas"` });
  });
  const passivo = num(pr, 'Passivo assumido pelo Investidor Estratégico', 2);
  const faixas = [1, 2, 3, 4].map((f) => ({ pct: num(wf, f, 3), ateMoic: f < 4 ? num(wf, f, 7) : null }));
  add('REAL', 'CONTRATO_REAL', 'PASSIVO_REFERENCIA', 'Passivo de referência assumido', { valor_num: passivo, unidade: 'R$', fonte: 'Premissas, linha "Passivo assumido pelo Investidor Estratégico"' });
  add('REAL', 'CONTRATO_REAL', 'DATA_ASSUNCAO_PASSIVO', 'Data da assunção do passivo', { valor_data: '2025-10-31', valor_texto: '31/10/2025', fonte: 'Premissas, linha "Data da assunção do passivo"' });
  add('REAL', 'CONTRATO_REAL', 'INICIO_ESTRUTURACAO', 'Início da Estruturação', { valor_data: '2027-01-01', valor_texto: 'jan/2027', fonte: DECISAO });
  add('REAL', 'CONTRATO_REAL', 'INICIO_PARTICIPACAO', 'Início da participação nos resultados', { valor_texto: 'a definir, após a Estruturação', fonte: DECISAO });
  faixas.forEach((f, i) => {
    add('REAL', 'CONTRATO_REAL', `FAIXA_${i + 1}_PCT`, `Faixa ${i + 1}: participação no CDE`, { valor_num: f.pct, unidade: '%', fonte: `Waterfall_Investidor, faixa ${i + 1}, coluna "Participação do Investidor"` });
    if (f.ateMoic !== null) add('REAL', 'CONTRATO_REAL', `FAIXA_${i + 1}_ATE_MOIC`, `Faixa ${i + 1}: até o MOIC`, { valor_num: f.ateMoic, unidade: 'x', fonte: `Waterfall_Investidor, faixa ${i + 1}, coluna "MOIC acumulado"` });
  });
  add('ANCORA', 'META_ANCORA', 'META_COTA_SENIOR', 'Meta da cota sênior do Cliente Âncora', { valor_num: 5000000, unidade: 'R$', fonte: DECISAO });
  add('ANCORA', 'META_ANCORA', 'CRITERIO_META', 'Critério de conclusão da meta', { valor_texto: 'saldo líquido da Conta Individual (vinculados menos devoluções ao Adquirente)', fonte: DECISAO });
  add('ANCORA', 'META_ANCORA', 'INICIO_OPERACAO', 'Início da Operação Âncora', { valor_data: '2024-08-01', valor_texto: 'ago/2024', fonte: DECISAO + ' (confirmado pelo extrato)' });

  const g = (c) => P.find((p) => p.codigo === c).valor_num;
  const linhas = []; let diverge = 0;
  const conf = (nome, plan, calc) => { const d = Math.abs(plan) > 1e-12 ? Math.abs(calc - plan) / Math.abs(plan) : Math.abs(calc - plan); const ok = d < 1e-6; if (!ok) diverge++; linhas.push([nome, plan, calc, ok ? 'OK' : 'DIVERGE']); };
  const fator = IPCA.reduce((f, a) => f * (1 + g('IPCA_' + a)), 1);
  conf('Fator IPCA acumulado', num(pr, 'Fator IPCA acumulado', 2), fator);
  const mon = ['VALOR_MEDIO_COTA', 'VALOR_MEDIO_PARCELA', 'VALOR_MEDIO_AREA_PRIVATIVA', 'VGV', 'RECEITAS', 'DESPESAS', 'VPL_6', 'EXPOSICAO_MAXIMA'];
  const dez = {};
  BP.forEach(([c, r]) => { if (mon.includes(c)) { dez[c] = g(c) * fator; conf(r + ' (dez/2025)', num(bp, r, 3), dez[c]); } });
  dez.RESULTADO = dez.RECEITAS + dez.DESPESAS; conf('Resultado do empreendimento (dez/2025)', num(bp, 'Resultado do empreendimento', 3), dez.RESULTADO);
  conf('Margem resultado / receita', num(bp, 'Margem resultado / receita', 3), dez.RESULTADO / dez.RECEITAS);
  conf('ROE resultado / exposição', num(bp, 'ROE resultado / exposição', 3), dez.RESULTADO / Math.abs(dez.EXPOSICAO_MAXIMA));
  conf('TIR anual (capitalização mensal)', num(bp, 'TIR anual', 3), Math.pow(1 + g('TIR_MENSAL'), 12) - 1);
  CEN.forEach(([c, r]) => conf('Sensibilidade ' + r + ' (resultado)', num(se, r, 6), dez.RECEITAS * (1 + g('SENS_' + c + '_RECEITA')) + dez.DESPESAS * (1 + g('SENS_' + c + '_DESPESA'))));
  const ancoraPlan = num(pr, 'Cliente Âncora — aportes 2024/2025', 2);
  const cotasEq = ancoraPlan / dez.VALOR_MEDIO_COTA;
  conf('Cotas equivalentes do Cliente Âncora (R$ 3,45 mi)', num(pr, 'Cotas equivalentes do Cliente Âncora', 2), cotasEq);
  const elegPlan = dez.RESULTADO * (1 - cotasEq / g('COTAS'));
  conf('Resultado elegível indicativo (R$ 3,45 mi)', num(pr, 'Resultado elegível indicativo pós-início', 2), elegPlan);
  conf('Recebimento total do Investidor (R$ 3,45 mi)', num(wf, 'Recebimento total do Investidor', 2), waterfall(elegPlan, passivo, faixas));
  console.log('Conferencia (planilha x calculado pelo LEDGR):');
  linhas.forEach(([n, p, c, s]) => console.log(`  ${s.padEnd(7)} ${n.padEnd(52)} ${p.toFixed(6).padStart(22)} ${c.toFixed(6).padStart(22)}`));
  const cotasSenior = 5000000 / dez.VALOR_MEDIO_COTA;
  const elegSenior = dez.RESULTADO * (1 - cotasSenior / g('COTAS'));
  const recSenior = waterfall(elegSenior, passivo, faixas);
  console.log(`\nCom a cota senior de R$ 5 mi: cotas equivalentes ${cotasSenior.toFixed(2)}; resultado elegivel R$ ${(elegSenior / 1e6).toFixed(2)} mi; recebimento indicativo R$ ${(recSenior / 1e6).toFixed(2)} mi; MOIC ${(recSenior / passivo).toFixed(3)}x`);
  console.log(`Premissas a gravar: ${P.length}`);
  if (diverge) { console.log(`\n${diverge} DIVERGENCIA(S) - NADA FOI GRAVADO.`); process.exit(1); }
  if (SECO) { console.log('\nKIT_DRYRUN: conferencia concluida, nada gravado.'); return; }

  const valores = P.map((p) => `(${q(p.op)}, ${q(p.grupo)}, ${q(p.codigo)}, ${q(p.nome)}, ${p.valor_num === null ? 'NULL::numeric' : p.valor_num + '::numeric'}, ${q(p.valor_texto)}, ${p.valor_data ? `DATE '${p.valor_data}'` : 'NULL::date'}, ${q(p.unidade)}, ${q(p.fonte)}, ${p.ordem})`).join(',\n');
  const r = psql(`BEGIN;
WITH proj AS (SELECT id FROM proj_projetos WHERE codigo = 'RECIFE-OCEAN'),
v AS (INSERT INTO proj_premissa_versoes (projeto_id, numero, descricao, data_base, arquivo_origem, arquivo_sha256, criado_por_id)
      SELECT proj.id, COALESCE((SELECT max(numero) FROM proj_premissa_versoes x WHERE x.projeto_id = proj.id), 0) + 1,
             'BP reexpresso a dez/2025 + parametros contratuais (REAL) e meta da cota senior (Ancora)', DATE '2025-12-31', ${q(path.basename(ARQ))}, '${sha}',
             (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') FROM proj RETURNING id, numero, projeto_id)
INSERT INTO proj_premissas (versao_id, operacao_id, grupo, codigo, nome, valor_num, valor_texto, valor_data, unidade, fonte, ordem)
SELECT v.id, (SELECT o.id FROM proj_operacoes o WHERE o.projeto_id = v.projeto_id AND o.codigo = t.op), t.grupo, t.codigo, t.nome, t.valor_num, t.valor_texto, t.valor_data, t.unidade, t.fonte, t.ordem
FROM v, (VALUES ${valores}) AS t(op, grupo, codigo, nome, valor_num, valor_texto, valor_data, unidade, fonte, ordem);
COMMIT;
SELECT 'versao ' || v.numero || ': ' || count(p.*) || ' premissas' FROM proj_premissa_versoes v JOIN proj_premissas p ON p.versao_id = v.id WHERE v.arquivo_sha256 = '${sha}' GROUP BY v.numero;`);
  console.log('\nGravado: ' + r.split('\n').pop());
})().catch((e) => { console.log('ERRO - ' + e.message); process.exit(1); });