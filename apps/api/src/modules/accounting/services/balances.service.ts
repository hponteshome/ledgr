// /apps/api/src/accounting/balances.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BalancesService {
  constructor(private prisma: PrismaService) {}

  async getBalances(
    companyId: string,
    startDate: Date,
    endDate: Date,
    accountCode?: string
  ) {
    const where: any = {
      companyId,
      referenceDate: {
        gte: startDate,
        lte: endDate
      }
    };

    if (accountCode) {
      const account = await this.prisma.chartOfAccounts.findFirst({
        where: { 
          code: accountCode,
          companyId 
        }
      });
      
      if (!account) {
        throw new BadRequestException(`Conta ${accountCode} não encontrada`);
      }
      
      where.accountId = account.id;
    }

    const balances = await this.prisma.accountBalance.findMany({
      where,
      include: {
        account: {
          select: {
            code: true,
            name: true,
            type: true,
            nature: true
          }
        }
      },
      orderBy: [
        { referenceDate: 'asc' },
        { account: { code: 'asc' } }
      ]
    });

    return balances.map(b => ({
      ...b,
      balance: Number(b.balance)
    }));
  }
async getBalanceComparison(companyId: string) {
  // 1. Buscamos os saldos usando os nomes corretos do seu Schema
  const balances = await this.prisma.accountBalance.findMany({
    where: {
      companyId: companyId,
    },
    include: {
      account: {
        select: {
          code: true,
          name: true,
          type: true,
        }
      },
    },
    orderBy: [
      { referenceDate: 'asc' },
      { account: { code: 'asc' } }
    ]
  });

  // 2. Transforma os dados para o formato de comparação (Pivot)
  return this.formatForComparison(balances);
}

// 3. Adicione este método auxiliar para organizar os dados por ano
private formatForComparison(balances: any[]) {
  const accountMap = new Map();

  balances.forEach(b => {
    const year = new Date(b.referenceDate).getFullYear();
    const accountCode = b.account.code;

    if (!accountMap.has(accountCode)) {
      accountMap.set(accountCode, {
        conta: accountCode,
        descricao: b.account.name,
        saldos: {}
      });
    }

    accountMap.get(accountCode).saldos[year] = Number(b.balance);
  });

  return Array.from(accountMap.values());
}

}
