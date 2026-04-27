// /apps/api/src/modules/accounting/dto/verification-balance.dto.ts

export class VerificationBalanceQueryDto {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export class VerificationBalanceItemDto {
  account: {
    id: string;
    code: string;
    name: string;
    type: string;
    nature: string;
    level: number;
    parentId?: string;
  };
  previousBalance: number;
  debits: number;
  credits: number;
  currentBalance: number;
}
