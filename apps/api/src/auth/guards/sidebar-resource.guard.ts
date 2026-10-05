import { RECURSO_MENU_KEY } from '../decorators/recurso-menu.decorator';
// apps/api/src/auth/guards/sidebar-resource.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SidebarPermissionsService } from '../../modules/sidebar-permissions/sidebar-permissions.service';
import { ResourceAccessRequirement } from '../decorators/require-resource-access.decorator';

const LEVEL_RANK: Record<string, number> = { NONE: 0, VIEW: 1, EDIT: 2, DELETE: 3 };

@Injectable()
export class SidebarResourceGuard implements CanActivate {
  constructor(private reflector: Reflector, private svc: SidebarPermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Seguranca 0A (04/10/2026): declaracao por rota tem precedencia; senao, @RecursoMenu na classe com o nivel pelo verbo HTTP
    let required = this.reflector.get<ResourceAccessRequirement>('resourceAccess', context.getHandler());
    if (!required) {
      const recurso = this.reflector.getAllAndOverride<string>(RECURSO_MENU_KEY, [context.getHandler(), context.getClass()]);
      if (!recurso) return true;
      const m = String(context.switchToHttp().getRequest().method || 'GET').toUpperCase();
      required = { resource: recurso, level: m === 'GET' || m === 'HEAD' ? 'VIEW' : m === 'DELETE' ? 'DELETE' : 'EDIT' } as any;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Usuário não autenticado.');

    const userId = user.id ?? user.sub;
    // Seguranca 0A (04/10/2026): cabecalho lido como texto; o servico ignora valor que nao seja UUID (rotas sem empresa ativa)
    const companyId = String(request.headers['x-company-id'] ?? '');

    const level = await this.svc.resolveResourceLevel(userId, companyId, required.resource);

    if (LEVEL_RANK[level] >= LEVEL_RANK[required.level]) return true;

    throw new ForbiddenException('Você não tem o nível de acesso necessário para esta ação.');
  }
}
