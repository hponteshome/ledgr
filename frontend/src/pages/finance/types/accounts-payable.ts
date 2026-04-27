// ============================================================
// LEDGR — apps/web/src/types/accounts-payable.ts
// ============================================================

export type APStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type APOrigin = 'FISCAL_DOCUMENT' | 'MANUAL' | 'PAYROLL' | 'BOLETO_IMPORT';
export type PaymentMethod =
  | 'PIX' | 'TED' | 'DOC' | 'BOLETO'
  | 'CHEQUE' | 'DINHEIRO' | 'DEBITO_AUTOMATICO' | 'OUTROS';

export interface APPayment {
  id: string;
  accountsPayableId: string;
  paidAt: string;
  amount: string;
  discountApplied: string;
  interestApplied: string;
  fineApplied: string;
  paymentMethod: PaymentMethod;
  bankAccount: string | null;
  receiptRef: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AccountsPayable {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  origin: APOrigin;
  documentNumber: string | null;
  barCode: string | null;
  supplierCnpj: string | null;
  supplierName: string | null;
  grossAmount: string;
  discountAmount: string;
  interestAmount: string;
  fineAmount: string;
  netAmount: string;
  paidAmount: string;
  issueDate: string;
  dueDate: string;
  competenceMonth: string;
  status: APStatus;
  installmentNumber: number;
  totalInstallments: number;
  parentId: string | null;
  expenseAccountId: string | null;
  costCenter: string | null;
  categoryTag: string | null;
  fiscalDocumentId: string | null;
  agendaEventId: string | null;
  notes: string | null;
  createdAt: string;
  payments?: APPayment[];
}

export interface APSummary {
  open: number;
  overdue: number;
  dueWeek: number;
  paidMonth: number;
  totalOpen: number;
  totalOverdue: number;
}

export interface APListResponse {
  data: AccountsPayable[];
  total: number;
  summary: APSummary;
}

export interface APAgingBucket {
  count: number;
  total: string;
}

export interface APPositionReport {
  refDate: string;
  grandTotal: string;
  totalTitles: number;
  buckets: {
    overdue90plus: APAgingBucket;
    overdue60_90:  APAgingBucket;
    overdue30_60:  APAgingBucket;
    overdue1_30:   APAgingBucket;
    dueToday:      APAgingBucket;
    due7:          APAgingBucket;
    due30:         APAgingBucket;
    dueFuture:     APAgingBucket;
  };
  topSuppliers: { name: string; total: string }[];
  byCategory:   { name: string; total: string }[];
}

// ── Labels e helpers ─────────────────────────────────────────

export const AP_STATUS_LABEL: Record<APStatus, string> = {
  OPEN:      'Em aberto',
  PARTIAL:   'Parcial',
  PAID:      'Pago',
  OVERDUE:   'Vencido',
  CANCELLED: 'Cancelado',
};

export const AP_STATUS_COLORS: Record<APStatus, { bg: string; text: string; border: string }> = {
  OPEN:      { bg: '#E6F1FB', text: '#185FA5', border: '#64B5F6' },
  PARTIAL:   { bg: '#FAEEDA', text: '#854F0B', border: '#FFB74D' },
  PAID:      { bg: '#EAF3DE', text: '#3B6D11', border: '#81C784' },
  OVERDUE:   { bg: '#FFCDD2', text: '#8B0000', border: '#E57373' },
  CANCELLED: { bg: '#F5F5F5', text: '#777777', border: '#CCCCCC' },
};

export const AP_ORIGIN_LABEL: Record<APOrigin, string> = {
  FISCAL_DOCUMENT: 'Doc. Fiscal',
  MANUAL:          'Manual',
  PAYROLL:         'Folha',
  BOLETO_IMPORT:   'Boleto',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  PIX:              'PIX',
  TED:              'TED',
  DOC:              'DOC',
  BOLETO:           'Boleto',
  CHEQUE:           'Cheque',
  DINHEIRO:         'Dinheiro',
  DEBITO_AUTOMATICO:'Débito Autom.',
  OUTROS:           'Outros',
};

// Calcula o status de aging para uma data de vencimento
export function getAgingStatus(dueDate: string, status: APStatus): {
  label: string; color: string; days: number;
} {
  if (status === 'PAID')      return { label: 'Pago', color: '#3B6D11', days: 0 };
  if (status === 'CANCELLED') return { label: 'Cancelado', color: '#777', days: 0 };

  const diff = Math.floor((new Date(dueDate).getTime() - Date.now()) / 86400000);

  if (diff < -90) return { label: `${Math.abs(diff)}d atraso`, color: '#6B0000', days: diff };
  if (diff < -30) return { label: `${Math.abs(diff)}d atraso`, color: '#A32D2D', days: diff };
  if (diff < 0)   return { label: `${Math.abs(diff)}d atraso`, color: '#C0392B', days: diff };
  if (diff === 0) return { label: 'Vence hoje',  color: '#854F0B', days: 0 };
  if (diff <= 7)  return { label: `${diff}d`,    color: '#854F0B', days: diff };
  if (diff <= 30) return { label: `${diff}d`,    color: '#555',    days: diff };
  return               { label: `${diff}d`,       color: '#888',    days: diff };
}

export function remaining(ap: AccountsPayable): number {
  return Math.max(0, Number(ap.netAmount) - Number(ap.paidAmount));
}

export function fmtBRL(v: string | number): string {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}
