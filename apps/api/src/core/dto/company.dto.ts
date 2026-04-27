// company.dto.ts
export class CompanyDto {
  id: string;
  taxId: string;
  legalName: string;
  tradeName?: string;
  openingDate?: Date;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  state?: string;
  city?: string;
  email?: string;
  phone1?: string;
  phone2?: string;
  equity?: number;
  legalNature?: string;
  size?: string;
  taxRegime?: string;
  status: string;
  statusDate?: Date;
  partners?: any;
  cnaes?: any;
  
  constructor(company: any) {
    this.id = company.id;
    
    // Padronização para números puros (taxId/CNPJ)
    this.taxId = company.taxId ? String(company.taxId).replace(/\D/g, '') : company.taxId;
    
    this.legalName = company.legalName;
    this.tradeName = company.tradeName;
    this.openingDate = company.openingDate;
    
    // Padronização para números puros (CEP)
    this.zipCode = company.zipCode ? String(company.zipCode).replace(/\D/g, '') : company.zipCode;
    
    this.street = company.street;
    this.number = company.number;
    this.complement = company.complement;
    this.neighborhood = company.neighborhood;
    this.state = company.state;
    this.city = company.city;
    this.email = company.email;
    
    // Padronização para números puros (Telefones)
    this.phone1 = company.phone1 ? String(company.phone1).replace(/\D/g, '') : company.phone1;
    this.phone2 = company.phone2 ? String(company.phone2).replace(/\D/g, '') : company.phone2;
    
    this.equity = company.equity;
    this.legalNature = company.legalNature;
    this.size = company.size;
    this.taxRegime = company.taxRegime;
    this.status = company.status;
    this.statusDate = company.statusDate;
    this.partners = company.partners;
    this.cnaes = company.cnaes;
  }
}