// apps/api/src/auth/decorators/recurso-menu.decorator.ts
// Seguranca 0A (04/10/2026): recurso do menu na CLASSE do controller. Com o SidebarResourceGuard, o nivel exigido vem do verbo HTTP
// (GET/HEAD = VIEW, POST/PUT/PATCH = EDIT, DELETE = DELETE). @RequireResourceAccess na rota tem precedencia (excecoes).
import { SetMetadata } from '@nestjs/common';

export const RECURSO_MENU_KEY = 'recursoMenu';
export const RecursoMenu = (recurso: string) => SetMetadata(RECURSO_MENU_KEY, recurso);
