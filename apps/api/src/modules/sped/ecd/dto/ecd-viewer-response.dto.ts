// apps/api/src/modules/sped/ecd/dto/ecd-viewer-response.dto.ts

export interface EcdViewerAccount {
  code: string;
  name: string;
  level: number;
  type: string; // ASSET, LIABILITY, etc
  isAnalytic: boolean;
  balance: number;
}

export interface EcdViewerResponse {
  summary: {
    companyName: string;
    cnpj: string;
    period: string;
    layoutVersion: string;
    contentType: string; // FULL, BALANCES_ONLY, etc
  };
  accounts: EcdViewerAccount[];
  // Mantemos o campo consistency como opcional para arquivos BALANCES_ONLY
  consistency?: {
    consistent: number;
    divergent: number;
    missing: number;
    details: Array<{
      accountCode: string;
      accountName: string;
      ecdBalance: number;
      calcBalance: number;
      difference: number;
      diagnosis: string;
    }>;
  };
}