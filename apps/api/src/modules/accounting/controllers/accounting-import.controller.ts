// apps/api/src/modules/accounting/controllers/accounting-import.controller.ts
//
// Endpoints:
//   GET  /accounting/accounts-search?q=texto          — autocomplete para mapeamento
//   POST /accounting/import-ecd-opening?dryRun=true   — parse + sugestão automática
//   POST /accounting/import-ecd-opening?dryRun=false  — grava com mapeamento confirmado
//
// Fluxo completo:
//   1. dryRun=true  → retorna linhas I155 com sugestão automática de conta 2015
//   2. Usuário revisa/ajusta mapeamento no frontend
//   3. dryRun=false → body.mapping[] + arquivo → grava JournalEntries

import {
  Controller, Post, Get, UseGuards, Req, UploadedFile,
  UseInterceptors, BadRequestException, Query, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { CompanyGuard } from '@multi-company/multi-company.guard';
import { PrismaService } from '@prisma/prisma.service';

// ── Tipos ──────────────────────────────────────────────────────

interface I155Row {
  accountCode:    string;
  closingBalance: number;
  closingSign:    'D' | 'C';
}

export interface MappingEntry {
  ecdCode:       string;
  ecdName:       string;
  targetAccount: { id: string; code: string; name: string } | null;
}

export interface MappingPreviewRow {
  ecdCode:     string;
  ecdName:     string;
  value:       number;
  sign:        'D' | 'C';
  suggestion:  { id: string; code: string; name: string } | null;
  matchReason: 'exact' | 'stripped' | 'name' | 'none';
}

export interface MappingPreview {
  dryRun:      true;
  periodEnd:   string;
  description: string;
  rows:        MappingPreviewRow[];
  totalRows:   number;
  autoMatched: number;
  unmatched:   number;
}

export interface ImportResult {
  dryRun:      false;
  periodEnd:   string;
  description: string;
  imported:    number;
  skipped:     number;
  totalDebit:  number;
  totalCredit: number;
  balanced:    boolean;
  warnings:    string[];
}

// ── Controller ─────────────────────────────────────────────────

@Controller('accounting')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class AccountingImportController {
  constructor(private prisma: PrismaService) {}

  // ── Autocomplete de contas para o mapeamento ──────────────────
  @Get('accounts-search')
  async searchAccounts(@Query('q') q: string, @Req() req: any) {
    const companyId = req.headers['x-company-id'] as string;
    if (!q || q.length < 2) return [];
    return this.prisma.chartOfAccounts.findMany({
      where: {
        companyId,
        isAnalytic: true,
        deletedAt:  null,
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select:  { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
      take:    20,
    });
  }

  // ── Import ECD com mapeamento ─────────────────────────────────
  @Post('import-ecd-opening')
  @UseInterceptors(FileInterceptor('file'))
  async importEcdOpening(
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRunParam: string,
    @Body('mapping') mappingJson: string | undefined,
    @Req() req: any,
  ): Promise<MappingPreview | ImportResult> {
    if (!file) throw new BadRequestException('Arquivo não enviado.');

    const companyId = req.headers['x-company-id'] as string;
    const userId    = req.user.id as string;
    const dryRun    = dryRunParam !== 'false';

    // 1. Decode latin1
    const content = file.buffer.toString('latin1');
    const lines   = content.split('\n').map(l => l.trim()).filter(Boolean);

    // 2. Nomes do I050 (todos os leiautes — mesma posição de campos)
    //    |I050|DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_PAI|NOME|
    //      [0]  [1]    [2]     [3]     [4]   [5]     [6]    [7]
    const ecdNames = new Map<string, string>();
    for (const line of lines) {
      if (!line.startsWith('|I050|')) continue;
      const p = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|');
      if (p[5] && p[7]) ecdNames.set(p[5].trim(), p[7].trim());
    }

    // 3. Último período I150
    let lastPeriodEnd = '';
    for (const line of lines) {
      if (!line.startsWith('|I150|')) continue;
      const p = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|');
      lastPeriodEnd = p[2] || '';
    }
    if (!lastPeriodEnd)
      throw new BadRequestException('Arquivo ECD não contém registros I150.');

    // 4. I155 do último período
    //    |I155|COD_CTA|COD_CCUS|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
    //      [0]   [1]    [2]      [3]         [4]       [5]    [6]     [7]         [8]
    let inLastPeriod = false;
    const rawRows: I155Row[] = [];
    for (const line of lines) {
      if (line.startsWith('|I150|')) {
        const p = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|');
        inLastPeriod = (p[2] === lastPeriodEnd);
        continue;
      }
      if (inLastPeriod && line.startsWith('|I155|')) {
        const p   = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|');
        const code = p[1]?.trim() || '';
        const bal  = parseFloat((p[7] || '0').replace(/\./g, '').replace(',', '.'));
        const sign = (p[8] || 'D').trim().toUpperCase();
        if (!code || isNaN(bal) || bal === 0) continue;
        rawRows.push({ accountCode: code, closingBalance: bal, closingSign: sign === 'C' ? 'C' : 'D' });
      }
    }
    if (rawRows.length === 0)
      throw new BadRequestException(`Nenhum saldo no último período (${lastPeriodEnd}).`);

    // 5. Agrupa por código (elimina duplicatas de centro de custo)
    const grouped = new Map<string, I155Row>();
    for (const row of rawRows) {
      const ex = grouped.get(row.accountCode);
      if (ex) ex.closingBalance = parseFloat((ex.closingBalance + row.closingBalance).toFixed(2));
      else    grouped.set(row.accountCode, { ...row });
    }

    // 6. Plano de contas 2015 — índices de busca
    const allAccounts = await this.prisma.chartOfAccounts.findMany({
      where:  { companyId, isAnalytic: true, deletedAt: null },
      select: { id: true, code: true, spedCode: true, name: true },
    });
    const byCode     = new Map(allAccounts.map(a => [a.code, a]));
    const bySpedCode = new Map(allAccounts.filter(a => a.spedCode).map(a => [a.spedCode!, a]));
    const byStripped = new Map(allAccounts.map(a => [a.code.replace(/\./g, ''), a]));
    const byNameNorm = new Map(allAccounts.map(a => [this.normName(a.name), a]));

    const periodDate  = this.ecdDateToIso(lastPeriodEnd);
    const description = `SALDO INICIAL ECD — ${lastPeriodEnd.substring(4)} (${lastPeriodEnd.substring(2, 4)}/${lastPeriodEnd.substring(4)})`;

    // ── DRY RUN: retorna sugestões de mapeamento ─────────────────
    if (dryRun) {
      let autoMatched = 0;
      const rows: MappingPreviewRow[] = Array.from(grouped.entries()).map(([code, row]) => {
        const ecdName = ecdNames.get(code) || code;
        let suggestion: MappingPreviewRow['suggestion'] = null;
        let matchReason: MappingPreviewRow['matchReason'] = 'none';

        const tryMatch = (
          acc: typeof allAccounts[0] | undefined,
          reason: MappingPreviewRow['matchReason'],
        ) => {
          if (!suggestion && acc) {
            suggestion  = { id: acc.id, code: acc.code, name: acc.name };
            matchReason = reason;
          }
        };

        tryMatch(bySpedCode.get(code),                       'exact');
        tryMatch(byCode.get(code),                           'exact');
        tryMatch(byStripped.get(code.replace(/\./g, '')),    'stripped');
        tryMatch(byNameNorm.get(this.normName(ecdName)),     'name');

        if (suggestion) autoMatched++;
        return { ecdCode: code, ecdName, value: row.closingBalance, sign: row.closingSign, suggestion, matchReason };
      });

      return { dryRun: true, periodEnd: periodDate, description, rows, totalRows: rows.length, autoMatched, unmatched: rows.length - autoMatched };
    }

    // ── IMPORT: recebe mapeamento e grava ─────────────────────────
    let mapping: MappingEntry[] = [];
    try { mapping = mappingJson ? JSON.parse(mappingJson) : []; }
    catch { throw new BadRequestException('Mapeamento inválido.'); }
    if (mapping.length === 0) throw new BadRequestException('Mapeamento não enviado.');

    const mappingMap = new Map<string, MappingEntry['targetAccount']>(
      mapping.filter(e => e.targetAccount).map(e => [e.ecdCode, e.targetAccount])
    );

    // Remove lançamentos ABERTURA-ECD anteriores do mesmo dia
    const existing = await this.prisma.journalEntry.findMany({
      where:  { companyId, date: new Date(periodDate), reference: 'ABERTURA-ECD' },
      select: { id: true },
    });
    if (existing.length > 0) {
      const ids = existing.map(e => e.id);
      await this.prisma.journalEntryItem.deleteMany({ where: { journalEntryId: { in: ids } } });
      await this.prisma.journalEntry.deleteMany({ where: { id: { in: ids } } });
    }

    const genId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

    const entryDate = new Date(periodDate);
    let imported = 0, skipped = 0, totalDebit = 0, totalCredit = 0;
    const warnings: string[] = [];

    for (const [code, row] of grouped) {
      const target = mappingMap.get(code);
      if (!target) {
        skipped++;
        warnings.push(`"${code}" (${ecdNames.get(code) || code}) não mapeada — ignorada.`);
        continue;
      }
      await this.prisma.journalEntry.create({
        data: {
          id:           genId(),
          companyId,
          date:         entryDate,
          description:  `${description} | ${target.code} — ${target.name}`,
          reference:    'ABERTURA-ECD',
          sourceModule: 'ECD_IMPORT' as any,
          createdById:  userId,
          items: { create: [{ id: genId(), accountId: target.id, value: row.closingBalance, type: row.closingSign === 'D' ? 'DEBIT' : 'CREDIT' }] },
        },
      });
      if (row.closingSign === 'D') totalDebit  += row.closingBalance;
      else                         totalCredit += row.closingBalance;
      imported++;
    }

    return {
      dryRun: false, periodEnd: periodDate, description, imported, skipped,
      totalDebit: parseFloat(totalDebit.toFixed(2)), totalCredit: parseFloat(totalCredit.toFixed(2)),
      balanced: Math.abs(totalDebit - totalCredit) < 0.02, warnings,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private ecdDateToIso(d: string): string {
    if (!d || d.length !== 8) return d;
    return `${d.substring(4, 8)}-${d.substring(2, 4)}-${d.substring(0, 2)}`;
  }

  private normName(name: string): string {
    return name.toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').trim();
  }
}