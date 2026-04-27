// apps/api/src/modules/sped/ecd/ecd.controller.ts

import {
  Controller, Post, Get, Delete, Param, Body, Query,
  UploadedFile, UseInterceptors, UseGuards, Req, Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { CompanyGuard } from '@multi-company/multi-company.guard';
import { EcdParserService } from './../services/ecd-parser.service';
import { EcdImporterService } from './../services/ecd-importer.service';
import { EcdExporterService } from './../services/ecd-exporter.service';
import { EcdValidatorService } from './../services/ecd-validator.service';
import { PrismaService } from '@prisma/prisma.service';

@Controller('sped/ecd')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class EcdController {
  constructor(
    private parser: EcdParserService,
    private importer: EcdImporterService,
    private exporter: EcdExporterService,
    private validator: EcdValidatorService,
    private prisma: PrismaService,
  ) {}

  // ── POST /sped/ecd/validate — valida sem importar ─────────────
  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  async validate(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');

    const companyId = req.headers['x-company-id'];
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxId: true },
    });

    // ── Encoding: arquivos ECD SPED são latin1 (ISO-8859-1) ──────
    const content = file.buffer.toString('latin1');
    const parsed = this.parser.parse(content);
    const result = this.validator.validate(parsed, company?.taxId || '');

    // Busca o que já existe no banco para o período do arquivo
    let existing = { accounts: 0, balances: 0, journalEntries: 0, periodStart: '', periodEnd: '' };
    if (parsed.reg0000 && result.valid) {
      try {
        const periodStart = this.parser.parseDate(parsed.reg0000.periodStart);
        const periodEnd   = this.parser.parseDate(parsed.reg0000.periodEnd);

        const [existingAccounts, existingBalances, existingEntries] = await Promise.all([
          this.prisma.chartOfAccounts.count({ where: { companyId } }),
          this.prisma.accountBalance.count({
            where: { companyId, referenceDate: { gte: periodStart, lte: periodEnd } },
          }),
          this.prisma.journalEntry.count({
            where: {
              companyId,
              sourceModule: 'ECD_IMPORT' as any,
              date: { gte: periodStart, lte: periodEnd },
            },
          }),
        ]);

        existing = {
          accounts: existingAccounts,
          balances: existingBalances,
          journalEntries: existingEntries,
          periodStart: parsed.reg0000.periodStart,
          periodEnd: parsed.reg0000.periodEnd,
        };
      } catch (_) {}
    }

    return {
      valid: result.valid,
      contentType: parsed.contentType,    // FULL | BALANCES_ONLY | STATEMENTS_ONLY
      layoutVersion: parsed.regI010?.layoutVersion ?? '?',
      summary: {
        accounts:      parsed.regI050.length,
        periods:       parsed.periods.length,
        journalEntries: parsed.journalEntries.length,
        balanceSheet:  parsed.balanceSheet.length,
        parseErrors:   parsed.errors.length,
      },
      existing,
      errors: result.errors,
      fileInfo: result.fileInfo,
    };
  }

  // ── POST /sped/ecd/import — importa para o banco ─────────────
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');

    const companyId = req.headers['x-company-id'];
    const userId = req.user.id;

    // ── Encoding: arquivos ECD SPED são latin1 (ISO-8859-1) ──────
    const content = file.buffer.toString('latin1');

    // Valida antes de importar
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxId: true },
    });
    const parsed = this.parser.parse(content);
    const validation = this.validator.validate(parsed, company?.taxId || '');

    if (!validation.valid) {
      return {
        success: false,
        message: 'Arquivo com erros bloqueantes. Corrija antes de importar.',
        errors: validation.errors.filter(e => e.severity === 'error'),
      };
    }

    const result = await this.importer.import(companyId, content, file.originalname, userId);

    return {
      success:      result.status !== 'error',
      importId:     result.importId,
      status:       result.status,
      contentType:  result.contentType,     // FULL | BALANCES_ONLY | STATEMENTS_ONLY
      layoutVersion: result.layoutVersion,
      stats:        result.stats,
      errors:       result.errors.slice(0, 50),
      warnings:     result.warnings.slice(0, 20),
      consistency:  result.consistency,
    };
  }

  // ── GET /sped/ecd/export — gera arquivo .txt ─────────────────
  @Get('export')
  async export(
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('bookNumber') bookNumber: string,
    @Query('bookType') bookType: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const companyId = req.headers['x-company-id'];

    if (!periodStart || !periodEnd) {
      throw new BadRequestException('Informe periodStart e periodEnd (YYYY-MM-DD).');
    }

    const content = await this.exporter.export({
      companyId,
      periodStart: new Date(periodStart),
      periodEnd:   new Date(periodEnd),
      bookNumber:  bookNumber || '1',
      bookType:    (bookType as any) || 'G',
    });

    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: { taxId: true },
    });
    const cnpj     = company?.taxId.replace(/\D/g, '') || 'ECD';
    const year     = new Date(periodEnd).getFullYear();
    const filename = `ECD_${cnpj}_${year}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  // ── GET /sped/ecd/imports — histórico de importações ─────────
  @Get('imports')
  async listImports(@Req() req: any) {
    const companyId = req.headers['x-company-id'];

    return this.prisma.ecdImport.findMany({
      where:   { companyId },
      orderBy: { importedAt: 'desc' },
      take:    20,
      select: {
        id:            true,
        fileName:      true,
        layoutVersion: true,
        periodStart:   true,
        periodEnd:     true,
        bookType:      true,
        bookNumber:    true,
        status:        true,
        stats:         true,
        importedAt:    true,
      },
    });
  }

  // ── GET /sped/ecd/imports/:id — detalhes de uma importação ───
  @Get('imports/:id')
  async getImport(@Param('id') id: string, @Req() req: any) {
    const companyId = req.headers['x-company-id'];

    const imp = await this.prisma.ecdImport.findFirst({
      where: { id, companyId },
    });
    if (!imp) throw new BadRequestException('Importação não encontrada.');
    return imp;
  }

  // ── DELETE /sped/ecd/imports/:id — remove registro ───────────
  @Delete('imports/:id')
  async deleteImport(@Param('id') id: string, @Req() req: any) {
    const companyId = req.headers['x-company-id'];

    await this.prisma.ecdImport.deleteMany({ where: { id, companyId } });
    return { message: 'Importação removida.' };
  }



}