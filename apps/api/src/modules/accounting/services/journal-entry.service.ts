// apps/api/src/modules/accounting/services/journal-entry.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateJournalEntryDto {
  date:         string;
  description:  string;
  reference?:   string;
  historyCode?: string;
  type?:        'MANUAL' | 'PROVISION' | 'ADJUSTMENT';
  costCenter?:  string;
  items: Array<{
    accountId:   string;
    accountCode: string;
    value:       number;
    type:        'DEBIT' | 'CREDIT';
  }>;
}

export interface BulkDeleteFilters {
  dateFrom?:            string;
  dateTo?:              string;
  debitCodeFrom?:       string;
  debitCodeTo?:         string;
  creditCodeFrom?:      string;
  creditCodeTo?:        string;
  valueFrom?:           number;
  valueTo?:             number;
  historyCode?:         string;
  descriptionContains?: string;
  sources?:             string[];
  dryRun?:              boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class JournalEntryService {
  constructor(private prisma: PrismaService) {}

  // ── Helper: converte 'YYYY-MM-DD' para Date UTC sem fuso ───────────────────
  // Evita que new Date('2015-01-01') seja interpretado como meia-noite local,
  // o que em fuso negativo (-3) produz 2015-01-01T03:00:00Z e perde lançamentos.

  private toUTC(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private toUTCEnd(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }

  // ── Listar lançamentos ──────────────────────────────────────────────────────

  async findAll(companyId: string, params: {
    dateFrom?:    string;
    dateTo?:      string;
    search?:      string;
    sources?:     string;   // CSV: "ECD_IMPORT,ACCOUNTING"
    accountCode?: string;
    page?:        number;
    limit?:       number;
  }) {
    const { dateFrom, dateTo, search, sources, accountCode, page = 1, limit = 50 } = params;

    const where: any = { companyId };

    // ── Filtro de período ───────────────────────────────────────
    // Usa toUTC/toUTCEnd para garantir comparação correta independente do fuso
    // do servidor. JournalEntry.date é @db.Date (meia-noite UTC no PostgreSQL).
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = this.toUTC(dateFrom);
      if (dateTo)   where.date.lte = this.toUTCEnd(dateTo);
    }

    // ── Filtro de fonte ─────────────────────────────────────────
 // if (sources) {
 // where.sourceModule = { in: sources.split(',') as any[] };
// }

    // ── Filtro de busca livre ───────────────────────────────────
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference:   { contains: search, mode: 'insensitive' } },
        { items: { some: {
          account: { OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ]},
        }}},
      ];
    }

    // ── Filtro por código de conta ──────────────────────────────
    if (accountCode) {
      where.items = {
        some: { account: { code: { startsWith: accountCode } } },
      };
    }

    const [total, entries] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        include: {
          items: {
            include: {
              account: {
                select: { id: true, code: true, name: true, type: true, nature: true, isAnalytic: true, level: true  },
              },
            },
            orderBy: { type: 'asc' },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip:  (page - 1) * limit,
        take:  limit,
      }),
    ]);

const sourcesArr = sources ? sources.split(',') : null;
const filteredEntries = sourcesArr
    ? entries.filter(e => sourcesArr.includes(e.sourceModule as string))
    : entries;
const filteredTotal = filteredEntries.length;

