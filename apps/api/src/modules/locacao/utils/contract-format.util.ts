// apps/api/src/modules/locacao/utils/contract-format.util.ts
// Formatacao (mascaras, datas, labels de enum) para geracao de documentos.
// Regra do projeto: numeros/datas ficam CRUS no banco - formatacao so na exibicao/output.

const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

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

// [masculino, feminino, neutro] - flexao pelo genero gramatical (29/09/2026)
const MARITAL_STATUS_LABEL: Record<string, [string, string, string]> = {
  SOLTEIRO: ['solteiro', 'solteira', 'solteiro(a)'],
  CASADO: ['casado', 'casada', 'casado(a)'],
  UNIAO_ESTAVEL: ['em união estável', 'em união estável', 'em união estável'],
  SEPARADO: ['separado judicialmente', 'separada judicialmente', 'separado(a) judicialmente'],
  DIVORCIADO: ['divorciado', 'divorciada', 'divorciado(a)'],
  VIUVO: ['viúvo', 'viúva', 'viúvo(a)'],
};

export function maritalStatusLabel(value: string | null | undefined, g: Genero = null): string {
  if (!value) return '';
  const f = MARITAL_STATUS_LABEL[value];
  if (!f) return value;
  return g === 'M' ? f[0] : g === 'F' ? f[1] : f[2];
}

const GUARANTEE_TYPE_LABEL: Record<string, string> = {
  FIANCA: 'Fiança',
  SEGURO_FIANCA: 'Seguro-fiança',
  CAUCAO: 'Caução',
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
  if (value === 'OUTRO') return other ?? 'índice pactuado entre as partes';
  return READJUSTMENT_INDEX_LABEL[value] ?? value;
}

// Genero gramatical (29/09/2026): 'M' | 'F' | null. PJ (CNPJ com 14 digitos) sem
// genero informado assume feminino ("a LOCATARIA"). Nulo mantem as formas neutras "(a)".
export type Genero = 'M' | 'F' | null;

export function resolveGender(value: string | null | undefined, taxId: string | null | undefined): Genero {
  if (value === 'M' || value === 'F') return value;
  if (taxId && taxId.replace(/\D/g, '').length === 14) return 'F';
  return null;
}

function g3(g: Genero, m: string, f: string, n: string): string {
  return g === 'M' ? m : g === 'F' ? f : n;
}

export function termosLocatario(g: Genero) {
  return {
    TITULO: g3(g, 'LOCATÁRIO', 'LOCATÁRIA', 'LOCATÁRIO(A)'),
    Titulo: g3(g, 'Locatário', 'Locatária', 'Locatário(a)'),
    o: g3(g, 'o', 'a', 'o(a)'),
    O: g3(g, 'O', 'A', 'O(A)'),
    ao: g3(g, 'ao', 'à', 'ao(à)'),
    do: g3(g, 'do', 'da', 'do(a)'),
    pelo: g3(g, 'pelo', 'pela', 'pelo(a)'),
    portador: g3(g, 'portador', 'portadora', 'portador(a)'),
    inscrito: g3(g, 'inscrito', 'inscrita', 'inscrito(a)'),
    domiciliado: g3(g, 'residente e domiciliado', 'residente e domiciliada', 'residente e domiciliado(a)'),
    denominado: g3(g, 'denominado', 'denominada', 'denominado(a)'),
  };
}

export function termosFiador(g: Genero) {
  return {
    TITULO: g3(g, 'FIADOR', 'FIADORA', 'FIADOR(A)'),
    Titulo: g3(g, 'Fiador', 'Fiadora', 'Fiador(a)'),
    o: g3(g, 'o', 'a', 'o(a)'),
    do: g3(g, 'do', 'da', 'do(a)'),
    casado: g3(g, 'casado', 'casada', 'casado(a)'),
  };
}
