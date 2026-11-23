// apps/api/src/modules/finance/parsers/bb-pdf.parser.ts
// EXTBB-07 (23/11/2026) - Extrato do Banco do Brasil em PDF (texto do pdf-parse, sem OCR).
// Leiaute A "Extrato de Conta" (Mod. 0.51.291-3, mensal): cada campo numa linha; lote sem
//   espaco a esquerda, documento com espaco; complemento (favorecido TED/Pix) na linha seguinte.
// Leiaute B "Extrato de Conta Corrente" (Mod. 0.50.817-2, parcial/consulta): lancamento numa linha so.
// Funcao pura (sem Nest), testavel fora da API; a normalizacao do historico vem por parametro.
import type { ParsedStatement, ParsedTransaction } from './bank-parser.service';

const VAL = String.raw`\d{1,3}(?:\.\d{3})*,\d{2}`;
const RE_VALUE = new RegExp(String.raw`^\s*(${VAL}) ([DC])$`);
const RE_B = new RegExp(String.raw`^(\d{2}/\d{2}/\d{4})(.*?)(\d{1,3}(?:\.\d{3})*)?(${VAL}) ([DC])(?:(${VAL}) ([DC]))?$`);
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const round2 = (n: number) => Math.round(n * 100) / 100;
const digits = (s?: string) => (s ?? '').replace(/\D/g, '');
const docKey = (s?: string) => digits(s).replace(/^0+(?=\d)/, '');
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Data local (mesmo criterio dos demais parsers do modulo)
const dmy = (s: string) => { const [d, m, y] = s.split(/[./]/).map(Number); return new Date(y, m - 1, d); };
const splitDv = (s?: string) => {
  const m = (s ?? '').match(/^([\d.]+)-([\dXx])$/);
  return m ? { base: digits(m[1]).replace(/^0+(?=\d)/, ''), dv: m[2].toUpperCase() } : { base: digits(s), dv: '' };
};
const signed = (v: string, dc: string) => (dc === 'C' ? 1 : -1) * num(v);

function falhar(msg: string): never { throw new Error(msg); }

export function parseBbPdfText(text: string, normalize: (s: string) => string): ParsedStatement {
  const lines = text.replace(/\r/g, '').split('\n');
  if (!text.trim()) falhar('PDF sem texto (imagem digitalizada?) - o LEDGR le apenas PDF com texto.');
  if (lines.some(l => l.trim().startsWith('Extrato de Conta Corrente'))) return parseLayoutB(lines, text, normalize);
  if (lines.some(l => l.trim() === 'Extrato de Conta')) return parseLayoutA(lines, text, normalize);
  return falhar('Extrato do Banco do Brasil em PDF com leiaute nao reconhecido.');
}

// Favorecido: TED "237 0133 028300920000144 NOME" | Pix "10/12 07:27 NOME"
function counterparty(compl: string[]): { name?: string; doc?: string } {
  const c = compl.join(' ').replace(/\s+/g, ' ').trim();
  let m = c.match(/^\d{3} \d{4} (\d{11,15}) (.+)$/);
  if (m) {
    const raw = m[1];
    const doc = raw.length >= 14 ? raw.slice(-14) : raw.padStart(11, '0');
    return { doc, name: m[2].trim() };
  }
  m = c.match(/^\d{2}\/\d{2} \d{2}:\d{2} (.+)$/);
  if (m) return { name: m[1].trim() };
  return {};
}

function buildTx(date: string, hist: string, code: string | undefined, doc: string | undefined,
                 amount: number, dc: string, balance: number | undefined, compl: string[], lineNo: number,
                 normalize: (s: string) => string): ParsedTransaction {
  const description = [hist, ...compl].join(' ').replace(/\s+/g, ' ').trim();
  const cp = counterparty(compl);
  return {
    transactionDate: dmy(date),
    description,
    descriptionNorm: normalize(description),
    amount: round2(amount),
    type: dc === 'D' ? 'DEBIT' : 'CREDIT',
    balance,
    bankRef: doc ? doc.trim() : undefined,
    bankHistCode: code,
    lineNo,
    docKey: docKey(doc) || undefined,
    counterpartyName: cp.name,
    counterpartyDoc: cp.doc,
  };
}

