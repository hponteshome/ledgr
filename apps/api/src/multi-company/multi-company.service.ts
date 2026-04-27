import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST }) // Scope.REQUEST cria uma instância nova por requisição
export class companyService {
  private companyId: string = null;

  setcompanyId(id: string) {
    this.companyId = id;
  }

  getcompanyId() {
    return this.companyId;
  }
}
