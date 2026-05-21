// ============================================================
// LEDGR — apps/api/src/modules/bank-import/bank-import.service.ts
// ============================================================
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { BankParserService, buildGroupKey } from './parsers/bank-parser.service';
import { SuggestionService } from './suggestion.service';
import { Prisma } from '@prisma/client';

export interface ClassifyGroupDto {
  groupKey:    string;
  accountId:   string;
  counterAccountId: string; // conta bancária
  memo:        string;
  costCenter?: string;
  transactionIds?: string[]; // se null: aplica a todo o grupo
}

export interface PostStatementDto {
  statementId:    string;
  groups:         ClassifyGroupDto[];
  journalDate?:   string; // default: data de cada transação
}

@Injectable()
export class BankImportService {
  constructor(
    private readonly prisma:      PrismaService,
    private readonly parser:      BankParserService,
    private readonly suggestion:  SuggestionService,
  ) {}

  // ── 1. Upload e parse ────────────────────────────────────────
  async uploadStatement(
    companyId: string,
    buffer:    Buffer,
    fileName:  string,
    userId:    string,
  ) {
    const parsed = this.parser.parse(buffer, fileName);

    if (parsed.transactions.length === 0) {
      throw new BadRequestException('Nenhuma transação encontrada no arquivo.');
    }

    // Calcula totais
    const totalDebits  = parsed.transactions.filter(t => t.type === 'DEBIT')
      .reduce((s, t) => s + t.amount, 0);
    const totalCredits = parsed.transactions.filter(t => t.type === 'CREDIT')
      .reduce((s, t) => s + t.amount, 0);

    // Cria o cabeçalho do extrato
    const statement = await this.prisma.bankStatement.create({
      data: {
        companyId,
        bankCode:       parsed.bankCode as any,
        bankName:       parsed.bankName,
        agency:         parsed.agency,
        account:        parsed.account,
        periodFrom:     parsed.periodFrom,
        periodTo:       parsed.periodTo,
        fileName,
        fileFormat:     fileName.split('.').pop()?.toUpperCase() ?? 'XLS',
        totalLines:     parsed.transactions.length,
        totalDebits:    new Prisma.Decimal(totalDebits.toFixed(2)),
        totalCredits:   new Prisma.Decimal(totalCredits.toFixed(2)),
        openingBalance: parsed.openingBalance != null ? new Prisma.Decimal(parsed.openingBalance.toFixed(2)) : null,
        closingBalance: parsed.closingBalance != null ? new Prisma.Decimal(parsed.closingBalance.toFixed(2)) : null,
        createdById:    userId,
      },
    });

    // Busca sugestões para todas as transações de uma vez
    const suggestions = await this.suggestion.suggestBatch(
      companyId,
      parsed.transactions.map(t => ({ descriptionNorm: t.descriptionNorm, type: t.type })),
    );

    // Salva as transações com sugestões
    const txData = parsed.transactions.map((tx, i) => ({
      companyId,
      statementId:         statement.id,
      transactionDate:     tx.transactionDate,
      description:         tx.description,
      descriptionNorm:     tx.descriptionNorm,
      amount:              new Prisma.Decimal(tx.amount.toFixed(2)),
      type:                tx.type as any,
      balance:             tx.balance != null ? new Prisma.Decimal(tx.balance.toFixed(2)) : null,
      bankRef:             tx.bankRef,
      agency:              tx.agency,
      groupKey:            buildGroupKey(tx.descriptionNorm),
      suggestedAccountId:  suggestions[i].accountId,
      suggestionSource:    suggestions[i].source,
      suggestionConfidence: suggestions[i].confidence,
      // Memo template como sugestão de histórico
      memo:                suggestions[i].memoTemplate ?? tx.description,
    }));

    await this.prisma.bankTransaction.createMany({ data: txData });

    return {
      statementId:  statement.id,
      bankName:     parsed.bankName,
      bankCode:     parsed.bankCode,
      totalLines:   parsed.transactions.length,
      totalDebits,
      totalCredits,
      periodFrom:   parsed.periodFrom,
      periodTo:     parsed.periodTo,
    };
  }

