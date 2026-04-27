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
}
