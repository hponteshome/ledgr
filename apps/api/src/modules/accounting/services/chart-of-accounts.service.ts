// apps/api/src/modules/accounting/services/chart-of-accounts.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AccountType, AccountNature, Prisma } from '@prisma/client';
import { normalizeAccountCode } from '@/utils/normalize-account-code';
import {
  CreateAccountDto, UpdateAccountDto, AccountFilterDto,
  AccountMoveDto, ImportAccountsDto, BulkOperationDto,
} from '../dto/chart-of-accounts.dto';
import { AccountingMaskService, getLevelFromCode } from './accounting-mask.service';

@Injectable()
export class ChartOfAccountsService {
  constructor(
    private prisma: PrismaService,
    private maskService: AccountingMaskService,
  ) {}

  // ── Saldo de uma conta ─────────────────────────────────────────────────────

  async getAccountBalance(companyId: string, id: string) {
    await this.findOne(companyId, id);

    const balance = await this.prisma.accountBalance.findFirst({
      where: { accountId: id },
      orderBy: { referenceDate: 'desc' },
    });

    const journalEntries = await this.prisma.journalEntryItem.count({
      where: { accountId: id },
    });

    return {
      balance: balance?.balance || 0,
      journalEntries,
    };
  }

  // ── Listar contas com filtros ──────────────────────────────────────────────

