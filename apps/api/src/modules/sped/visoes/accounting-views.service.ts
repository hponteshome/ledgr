// apps/api/src/modules/sped/visoes/accounting-views.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";

@Injectable()
export class AccountingViewsService {
  constructor(private readonly prisma: PrismaService) {}

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
      orderBy: [{ tipo: "asc" }, { ordem: "asc" }],
    });
  }

  async findRfbLeiauteYears() {
    const rows = await this.prisma.$queryRawUnsafe<{ leiaute: number; ano_base: number }[]>(
      "SELECT DISTINCT leiaute, ano_base FROM rfb_aglutination_codes ORDER BY leiaute DESC, ano_base DESC"
    );
    return rows;
  }

  async findAllViews(companyId: string) {
    return this.prisma.accountingView.findMany({
      where: { companyId, deletedAt: null },
      include: { _count: { select: { mappings: true } } },
      orderBy: [{ anoBase: "desc" }, { tipo: "asc" }],
    });
  }

  async createView(companyId: string, dto: any) {
    const existing = await this.prisma.accountingView.findFirst({
      where: { companyId, tipo: dto.tipo, anoBase: dto.anoBase },
    });
    if (existing) {
      return this.prisma.accountingView.update({
        where: { id: existing.id },
        data: { isActive: true, deletedAt: null, name: dto.name ?? existing.name },
      });
    }
    return this.prisma.accountingView.create({ data: { companyId, ...dto } });
  }

  async deleteView(id: string) {
    return this.prisma.accountingView.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async findMappings(viewId: string) {
    const view = await this.prisma.accountingView.findUnique({ where: { id: viewId } });
    if (!view) throw new NotFoundException("Visao nao encontrada");
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId: view.companyId, isAnalytic: true, deletedAt: null },
      orderBy: { code: "asc" },
      select: { id: true, code: true, reducedCode: true, name: true, type: true, level: true, isAnalytic: true },
    });
    const mappings = await this.prisma.accountingViewMapping.findMany({ where: { viewId } });
    const mappingMap = new Map(mappings.map(m => [m.accountId, m]));
    return accounts.map(a => ({
      accountId: a.id,
      account: { code: a.code, reducedCode: a.reducedCode, name: a.name, type: a.type, level: a.level, isAnalytic: a.isAnalytic },
      aglutinationCode: mappingMap.get(a.id)?.aglutinationCode ?? null,
      id: mappingMap.get(a.id)?.id ?? null,
    }));
  }

  async upsertMapping(viewId: string, accountId: string, aglutinationCode: string) {
    return this.prisma.accountingViewMapping.upsert({
      where: { viewId_accountId: { viewId, accountId } },
      create: { viewId, accountId, aglutinationCode },
      update: { aglutinationCode },
    });
  }

  async deleteMapping(viewId: string, accountId: string) {
    return this.prisma.accountingViewMapping.deleteMany({ where: { viewId, accountId } });
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

  async autoMatch(viewId: string, companyId: string, leiaute: number, anoBase: number) {
    const view = await this.prisma.accountingView.findUnique({ where: { id: viewId } });
    if (!view) throw new NotFoundException("Visao nao encontrada");
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, isAnalytic: true, deletedAt: null },
      orderBy: { code: "asc" },
    });
    const rfbCodes = await this.prisma.rfbAglutinationCode.findMany({
      where: { leiaute, anoBase, tipo: view.tipo },
      orderBy: { ordem: "asc" },
    });

    const norm = (s: string) => s.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

    const codigosComFilho = new Set(rfbCodes.filter(c => c.codigoPai).map(c => c.codigoPai as string));
    const rfbLeaves = rfbCodes.filter(c => !codigosComFilho.has(c.codigo));

    const typeFallback: Record<string, string> = view.tipo === "BP"
      ? { ASSET: "1.01.08", LIABILITY: "2.01.05", EQUITY: "2.03.05" }
      : { REVENUE: "3.01", EXPENSE: "3.06.02" };

    const suggestions: { accountId: string; aglutinationCode: string }[] = [];

    for (const acc of accounts) {
      const accWords = norm(acc.name).split(" ").filter(w => w.length > 2);
      let bestCode = "";
      let bestScore = -1;

      for (const rfb of rfbLeaves) {
        const rfbWords = norm(rfb.descricao).split(" ").filter(w => w.length > 2);
        const exact = accWords.filter(w => rfbWords.includes(w)).length;
        const partial = rfbWords.some(w => accWords.some(a => a.includes(w) || w.includes(a))) ? 0.5 : 0;
        const score = exact + partial;
        if (score > bestScore) { bestScore = score; bestCode = rfb.codigo; }
      }

      if (bestScore < 0.5) {
        const fb = typeFallback[acc.type.toString()];
        bestCode = (fb && rfbCodes.some(c => c.codigo === fb)) ? fb : "";
      }

      if (bestCode) suggestions.push({ accountId: acc.id, aglutinationCode: bestCode });
    }

    console.log('[autoMatch] primeiras 5 sugestoes:', JSON.stringify(suggestions.slice(0,5)));
    console.log('[autoMatch] rfbLeaves count:', rfbLeaves.length);
    return { suggestions, total: suggestions.length };
  }
}