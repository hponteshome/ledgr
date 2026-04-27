/////////////////////////   D:\Projetos\Ledgr\apps\api\src\auth\guards/profile.guard.ts


import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ProfileGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler()
    );

    // Sem permissão exigida na rota — libera
    if (!requiredPermission) {
      return true;
    }

    if (!user || !user.profile) {
      throw new ForbiddenException('Usuário sem perfil atribuído.');
    }

    const permissions = user.profile.permissions || {};
    const isMaster =
      user.profile.id   === 'ad8e026c-4164-4fc7-8668-42cc7f3cc67e' || // ID real do banco
      user.profile.name === 'Administrador Master'                    || // fallback por nome
      permissions.all   === true;                                        // fallback por permissão

    if (isMaster) {
      return true;
    }

    if (permissions[requiredPermission] === true) {
      return true;
    }

    throw new ForbiddenException(
      'Você não tem permissão para executar esta ação.'
    );
  }
}