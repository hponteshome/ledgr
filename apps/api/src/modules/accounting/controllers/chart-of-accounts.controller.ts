// apps/api/src/modules/accounting/controllers/chart-of-accounts.controller.ts

import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Patch,
  Body, 
  Param, 
  Query, 
  UseGuards, 
  HttpCode, 
  HttpStatus, 
  ParseUUIDPipe
} from '@nestjs/common';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyGuard } from '../../../multi-company/multi-company.guard';
import { Company } from '../../../multi-company/company.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { 
  CreateAccountDto, 
  UpdateAccountDto, 
  BulkOperationDto,
  AccountFilterDto,
  AccountMoveDto,
  ImportAccountsDto
} from '../dto/chart-of-accounts.dto';

@Controller('chart-of-accounts')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class ChartOfAccountsController {
  constructor(private readonly service: ChartOfAccountsService) {}

  // ── Listar contas com filtros ─────────────────────────────────
  @Get()
  async findAll(
    @Company() companyId: string,
    @Query() filters: AccountFilterDto,
  ) {
    return this.service.findAll(companyId, filters);
  }

  // ── Buscar árvore completa ────────────────────────────────────
  @Get('tree')
  async getTree(
    @Company() companyId: string,
    @Query('date') date?: string,
  ) {
    // 🔴 CORRIGIDO: Removido o parâmetro showInactive que não existe no método
    return this.service.getTree(companyId, date);
  }

  // ── Buscar uma conta específica ───────────────────────────────
  @Get(':id')
  async findOne(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(companyId, id);
  }

  // ── Criar nova conta ──────────────────────────────────────────
  @Post()
  async create(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.service.create(companyId, userId, dto);
  }

  // ── Atualizar conta ───────────────────────────────────────────
  @Put(':id')
  async update(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.service.update(companyId, userId, id, dto);
  }

  // ── Excluir conta ─────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('permanent') permanent?: string,
  ) {
    const permanentBool = permanent === 'true';
    return this.service.remove(companyId, id, { permanent: permanentBool });
  }

  // ── Mover conta na hierarquia ─────────────────────────────────
  @Post(':id/move')
  async move(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AccountMoveDto,
  ) {
    return this.service.move(companyId, id, dto);
  }

  // ── Ativar/desativar conta ────────────────────────────────────
  @Patch(':id/toggle-status')
  async toggleStatus(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('active') active: boolean,
  ) {
    return this.service.toggleStatus(companyId, id, active);
  }

  // ── Importar contas em lote ───────────────────────────────────
  @Post('import')
  async importAccounts(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Body() dto: ImportAccountsDto,
  ) {
    return this.service.importAccounts(companyId, userId, dto);
  }

  // ── Operações em lote ─────────────────────────────────────────
  @Post('bulk')
  async bulkOperation(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @Body() dto: BulkOperationDto,
  ) {
    return this.service.bulkOperation(companyId, userId, dto);
  }

  // ── Validar estrutura do plano ────────────────────────────────
  @Get('validate/structure')
  async validateStructure(@Company() companyId: string) {
    return this.service.validateStructure(companyId);
  }

  // ── Sugerir próximo código disponível ─────────────────────────
  @Get('suggest-code/:parentCode')
  async suggestCode(
    @Company() companyId: string,
    @Param('parentCode') parentCode: string,
  ) {
    return this.service.suggestCode(companyId, parentCode);
  }
@Get(':id/balance')
async getAccountBalance(
  @Company() companyId: string,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.service.getAccountBalance(companyId, id);
}


}