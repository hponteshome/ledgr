import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class CompanyService {
  private companyId: string | null = null;

  setcompanyId(id: string) {
    this.companyId = id;
  }

  getCompanyId(): string {
    if (!this.companyId) {
      throw new Error('company context not set');
    }
    return this.companyId;
  }
}
