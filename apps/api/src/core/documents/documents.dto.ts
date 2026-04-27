// ── documents.dto.ts ──────────────────────────────────────

export class CreateDocumentDto {
  companyId: string;
  type: 'ATA' | 'CONTRATO' | 'ALTERACAO' | 'ASSEMBLEIA' | 'OUTRO' | 'FISCAL' | 'TRABALHISTA' | 'CONTABIL';
  bookNumber?: number;
  description: string;
  date: string;
  status?: 'draft' | 'signed' | 'registered' | 'archived';
  fileUrl?: string;
  fileSize?: number;
  digitalSignature?: string;
  registrationNumber?: string;
  registrationDate?: string;
  notes?: string;
}

export class UpdateDocumentDto {
  description?: string;
  date?: string;
  status?: 'draft' | 'signed' | 'registered' | 'archived';
  fileUrl?: string;
  fileSize?: number;
  digitalSignature?: string;
  registrationNumber?: string;
  registrationDate?: string;
  notes?: string;
}

export class SignDocumentDto {
  method: 'GOVBR' | 'INTERNAL' | 'CERTIFICATE';
  certId?: string;
  signatureHash?: string;
  signerId?: string;

  certificateData?: {
    cpf?: string;
    name?: string;
    email?: string;
    serialNumber?: string;
    [key: string]: any;
  };

  reason?: string;
  location?: string;
}