// apps/api/src/core/companies/company.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  Request,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { ProfileGuard } from '../../auth/guards/profile.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { CompanyService } from './company.service';
import { CompanyDto } from '../../core/dto/company.dto';

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMAS CORRIGIDOS:
//  1. @Module() REMOVIDO — decorator de módulo nunca vai em controller
//  2. PrismaService REMOVIDO do controller — acesso direto ao Prisma quebra a
//     arquitetura; a rota /profiles foi movida para ProfilesController
//  3. @SkipCompanyCheck() adicionado nas rotas que não exigem empresa ativa
//  4. Tipagem `any` substituída onde possível
//  5. Logs de console mantidos apenas onde agregam valor diagnóstico real
// ─────────────────────────────────────────────────────────────────────────────

@Controller('companies')
@UseGuards(JwtAuthGuard, ProfileGuard)
export class CompanyController {

  constructor(private readonly companyService: CompanyService) {}

  // ── Rotas sem empresa ativa (Master Admin / pré-login) ──────────────────────

  /**
   * Lista todas as empresas disponíveis para o seletor de empresa.
   * Deve ser acessível antes de qualquer empresa estar ativa — por isso
   * @SkipCompanyCheck() é obrigatório aqui.
   */
  @Get('available')
  @SkipCompanyCheck()
  async listAvailable(@CurrentUser('object') user: any) {
    return this.companyService.findAvailable(user);
  }

  /**
   * Retorna a empresa sede (headquarter).
   * Também não exige empresa ativa no header.
   */
  @Get('headquarters')
  @SkipCompanyCheck()
  async getHeadquarters() {
    return this.companyService.findHeadquarters();
  }

  // ── Rotas que exigem empresa ativa ──────────────────────────────────────────

  /**
   * Empresa vinculada ao token do usuário logado.
   * Usa request.companyId injetado pelo CompanyInterceptor.
   */
  @Get('me')
  async getMyCompany(@Request() req: any) {
    const company = await this.companyService.findById(req.companyId);
    if (!company) throw new NotFoundException('Empresa do usuário não encontrada.');
    return new CompanyDto(company);
  }

  @Get()
  async findAll() {
    const companies = await this.companyService.findAll();
    return companies.map(c => new CompanyDto(c));
  }

  @Get('taxid/:taxId')
  async findByTaxId(@Param('taxId') taxId: string) {
    const company = await this.companyService.findByTaxId(taxId);
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const company = await this.companyService.findById(id);
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return new CompanyDto(company);
  }

  @Post()
  async create(@Body() body: any, @CurrentUser('object') user: any) {
    const data = {
      ...body,
      openingDate: body.openingDate ? new Date(body.openingDate) : new Date(),
      statusDate:  body.statusDate  ? new Date(body.statusDate)  : new Date(),
    };
    const result = await this.companyService.create(data);
    return new CompanyDto(result);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser('object') user: any,
  ) {
    const data = {
      ...body,
      ...(body.openingDate && { openingDate: new Date(body.openingDate) }),
      ...(body.statusDate  && { statusDate:  new Date(body.statusDate)  }),
    };
    const result = await this.companyService.update(id, data, user.id);
    return new CompanyDto(result);
  }

  @Patch(':id/status')
  @RequirePermission('companies_edit')
  async changeStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser('object') user: any,
  ) {
    const result = await this.companyService.update(id, { status }, user.id);
    return new CompanyDto(result);
  }

  @Delete(':id')
  @RequirePermission('companies_delete')
  async remove(@Param('id') id: string, @CurrentUser('object') user: any) {
    return this.companyService.remove(id, user.id);
  }

  // ── Rota de audit ────────────────────────────────────────────────────────────

  @Get('audit')
  getAuditInfo() {
    return { message: 'Audit logs integrado ao monolito Ledgr 1.0.' };
  }
}
