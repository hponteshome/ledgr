// apps/api/src/auth/guards/master-only.guard.ts
// Seguranca 0A (03/10/2026): administracao de acessos (usuarios, aprovacoes, perfis,
// janelas de acesso, desbloqueios e permissoes de menu) restrita ao Master Admin.
// Bussola 5.3: "Configurar, conceder acessos - Restrito ao Hpontes".
// Rotas marcadas com @AcessoAutenticado() ficam liberadas a qualquer usuario autenticado.
// Aplicado no nivel da classe: rota nova nasce restrita; liberar exige decisao explicita.
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isMasterAdmin } from '../../multi-company/company.interceptor';

export const ACESSO_AUTENTICADO_KEY = 'acessoAutenticado';
export const AcessoAutenticado = () => SetMetadata(ACESSO_AUTENTICADO_KEY, true);

@Injectable()
export class MasterOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const liberado = this.reflector.getAllAndOverride<boolean>(ACESSO_AUTENTICADO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (liberado) return true;
    const user = context.switchToHttp().getRequest().user;
    if (isMasterAdmin(user)) return true;
    throw new ForbiddenException('Acao restrita ao administrador.');
  }
}