function check(opening: number | undefined, txs: ParsedTransaction[], closing: number | undefined) {
  const mov = txs.reduce((a, t) => a + (t.type === 'CREDIT' ? t.amount : -t.amount), 0);
  const expected = round2((opening ?? 0) + mov);
  const found = round2(closing ?? opening ?? 0);
  return { ok: Math.abs(expected - found) < 0.005, expected, found };
}

// ── Leiaute A ────────────────────────────────────────────────────────────────
interface RawA { date: string; hist?: string; code?: string; lote?: string; doc?: string; values: [string, string][]; compl: string[]; }

function parseLayoutA(lines: string[], text: string, normalize: (s: string) => string): ParsedStatement {
  const pick = (re: RegExp) => { for (const l of lines) { const m = l.trim().match(re); if (m) return m[1]; } return undefined; };
  const cnpj = pick(/^([\d./-]{14,18})CNPJ$/);
  const posicao = pick(/^(\S+\/\d{4})Posi/);
  const emissao = pick(/^(\d{2}\.\d{2}\.\d{4})Data de emiss/);
  const agencia = pick(/^([\d.]+-[\dXx])Ag/);
  const conta = pick(/^([\d.]+-[\dXx])Conta n/);

  const raws: RawA[] = [];
  let inMov = false;
  let cur: RawA | null = null;
  const close = () => { if (cur) raws.push(cur); cur = null; };
  for (const l of lines) {
    const t = l.trim();
    if (t === 'Saldo - R$') { inMov = true; continue; }
    if (!inMov) continue;
    if (t === '' || /^Folha \d+/.test(t) || t.startsWith('Mod. ') || t.startsWith('Bloqueado')) { close(); inMov = false; continue; }
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(t)) { close(); cur = { date: t, values: [], compl: [] }; continue; }
    if (!cur) continue;
    if (!cur.hist) {
      if (/^\d{1,2}$/.test(t)) continue; // coluna "Dia"
      cur.hist = t;
      const m = t.match(/^(\d{3})-/);
      if (m) cur.code = m[1];
      continue;
    }
    const v = l.match(RE_VALUE);
    if (v) { cur.values.push([v[1], v[2]]); continue; }
    if (cur.values.length === 0 && /^\d+$/.test(t)) {
      if (/^\s/.test(l)) cur.doc = t; else cur.lote = t;
      continue;
    }
    cur.compl.push(t);
  }
  close();

  let opening: number | undefined;
  let last: number | undefined;
  const txs: ParsedTransaction[] = [];
  for (const r of raws) {
    if (!r.hist || r.values.length === 0) continue;
    if (/^saldo anterior$/i.test(r.hist)) { opening = signed(r.values[0][0], r.values[0][1]); last = opening; continue; }
    const balance = r.values[1] ? signed(r.values[1][0], r.values[1][1]) : undefined;
    if (balance !== undefined) last = balance;
    txs.push(buildTx(r.date, r.hist, r.code, r.doc, num(r.values[0][0]), r.values[0][1], balance, r.compl, txs.length + 1, normalize));
  }

  let periodFrom: Date | undefined;
  let periodTo: Date | undefined;
  const pm = (posicao ?? '').match(/^(.+)\/(\d{4})$/);
  const mi = pm ? MESES.indexOf(semAcento(pm[1])) : -1;
  if (pm && mi >= 0) { periodFrom = new Date(Number(pm[2]), mi, 1); periodTo = new Date(Number(pm[2]), mi + 1, 0); }
  if (!periodFrom || !periodTo) {
    if (txs.length === 0) falhar('Extrato BB sem posicao (mes/ano) e sem lancamentos.');
    const ts = txs.map(t => t.transactionDate.getTime());
    periodFrom = new Date(Math.min(...ts)); periodTo = new Date(Math.max(...ts));
  }
  const ag = splitDv(agencia);
  const cc = splitDv(conta);
  return {
    bankCode: 'BB', bankName: 'Banco do Brasil S/A',
    agency: agencia, account: conta,
    periodFrom, periodTo,
    openingBalance: opening, closingBalance: last,
    transactions: txs,
    layout: 'BB_PDF_A',
    taxId: digits(cnpj) || undefined,
    issuedAt: emissao ? dmy(emissao) : undefined,
    rawText: text,
    bankNumber: '001',
    agencyNoDv: ag.base, accountNoDv: cc.base,
    balanceCheck: check(opening, txs, last),
  };
}

