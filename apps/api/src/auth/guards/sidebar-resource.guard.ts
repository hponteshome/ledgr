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
    const required = this.reflector.get<ResourceAccessRequirement>('resourceAccess', context.getHandler());
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('Usuário não autenticado.');

    const userId = user.id ?? user.sub;
    const companyId = request.headers['x-company-id'] ?? '';

    const level = await this.svc.resolveResourceLevel(userId, companyId, required.resource);

    if (LEVEL_RANK[level] >= LEVEL_RANK[required.level]) return true;

    throw new ForbiddenException('Você não tem o nível de acesso necessário para esta ação.');
  }
}
