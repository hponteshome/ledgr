
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