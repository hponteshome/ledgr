// apps/api/src/modules/sped/visoes/accounting-views.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class AccountingViewsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Codigos RFB ─────────────────────────────────────────────────────────
  async importRfbCodes(codes: any[]) {
    await this.prisma.rfbAglutinationCode.deleteMany({
      where: { leiaute: codes[0].leiaute, anoBase: codes[0].anoBase, tipo: codes[0].tipo },
    });
    await this.prisma.rfbAglutinationCode.createMany({ data: codes, skipDuplicates: true });
    return { imported: codes.length };
  }

  async findRfbCodes(leiaute: number, anoBase: number, tipo?: string) {
    return this.prisma.rfbAglutinationCode.findMany({
      where: { leiaute, anoBase, ...(tipo ? { tipo } : {}) },
      orderBy: [{ tipo: 'asc' }, { ordem: 'asc' }],
    });
  }

  async findRfbLeiauteYears() {
    const rows = await this.prisma.$queryRaw<{ leiaute: number; ano_base: number }[]>`
      SELECT DISTINCT leiaute, ano_base FROM rfb_aglutination_codes ORDER BY leiaute DESC, ano_base DESC
    `;
    return rows;
  }

  // ── Visoes Contabeis ────────────────────────────────────────────────────
  async findAllViews(companyId: string) {
    return this.prisma.accountingView.findMany({
      where: { companyId, deletedAt: null },
      include: { _count: { select: { mappings: true } } },
      orderBy: [{ anoBase: 'desc' }, { tipo: 'asc' }],
    });
  }

  async createView(companyId: string, dto: any) {
    return this.prisma.accountingView.create({
      data: { companyId, ...dto },
    });
  }

  async deleteView(id: string) {
    return this.prisma.accountingView.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ── Mapeamentos (I052) ──────────────────────────────────────────────────
  async findMappings(viewId: string) {
    return this.prisma.accountingViewMapping.findMany({
      where: { viewId },
      include: { account: { select: { code: true, name: true, type: true, level: true, isAnalytic: true } } },
      orderBy: { account: { code: 'asc' } },
    });
  }

  async upsertMapping(viewId: string, accountId: string, aglutinationCode: string) {
    return this.prisma.accountingViewMapping.upsert({
      where: { viewId_accountId: { viewId, accountId } },
      create: { viewId, accountId, aglutinationCode },
      update: { aglutinationCode },
    });
  }

  async deleteMapping(viewId: string, accountId: string) {
    return this.prisma.accountingViewMapping.deleteMany({
      where: { viewId, accountId },
    });
  }

  async bulkUpsertMappings(viewId: string, mappings: { accountId: string; aglutinationCode: string }[]) {
    const ops = mappings.map(m =>
      this.prisma.accountingViewMapping.upsert({
        where: { viewId_accountId: { viewId, accountId: m.accountId } },
        create: { viewId, accountId: m.accountId, aglutinationCode: m.aglutinationCode },
        update: { aglutinationCode: m.aglutinationCode },
      })
    );
    return this.prisma.$transaction(ops);
  }

  // ── Auto-match: sugerir codigo RFB por natureza da conta ────────────────
  async autoMatch(viewId: string, companyId: string, leiaute: number, anoBase: number) {
    const view = await this.prisma.accountingView.findUnique({ where: { id: viewId } });
    if (!view) throw new NotFoundException('Visao nao encontrada');

    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, isAnalytic: true, deletedAt: null },
      orderBy: { code: 'asc' },
    });

    const rfbCodes = await this.prisma.rfbAglutinationCode.findMany({
      where: { leiaute, anoBase, tipo: view.tipo },
      orderBy: { ordem: 'asc' },
    });

    // Mapeamento simples por tipo de conta
    const typeToCode: Record<string, string> = {
      ASSET:     rfbCodes.find(c => c.nivel === 1 && c.tipo === 'BP')?.codigo ?? '',
      LIABILITY: rfbCodes.find(c => c.codigo.startsWith('2') && c.nivel === 1)?.codigo ?? '',
      EQUITY:    rfbCodes.find(c => c.codigo.startsWith('3') && c.nivel === 1)?.codigo ?? '',
      REVENUE:   rfbCodes.find(c => c.nivel === 1 && c.tipo === 'DRE')?.codigo ?? '',
      EXPENSE:   rfbCodes.find(c => c.codigo.startsWith('6') && c.nivel === 1)?.codigo ?? '',
    };

    const suggestions = accounts
      .filter(a => typeToCode[a.type.toString()])
      .map(a => ({ accountId: a.id, aglutinationCode: typeToCode[a.type.toString()] }));

    return { suggestions, total: suggestions.length };
  }
}
