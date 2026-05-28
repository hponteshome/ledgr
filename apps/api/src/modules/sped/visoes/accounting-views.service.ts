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

          // Mapa prefixo do codigo contabil -> codigo RFB (BP)
          // Baseado nos 3-4 primeiros digitos do codigo da conta
          const bpPrefixMap: Record<string, string> = {
            "111": "1.01.01", // Disponivel -> Caixa e Equivalentes
            "112": "1.01.01", // Caixa
            "113": "1.01.02", // Aplicacoes Financeiras CP
            "114": "1.01.02", // Aplicacoes Financeiras CP
            "115": "1.01.03", // Contas a Receber
            "116": "1.01.03", // Clientes
            "117": "1.01.06", // Tributos a Recuperar
            "118": "1.01.08", // Outros Ativos Circulantes
            "119": "1.01.08", // Outros Ativos Circulantes
            "121": "1.02.01", // Realizavel LP
            "122": "1.02.02.01", // Participacoes Societarias
            "123": "1.02.02.01", // Participacoes Societarias
            "124": "1.02.02.01", // Participacoes Societarias
            "125": "1.02.03.01", // Imobilizado em Operacao
            "126": "1.02.03.01", // Imobilizado em Operacao
            "127": "1.02.04.01", // Intangiveis
            "221": "2.01.01", // Fornecedores CP
            "222": "2.01.02", // Emprestimos CP
            "223": "2.01.05", // Obrigacoes Fiscais CP
            "224": "2.01.05", // Tributos CP
            "225": "2.01.05", // Outras Obrigacoes CP
            "226": "2.01.05", // Outras Obrigacoes CP
            "231": "2.03.01", // Capital Social
            "232": "2.03.06", // Reservas
            "233": "2.03.07", // Lucros/Prejuizos Acumulados
          };

          const drePrefixMap: Record<string, string> = {
            "311": "3.01", // Receita Bruta
            "312": "3.02", // Deducoes
            "313": "3.03", // Custo
            "411": "3.04", // Despesas Operacionais
            "412": "3.04", // Despesas Operacionais
            "413": "3.04", // Despesas Operacionais
            "421": "3.06.01", // Resultado Financeiro
            "422": "3.06.01", // Resultado Financeiro
            "423": "3.06.02", // Resultado Equivalencia
            "431": "3.06.01", // Despesas Financeiras
            "441": "3.08.01", // IR/CSLL
          };

          const prefixMap = view.tipo === "BP" ? bpPrefixMap : drePrefixMap;

          const suggestions: { accountId: string; aglutinationCode: string }[] = [];

          for (const acc of accounts) {
            const code = (acc as any).reducedCode || acc.code;
            const prefix3 = code.replace(/\D/g, "").substring(0, 3);
            const prefix4 = code.replace(/\D/g, "").substring(0, 4);

            // 1. Tentar match semantico por nome
            const accWords = norm(acc.name).split(" ").filter(w => w.length > 3);
            let bestCode = "";
            let bestScore = -1;
            for (const rfb of rfbLeaves) {
              const rfbWords = norm(rfb.descricao).split(" ").filter(w => w.length > 3);
              const exact = accWords.filter(w => rfbWords.includes(w)).length;
              const partial = rfbWords.some(w => accWords.some(a => a.includes(w) || w.includes(a))) ? 0.5 : 0;
              const score = exact + partial;
              if (score > bestScore) { bestScore = score; bestCode = rfb.codigo; }
            }

            // 2. Se match semantico fraco, usar prefixo do codigo contabil
            if (bestScore < 1) {
              const fromPrefix = prefixMap[prefix4] ?? prefixMap[prefix3];
              if (fromPrefix && rfbCodes.some(c => c.codigo === fromPrefix)) {
                bestCode = fromPrefix;
              }
            }

            if (bestCode) suggestions.push({ accountId: acc.id, aglutinationCode: bestCode });
          }

          return { suggestions, total: suggestions.length };
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

          // Separar analiticas e montar grupos pelo pai nivel 5
          const analytics = allAccounts.filter(a => a.isAnalytic);
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
