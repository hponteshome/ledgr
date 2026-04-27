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
    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler()
    );

    if (!requiredPermission) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // 👇 DEBUG LOG
    console.log('USER IN GUARD >>>', JSON.stringify(user, null, 2));

    if (!user || !user.profile) {
      throw new ForbiddenException('User has no profile assigned');
    }

    const userPermissions = user.profile.permissions || {};

    // ⚠️ Master Admin ID Bypass (Kept original UUID)
    if (user.profile.id === 'd0466a7e-56e9-442f-822a-f69eecadb8cc') {
      return true;
    }

    if (userPermissions[requiredPermission] === true) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have permission to perform this action'
    );
  }
}