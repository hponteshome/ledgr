// apps/api/src/modules/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async kpi(companyId: string, month: string) {
    const [y, m] = (month ?? '').split('-').map(Number);
    const valid = !isNaN(y) && !isNaN(m) && m >= 1 && m <= 12;
    const now = new Date();
    const monthStart = valid ? new Date(Date.UTC(y, m - 1, 1)) : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const monthEnd   = valid ? new Date(Date.UTC(y, m, 1))     : new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

    const [apAgg, arAgg, nfPending, journalCount, fechamento, docsAguardando] = await Promise.all([

      // A Pagar — títulos em aberto com vencimento no mês
      this.prisma.apEntry.aggregate({
        where: {
          companyId,
          status: { in: ['OPEN', 'OVERDUE', 'PARTIALLY_PAID', 'SCHEDULED'] },
          dueDate: { gte: monthStart, lt: monthEnd },
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // A Receber — títulos em aberto com vencimento no mês
      this.prisma.arEntry.aggregate({
        where: {
          companyId,
          status: { in: ['OPEN', 'OVERDUE', 'PARTIAL'] },
          dueDate: { gte: monthStart, lt: monthEnd },
          deletedAt: null,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),

      // NFs sem integração
      this.prisma.fiscalDocument.count({
        where: { companyId, integrationStatus: 'PENDING', deletedAt: null },
      }),

      // Lançamentos contábeis do mês
      this.prisma.journalEntry.count({
        where: { companyId, date: { gte: monthStart, lt: monthEnd }, deletedAt: null },
      }),

      // Fechamento do mês
      this.prisma.fechamentoMensal.findFirst({
        where: { companyId, competencia: month },
        select: { status: true, competencia: true },
      }).catch(() => null),

      // Documentos aguardando assinatura (model Document, status AGUARDANDO_ASSINATURA)
      this.prisma.document.count({
        where: { companyId, status: 'AGUARDANDO_ASSINATURA', deletedAt: null },
      }).catch(() => 0),
    ]);

    return {
      apTotal:                Number(apAgg._sum.amount ?? 0),
      apCount:                apAgg._count.id,
      arTotal:                Number(arAgg._sum.amount ?? 0),
      arCount:                arAgg._count.id,
      nfPending,
      journalCount,
      fechamentoStatus:       fechamento?.status ?? null,
      fechamentoCompetencia:  fechamento?.competencia ? fechamento.competencia.slice(0,7) : null,
      docsAguardando,
    };
  }
}

