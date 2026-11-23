// apps/api/src/modules/finance/bank-accounts.controller.ts
// EXTBB-05 (23/11/2026) - Cadastro de Contas Bancarias (recurso de menu: contas-bancarias)
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { BankAccountsService, BankAccountDto } from './bank-accounts.service';

@UseGuards(SidebarResourceGuard) // Seguranca 0A: perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('contas-bancarias')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly service: BankAccountsService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.companyId);
  }

  @Get('ledger-options') // EXTBB-05B: rota estatica antes de :id
  ledgerOptions(@Req() req: any) {
    return this.service.ledgerOptions(req.companyId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: any) {
    return this.service.get(req.companyId, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: BankAccountDto) {
    return this.service.create(req.companyId, req.user.id, dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() dto: BankAccountDto) {
    return this.service.update(req.companyId, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(req.companyId, id);
  }
}
