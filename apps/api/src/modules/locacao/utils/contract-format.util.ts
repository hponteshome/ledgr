// apps/api/src/modules/locacao/utils/contract-format.util.ts
// Formatacao (mascaras, datas, labels de enum) para geracao de documentos.
// Regra do projeto: numeros/datas ficam CRUS no banco - formatacao so na exibicao/output.

const MESES_EXTENSO = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  const ano = d.getUTCFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function formatDateExtenso(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const dia = d.getUTCDate();
  const mes = MESES_EXTENSO[d.getUTCMonth()];
  const ano = d.getUTCFullYear();
  return `${dia} de ${mes} de ${ano}`;
}

export function formatCurrencyBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'string' ? Number(value) : value;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatCep(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatCpfCnpj(value: string | null | undefined): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return value;
}

export function monthsBetween(start: Date, end: Date | null | undefined): number {
  if (!end) return 0;
  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  months -= start.getUTCMonth();
  months += end.getUTCMonth();
  return months <= 0 ? 0 : months;
}

const MARITAL_STATUS_LABEL: Record<string, string> = {
  SOLTEIRO: 'solteiro(a)',
  CASADO: 'casado(a)',
  UNIAO_ESTAVEL: 'em uniao estavel',
  SEPARADO: 'separado(a) judicialmente',
  DIVORCIADO: 'divorciado(a)',
  VIUVO: 'viuvo(a)',
};

export function maritalStatusLabel(value: string | null | undefined): string {
  if (!value) return '';
  return MARITAL_STATUS_LABEL[value] ?? value;
}

const GUARANTEE_TYPE_LABEL: Record<string, string> = {
  FIANCA: 'Fianca',
  SEGURO_FIANCA: 'Seguro Fianca',
  CAUCAO: 'Caucao',
  OUTROS: 'Outros',
};

export function guaranteeTypeLabel(value: string | null | undefined): string {
  if (!value) return '';
  return GUARANTEE_TYPE_LABEL[value] ?? value;
}

const READJUSTMENT_INDEX_LABEL: Record<string, string> = {
  IGPM: 'IGP-M/FGV',
  IPCA: 'IPCA/IBGE',
  INPC: 'INPC/IBGE',
  IGPDI: 'IGP-DI/FGV',
};

export function readjustmentIndexLabel(value: string | null | undefined, other: string | null | undefined): string {
  if (!value) return '';
  if (value === 'OUTRO') return other ?? 'indice pactuado entre as partes';
  return READJUSTMENT_INDEX_LABEL[value] ?? value;
}
