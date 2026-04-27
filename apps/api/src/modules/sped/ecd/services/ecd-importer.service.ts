// apps/api/src/modules/sped/ecd/ecd-importer.service.ts
//
// Alterações nesta versão:
//   1. Usa parsed.contentType para distinguir FULL / BALANCES_ONLY / STATEMENTS_ONLY
//   2. Não reporta "0 lançamentos" como divergência quando o arquivo é BALANCES_ONLY
//   3. Campo contentType exposto no EcdImportResult para o frontend exibir aviso correto
//   4. Nota de encoding: o controller deve decodificar o buffer em latin1 antes de chamar import()

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import {
  EcdParserService,
  EcdParsed,
  EcdRegI050,
  EcdContentType,
} from './ecd-parser.service';
import { normalizeAccountCode } from '../../../../utils/normalize-account-code';

export interface EcdImportResult {
  importId:     string;
  status:       'done' | 'partial' | 'error';
  contentType:  EcdContentType;   // FULL | BALANCES_ONLY | STATEMENTS_ONLY
  layoutVersion: string;          // "4.00" | "9.00" …
  stats: {
    accounts:           number;
    accountsSkipped:    number;
    balances:           number;
    balancesReplaced:   number;
    journalEntries:     number;
    journalItems:       number;
    totalAccountsInDb:  number;
  };
  errors:   Array<{ block: string; message: string }>;
  warnings: string[];
  consistency?: {
    consistent: number;
    divergent:  number;
    missing:    number;
    details: Array<{
      accountCode: string;
      accountName: string;
      ecdBalance:  number;
      calcBalance: number;
      difference:  number;
      diagnosis:   string;
    }>;
  };
}

@Injectable()
export class EcdImporterService {
  private readonly logger = new Logger(EcdImporterService.name);

  constructor(
    private prisma:  PrismaService,
    private parser:  EcdParserService,
  ) {}

  // ── Método principal ──────────────────────────────────────────
  //
  // ATENÇÃO — encoding:
  //   O controller deve decodificar o Buffer em latin1 antes de chamar este método:
  //
  //     const fileContent = file.buffer.toString('latin1');
  //     await this.ecdImporterService.import(companyId, fileContent, file.originalname, userId);
  //
  async import(
    companyId:   string,
    fileContent: string,
    fileName:    string,
    userId:      string,
  ): Promise<EcdImportResult> {

    // 1. Parse
    const parsed = this.parser.parse(fileContent);

    if (!parsed.reg0000) {
      throw new BadRequestException('Arquivo ECD inválido: registro 0000 não encontrado.');
    }

    // 2. Valida CNPJ
    const company = await this.prisma.company.findUnique({
      where:  { id: companyId },
      select: { taxId: true },
    });
    if (!company) throw new BadRequestException('Empresa não encontrada.');

    const fileCnpj    = parsed.reg0000.cnpj.replace(/\D/g, '');
    const companyCnpj = company.taxId.replace(/\D/g, '');
    if (fileCnpj !== companyCnpj) {
      throw new BadRequestException(
        `CNPJ do arquivo (${fileCnpj}) não confere com a empresa ativa (${companyCnpj}).`,
      );
    }

    const periodStart   = this.parser.parseDate(parsed.reg0000.periodStart);
    const periodEnd     = this.parser.parseDate(parsed.reg0000.periodEnd);
    const layoutVersion = parsed.regI010?.layoutVersion || '?';
    const contentType   = parsed.contentType;

    // 3. Cria registro de importação
    const ecdImport = await this.prisma.ecdImport.create({
      data: {
        companyId,
        fileName,
        fileSize:      fileContent.length,
        layoutVersion,
        periodStart,
        periodEnd,
        bookType:   parsed.regI010?.bookType   || 'G',
        bookNumber: parsed.regI030?.bookNumber || '1',
        bookNature: parsed.regI030?.bookNature || 'DIÁRIO',
        status:     'processing',
        importedBy: userId,
      },
    });

    const stats = {
      accounts:          0,
      accountsSkipped:   0,
      balances:          0,
      balancesReplaced:  0,
      journalEntries:    0,
      journalItems:      0,
      totalAccountsInDb: 0,
    };
    const errors:   Array<{ block: string; message: string }> = [];
    const warnings: string[] = [];

    // Repassa avisos de parse
    parsed.errors.forEach(e => {
      warnings.push(`Linha ${e.line} [${e.record}]: ${e.message}`);
    });

    // ── Aviso claro por contentType ───────────────────────────
    if (contentType === 'BALANCES_ONLY') {
      warnings.push(
        'Este arquivo ECD contém apenas saldos periódicos (I155) — ' +
        'não inclui lançamentos analíticos (I200/I250). ' +
        'Isso é comum em ECDs leiaute 4.00 entregues sem escrituração auxiliar. ' +
        'O Diário de Lançamentos permanecerá vazio para este período.',
      );
    } else if (contentType === 'STATEMENTS_ONLY') {
      warnings.push(
        'Este arquivo contém apenas Demonstrações Financeiras (Bloco J — Balanço e DRE). ' +
        'Para importar o plano de contas e saldos, utilize o arquivo ECD completo.',
      );
    }

    try {
      // 4. Plano de Contas — só se tiver I050
      if (parsed.regI050.length > 0) {
        await this.importChartOfAccounts(companyId, parsed.regI050, stats, errors);
      }

      // 5. Saldos — só se tiver I155
      if (parsed.periods.length > 0) {
        await this.importBalances(companyId, parsed, stats, errors, userId);
      }

      // 6. Lançamentos — só se FULL
      if (contentType === 'FULL' && parsed.journalEntries.length > 0) {
        await this.importJournalEntries(companyId, parsed, userId, stats, errors);
      }

      stats.totalAccountsInDb = await this.prisma.chartOfAccounts.count({
        where: { companyId },
      });

      // 7. Consistência I155 vs I250 — só faz sentido se houver lançamentos
      let consistency: EcdImportResult['consistency'] | undefined;
      if (contentType === 'FULL') {
        consistency = await this.validateEcdConsistency(companyId, periodStart, periodEnd);
      }

      const status = errors.length > 0 ? 'partial' : 'done';
      await this.prisma.ecdImport.update({
        where: { id: ecdImport.id },
        data: {
          status,
          stats:  { ...stats, contentType, layoutVersion, consistency },
          errors: errors.slice(0, 100),
        },
      });

      return {
        importId: ecdImport.id,
        status,
        contentType,
        layoutVersion,
        stats,
        errors,
        warnings,
        consistency,
      };

    } catch (err) {
      await this.prisma.ecdImport.update({
        where: { id: ecdImport.id },
        data:  { status: 'error', errors: [{ block: 'GERAL', message: err.message }] },
      });
      throw err;
    }
  }

