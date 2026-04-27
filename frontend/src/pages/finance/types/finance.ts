// ============================================================
// LEDGR — src/types/finance.ts  (apps/web)
// ============================================================

export type FiscalDocumentType =
  | 'NFE' | 'NFSE' | 'FATURA' | 'DUPLICATA'
  | 'BOLETO' | 'CONSUMO' | 'OUTROS';

export type IntegrationStatus =
  | 'PENDING' | 'INTEGRATED' | 'ERROR' | 'MANUAL';

export type AgendaEventType =
  | 'PAYMENT' | 'TAX' | 'CLOSING' | 'MEETING' | 'REMINDER' | 'OTHER';

export type AgendaColor =
  | 'YELLOW' | 'BLUE' | 'GREEN' | 'RED' | 'ORANGE' | 'PURPLE';

export interface FiscalDocument {
  id: string;
  companyId: string;
  documentType: FiscalDocumentType;
  documentNumber: string | null;
  accessKey: string | null;
  issuerCnpj: string;
  issuerName: string;
  issueDate: string;
  dueDate: string;
  competenceMonth: string;
  grossAmount: string;
  discountAmount: string;
  netAmount: string;
  irAmount: string;
  pisAmount: string;
  cofinsAmount: string;
  csllAmount: string;
  issAmount: string;
  inssAmount: string;
  expenseAccountId: string | null;
  integrationStatus: IntegrationStatus;
  apEntryId: string | null;
  journalEntryId: string | null;
  agendaEventId: string | null;
  notes: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaEvent {
  id: string;
  companyId: string;
  eventType: AgendaEventType;
  title: string;
  description: string | null;
  color: AgendaColor;
  dueDate: string;
  amount: string | null;
  isPaid: boolean;
  paidAt: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  parentEventId: string | null;
  fiscalDocumentId: string | null;
  apEntryId: string | null;
  createdAt: string;
}

export interface FinanceSummary {
  totalDocuments: number;
  totalAmount: string;
  overdueAmount: string;
  overdueCount: number;
  integrationRate: number;
}

export interface FiscalDocumentListResponse {
  data: FiscalDocument[];
  total: number;
  summary: FinanceSummary;
}

export interface AgendaMonthResponse {
  events: AgendaEvent[];
  byDay: Record<number, AgendaEvent[]>;
}

// Formulário de novo documento
export interface FiscalDocumentFormData {
  documentType: FiscalDocumentType;
  documentNumber: string;
  accessKey: string;
  issuerCnpj: string;
  issuerName: string;
  issuerStateReg: string;
  issueDate: string;
  dueDate: string;
  competenceMonth: string;
  grossAmount: string;
  discountAmount: string;
  netAmount: string;
  irAmount: string;
  pisAmount: string;
  cofinsAmount: string;
  csllAmount: string;
  issAmount: string;
  inssAmount: string;
  expenseAccountId: string;
  costCenter: string;
  notes: string;
  attachmentUrl: string;
}

// Labels de exibição
export const FISCAL_DOC_TYPE_LABEL: Record<FiscalDocumentType, string> = {
  NFE:       'NF-e',
  NFSE:      'NFS-e',
  FATURA:    'Fatura',
  DUPLICATA: 'Duplicata',
  BOLETO:    'Boleto',
  CONSUMO:   'Consumo',
  OUTROS:    'Outros',
};

export const AGENDA_COLOR_CSS: Record<AgendaColor, { bg: string; text: string; border: string }> = {
  YELLOW: { bg: '#FFF9C4', text: '#7A6500', border: '#F0C000' },
  BLUE:   { bg: '#BBDEFB', text: '#0D47A1', border: '#64B5F6' },
  GREEN:  { bg: '#C8E6C9', text: '#1B5E20', border: '#81C784' },
  RED:    { bg: '#FFCDD2', text: '#8B0000', border: '#E57373' },
  ORANGE: { bg: '#FFE0B2', text: '#7A3200', border: '#FFB74D' },
  PURPLE: { bg: '#E1BEE7', text: '#4A148C', border: '#CE93D8' },
};

export const INTEGRATION_STATUS_LABEL: Record<IntegrationStatus, string> = {
  PENDING:    '⏳ Pendente',
  INTEGRATED: '✓ Integrado',
  ERROR:      '⚠ Erro',
  MANUAL:     '✎ Manual',
};
