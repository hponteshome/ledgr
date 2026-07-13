import { Controller, Get, Post, Delete, Body, Param, Req } from '@nestjs/common';
import { SidebarPermissionsService } from './sidebar-permissions.service';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';

@Controller('sidebar-permissions')
export class SidebarPermissionsController {
  constructor(private svc: SidebarPermissionsService) {}

  // GET /sidebar-permissions/items
  @Get('items')
  @SkipCompanyCheck()
  listItems() { return this.svc.listItems(); }

  // GET /sidebar-permissions/tree
  @Get('tree')
  @SkipCompanyCheck()
  getTree() { return this.svc.getTree(); }

  // GET /sidebar-permissions/resolve
  @Get('resolve')
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

  // DELETE /sidebar-permissions/user/:userId/:itemId
  @Delete('user/:userId/:itemId')
  @SkipCompanyCheck()
  removeUser(@Param('userId') userId: string, @Param('itemId') itemId: string) {
    return this.svc.removeUserPermission(userId, itemId);
  }
}