  // ── Plano de Contas ───────────────────────────────────────────

  private async importChartOfAccounts(
    companyId: string,
    accounts:  EcdRegI050[],
    stats:     any,
    errors:    any[],
  ): Promise<void> {
    this.logger.log(`Importando ${accounts.length} contas para empresa ${companyId}`);

    const sorted = [...accounts].sort((a, b) => a.level - b.level);

    const systemUser = await this.prisma.user.findFirst({
      where: { email: 'admin@ledgr.com' },
    });

    for (const acc of sorted) {
      try {
        const normalizedCode = acc.code;

        let parentId: string | null = null;
        if (acc.parentCode) {
          const normalizedParentCode = acc.parentCode;
          const parent = await this.prisma.chartOfAccounts.findFirst({
            where:  { companyId, code: normalizedParentCode },
            select: { id: true },
          });
          if (parent) parentId = parent.id;
        }

        const type   = this.resolveAccountType(acc.natureCode, acc.name);
        const nature = this.resolveNature(acc.natureCode);

        const existing = await this.prisma.chartOfAccounts.findUnique({
          where: { companyId_code: { companyId, code: normalizedCode } },
        });

        if (existing) {
          await this.prisma.chartOfAccounts.update({
            where: { id: existing.id },
            data: {
              name: acc.name,
              level: acc.level,
              type,
              nature,
              isAnalytic: acc.accountType === 'A',
              parentId,
              spedCode: acc.code,
            },
          });
        } else {
          await this.prisma.chartOfAccounts.create({
            data: {
              code:        normalizedCode,
              name:        acc.name,
              level:       acc.level,
              type,
              nature,
              isAnalytic:  acc.accountType === 'A',
              parentId,
              spedCode:    acc.code,
              isActive:    true,
              createdById: systemUser?.id,
              companyId,
            } as any,
          });
        }

        stats.accounts++;
      } catch (err) {
        stats.accountsSkipped++;
        errors.push({ block: 'I050', message: `Conta ${acc.code}: ${err.message}` });
      }
    }

    this.logger.log(
      `Plano de contas: ${stats.accounts} importadas, ${stats.accountsSkipped} ignoradas`,
    );
  }

  // ── Saldos Periódicos ─────────────────────────────────────────

