/////  apps/api/src/accounting/dto/import-balance.dto.ts   //////
export class ImportBalanceDto {
  lines: string[];
  companyId: string;
  referenceDate?: string;
}

export class BalanceLineDto {
  code: string;
  balance: number;
}