  async findAll(companyId: string, filters: AccountFilterDto) {
    const where: Prisma.ChartOfAccountsWhereInput = {
      companyId,
      ...(filters.showInactive ? {} : { isActive: true }),
    };

    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
        { spedCode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.parentCode) {
      const parent = await this.prisma.chartOfAccounts.findFirst({
        where: { companyId, code: filters.parentCode },
      });
      if (parent) where.parentId = parent.id;
    }

    if (filters.types?.length)   where.type   = { in: filters.types };
    if (filters.natures?.length) where.nature = { in: filters.natures };
    if (filters.onlyAnalytic)    where.isAnalytic = true;
    if (filters.onlySynthetic)   where.isAnalytic = false;

    const page  = filters.page  ? Number(filters.page)  : 1;
    const limit = filters.limit ? Number(filters.limit) : 50;

    const [total, items] = await Promise.all([
      this.prisma.chartOfAccounts.count({ where }),
      this.prisma.chartOfAccounts.findMany({
        where,
        include: {
          parent:   { select: { id: true, code: true, name: true } },
          children: { select: { id: true, code: true, name: true, isAnalytic: true }, take: 10 },
          _count:   { select: { children: true } },
        },
        orderBy: { code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      pages: Math.ceil(total / limit),
      items: items.map(item => ({
        ...item,
        hasChildren: item._count.children > 0,
        childCount:  item._count.children,
        _count:      undefined,
      })),
    };
  }

  // ── Buscar uma conta específica ────────────────────────────────────────────

  async findOne(companyId: string, id: string) {
    const account = await this.prisma.chartOfAccounts.findFirst({
      where: { id, companyId },
      include: {
        parent:    { select: { id: true, code: true, name: true } },
        children:  { select: { id: true, code: true, name: true, isAnalytic: true, isActive: true }, orderBy: { code: 'asc' } },
        createdBy: { select: { id: true, email: true, fullName: true } },
        updatedBy: { select: { id: true, email: true, fullName: true } },
        _count:    { select: { children: true, journalItems: true, balances: true } },
      },
    });

    if (!account) throw new NotFoundException('Conta não encontrada');
    return account;
  }

  // ── Criar nova conta ───────────────────────────────────────────────────────

  async create(companyId: string, userOrId: any, dto: CreateAccountDto) {
    // Normaliza userId — suporta string direta ou objeto do decorator legado
    const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;

    const normalizedCode = normalizeAccountCode(dto.code);

    // Verificar duplicata
    const existing = await this.prisma.chartOfAccounts.findFirst({
      where: { companyId, code: normalizedCode },
    });
    if (existing) {
      throw new BadRequestException(`Código ${normalizedCode} já está em uso`);
    }

    // Resolver pai
    let parentId: string | null = dto.parentId || null;
    let level   = getLevelFromCode(normalizedCode); // calculado pelo código, não pelo pai
    let type    = dto.type;
    let nature  = dto.nature;

    if (dto.parentId || dto.parentCode) {
      const parent = await this.findParent(companyId, dto.parentId, dto.parentCode);
      parentId = parent.id;
      level    = parent.level + 1;
      type     = type   || parent.type;
      nature   = nature || parent.nature;

      // Código filho deve começar com código do pai
      if (!normalizedCode.startsWith(parent.code + '.')) {
        throw new BadRequestException(
          `Código "${normalizedCode}" deve começar com "${parent.code}." para ser filho desta conta.`
        );
      }
    }

    if (level === 1 && (!type || !nature)) {
      throw new BadRequestException('Contas de nível 1 devem ter tipo e natureza definidos');
    }

    // Validar contra máscara vigente
    await this.maskService.validateCode(companyId, normalizedCode);

    const account = await this.prisma.chartOfAccounts.create({
      data: {
        companyId,
        code:        normalizedCode,
        name:        dto.name,
        level,
        type,
        nature,
        isAnalytic:  dto.isAnalytic  || false,
        parentId,
        spedCode:    dto.spedCode    || null,
        ifrsCode:    dto.ifrsCode    || null,
        usgaapCode:  dto.usgaapCode  || null,
        eSocialCode: dto.eSocialCode || null,
        createdById: userId,
        isActive:    true,
      } as any,
    });

    return { ...account, message: 'Conta criada com sucesso' };
  }

  // ── Atualizar conta ────────────────────────────────────────────────────────

  async update(companyId: string, userId: string, id: string, dto: UpdateAccountDto) {
    const account = await this.findOne(companyId, id);

    if (dto.isAnalytic !== undefined && dto.isAnalytic !== account.isAnalytic) {
      const hasChildren = await this.prisma.chartOfAccounts.count({ where: { parentId: id } });
      if (hasChildren > 0) {
        throw new BadRequestException('Não é possível alterar analiticidade de conta que possui filhos');
      }
    }

    const updated = await this.prisma.chartOfAccounts.update({
      where: { id },
      data: {
        name:        dto.name,
        isAnalytic:  dto.isAnalytic,
        spedCode:    dto.spedCode,
        ifrsCode:    dto.ifrsCode,
        usgaapCode:  dto.usgaapCode,
        eSocialCode: dto.eSocialCode,
        updatedById: userId,
      },
    });

    return { ...updated, message: 'Conta atualizada com sucesso' };
  }

  // ── Excluir conta ──────────────────────────────────────────────────────────

  async remove(companyId: string, id: string, options: { permanent?: boolean } = {}) {
    await this.findOne(companyId, id);

    const childCount = await this.prisma.chartOfAccounts.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException('Não é possível excluir conta que possui contas filhas');
    }

    const itemCount = await this.prisma.journalEntryItem.count({ where: { accountId: id } });
    if (itemCount > 0 && options.permanent) {
      throw new BadRequestException(
        'Não é possível excluir permanentemente conta com lançamentos. Utilize exclusão lógica.'
      );
    }

    if (options.permanent && itemCount === 0) {
      await this.prisma.chartOfAccounts.delete({ where: { id } });
      return { message: 'Conta excluída permanentemente' };
    }

    await this.prisma.chartOfAccounts.update({ where: { id }, data: { isActive: false } });
    return { message: 'Conta desativada com sucesso' };
  }

  // ── Mover conta na hierarquia ──────────────────────────────────────────────

  async move(companyId: string, id: string, dto: AccountMoveDto) {
    const account = await this.findOne(companyId, id);

    let newParentId: string | null = null;
    let newLevel = 1;

    if (dto.newParentId || dto.newParentCode) {
      const newParent = await this.findParent(companyId, dto.newParentId, dto.newParentCode);
      newParentId = newParent.id;
      newLevel    = newParent.level + 1;
      await this.validateNoCycle(id, newParentId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.chartOfAccounts.update({ where: { id }, data: { parentId: newParentId } });
      await this.updateChildrenLevels(tx, id, newLevel - account.level);
    });

    return this.findOne(companyId, id);
  }

  // ── Ativar/desativar conta ─────────────────────────────────────────────────

  async toggleStatus(companyId: string, id: string, active: boolean) {
    await this.findOne(companyId, id);
    return this.prisma.chartOfAccounts.update({ where: { id }, data: { isActive: active } });
  }

  // ── Importar contas em lote ────────────────────────────────────────────────

  async importAccounts(companyId: string, userId: string, dto: ImportAccountsDto) {
    const results = { total: dto.accounts.length, created: 0, updated: 0, skipped: 0, errors: [] as any[] };

    for (const item of dto.accounts) {
      try {
        const normalizedCode = normalizeAccountCode(item.code);

        let parentId: string | null = null;
        if (item.parentCode) {
          const parent = await this.prisma.chartOfAccounts.findFirst({
            where: { companyId, code: normalizeAccountCode(item.parentCode) },
          });
          if (parent) parentId = parent.id;
        }

        const existing = await this.prisma.chartOfAccounts.findFirst({
          where: { companyId, code: normalizedCode },
        });

        if (existing) {
          if (dto.strategy === 'skip') { results.skipped++; continue; }
          if (dto.strategy === 'overwrite' || dto.strategy === 'upsert') {
            await this.prisma.chartOfAccounts.update({
              where: { id: existing.id },
              data:  { name: item.name, type: item.type, nature: item.nature, isAnalytic: item.isAnalytic || false, parentId, spedCode: item.spedCode || item.code },
            });
            results.updated++;
          }
        } else {
          let level = 1;
          if (parentId) {
            const parent = await this.prisma.chartOfAccounts.findUnique({ where: { id: parentId } });
            level = parent ? parent.level + 1 : 1;
          }
          await this.prisma.chartOfAccounts.create({
            data: {
              companyId, code: normalizedCode, name: item.name, level,
              type: item.type, nature: item.nature, isAnalytic: item.isAnalytic || false,
              parentId, spedCode: item.spedCode || item.code, createdById: userId, isActive: true,
            } as any,
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push({ code: item.code, error: error.message });
      }
    }

    return results;
  }

  // ── Operações em lote ──────────────────────────────────────────────────────

  async bulkOperation(companyId: string, userId: string, dto: BulkOperationDto) {
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: dto.accountIds }, companyId },
    });

    if (accounts.length !== dto.accountIds.length) {
      throw new BadRequestException('Algumas contas não foram encontradas');
    }

    switch (dto.operation) {
      case 'activate':
        await this.prisma.chartOfAccounts.updateMany({ where: { id: { in: dto.accountIds } }, data: { isActive: true } });
        return { message: `${accounts.length} contas ativadas` };

      case 'deactivate':
        await this.prisma.chartOfAccounts.updateMany({ where: { id: { in: dto.accountIds } }, data: { isActive: false } });
        return { message: `${accounts.length} contas desativadas` };

      case 'delete':
        for (const account of accounts) {
          const childCount = await this.prisma.chartOfAccounts.count({ where: { parentId: account.id } });
          if (childCount > 0) throw new BadRequestException(`Conta ${account.code} possui contas filhas`);
        }
        if (dto.permanent) {
          await this.prisma.chartOfAccounts.deleteMany({ where: { id: { in: dto.accountIds } } });
          return { message: `${accounts.length} contas excluídas permanentemente` };
        }
        await this.prisma.chartOfAccounts.updateMany({ where: { id: { in: dto.accountIds } }, data: { isActive: false } });
        return { message: `${accounts.length} contas desativadas` };

      case 'export':
        return accounts.map(a => ({ code: a.code, name: a.name, type: a.type, nature: a.nature, isAnalytic: a.isAnalytic }));

      default:
        throw new BadRequestException('Operação inválida');
    }
  }

  // ── Validar estrutura do plano ─────────────────────────────────────────────

  async validateStructure(companyId: string) {
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId }, orderBy: { code: 'asc' },
    });

