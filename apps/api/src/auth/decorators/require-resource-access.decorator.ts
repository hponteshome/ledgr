// apps/api/src/auth/decorators/require-resource-access.decorator.ts
import { SetMetadata } from '@nestjs/common';

export interface ResourceAccessRequirement {
  resource: string;
  level: 'VIEW' | 'EDIT' | 'DELETE';
}

export const RequireResourceAccess = (resource: string, level: 'VIEW' | 'EDIT' | 'DELETE') =>
  SetMetadata('resourceAccess', { resource, level } as ResourceAccessRequirement);
