// frontend/src/utils/accountMask.ts
// EXTBB-10B (23/11/2026) - Regra: codigo de conta e gravado BRUTO (so digitos); a mascara e so de
// exibicao/digitacao. Mascara da empresa em "0.0.0.00.00.0000" (ou "1.1.1.2.2.4"); padrao LEDGR 1-1-1-2-2-4.
export const DEFAULT_LEVELS = [1, 1, 1, 2, 2, 4];

export function parseMaskLevels(mask?: string | null): number[] {
  if (!mask) return DEFAULT_LEVELS;
  const lv = mask.split('.').map(p => (/^0+$/.test(p) ? p.length : parseInt(p, 10)));
  return lv.length > 0 && lv.every(n => Number.isFinite(n) && n >= 1 && n <= 9) ? lv : DEFAULT_LEVELS;
}

// "11102010002" -> "1.1.1.02.01.0002" (codigo nao numerico volta como veio)
export function formatAccountCode(code?: string | null, levels: number[] = DEFAULT_LEVELS): string {
  const raw = String(code ?? '');
  if (!/^\d+$/.test(raw)) return raw;
  const parts: string[] = [];
  let cur = 0;
  for (const l of levels) {
    const chunk = raw.slice(cur, cur + l);
    if (!chunk) break;
    parts.push(chunk);
    cur += l;
  }
  if (cur < raw.length) parts.push(raw.slice(cur));
  return parts.join('.');
}
