// ============================================================
// LEDGR — apps/web/src/types/bank-import.ts
// ============================================================

export type BankCode = 'ITAU' | 'BRADESCO' | 'BB' | 'SANTANDER' | 'CAIXA' | 'SICREDI' | 'SICOOB' | 'NUBANK' | 'INTER' | 'GENERIC';
export type TransactionType = 'DEBIT' | 'CREDIT';
export type SuggestionSource = 'FIXED' | 'LEARNED' | 'FUZZY';
export type BankImportStatus = 'PENDING' | 'CLASSIFIED' | 'POSTED' | 'IGNORED' | 'RECONCILED';

export interface BankStatementSummary {
  id:           string;
  bankCode:     BankCode;
  bankName:     string;
  agency?:      string;
  account?:     string;
  periodFrom:   string;
  periodTo:     string;
  fileName:     string;
  fileFormat:   string;
  totalLines:   number;
  totalDebits:  string;
  totalCredits: string;
  createdAt:    string;
  _count:       { transactions: number };
}

export interface BankTransaction {
  id:                   string;
  transactionDate:      string;
  description:          string;
  descriptionNorm:      string;
  amount:               string;
  type:                 TransactionType;
  balance?:             string;
  bankRef?:             string;
  status:               BankImportStatus;
  accountId?:           string;
  counterAccountId?:    string;
  memo?:                string;
  costCenter?:          string;
  suggestedAccountId?:  string;
  suggestionSource?:    SuggestionSource;
  suggestionConfidence?: number;
  journalEntryId?:      string;
}

export interface TransactionGroup {
  groupKey:             string;
  type:                 TransactionType;
  description:          string;
  count:                number;
  totalAmount:          number;
  transactions:         BankTransaction[];
  suggestedAccountId:   string | null;
  suggestionSource:     SuggestionSource | null;
  suggestionConfidence: number | null;
  memo:                 string | null;
  // campos preenchidos pelo usuário na tela
  accountId?:           string;
  counterAccountId?:    string;
}

export interface UploadResult {
  statementId:  string;
  bankName:     string;
  bankCode:     BankCode;
  totalLines:   number;
  totalDebits:  number;
  totalCredits: number;
  periodFrom:   string;
  periodTo:     string;
}

// Labels
export const BANK_NAME: Record<BankCode, string> = {
  ITAU:      'Banco Itaú',
  BRADESCO:  'Banco Bradesco',
  BB:        'Banco do Brasil',
  SANTANDER: 'Banco Santander',
  CAIXA:     'Caixa Econômica Federal',
  SICREDI:   'Sicredi',
  SICOOB:    'Sicoob',
  NUBANK:    'Nubank',
  INTER:     'Banco Inter',
  GENERIC:   'Banco (genérico)',
};

export const BANK_COLOR: Record<BankCode, string> = {
  ITAU:      '#EC7000',
  BRADESCO:  '#CC092F',
  BB:        '#FBCD00',
  SANTANDER: '#EC0000',
  CAIXA:     '#005CA9',
  SICREDI:   '#009B3A',
  SICOOB:    '#00529B',
  NUBANK:    '#820AD1',
  INTER:     '#FF7A00',
  GENERIC:   '#666666',
};

export const SUGGESTION_SOURCE_LABEL: Record<SuggestionSource, string> = {
  FIXED:   'Regra fixa',
  LEARNED: 'Aprendido',
  FUZZY:   'Similar',
};
