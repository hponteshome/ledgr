// apps/api/src/modules/dimob/dimob-layout.ts
// LEDGR - DIMOB: leiaute do arquivo de importacao do PGD Dimob 2.8g (conferido em 12/11/2026 - claude/dimob-leiaute-importacao.md)
// Funcoes puras (sem Nest/Prisma): Header, R01, R02 (801 c/ EOL, sequencial de 7), T9. ASCII 0x20-0x7E, EOL CRLF.

export interface DimobDeclarante {
  cnpj: string; ano: number; nome: string; cpfResponsavel: string;
  endereco: string; uf: string; municipio: string; // municipio: codigo RFB (4)
}
export interface DimobLocacao {
  contratoId: string; numero: string; dataContrato: string | null; // YYYY-MM-DD
  locadorDoc: string; locadorNome: string; locatarioDoc: string | null; locatarioNome: string;
  tipo: 'U' | 'R'; endereco: string; cep: string; municipio: string | null; uf: string;
  meses: { aluguel: number; comissao: number; imposto: number }[]; // 12 posicoes
}

export const ascii = (s: any) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[ºª°]/g, '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
export const digits = (s: any) => String(s ?? '').replace(/\D/g, '');
export const X = (s: any, n: number) => ascii(s).slice(0, n).padEnd(n, ' ');
export const N = (s: any, n: number) => { const d = digits(s); if (d.length > n) throw new Error(`Campo numerico excede ${n} posicoes: ${d}`); return d.padStart(n, '0'); };
export const V = (v: number) => { const c = Math.round((Number(v) || 0) * 100); if (c < 0) throw new Error(`Valor negativo na DIMOB: ${v}`); return String(c).padStart(14, '0'); };
export const DT = (iso: string | null) => (iso ? iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(0, 4) : '00000000');
export const DOC = (doc: string | null) => {
  const d = digits(doc);
  if (d.length === 14) return d;
  if (d.length === 11) return d + '   ';
  return X('', 14);
};

export function cpfValido(c: string) {
  const d = digits(c); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (const t of [9, 10]) { let s = 0; for (let i = 0; i < t; i++) s += +d[i] * (t + 1 - i); const r = (s * 10) % 11 % 10; if (r !== +d[t]) return false; }
  return true;
}
export function cnpjValido(c: string) {
  const d = digits(c); if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => { const w = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; let s = 0; for (let i = 0; i < n; i++) s += +d[i] * w[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return calc(12) === +d[12] && calc(13) === +d[13];
}
export const docValido = (doc: string | null) => { const d = digits(doc); return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false; };

export function header() { return 'DIMOB' + ' '.repeat(369); }

export function r01(d: DimobDeclarante) {
  const l = 'R01' + N(d.cnpj, 14) + N(d.ano, 4) + '0' + N('', 10) + '0' + N('', 8) + '00'
    + X(d.nome, 60) + N(d.cpfResponsavel, 11) + X(d.endereco, 120) + X(d.uf, 2) + N(d.municipio, 4) + ' '.repeat(20) + ' '.repeat(10);
  if (l.length !== 270) throw new Error('R01 com tamanho ' + l.length);
  return l;
}

export function r02(d: DimobDeclarante, seq: number, x: DimobLocacao) {
  if (x.meses.length !== 12) throw new Error('R02 precisa de 12 meses');
  const meses = x.meses.map(m => V(m.aluguel) + V(m.comissao) + V(m.imposto)).join('');
  const l = 'R02' + N(d.cnpj, 14) + N(d.ano, 4) + N(seq, 7) + DOC(x.locadorDoc) + X(x.locadorNome, 60)
    + DOC(x.locatarioDoc) + X(x.locatarioNome, 60) + X(x.numero, 6) + DT(x.dataContrato) + meses
    + X(x.tipo, 1) + X(x.endereco, 60) + N(x.cep, 8) + N(x.municipio ?? '', 4) + ' '.repeat(20) + X(x.uf, 2) + ' '.repeat(10);
  if (l.length !== 799) throw new Error('R02 com tamanho ' + l.length);
  return l;
}

export function trailer() { return 'T9' + ' '.repeat(100); }

export function arquivo(d: DimobDeclarante, locacoes: DimobLocacao[]) {
  const linhas = [header(), r01(d), ...locacoes.map((x, i) => r02(d, i + 1, x)), trailer()];
  return linhas.join('\r\n') + '\r\n';
}