  // ── 2. Retorna grupos para a tela de classificação ───────────
  async getGroups(companyId: string, statementId: string) {
    await this.verifyStatement(companyId, statementId);

    const transactions = await this.prisma.bankTransaction.findMany({
      where:   { statementId, status: { in: ['PENDING', 'CLASSIFIED'] as any } },
      orderBy: [{ type: 'asc' }, { groupKey: 'asc' }, { transactionDate: 'asc' }],
    });

    // Agrupa por groupKey
    const groups: Record<string, {
      groupKey:            string;
      type:                string;
      description:         string;   // descrição mais comum do grupo
      count:               number;
      totalAmount:         number;
      transactions:        typeof transactions;
      suggestedAccountId:  string | null;
      suggestionSource:    string | null;
      suggestionConfidence: number | null;
      memo:                string | null;
    }> = {};

    for (const tx of transactions) {
      const key = tx.groupKey ?? tx.descriptionNorm.slice(0, 30);
      if (!groups[key]) {
        groups[key] = {
          groupKey:             key,
          type:                 tx.type,
          description:          tx.description,
          count:                0,
          totalAmount:          0,
          transactions:         [],
          suggestedAccountId:   tx.suggestedAccountId,
          suggestionSource:     tx.suggestionSource,
          suggestionConfidence: tx.suggestionConfidence,
          memo:                 tx.memo,
        };
      }
      groups[key].count++;
      groups[key].totalAmount += Number(tx.amount);
      groups[key].transactions.push(tx);
    }

    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount);
  }

  // ── 3. Classifica grupo (salva conta + histórico) ─────────────
  async classifyGroup(
    companyId:   string,
    statementId: string,
    dto:         ClassifyGroupDto,
    userId:      string,
  ) {
    await this.verifyStatement(companyId, statementId);

    const where: any = {
      statementId,
      companyId,
      groupKey: dto.groupKey,
    };
    if (dto.transactionIds?.length) {
      where.id = { in: dto.transactionIds };
    }

    const updated = await this.prisma.bankTransaction.updateMany({
      where,
      data: {
        accountId:       dto.accountId,
        counterAccountId: dto.counterAccountId,
        memo:            dto.memo,
        costCenter:      dto.costCenter,
        status:          'CLASSIFIED' as any,
      },
    });

    // Aprende a regra para futuras importações
    const sample = await this.prisma.bankTransaction.findFirst({ where });
    if (sample) {
      await this.suggestion.learn(
        companyId,
        sample.descriptionNorm,
        sample.type as 'DEBIT' | 'CREDIT',
        dto.accountId,
        dto.memo,
        userId,
      );
    }

    return { updated: updated.count };
  }

  // ── 4. Confirma e gera JournalEntries ────────────────────────
  async postStatement(
    companyId: string,
    dto:       PostStatementDto,
    userId:    string,
  ) {
    const stmt = await this.verifyStatement(companyId, dto.statementId);

    // Primeiro aplica todas as classificações pendentes
    for (const group of dto.groups) {
      await this.classifyGroup(companyId, dto.statementId, group, userId);
    }

    // Busca todas as transações classificadas
    const transactions = await this.prisma.bankTransaction.findMany({
      where: { statementId: dto.statementId, status: 'CLASSIFIED' as any },
      orderBy: { transactionDate: 'asc' },
    });

    if (transactions.length === 0) {
      throw new BadRequestException('Nenhuma transação classificada para lançar.');
    }

    // Verifica se todas têm conta contábil
    const sem = transactions.filter(t => !t.accountId || !t.counterAccountId);
    if (sem.length > 0) {
      throw new BadRequestException(
        `${sem.length} transação(ões) sem conta contábil. Classifique todos os grupos antes de confirmar.`
      );
    }

    let posted = 0;
    const errors: { id: string; error: string }[] = [];

    for (const tx of transactions) {
      try {
        await this.prisma.$transaction(async (prisma) => {
          // Gera lançamento contábil duplo
          const journalEntry = await prisma.journalEntry.create({
            data: {
              companyId,
              date:        tx.transactionDate,
              description: tx.memo ?? tx.description,
              reference:   tx.bankRef ?? tx.id,
              sourceModule: 'BANK_IMPORT',
              createdById:  userId,
            },
          });

          // Débito e crédito conforme tipo da transação
          // DEBIT: dinheiro SAI da conta bancária → débito na despesa, crédito na conta banco
          // CREDIT: dinheiro ENTRA na conta bancária → débito na conta banco, crédito na receita
          await prisma.journalEntryItem.createMany({
            data: tx.type === 'DEBIT'
              ? [
                  { journalEntryId: journalEntry.id, accountId: tx.accountId!,        type: 'DEBIT',  value: tx.amount },
                  { journalEntryId: journalEntry.id, accountId: tx.counterAccountId!, type: 'CREDIT', value: tx.amount },
                ]
              : [
                  { journalEntryId: journalEntry.id, accountId: tx.counterAccountId!, type: 'DEBIT',  value: tx.amount },
                  { journalEntryId: journalEntry.id, accountId: tx.accountId!,        type: 'CREDIT', value: tx.amount },
                ],
          });

          // Atualiza transação como POSTED
          await prisma.bankTransaction.update({
            where: { id: tx.id },
            data:  { status: 'POSTED' as any, journalEntryId: journalEntry.id },
          });
        });
        posted++;
      } catch (e: any) {
        errors.push({ id: tx.id, error: e.message });
      }
    }

    return {
      posted,
      errors,
      total: transactions.length,
      statementId: dto.statementId,
    };
  }

  // ── 5. Lista extratos importados ─────────────────────────────
  async listStatements(companyId: string) {
    return this.prisma.bankStatement.findMany({
      where:   { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { transactions: true } },
      },
    });
  }

  // ── Helper ────────────────────────────────────────────────────
  private async verifyStatement(companyId: string, statementId: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId, deletedAt: null },
    });
    if (!stmt) throw new NotFoundException('Extrato não encontrado.');
    return stmt;
  }


  async previewExcelMapped(companyId: string, buffer: Buffer) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(worksheet);

    if (!rows || rows.length === 0) throw new BadRequestException('Planilha vazia.');

    const normKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const rowKeys = (r: any) => Object.fromEntries(Object.entries(r).map(([k, v]) => [normKey(k), v]));

    const findAccount = async (code: any) => {
      if (!code) return null;
      const c = String(code).trim().padStart(6, '0');
      return this.prisma.chartOfAccounts.findFirst({
        where: { companyId, deletedAt: null, OR: [{ reducedCode: c }, { code: c }] },
        select: { id: true, code: true, name: true, reducedCode: true },
      });
    };

    const lines: Array<{
      row: number;
      date: string;
      description: string;
      value: number;
      type: string;
      debitCode: string;
      creditCode: string;
      debitAccount: any;
      creditAccount: any;
      status: 'ok' | 'warn' | 'error';
      issues: string[];
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rowKeys(rows[i]);
      const issues: string[] = [];
      const dateRaw    = r['data'] as any;
      const memoRaw    = r['complemento'] ?? r['descricao'] ?? r['historico'] ?? '';
      const valorRaw   = r['valor'] ?? null;
      const debitCode  = r['conta debito'] ?? r['conta'] ?? null;
      const creditCode = r['conta credito'] ?? r['contrapartida'] ?? null;

      if (!debitCode)  issues.push('Conta Débito ausente');
      if (!creditCode) issues.push('Conta Crédito ausente');

      const valorNum = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw ?? '0').replace(/[()]/g, '').replace(/,/g, '.'));
      const isNeg = valorNum < 0 || String(valorRaw ?? '').trim().startsWith('(');
      const type  = isNeg ? 'DEBIT' : 'CREDIT';

      const [debitAccount, creditAccount] = await Promise.all([
        findAccount(debitCode),
        findAccount(creditCode),
      ]);

      if (debitCode  && !debitAccount)  issues.push(`Conta Débito '${debitCode}' não encontrada`);
      if (creditCode && !creditAccount) issues.push(`Conta Crédito '${creditCode}' não encontrada`);

      const status = issues.length === 0 ? 'ok' : (debitAccount && creditAccount ? 'warn' : 'error');

      lines.push({
        row: i + 2,
        date: dateRaw instanceof Date ? dateRaw.toISOString().slice(0, 10) : String(dateRaw ?? ''),
        description: String(memoRaw),
        value: Math.abs(valorNum),
        type,
        debitCode:    String(debitCode  ?? ''),
        creditCode:   String(creditCode ?? ''),
        debitAccount,
        creditAccount,
        status,
        issues,
      });
    }

    const total   = lines.length;
    const ok      = lines.filter(l => l.status === 'ok').length;
    const errors  = lines.filter(l => l.status === 'error').length;
    const warns   = lines.filter(l => l.status === 'warn').length;
    const totalDebits  = lines.filter(l => l.type === 'DEBIT').reduce((s, l) => s + l.value, 0);
    const totalCredits = lines.filter(l => l.type === 'CREDIT').reduce((s, l) => s + l.value, 0);

    return { total, ok, errors, warns, totalDebits, totalCredits, lines };
  }

  async uploadExcelMapped(
    companyId: string,
    buffer:    Buffer,
    fileName:  string,
    userId:    string,
  ) {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any>(worksheet);

    if (!rows || rows.length === 0) {
      throw new BadRequestException('A planilha enviada esta vazia.');
    }

    const today = new Date();
    const statement = await this.prisma.bankStatement.create({
      data: {
        companyId,
        bankCode:     'GENERIC' as any,
        bankName:     'Planilha Mapeada Contabil',
        periodFrom:   today,
        periodTo:     today,
        fileName,
        fileFormat:   'XLSX',
        totalLines:   rows.length,
        totalDebits:  new Prisma.Decimal(0),
        totalCredits: new Prisma.Decimal(0),
        createdById:  userId,
      },
    });

    let importedCount = 0;
    let accumulatedDebits  = 0;
    let accumulatedCredits = 0;
    const errors: Array<{ row: number; error: string }> = [];

    const toNum = (v: any) =>
      typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));

    const findAccount = async (code: any) => {
      if (!code) return null;
      const c = String(code).trim().padStart(6, '0');
      return this.prisma.chartOfAccounts.findFirst({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { reducedCode: c },
            { code: c },
            { code: c },
          ],
        },
      });
    };
    const normKey = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const rowKeys = (r: any) => Object.fromEntries(Object.entries(r).map(([k,v]) => [normKey(k), v]));
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const r = rowKeys(row);
      if (i === 0) console.log('COLUNAS XLSX:', Object.keys(row));
      const rowNumber = i + 2;
      try {
        const dateRaw    = r['data'] as any;
        const memoRaw    = r['complemento'] ?? r['descricao'] ?? r['historico'] ?? null;
        const valorRaw   = r['valor'] ?? null;
        const debitCode  = r['conta debito'] ?? r['conta'] ?? null;
        const creditCode = r['conta credito'] ?? r['contrapartida'] ?? null;

        const transactionDate = dateRaw instanceof Date ? dateRaw : new Date(dateRaw);
        if (isNaN(transactionDate.getTime())) throw new Error('Data invalida: ' + dateRaw);

        // Valor: positivo = CREDIT, negativo ou entre parenteses = DEBIT
        if (valorRaw === null || valorRaw === undefined) throw new Error('Coluna Valor ausente.');
        const valorNum = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(/[()]/g, '').replace(/,/g, '.'));
        if (isNaN(valorNum)) throw new Error('Valor invalido na linha.');
        const isNeg = valorNum < 0 || String(valorRaw).trim().startsWith('(');
        const amountNum = Math.abs(valorNum);
        const type: 'DEBIT' | 'CREDIT' = isNeg ? 'DEBIT' : 'CREDIT';

        if (type === 'DEBIT') accumulatedDebits  += amountNum;
        else                  accumulatedCredits += amountNum;

        const debitAcc  = await findAccount(debitCode);
        const creditAcc = await findAccount(creditCode);

        if (debitCode  && !debitAcc)  throw new Error('Conta Debito '  + debitCode  + ' nao encontrada.');
        if (creditCode && !creditAcc) throw new Error('Conta Credito ' + creditCode + ' nao encontrada.');

        const isAutoPostable = debitAcc !== null && creditAcc !== null;
        const amount = new Prisma.Decimal(amountNum.toFixed(2));

        await this.prisma.$transaction(async (tx) => {
          const bankTx = await tx.bankTransaction.create({
            data: {
              companyId,
              statementId:      statement.id,
              transactionDate,
              description:      String(memoRaw),
              descriptionNorm:  String(memoRaw).trim().toUpperCase(),
              amount,
              type:             type as any,
              status:           isAutoPostable ? ('POSTED' as any) : ('PENDING' as any),
              accountId:        type === 'DEBIT' ? debitAcc?.id ?? null : creditAcc?.id ?? null,
              counterAccountId: type === 'DEBIT' ? creditAcc?.id ?? null : debitAcc?.id ?? null,
              memo:             String(memoRaw),
              groupKey:         String(memoRaw).trim().toUpperCase().slice(0, 50),
            },
          });

          if (isAutoPostable) {
            const journal = await tx.journalEntry.create({
              data: {
                companyId,
                date:         transactionDate,
                description:  String(memoRaw),
                sourceModule: 'BANK_IMPORT' as any,
                createdById:  userId,
              },
            });
            const abs = amount.abs();
            await tx.journalEntryItem.createMany({
              data: [
                { journalEntryId: journal.id, accountId: debitAcc!.id,  type: 'DEBIT'  as any, value: abs },
                { journalEntryId: journal.id, accountId: creditAcc!.id, type: 'CREDIT' as any, value: abs },
              ],
            });
            await tx.bankTransaction.update({
              where: { id: bankTx.id },
              data:  { journalEntryId: journal.id },
            });
          }
        });

        importedCount++;
      } catch (e: any) {
        errors.push({ row: rowNumber, error: e.message });
      }
    }

    await this.prisma.bankStatement.update({
      where: { id: statement.id },
      data: {
        totalDebits:  new Prisma.Decimal(accumulatedDebits.toFixed(2)),
        totalCredits: new Prisma.Decimal(accumulatedCredits.toFixed(2)),
      },
    });

    return {
      statementId:   statement.id,
      imported:      importedCount,
      errors,
      totalDebits:   accumulatedDebits,
      totalCredits:  accumulatedCredits,
    };
  }
}