  private async importBalances(
    companyId: string,
    parsed:    EcdParsed,
    stats:     any,
    errors:    any[],
    userId:    string,
  ): Promise<void> {
    let isFirstPeriod = true;
    for (const { period, balances } of parsed.periods) {
      const periodStart   = this.parser.parseDate(period.periodStart);
      const periodEnd     = this.parser.parseDate(period.periodEnd);
      const referenceDate = periodEnd;
      // Para o primeiro período, salvar saldo de abertura como referenceDate = periodStart - 1 dia
      const openingDate = new Date(periodStart.getTime() - 24 * 60 * 60 * 1000);

      const deleted = await this.prisma.accountBalance.deleteMany({
        where: { companyId, referenceDate: { gte: openingDate, lte: periodEnd } },
      });
      if (deleted.count > 0) stats.balancesReplaced += deleted.count;

      for (const bal of balances) {
        try {
          const account = await this.prisma.chartOfAccounts.findFirst({
            where: {
              companyId,
              OR: [
                { code:     bal.accountCode },
                { code:     normalizeAccountCode(bal.accountCode) },
                { spedCode: bal.accountCode },
              ],
            },
            select: { id: true },
          });

          if (!account) {
            errors.push({
              block:   "I155",
              message: `Conta "${bal.accountCode}" nao encontrada (periodo ${period.periodStart})`,
            });
            continue;
          }

          const balance = this.parser.toSignedBalance(bal.closingBalance, bal.closingSign);

          await this.prisma.accountBalance.upsert({
            where:  { accountId_referenceDate: { accountId: account.id, referenceDate } },
            create: { accountId: account.id, companyId, balance, referenceDate, createdBy: userId, updatedBy: userId } as any,
            update: { balance, updatedBy: userId },
          });

          // Saldo de abertura do primeiro periodo (referenceDate = periodStart - 1 dia)
          if (isFirstPeriod && bal.openingBalance !== 0) {
            const openingBalance = this.parser.toSignedBalance(bal.openingBalance, bal.openingSign);
            if (openingBalance !== 0) {
              await this.prisma.accountBalance.upsert({
                where:  { accountId_referenceDate: { accountId: account.id, referenceDate: openingDate } },
                create: { accountId: account.id, companyId, balance: openingBalance, referenceDate: openingDate, createdBy: userId, updatedBy: userId } as any,
                update: { balance: openingBalance, updatedBy: userId },
              });
            }
          }

          stats.balances++;
        } catch (err) {
          errors.push({ block: "I155", message: `Saldo ${bal.accountCode}: ${err.message}` });
        }
      }
      isFirstPeriod = false;
    }

    this.logger.log(
      `Saldos: ${stats.balances} importados, ${stats.balancesReplaced} substituídos`,
    );
  }

  // ── Lançamentos Contábeis (só FULL) ───────────────────────────

