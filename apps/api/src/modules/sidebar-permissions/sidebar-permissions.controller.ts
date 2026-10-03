import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { SidebarPermissionsService } from './sidebar-permissions.service';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { MasterOnlyGuard, AcessoAutenticado } from '../../auth/guards/master-only.guard';

@UseGuards(JwtAuthGuard, MasterOnlyGuard) // Seguranca 0A: edicao de permissoes so Master
@Controller('sidebar-permissions')
export class SidebarPermissionsController {
  constructor(private svc: SidebarPermissionsService) {}

  // GET /sidebar-permissions/items
  @Get('items')
  @AcessoAutenticado() // Seguranca 0A: liberada a qualquer usuario autenticado
  @SkipCompanyCheck()
  listItems() { return this.svc.listItems(); }

  // GET /sidebar-permissions/tree
  @Get('tree')
  @AcessoAutenticado() // Seguranca 0A: liberada a qualquer usuario autenticado
  @SkipCompanyCheck()
  getTree() { return this.svc.getTree(); }

  // GET /sidebar-permissions/resolve
  @Get('resolve')
  @AcessoAutenticado() // Seguranca 0A: liberada a qualquer usuario autenticado
  @SkipCompanyCheck()
  resolve(@Req() req: any) {
    const userId = req.user?.id ?? req.user?.sub ?? '';
    const companyId = req.headers['x-company-id'] ?? '';
    if (!userId) return [];
    return this.svc.resolvePermissions(userId, companyId);
  }

  // GET /sidebar-permissions/profile/:id
  @Get('profile/:id')
  @SkipCompanyCheck()
  getProfile(@Param('id') id: string) { return this.svc.getProfilePermissions(id); }

  // POST /sidebar-permissions/profile/:id
  // body: { items: { itemId: string; accessLevel: 'NONE'|'VIEW'|'EDIT'|'DELETE' }[] }
  @Post('profile/:id')
  @SkipCompanyCheck()
  setProfile(@Param('id') id: string, @Body() body: { items: { itemId: string; accessLevel: any }[] }) {
    return this.svc.setProfilePermissions(id, body.items);
  }

  // GET /sidebar-permissions/user/:id
  @Get('user/:id')
  @SkipCompanyCheck()
  getUser(@Param('id') id: string) { return this.svc.getUserPermissions(id); }

  // POST /sidebar-permissions/user/:id
  // body: { itemId: string; accessLevel: 'NONE'|'VIEW'|'EDIT'|'DELETE'; companyId?: string }
  @Post('user/:id')
  @SkipCompanyCheck()
  setUser(@Param('id') id: string, @Body() body: { itemId: string; accessLevel: any; companyId?: string }) {
    return this.svc.setUserPermission(id, body.itemId, body.accessLevel, body.companyId);
  }

  // POST /sidebar-permissions/user/:id/bulk
  // body: { items: { itemId: string; accessLevel: 'NONE'|'VIEW'|'EDIT'|'DELETE' }[]; companyId?: string }
  @Post('user/:id/bulk')
  @SkipCompanyCheck()
  setUserBulk(@Param('id') id: string, @Body() body: { items: { itemId: string; accessLevel: any }[]; companyId?: string }) {
    return this.svc.setUserPermissionsBulk(id, body.items, body.companyId);
  }

  // DELETE /sidebar-permissions/user/:userId/:itemId
  @Delete('user/:userId/:itemId')
  @SkipCompanyCheck()
  removeUser(@Param('userId') userId: string, @Param('itemId') itemId: string) {
    return this.svc.removeUserPermission(userId, itemId);
  }
}
