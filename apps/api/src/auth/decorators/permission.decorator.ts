import { SetMetadata } from '@nestjs/common';

// Este decorador vai marcar a rota com a permissão necessária
export const RequirePermission = (permission: string) => SetMetadata('permission', permission);