  private async importJournalEntries(
    companyId: string,
    parsed:    EcdParsed,
    userId:    string,
    stats:     any,
    errors:    any[],
  ): Promise<void> {
    const periodStart = this.parser.parseDate(parsed.reg0000!.periodStart);
    const periodEnd   = this.parser.parseDate(parsed.reg0000!.periodEnd);

    // Remove lançamentos ECD anteriores do mesmo período
    const existing = await this.prisma.journalEntry.findMany({
      where:  { companyId, sourceModule: 'ECD_IMPORT' as any, date: { gte: periodStart, lte: periodEnd } },
      select: { id: true },
    });
    if (existing.length > 0) {
      const ids = existing.map(e => e.id);
      await this.prisma.journalEntryItem.deleteMany({ where: { journalEntryId: { in: ids } } });
      await this.prisma.journalEntry.deleteMany({ where: { id: { in: ids } } });
      this.logger.log(`Removidos ${existing.length} lançamentos ECD anteriores.`);
    }

    // Índice code → accountId
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where:  { companyId },
      select: { id: true, code: true, spedCode: true },
    });
    const accountMap = new Map<string, string>();
    for (const a of accounts) {
      accountMap.set(a.code, a.id);
      if (a.spedCode) accountMap.set(a.spedCode, a.id);
    }

    const genId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

    const entriesData: any[] = [];
    const itemsData:   any[] = [];
    const skipped:     string[] = [];

    for (const { entry, items } of parsed.journalEntries) {
      let entryDate: Date;
      try {
        entryDate = this.parser.parseDate(entry.date);
      } catch {
        skipped.push(entry.entryNumber);
        continue;
      }

      const entryId        = genId();
      const resolvedItems: any[] = [];

      for (const item of items) {
        const accountId = accountMap.get(item.accountCode);
        if (!accountId) {
          errors.push({
            block:   'I250',
            message: `Lançamento ${entry.entryNumber}: conta "${item.accountCode}" não encontrada`,
          });
          continue;
        }
        resolvedItems.push({
          id:             genId(),
          journalEntryId: entryId,
          accountId,
          value:          item.value,
          type:           item.sign === 'D' ? 'DEBIT' : 'CREDIT',
        });
      }

      if (resolvedItems.length < 2) {
        skipped.push(entry.entryNumber);
        continue;
      }

      entriesData.push({
        id:           entryId,
        companyId,
        date:         entryDate,
        description:  `ECD - ${entry.entryNumber} (${entry.type})`,
        reference:    entry.entryNumber,
        sourceModule: 'ECD_IMPORT' as any,
        createdById:  userId,
        createdAt:    new Date(),
      });
      itemsData.push(...resolvedItems);
    }

    const BATCH = 5000;
    for (let i = 0; i < entriesData.length; i += BATCH) {
      await this.prisma.journalEntry.createMany({ data: entriesData.slice(i, i + BATCH), skipDuplicates: true });
    }
    for (let i = 0; i < itemsData.length; i += BATCH) {
      await this.prisma.journalEntryItem.createMany({ data: itemsData.slice(i, i + BATCH), skipDuplicates: true });
    }

    stats.journalEntries = entriesData.length;
    stats.journalItems   = itemsData.length;

    this.logger.log(
      `Lançamentos: ${stats.journalEntries} entradas, ${stats.journalItems} partidas. ` +
      `Ignorados: ${skipped.length}`,
    );
  }

  // ── Consistência I155 vs I250 (só FULL) ──────────────────────

  private async validateEcdConsistency(
    companyId:   string,
    periodStart: Date,
    periodEnd:   Date,
  ): Promise<EcdImportResult['consistency']> {
    const allBalances = await this.prisma.accountBalance.findMany({
      where:   { companyId, referenceDate: { gte: periodStart, lte: periodEnd } },
      include: { account: { select: { code: true, name: true } } },
      orderBy: { referenceDate: 'desc' },
    });

    // Deduplica: mais recente por conta
    const seen = new Set<string>();
    const ecdBalances = allBalances.filter(bal => {
      if (seen.has(bal.accountId)) return false;
      seen.add(bal.accountId);
      return true;
    });

    const items = await this.prisma.journalEntryItem.findMany({
      where: {
        journalEntry: {
          companyId,
          sourceModule: 'ECD_IMPORT' as any,
          date: { gte: periodStart, lte: periodEnd },
        },
      },
      select: { accountId: true, value: true, type: true },
    });

    const calcMap = new Map<string, number>();
    for (const item of items) {
      const cur   = calcMap.get(item.accountId) ?? 0;
      const delta = item.type === 'DEBIT' ? Number(item.value) : -Number(item.value);
      calcMap.set(item.accountId, cur + delta);
    }

    let consistent = 0, divergent = 0, missing = 0;
    const details: any[] = [];

    for (const bal of ecdBalances) {
      const ecdBalance  = Number(bal.balance);
      const calcBalance = calcMap.get(bal.accountId) ?? 0;
      const difference  = calcBalance - ecdBalance;
      const hasMoves    = calcMap.has(bal.accountId);

      if (Math.abs(ecdBalance) < 0.01) continue;

      if (!hasMoves) {
        missing++;
        details.push({ accountCode: bal.account.code, accountName: bal.account.name, ecdBalance, calcBalance: 0, difference: -ecdBalance, diagnosis: 'Sem lançamentos importados' });
      } else if (Math.abs(difference) > 0.01) {
        divergent++;
        details.push({ accountCode: bal.account.code, accountName: bal.account.name, ecdBalance, calcBalance, difference, diagnosis: 'Soma dos I250 diverge do I155' });
      } else {
        consistent++;
      }
    }

    details.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
    return { consistent, divergent, missing, details };
  }

  // ── Helpers ───────────────────────────────────────────────────

  private resolveAccountType(
    natureCode: string,
    name: string,
  ): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' {
    switch (natureCode) {
      case '01': return 'ASSET';
      case '02': return 'LIABILITY';
      case '03': return 'EQUITY';
      case '04': {
        const upper   = name.toUpperCase();
        const revenue = ['RECEITA', 'FATURAMENTO', 'VENDAS', 'RECEBI', 'RENDA'];
        return revenue.some(k => upper.includes(k)) ? 'REVENUE' : 'EXPENSE';
      }
      case '05': return 'ASSET';
      default:   return 'ASSET';
    }
  }

  private resolveNature(natureCode: string): 'DEBIT' | 'CREDIT' {
    switch (natureCode) {
      case '01': return 'DEBIT';
      case '02': return 'CREDIT';
      case '03': return 'CREDIT';
      case '05': return 'DEBIT';
      default:   return 'DEBIT';
    }
  }
}
