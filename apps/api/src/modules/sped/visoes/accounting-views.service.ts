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
    // upsert atomico - findFirst+create em dois passos e uma race condition real:
    // o React 18 StrictMode roda o useEffect da tela duas vezes em dev, e duas
    // chamadas concorrentes podem passar pelo findFirst vazio antes de qualquer
    // uma terminar o create, estourando unique constraint (company_id, tipo, ano_base).
    return this.prisma.accountingView.upsert({
      where: { companyId_tipo_anoBase: { companyId, tipo: dto.tipo, anoBase: dto.anoBase } },
      create: { companyId, ...dto },
      update: { isActive: true, deletedAt: null, ...(dto.name ? { name: dto.name } : {}) },
    });
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

    const bpTypes = new Set(["ASSET", "LIABILITY", "EQUITY"]);
    const dreTypes = new Set(["REVENUE", "EXPENSE"]);
    const allowedTypes = view.tipo === "BP" ? bpTypes : dreTypes;

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

    const bpPrefixMap: Record<string, string> = {
      "111": "1.01.01.01.01", "112": "1.01.01.01.01",
      "113": "1.01.01.02.01", "114": "1.01.01.02.01",
      "115": "1.01.02.01.01", "116": "1.01.02.01.01",
      "117": "1.01.07.01.01", "118": "1.01.07.01.01",
      "119": "1.01.09.01.90",
      "121": "1.02.01.01.01",
      "122": "1.02.02.01.01", "123": "1.02.02.01.01", "124": "1.02.02.01.01",
      "125": "1.02.03.01.01", "126": "1.02.03.01.01",
      "127": "1.02.04.01.01",
      "151": "1.02.03.01.01", "152": "1.02.03.01.01",
      "221": "2.01.01.01.01",
      "222": "2.01.02.01.01",
      "223": "2.01.05.01.01", "224": "2.01.05.01.01",
      "225": "2.01.09.01.90", "226": "2.01.09.01.90",
      "231": "2.03.01.01.01",
      "232": "2.03.02.01.99",
      "233": "2.03.04.01.01",
      "491": "2.03.04.01.01",
    };

    const drePrefixMap: Record<string, string> = {
      "311": "3.01.01.01.01.06",
      "312": "3.01.01.01.02.09",
      "313": "3.01.01.03.01.03",
      "321": "3.01.01.05.01.05", "322": "3.01.01.05.01.05", "323": "3.01.01.05.01.05",
      "411": "3.01.01.07.01.02", "412": "3.01.01.07.01.02",
      "413": "3.01.01.07.01.16",
      "421": "3.01.01.07.01.16", "422": "3.01.01.07.01.02",
      "423": "3.01.01.09.01.08",
      "431": "3.02.01.01.01.02",
      "432": "3.02.01.01.01.01",
    };

    const prefixMap = view.tipo === "BP" ? bpPrefixMap : drePrefixMap;
    const suggestions: { accountId: string; aglutinationCode: string }[] = [];

    for (const acc of accounts) {
      if (!allowedTypes.has(acc.type)) continue;
      const digits = acc.code.replace(/\D/g, "");
      const prefix3 = digits.substring(0, 3);
      const prefix4 = digits.substring(0, 4);
      let bestCode = "";
      const fromPrefix = prefixMap[prefix4] ?? prefixMap[prefix3];
      if (fromPrefix && rfbLeaves.some(c => c.codigo === fromPrefix)) {
        bestCode = fromPrefix;
      }
      if (!bestCode) {
        const accWords = norm(acc.name).split(" ").filter(w => w.length > 3);
        let bestScore = -1;
        // Filtra candidatos pela mesma polaridade da conta antes de comparar nomes -
        // sem isso, o fallback por similaridade de palavra pode casar uma conta do
        // PASSIVO (ex: "Provisao IRPJ") com um codigo RFB do ATIVO (1.xx) so por
        // parecenca textual, gerando IND_GRP_BAL incorreto no J100 (achado real via C8
        // do pre-validate, 01/08/2026). So se aplica ao BP (ASSET=1.xx, LIABILITY/
        // EQUITY=2.xx); na DRE todo codigo comeca com 3.xx, sem essa ambiguidade.
        const wantPrefix = view.tipo === "BP" ? (acc.type === "ASSET" ? "1" : "2") : "3";
        const candidates = rfbLeaves.filter(c => c.codigo.startsWith(wantPrefix));
        for (const rfb of candidates) {
          const rfbWords = norm(rfb.descricao).split(" ").filter(w => w.length > 3);
          const exact = accWords.filter(w => rfbWords.includes(w)).length;
          const partial = rfbWords.some(w => accWords.some(a => a.includes(w) || w.includes(a))) ? 0.5 : 0;
          const score = exact + partial;
          if (score > bestScore) { bestScore = score; bestCode = rfb.codigo; }
        }
        if (bestScore < 1) bestCode = "";
      }
      if (bestCode) suggestions.push({ accountId: acc.id, aglutinationCode: bestCode });
    }
    return { suggestions, total: suggestions.length };
  }

        async findMappingsGrouped(viewId: string) {
          const view = await this.prisma.accountingView.findUnique({ where: { id: viewId } });
          if (!view) throw new NotFoundException("Visao nao encontrada");

          // Buscar todas as contas da empresa (analiticas + sinteticas nivel 5)
          const allAccounts = await this.prisma.chartOfAccounts.findMany({
            where: { companyId: view.companyId, deletedAt: null },
            orderBy: { code: "asc" },
            select: { id: true, code: true, reducedCode: true, name: true, type: true, level: true, isAnalytic: true, parentId: true },
          });

          const mappings = await this.prisma.accountingViewMapping.findMany({ where: { viewId } });
          const mappingMap = new Map(mappings.map(m => [m.accountId, m]));
          const accountById = new Map(allAccounts.map(a => [a.id, a]));

          // Filtrar analiticas por tipo da visao
          const bpTypes = new Set(["ASSET","LIABILITY","EQUITY"]);
          const dreTypes = new Set(["REVENUE","EXPENSE"]);
          const allowedTypes = view.tipo === "BP" ? bpTypes : dreTypes;
          const analytics = allAccounts.filter(a => a.isAnalytic && allowedTypes.has(a.type));
          const groupMap = new Map<string, { parent: any; children: any[] }>();

          for (const acc of analytics) {
            // Subir na hierarquia ate encontrar nivel 5
            let parentId = acc.parentId;
            let parent5: any = null;
            while (parentId) {
              const p = accountById.get(parentId);
              if (!p) break;
              if (p.level === 5) { parent5 = p; break; }
              if (p.level < 5) { parent5 = p; break; }
              parentId = p.parentId;
            }
            const groupKey = parent5?.id ?? acc.id;
            if (!groupMap.has(groupKey)) {
              groupMap.set(groupKey, { parent: parent5 ?? acc, children: [] });
            }
            const mapping = mappingMap.get(acc.id);
            groupMap.get(groupKey)!.children.push({
              accountId: acc.id,
              code: acc.code,
              reducedCode: acc.reducedCode,
              name: acc.name,
              type: acc.type,
              level: acc.level,
              aglutinationCode: mapping?.aglutinationCode ?? null,
              overridden: false,
            });
          }

          // Determinar codigo do grupo (se todas filhas iguais -> codigo do grupo)
          const groups = Array.from(groupMap.values()).map(g => {
            const codes = g.children.map(c => c.aglutinationCode).filter(Boolean);
            const uniqueCodes = [...new Set(codes)];
            const groupCode = uniqueCodes.length === 1 ? uniqueCodes[0] : (uniqueCodes.length > 1 ? "__mixed__" : null);
            // Marcar filhas que divergem do grupo
            const children = g.children.map(c => ({
              ...c,
              overridden: uniqueCodes.length > 1 && c.aglutinationCode !== groupCode,
            }));
            return {
              parentId: g.parent.id,
              parentCode: g.parent.code,
              parentName: g.parent.name,
              parentLevel: g.parent.level,
              groupCode,
              children,
            };
          });

          return groups;
        }
      }
