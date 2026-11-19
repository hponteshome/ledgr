// apps/api/src/modules/situacao-fiscal/recibo-texto.ts
// ALERTA-AUTO-01 (19/11/2026): texto de recibos em PDF (Receita Federal), pagina a pagina.
// 1o pdf-parse (pdf.js); se falhar ou nao trouxer texto, leitura direta dos fluxos de conteudo
// (recibos gerados pelo ReceitaNet tem xref invalido, que o pdf.js antigo recusa).
import * as zlib from 'zlib';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

const desescapa = (s: string) => s.replace(/\\([nrtbf()\\]|[0-7]{1,3}|\r?\n)/g, (_m, c: string) => {
  if (/^[0-7]+$/.test(c)) return String.fromCharCode(parseInt(c, 8));
  return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' } as Record<string, string>)[c] ?? '';
});

/** Junta itens de texto em linhas pela posicao (y de cima para baixo, x da esquerda para a direita). */
function emLinhas(itens: { x: number; y: number; t: string }[]): string {
  const ord = [...itens].sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: { y: number; p: { x: number; t: string }[] }[] = [];
  for (const it of ord) {
    const l = linhas.find(q => Math.abs(q.y - it.y) <= 2);
    if (l) l.p.push({ x: it.x, t: it.t }); else linhas.push({ y: it.y, p: [{ x: it.x, t: it.t }] });
  }
  return linhas.map(l => l.p.sort((a, b) => a.x - b.x).map(p => p.t.trim()).filter(Boolean).join(' ')).join('\n');
}

/** Texto por pagina lido direto dos fluxos de conteudo (Tm/Td/Tj/TJ), linhas ordenadas por posicao. */
export function textoBruto(buf: Buffer): string[] {
  const s = buf.toString('latin1');
  const paginas: string[] = [];
  const reStream = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = reStream.exec(s))) {
    const bruto = Buffer.from(m[1], 'latin1');
    let d: string;
    try { d = zlib.inflateSync(bruto).toString('latin1'); } catch { d = bruto.toString('latin1'); }
    if (!/\bBT\b/.test(d) || !/T[jJ]\b/.test(d)) continue;
    const itens: { x: number; y: number; t: string }[] = [];
    let x = 0, y = 0, lx = 0, ly = 0;
    const tok = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm\b|(-?[\d.]+)\s+(-?[\d.]+)\s+T[dD]\b|\(((?:\\[\s\S]|[^\\)])*)\)\s*(?:Tj|'|")|\[((?:\((?:\\[\s\S]|[^\\)])*\)|[^\]])*)\]\s*TJ|T\*/g;
    let t: RegExpExecArray | null;
    while ((t = tok.exec(d))) {
      if (t[5] !== undefined) { x = lx = parseFloat(t[5]); y = ly = parseFloat(t[6]); }
      else if (t[7] !== undefined) { x = lx = lx + parseFloat(t[7]); y = ly = ly + parseFloat(t[8]); }
      else if (t[9] !== undefined) { const v = desescapa(t[9]); if (v.trim()) itens.push({ x, y, t: v }); }
      else if (t[10] !== undefined) {
        const v = (t[10].match(/\((?:\\[\s\S]|[^\\)])*\)/g) ?? []).map(p => desescapa(p.slice(1, -1))).join('');
        if (v.trim()) itens.push({ x, y, t: v });
      } else { y = ly = ly - 12; }
    }
    if (!itens.length) continue;
    paginas.push(emLinhas(itens));
  }
  return paginas;
}

/** Texto por pagina (ate maxPaginas), linhas pela posicao na pagina. Nunca lanca erro: devolve [] se nada for legivel.
 *  1o leitura direta dos fluxos (deterministica; recibos do ReceitaNet), depois pdf-parse (PDFs com fontes/objetos compactados). */
export async function textoPorPagina(buf: Buffer, maxPaginas = 10): Promise<string[]> {
  try {
    const diretas = textoBruto(buf).slice(0, maxPaginas);
    if (diretas.some(p => p.trim().length > 20)) return diretas;
  } catch { /* segue para o pdf-parse */ }
  const paginas: string[] = [];
  try {
    await pdfParse(buf, {
      max: maxPaginas,
      pagerender: (pd: any) => pd.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false }).then((tc: any) => {
        const txt = emLinhas((tc.items ?? []).map((it: any) => ({ x: Number(it.transform?.[4] ?? 0), y: Number(it.transform?.[5] ?? 0), t: String(it.str ?? '') })).filter((it: any) => it.t.trim()));
        paginas.push(txt); return txt;
      }),
    });
  } catch { return []; }
  return paginas;
}