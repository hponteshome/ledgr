
// src/utils/formatters.ts

export const formatCNPJ = (v: string) => 
  v?.replace(/\D/g, '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5") || '---';

export const formatCurrency = (v: any) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

export const formatDate = (v: any) => v ? new Date(v).toLocaleDateString('pt-BR') : '---';

export const cleanRaw = (v: string) => v?.replace(/\D/g, '') || '';

// ADICIONE ESTA FUNÇÃO:
export const formatPercent = (v: any) => {
  const n = parseFloat(v) || 0;
  return n.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }) + '%';
};

/// Normaliza competência para YYYY-MM.
/// Aceita: "01/25", "0125", "01-25", "01/2025", "012025", "01-2025",
///         "2025-01", "2025/01" (já no formato correto)
export function parseCompetencia(raw: string): string {
  const s = raw.trim().replace(/\s/g, '');
  if (!s) return '';

  // Já no formato YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // YYYY/MM
  if (/^\d{4}\/\d{2}$/.test(s)) return s.replace('/', '-');

  // MM/AAAA ou MM-AAAA
  const m4 = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m4) return m4[2] + '-' + m4[1].padStart(2, '0');

  // MM/AA ou MM-AA
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (m2) {
    const yr = parseInt(m2[2]) >= 0 ? '20' + m2[2] : m2[2];
    return yr + '-' + m2[1].padStart(2, '0');
  }

  // MMAAAA (6 digits)
  if (/^\d{6}$/.test(s)) return s.slice(2) + '-' + s.slice(0, 2);

  // MMAA (4 digits)
  if (/^\d{4}$/.test(s)) return '20' + s.slice(2) + '-' + s.slice(0, 2);

  return s;
}
