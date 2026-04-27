// apps/api/src/modules/sped/ecd/services/ecd-viewer.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { EcdViewerResponse } from '../dto/ecd-viewer-response.dto';

@Injectable()
export class EcdViewerService {
  constructor(private prisma: PrismaService) {}

  async getImportDetails(importId: string): Promise<EcdViewerResponse> {
    const ecdImport = await this.prisma.ecdImport.findUnique({
      where: { id: importId },
      include: {
        company: true,
      },
    });

    if (!ecdImport) throw new NotFoundException('Importação não encontrada.');

    // Busca o Plano de Contas vinculado à empresa desta importação
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId: ecdImport.companyId },
      include: {
        balances: {
          // Filtramos pelo período final da importação para pegar o saldo exato
          where: { referenceDate: ecdImport.periodEnd },
          take: 1
        }
      },
      orderBy: { code: 'asc' },
    });

    const stats = ecdImport.stats as any;

    return {
      summary: {
        companyName: ecdImport.company.legalName,
        cnpj: ecdImport.company.taxId,
        // Forçamos o pt-BR para evitar inconsistências em containers/nuvem
        period: `${ecdImport.periodStart.toLocaleDateString('pt-BR')} - ${ecdImport.periodEnd.toLocaleDateString('pt-BR')}`,
        layoutVersion: ecdImport.layoutVersion,
        contentType: stats?.contentType || 'UNKNOWN',
      },
      accounts: accounts.map(acc => ({
        code: acc.code,
        name: acc.name,
        level: acc.level,
        type: acc.type, // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
        isAnalytic: acc.isAnalytic,
        // Garantimos que o valor seja numérico para o formatador do Frontend
        balance: Number(acc.balances[0]?.balance || 0),
      })),
      // Mapeamento exato do que o EcdImporterService gera no método validateEcdConsistency
      consistency: stats?.consistency ? {
        consistent: stats.consistency.consistent,
        divergent: stats.consistency.divergent,
        missing: stats.consistency.missing,
        details: stats.consistency.details
      } : undefined
    };
  }
}