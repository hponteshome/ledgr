//src/multi-company/company.guard.ts

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class CompanyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.headers['x-company-id'] || request.body?.companyId || request.query?.companyId;
    
    // Se não tiver companyId, permite (Modo Global)
    if (!companyId) {
      return true;
    }
    
    // Se o usuário for admin master, permite todas as empresas
    if (user?.profileName === 'Administrador Master') {
      return true;
    }
    
    // TODO: Implementar validação de acesso à empresa
    // Por enquanto, permitindo tudo
    return true;
  }
}