// apps/api/src/modules/finance/accounts-receivable.controller.ts
import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { SidebarResourceGuard } from '@/auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '@/auth/decorators/require-resource-access.decorator';
import { AccountsReceivableService } from './accounts-receivable.service';

@UseGuards(JwtAuthGuard, SidebarResourceGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('finance/ar')
export class AccountsReceivableController {
  constructor(private readonly service: AccountsReceivableService) {}

  @RequireResourceAccess('ar', 'EDIT')
  @Post()
  create(@Req() req: any, @Body() dto: any) {
    return this.service.create(req.companyId, dto, req.user.id);
  }

  @RequireResourceAccess('ar', 'VIEW')
  @Get()
  findAll(@Req() req: any, @Query() filters: any) {
    return this.service.findAll(req.companyId, filters);
  }

  @RequireResourceAccess('ar', 'VIEW')
  @Get('aging')
  aging(@Req() req: any) {
    return this.service.aging(req.companyId);
  }

  @RequireResourceAccess('ar', 'VIEW')
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.companyId, id);
  }

  @RequireResourceAccess('ar', 'EDIT')
  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.update(req.companyId, id, dto, req.user.id);
  }

  @RequireResourceAccess('ar', 'EDIT')
  @Post(':id/receive')
  receive(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.receive(req.companyId, id, dto, req.user.id);
  }

  @RequireResourceAccess('ar', 'EDIT')
  @Patch(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.service.cancel(req.companyId, id, req.user.id);
  }

  @RequireResourceAccess('ar', 'DELETE')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.companyId, id);
  }
}
