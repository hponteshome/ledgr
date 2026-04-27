// ============================================================
// LEDGR — apps/api/src/modules/sped/ecf/controllers/ecf.controller.ts
// FIX:
//   1. Injeta PrismaService e implementa getCompanyData
//   2. Retorna erro estruturado de CNPJ divergente no validate
//   3. Mantém toda a lógica existente intacta
// ============================================================
import {
  Controller, Delete, Post, Get, UploadedFile, UseInterceptors,
  UseGuards, Req, BadRequestException, Query, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { CompanyGuard } from '@multi-company/multi-company.guard';
import { EcfParserService } from '../services/ecf-parser.service';
import { EcfValidatorService } from '../services/ecf-validator.service';
import { EcfImporterService } from '../services/ecf-importer.service';
import { Company } from '@multi-company/company.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { PrismaService } from '../../../../prisma/prisma.service';

@Controller('sped/ecf')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class EcfController {
  constructor(
    private parser: EcfParserService,
    private validator: EcfValidatorService,
    private importer: EcfImporterService,
    private prisma: PrismaService,   // ← INJETADO
  ) {}

  // ── Validação ────────────────────────────────────────────────
  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  async validateFile(
    @Company() companyId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const content = file.buffer.toString('latin1');
    const parsed  = await this.parser.parse(content);
    const company = await this.getCompanyData(companyId);
    const validation = this.validator.validate(parsed, company?.taxId ?? '');

    // Detecta divergência de CNPJ para retornar erro específico
    const cnpjError = validation.errors.find(e => e.code === 'E002');

    return {
      valid: validation.valid,
      summary: {
        accounts:       parsed.accounts?.length       || 0,
        periods:        parsed.periods?.length        || 0,
        journalEntries: parsed.journalEntries?.length || 0,
        parseErrors:    parsed.errors?.length         || 0,
      },
      existing: {
        accounts:           0,
        balances:           0,
        journalEntries:     0,
        totalAccountsInDb:  0,
        periodStart: parsed.periodStart || '',
        periodEnd:   parsed.periodEnd   || '',
      },
      errors: validation.errors,
      // Info do arquivo ECF
      fileInfo: {
        cnpj:        parsed.reg0000?.cnpj        || '',
        companyName: parsed.reg0000?.companyName || '',
        periodStart: parsed.periodStart          || '',
        periodEnd:   parsed.periodEnd            || '',
        bookType:    'ECF',
        bookNumber:  parsed.reg0030?.bookNumber  || '1',
      },
      // Info da empresa ativa no LEDGR (para o frontend comparar)
      activeCompany: company ? {
        id:       companyId,
        taxId:    company.taxId,
        name:     company.legalName ?? company.tradeName ?? '',
      } : null,
      // Flag explícita de divergência de CNPJ
      cnpjMismatch: !!cnpjError,
    };
  }

  // ── Importação ───────────────────────────────────────────────
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(
    @Company() companyId: string,
    @CurrentUser() userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');

    const content  = file.buffer.toString('latin1');
    const parsed   = await this.parser.parse(content);
    const company  = await this.getCompanyData(companyId);
    const validation = this.validator.validate(parsed, company?.taxId ?? '');

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Falha na validação do arquivo ECF',
        errors: validation.errors,
      });
    }

    try {
      const result = await this.importer.import(parsed, companyId, userId);
      return {
        success:     true,
        importId:    result.importId,
        status:      result.status,
        stats:       result.stats,
        warnings:    result.warnings,
        consistency: result.consistency,
        message:     result.message || 'ECF importada com sucesso',
      };
    } catch (error) {
      throw new BadRequestException({
        message: 'Erro ao importar arquivo ECF',
        error: error.message,
      });
    }
  }

  // ── Exportação ───────────────────────────────────────────────
  @Get('export')
  async exportFile(
    @Company() companyId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd')   periodEnd: string,
  ) {
    if (!periodStart || !periodEnd)
      throw new BadRequestException('Período de exportação não informado');
    return this.importer.export(companyId, periodStart, periodEnd);
  }

  // ── Histórico ────────────────────────────────────────────────
  @Get('imports')
  getImports(@Company() companyId: string) {
    return this.importer.getImports(companyId);
  }

  @Get('imports/:id')
  getImportById(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.importer.getImportById(companyId, id);
  }

  @Delete('imports/:id')
  deleteImport(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.importer.deleteImport(companyId, id);
  }

  // ── Resumo e saldos ──────────────────────────────────────────
  @Get('summary')
  async getSummary(@Company() companyId: string) {
    return {
      message: 'Resumo da reconstituição disponível',
      ...await this.importer.getSummary(companyId),
    };
  }

  @Get('balances')
  getBalances(
    @Company() companyId: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    return this.importer.getBalances(companyId, periodEnd);
  }

  // ── Helper: busca empresa ativa via Prisma ───────────────────
  private async getCompanyData(companyId: string) {
    return this.prisma.company.findUnique({
      where:  { id: companyId },
      select: { taxId: true, legalName: true, tradeName: true },
    });
  }
}