// ── Leiaute B ────────────────────────────────────────────────────────────────
function parseLayoutB(lines: string[], text: string, normalize: (s: string) => string): ParsedStatement {
  const contas = lines.map(l => l.trim()).filter(t => /^[\d.]+-[\dXx]$/.test(t));
  const agencia = contas[0];
  const conta = contas[1];
  const impresso = lines.map(l => l.trim()).map(t => t.match(/^(\d{2}\.\d{2}\.\d{4})\d{2}:\d{2}:\d{2}$/)).find(Boolean);

  let inMov = false;
  let opening: number | undefined;
  let openingDate: Date | undefined;
  let closing: number | undefined;
  let closingDate: Date | undefined;
  const txs: ParsedTransaction[] = [];
  let cur: { date: string; hist: string; doc?: string; amount: number; dc: string; balance?: number; compl: string[] } | null = null;
  const flush = () => {
    if (cur) txs.push(buildTx(cur.date, cur.hist, undefined, cur.doc, cur.amount, cur.dc, cur.balance, cur.compl, txs.length + 1, normalize));
    cur = null;
  };
  for (const l of lines) {
    const t = l.trim();
    if (t === 'Movimento') { inMov = true; continue; }
    if (!inMov || !t) continue;
    const m = t.match(RE_B);
    if (m) {
      const hist = m[2].trim();
      if (/^saldo anterior$/i.test(hist)) { opening = signed(m[4], m[5]); openingDate = dmy(m[1]); continue; }
      if (/^S A L D O$/.test(hist) || /^saldo$/i.test(hist)) { flush(); closing = signed(m[4], m[5]); closingDate = dmy(m[1]); inMov = false; continue; }
      flush();
      cur = { date: m[1], hist, doc: m[3], amount: num(m[4]), dc: m[5], balance: m[6] ? signed(m[6], m[7]) : undefined, compl: [] };
      continue;
    }
    if (cur) cur.compl.push(t);
  }
  flush();
  if (closing === undefined && txs.length) closing = txs[txs.length - 1].balance;

  const ts = txs.map(x => x.transactionDate.getTime());
  const periodFrom = openingDate ? new Date(openingDate.getFullYear(), openingDate.getMonth(), openingDate.getDate() + 1)
    : (ts.length ? new Date(Math.min(...ts)) : falhar('Extrato BB (consulta) sem saldo anterior e sem lancamentos.'));
  const periodTo = closingDate ?? (ts.length ? new Date(Math.max(...ts)) : periodFrom);
  const ag = splitDv(agencia);
  const cc = splitDv(conta);
  return {
    bankCode: 'BB', bankName: 'Banco do Brasil S/A',
    agency: agencia, account: conta,
    periodFrom, periodTo,
    openingBalance: opening, closingBalance: closing,
    transactions: txs,
    layout: 'BB_PDF_B',
    issuedAt: impresso ? dmy(impresso[1]) : undefined,
    rawText: text,
    bankNumber: '001',
    agencyNoDv: ag.base, accountNoDv: cc.base,
    balanceCheck: check(opening, txs, closing),
  };
}