    const issues = [];
    const codeMap = new Map();

    for (const acc of accounts) {
      if (codeMap.has(acc.code)) {
        issues.push({ type: 'DUPLICATE_CODE', code: acc.code, accounts: [codeMap.get(acc.code), acc.id] });
      }
      codeMap.set(acc.code, acc.id);
    }

    for (const acc of accounts) {
      if (acc.parentId) {
        const parent = accounts.find(a => a.id === acc.parentId);
        if (!parent) {
          issues.push({ type: 'ORPHAN_CHILD', code: acc.code, message: 'Conta filha sem pai válido' });
        } else if (parent.level !== acc.level - 1) {
          issues.push({ type: 'LEVEL_MISMATCH', code: acc.code, message: `Nível ${acc.level} mas pai tem nível ${parent.level}` });
        }
      }
    }

    const syntheticWithEntries = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, isAnalytic: false, journalItems: { some: {} } }, take: 100,
    });

    if (syntheticWithEntries.length > 0) {
      issues.push({ type: 'SYNTHETIC_WITH_ENTRIES', count: syntheticWithEntries.length, examples: syntheticWithEntries.slice(0, 5).map(a => a.code) });
    }

    return {
      valid:         issues.length === 0,
      totalAccounts: accounts.length,
      issues,
      hasOrphans:    issues.some(i => i.type === 'ORPHAN_CHILD'),
      hasDuplicates: issues.some(i => i.type === 'DUPLICATE_CODE'),
    };
  }

  // ── Sugerir próximo código (usa AccountingMaskService) ─────────────────────

  async suggestCode(companyId: string, parentId: string) {
    return this.maskService.suggestChildCode(companyId, parentId);
  }

  // ── Árvore com saldos ──────────────────────────────────────────────────────

  async getTree(companyId: string, date?: string) {
    const refDate = date ? new Date(date + 'T23:59:59Z') : new Date();

    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId }, orderBy: { code: 'asc' },
    });

    const ecdBalances = await this.prisma.accountBalance.findMany({
      where: { companyId, referenceDate: { lte: refDate } },
      orderBy: { referenceDate: 'desc' },
    });

    const ecdMap = new Map<string, number>();
    for (const bal of ecdBalances) {
      if (!ecdMap.has(bal.accountId)) ecdMap.set(bal.accountId, Number(bal.balance));
    }

    const journalItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { lte: refDate } } },
      select: { accountId: true, value: true, type: true },
    });

    const calcMap = new Map<string, number>();
    for (const item of journalItems) {
      const current = calcMap.get(item.accountId) ?? 0;
      const delta   = item.type === 'DEBIT' ? Number(item.value) : -Number(item.value);
      calcMap.set(item.accountId, current + delta);
    }

    const accountsWithBalances = accounts.map(a => ({
      ...a,
      calculatedBalance: calcMap.get(a.id) ?? 0,
      ecdBalance:        ecdMap.get(a.id)  ?? null,
    }));

    return this.buildTree(accountsWithBalances);
  }

  private buildTree(accounts: any[], parentCode: string | null = null): any[] {
    const children = accounts.filter(a => {
      const parts = a.code.split('.');
      if (parts.length === 1) return parentCode === null;
      return parts.slice(0, -1).join('.') === parentCode;
    });

    return children.map(a => {
      const builtChildren = this.buildTree(accounts, a.code);

      const calculatedBalance = builtChildren.length > 0
        ? builtChildren.reduce((sum, c) => sum + (c.calculatedBalance ?? 0), 0)
        : (a.calculatedBalance ?? 0);

      const ecdBalance = builtChildren.length > 0
        ? builtChildren.reduce((sum, c) => c.ecdBalance === null ? sum : sum + c.ecdBalance, 0)
        : a.ecdBalance;

      return {
        ...a,
        calculatedBalance,
        ecdBalance,
        difference: ecdBalance !== null ? calculatedBalance - ecdBalance : null,
        children: builtChildren,
      };
    });
  }

  // ── Validação de consistência ECD ──────────────────────────────────────────

  async validateEcdConsistency(companyId: string, periodStart: Date, periodEnd: Date) {
    const allBalances = await this.prisma.accountBalance.findMany({
      where: { companyId, referenceDate: { gte: periodStart, lte: periodEnd } },
      include: { account: true },
      orderBy: { referenceDate: 'desc' },
    });

    const seen = new Set<string>();
    const ecdBalances = allBalances.filter(bal => {
      if (seen.has(bal.accountId)) return false;
      seen.add(bal.accountId);
      return true;
    });

    const journalItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, sourceModule: 'ECD_IMPORT' as any, date: { gte: periodStart, lte: periodEnd } } },
      select: { accountId: true, value: true, type: true },
    });

    const calcMap = new Map<string, number>();
    for (const item of journalItems) {
      const current = calcMap.get(item.accountId) ?? 0;
      const delta   = item.type === 'DEBIT' ? Number(item.value) : -Number(item.value);
      calcMap.set(item.accountId, current + delta);
    }

    const divergences = [];
    const consistent  = [];

    for (const bal of ecdBalances) {
      const ecdBalance  = Number(bal.balance);
      const calcBalance = calcMap.get(bal.accountId) ?? 0;
      const difference  = calcBalance - ecdBalance;
      const entry = { accountId: bal.accountId, accountCode: bal.account.code, accountName: bal.account.name, ecdBalance, calcBalance, difference, referenceDate: bal.referenceDate };
      Math.abs(difference) > 0.01 ? divergences.push(entry) : consistent.push(entry);
    }

    const missingEntries = ecdBalances
      .filter(bal => !calcMap.has(bal.accountId) && Math.abs(Number(bal.balance)) > 0.01)
      .map(bal => ({ accountCode: bal.account.code, accountName: bal.account.name, ecdBalance: Number(bal.balance), calcBalance: 0, difference: -Number(bal.balance), reason: 'Sem lançamentos importados para esta conta' }));

    const allDivergences = [...divergences, ...missingEntries].sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return {
      summary: { totalAccounts: ecdBalances.length, consistent: consistent.length, divergent: divergences.length, missingEntries: missingEntries.length, isFullyConsistent: divergences.length === 0 && missingEntries.length === 0 },
      divergences: allDivergences,
    };
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  private async findParent(companyId: string, parentId?: string, parentCode?: string) {
    let parent = null;
    if (parentId) {
      parent = await this.prisma.chartOfAccounts.findFirst({ where: { id: parentId, companyId } });
    } else if (parentCode) {
      parent = await this.prisma.chartOfAccounts.findFirst({ where: { companyId, code: normalizeAccountCode(parentCode) } });
    }
    if (!parent) throw new BadRequestException('Conta pai não encontrada');
    return parent;
  }

  private async validateNoCycle(accountId: string, newParentId: string | null) {
    if (!newParentId) return;
    let current = await this.prisma.chartOfAccounts.findUnique({ where: { id: newParentId } });
    while (current) {
      if (current.id === accountId) throw new BadRequestException('Não é possível mover uma conta para seus próprios descendentes');
      if (!current.parentId) break;
      current = await this.prisma.chartOfAccounts.findUnique({ where: { id: current.parentId } });
    }
  }

  private async updateChildrenLevels(tx: Prisma.TransactionClient, parentId: string, levelDelta: number) {
    const children = await tx.chartOfAccounts.findMany({ where: { parentId } });
    for (const child of children) {
      await tx.chartOfAccounts.update({ where: { id: child.id }, data: { level: child.level + levelDelta } });
      await this.updateChildrenLevels(tx, child.id, levelDelta);
    }
  }
}