return { 
    total: filteredTotal, 
    page, 
    pages: Math.ceil(filteredTotal / limit), 
    entries: filteredEntries 
};
  }

  // ── Totalizadores do período ────────────────────────────────────────────────

  async getTotals(companyId: string, dateFrom: string, dateTo: string) {
    const where = {
      journalEntry: {
        companyId,
        date: {
          gte: this.toUTC(dateFrom),
          lte: this.toUTCEnd(dateTo),
        },
      },
    };

    const sums = await this.prisma.journalEntryItem.groupBy({
      by:    ['type'],
      where,
      _sum:  { value: true },
      _count: { _all: true },
    });

    const totalDebit  = Number(sums.find(s => s.type === 'DEBIT')?._sum?.value  ?? 0);
    const totalCredit = Number(sums.find(s => s.type === 'CREDIT')?._sum?.value ?? 0);
    const count       = await this.prisma.journalEntry.count({
      where: { companyId, date: { gte: this.toUTC(dateFrom), lte: this.toUTCEnd(dateTo) } },
    });

    return {
      totalDebit,
      totalCredit,
      difference: totalDebit - totalCredit,
      count,
      balanced:   Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }

  // ── Lookup de conta por código ──────────────────────────────────────────────

// DEPOIS:
async lookupAccount(companyId: string, code: string) {
  const raw = code.trim();

  // Tenta exato primeiro, depois sem pontos vs com pontos
  const account = await this.prisma.chartOfAccounts.findFirst({
    where: {
      companyId,
      OR: [
        { code: raw },
        { code: raw.replace(/\./g, '') },           // digitou com ponto, banco sem
        { code: { equals: this.applyMask(raw) } },  // digitou sem ponto, tenta com máscara
      ],
    },
    select: { id: true, code: true, name: true, type: true, nature: true, isAnalytic: true },
  });

  if (!account) throw new NotFoundException(`Conta "${raw}" não encontrada.`);
  if (!account.isAnalytic) {
    throw new BadRequestException(`Conta "${account.code}" é sintética e não aceita lançamentos.`);
  }
  return account;
}

// Normaliza código bruto para formato com pontos baseado no padrão SPED 1.1.1.2.3
// Ex: "11401001" → tenta encontrar inserindo pontos progressivamente
private applyMask(raw: string): string {
  const digits = raw.replace(/\./g, '');
  // Máscara padrão SPED: 1.1.1.2.3 → 1 + 1 + 1 + 2 + 3 = 8 dígitos
  const masks = [
    [1, 1, 1, 2, 3],   // 1.1.1.XX.XXX  (8 dígitos)
    [1, 1, 2, 3],       // 1.1.XX.XXX    (7 dígitos)
    [1, 2, 3],           // 1.XX.XXX      (6 dígitos)
    [1, 1, 1, 3],       // 1.1.1.XXX     (6 dígitos)
  ];
  for (const mask of masks) {
    if (digits.length === mask.reduce((a, b) => a + b, 0)) {
      let pos = 0;
      return mask.map(len => { const s = digits.slice(pos, pos + len); pos += len; return s; }).join('.');
    }
  }
  return raw; // fallback: retorna como veio
}

  // ── Buscar um lançamento ────────────────────────────────────────────────────

  async findOne(id: string, companyId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
account: { select: { id: true, code: true, name: true, type: true, nature: true, isAnalytic: true, level: true } },
          },
        },
      },
    });
    if (!entry) throw new NotFoundException('Lançamento não encontrado.');
    return entry;
  }

  // ── Criar lançamento ────────────────────────────────────────────────────────

  async create(companyId: string, userId: string, dto: CreateJournalEntryDto) {
    // Resolve accountId a partir do accountCode quando necessário
    const resolvedItems = await this.resolveItems(companyId, dto.items);
    this.validateItems(resolvedItems);

    return this.prisma.journalEntry.create({
      data: {
        companyId,
        date:         this.toUTC(dto.date),
        description:  dto.description || '',
        reference:    dto.reference   || null,
        sourceModule: 'ACCOUNTING',
        createdById:  userId,
        items: {
          create: resolvedItems.map(i => ({
            accountId: i.accountId,
            value:     i.value,
            type:      i.type,
          })),
        },
      },
      include: {
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  // ── Editar lançamento ───────────────────────────────────────────────────────

  async update(id: string, companyId: string, userId: string, dto: CreateJournalEntryDto) {
    const entry = await this.prisma.journalEntry.findFirst({ where: { id, companyId } });
    if (!entry) throw new NotFoundException('Lançamento não encontrado.');

    if (entry.sourceModule === ('ECD_IMPORT' as any)) {
      throw new BadRequestException('Lançamentos importados do ECD não podem ser editados.');
    }

    const resolvedItems = await this.resolveItems(companyId, dto.items);
    this.validateItems(resolvedItems);

    await this.prisma.journalEntryItem.deleteMany({ where: { journalEntryId: id } });

    return this.prisma.journalEntry.update({
      where: { id },
      data: {
        date:        new Date(dto.date),
        description: dto.description,
        reference:   dto.reference || null,
        items: {
          create: resolvedItems.map(i => ({
            accountId: i.accountId,
            value:     i.value,
            type:      i.type,
          })),
        },
      },
      include: {
        items: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  // ── Estornar lançamento ─────────────────────────────────────────────────────

  async reverse(id: string, companyId: string, userId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where:   { id, companyId },
      include: { items: true },
    });
    if (!entry) throw new NotFoundException('Lançamento não encontrado.');

    return this.prisma.journalEntry.create({
      data: {
        companyId,
        date:         new Date(),
        description:  `ESTORNO — ${entry.description}`,
        reference:    `EST-${entry.reference || entry.id.substring(0, 8)}`,
        sourceModule: 'ACCOUNTING',
        createdById:  userId,
        items: {
          create: entry.items.map(i => ({
            accountId: i.accountId,
            value:     Number(i.value),
            type:      i.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
          })),
        },
      },
      include: {
        items: {
          include: { account: { select: { id: true, code: true, name: true } } },
        },
      },
    });
  }

  // ── Excluir lançamento individual ───────────────────────────────────────────

  async remove(id: string, companyId: string) {
    const entry = await this.prisma.journalEntry.findFirst({ where: { id, companyId } });
    if (!entry) throw new NotFoundException('Lançamento não encontrado.');

    // ECD só pode ser excluído via bulk-delete (com confirmação explícita)
    if (entry.sourceModule === ('ECD_IMPORT' as any)) {
      throw new BadRequestException(
        'Lançamentos ECD devem ser excluídos via "Excluir período" para garantir rastreabilidade.'
      );
    }

    await this.prisma.journalEntryItem.deleteMany({ where: { journalEntryId: id } });
    await this.prisma.journalEntry.delete({ where: { id } });
    return { message: 'Lançamento excluído.' };
  }

  // ── Exclusão em lote com preview ────────────────────────────────────────────

  // ── Exclusão em lote com preview ────────────────────────────────────────────

async bulkDelete(companyId: string, filters: BulkDeleteFilters) {
  const { dryRun = false } = filters;

  // ── Monta filtro base ───────────────────────────────────────
  const where: any = { companyId };

  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = this.toUTC(filters.dateFrom);
    if (filters.dateTo)   where.date.lte = this.toUTCEnd(filters.dateTo);
  }

  if (filters.descriptionContains) {
    where.description = { contains: filters.descriptionContains, mode: 'insensitive' };
  }

  // ── Filtros de conta (débito/crédito) ───────────────────────
  const itemFilters: any[] = [];

  if (filters.debitCodeFrom || filters.debitCodeTo) {
    const debitWhere: any = { type: 'DEBIT' };
    if (filters.debitCodeFrom) debitWhere.account = { code: { gte: filters.debitCodeFrom } };
    if (filters.debitCodeTo)   debitWhere.account = { ...debitWhere.account, code: { lte: filters.debitCodeTo } };
    itemFilters.push({ items: { some: debitWhere } });
  }

  if (filters.creditCodeFrom || filters.creditCodeTo) {
    const creditWhere: any = { type: 'CREDIT' };
    if (filters.creditCodeFrom) creditWhere.account = { code: { gte: filters.creditCodeFrom } };
    if (filters.creditCodeTo)   creditWhere.account = { ...creditWhere.account, code: { lte: filters.creditCodeTo } };
    itemFilters.push({ items: { some: creditWhere } });
  }

  if (filters.valueFrom !== undefined || filters.valueTo !== undefined) {
    const valueWhere: any = {};
    if (filters.valueFrom !== undefined) valueWhere.gte = filters.valueFrom;
    if (filters.valueTo   !== undefined) valueWhere.lte = filters.valueTo;
    itemFilters.push({ items: { some: { value: valueWhere } } });
  }

  if (itemFilters.length > 0) {
    where.AND = itemFilters;
  }

  // ── Busca IDs afetados ──────────────────────────────────────
  // Busca sem filtro de sourceModule (Prisma não aceita string no enum)
  let entries = await this.prisma.journalEntry.findMany({
    where,
    select: { id: true, date: true, sourceModule: true },
  });

  // Filtra por fonte em memória
  if (filters.sources && filters.sources.length > 0) {
    entries = entries.filter(e => filters.sources!.includes(e.sourceModule as string));
  }

  const ids = entries.map(e => e.id);
  
  // Se não há IDs, retorna vazio
  if (ids.length === 0) {
    return {
      dryRun: dryRun,
      count: 0,
      itemCount: 0,
      totalValue: 0,
      periodStart: filters.dateFrom,
      periodEnd: filters.dateTo,
      affected: [],
      message: 'Nenhum lançamento encontrado com os filtros informados.'
    };
  }

  // ── Calcula totais dos itens afetados ────────────────────────
  const items = await this.prisma.journalEntryItem.findMany({
    where: { journalEntryId: { in: ids } },
    select: { value: true }
  });

  const itemCount = items.length;
  const totalValue = items.reduce((sum, item) => sum + Number(item.value), 0);

  // ── Preview — não executa exclusão ──────────────────────────
  if (dryRun) {
    return {
      dryRun: true,
      count: ids.length,
      itemCount,
      totalValue,
      periodStart: filters.dateFrom,
      periodEnd: filters.dateTo,
      affected: ids,
    };
  }

  // ── Executa exclusão ────────────────────────────────────────
  await this.prisma.$transaction([
    this.prisma.journalEntryItem.deleteMany({
      where: { journalEntryId: { in: ids } },
    }),
    this.prisma.journalEntry.deleteMany({
      where: { id: { in: ids } },
    })
  ]);

  return {
    dryRun: false,
    deleted: ids.length,
    itemCount,
    totalValue,
    periodStart: filters.dateFrom,
    periodEnd: filters.dateTo,
    message: `${ids.length} lançamentos e ${itemCount} partidas excluídos com sucesso.`,
  };
}
  // ── Helpers ───────────────────────────────────────────────────────────────

  private async resolveItems(companyId: string, items: CreateJournalEntryDto['items']) {
    return Promise.all(items.map(async item => {
      // Se já tem accountId, usa direto
      if (item.accountId) return item;
      // Senão, resolve pelo código
      const account = await this.lookupAccount(companyId, item.accountCode);
      return { ...item, accountId: account.id };
    }));
  }

private validateItems(items: Array<{ type: string; value: number }>) {
  if (!items || items.length < 1) {
    throw new BadRequestException('O lançamento deve ter no mínimo 1 partida.');
  }
  // Só valida balanço se houver partidas dos dois lados
  const totalDebit  = items.filter(i => i.type === 'DEBIT').reduce((s, i)  => s + i.value, 0);
  const totalCredit = items.filter(i => i.type === 'CREDIT').reduce((s, i) => s + i.value, 0);

  if (totalDebit > 0 && totalCredit > 0 && Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new BadRequestException(
      `Lançamento desbalanceado: D=${totalDebit.toFixed(2)} ≠ C=${totalCredit.toFixed(2)}.`
    );
  }
}
}