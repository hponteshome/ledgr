import { Injectable } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";

export type CheckLevel = "ERROR" | "WARNING" | "INFO";

export interface PreValidateCheck {
  id: string;
  level: CheckLevel;
  title: string;
  description: string;
  count?: number;
  details?: any[];
  action?: string;
}

export interface PreValidateResult {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  checks: PreValidateCheck[];
  hasErrors: boolean;
  hasWarnings: boolean;
  generatedAt: string;
}

@Injectable()
export class EcdPreValidateService {
  constructor(private prisma: PrismaService) {}

  async validate(
    companyId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<PreValidateResult> {
    const checks: PreValidateCheck[] = [];
    const ps = new Date(periodStart + "T00:00:00.000Z");
    const pe = new Date(periodEnd + "T23:59:59.999Z");
    const year = parseInt(periodStart.substring(0, 4), 10);

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });

    if (!company?.state) {
      checks.push({
        id: "C10", level: "ERROR",
        title: "Empresa sem UF cadastrada",
        description: "O campo Estado (UF) e obrigatorio para o registro 0007 do ECD.",
        action: "Edite o cadastro da empresa e preencha o campo Estado.",
      });
    }

    const allAccounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true, reducedCode: true, level: true, parentId: true, isAnalytic: true, type: true, name: true },
    });

    const accountMap = new Map<string, typeof allAccounts[0]>(allAccounts.map((a) => [a.id, a]));

    const badCode = allAccounts.filter((a) => a.isAnalytic && (a.code.length <= 6 || a.code.includes(".")));
    if (badCode.length > 0) {
      checks.push({
        id: "C2", level: "ERROR",
        title: badCode.length + " conta(s) analitica(s) com codigo invalido para ECD",
        description: "COD_CTA no I050/I155 deve usar o codigo contabil completo (ex: 11102010001), nunca o reduced_code nem codigo pontilhado (ex: 1.1.1).",
        count: badCode.length,
        details: badCode.slice(0, 20).map((a) => ({ code: a.code, name: a.name })),
        action: "Corrija os codigos das contas analiticas ou execute a limpeza de plano duplicado via SQL.",
      });
    }

    const rfbOverlap = allAccounts.filter((a) => a.reducedCode === "000000");
    if (rfbOverlap.length > 0) {
      checks.push({
        id: "C3", level: "ERROR",
        title: rfbOverlap.length + " conta(s) com reduced_code=000000 (plano RFB sobreposto)",
        description: "Apos importacao de ECD externo, contas do plano sintetico RFB ficam ativas. Causam duplicidade silenciosa no I050.",
        count: rfbOverlap.length,
        details: rfbOverlap.slice(0, 10).map((a) => ({ code: a.code, name: a.name })),
        action: "UPDATE chart_of_accounts SET deleted_at = NOW() WHERE company_id = '<id>' AND reduced_code = '000000';",
      });
    }

    const brokenHierarchy: any[] = [];
    for (const acc of allAccounts) {
      if (!acc.parentId) continue;
      const parent = accountMap.get(acc.parentId);
      if (!parent) continue;
      if (acc.level !== parent.level + 1) {
        brokenHierarchy.push({ code: acc.code, name: acc.name, level: acc.level, parentLevel: parent.level });
      }
    }
    if (brokenHierarchy.length > 0) {
      checks.push({
        id: "C1", level: "ERROR",
        title: brokenHierarchy.length + " conta(s) com hierarquia de niveis quebrada",
        description: "O ECD exige nivel = nivel do pai + 1 (sem saltos). Ex: nivel 3 nao pode ter pai de nivel 1.",
        count: brokenHierarchy.length,
        details: brokenHierarchy.slice(0, 20),
        action: "Reindexe os niveis via SQL ou corrija manualmente o parentId/level das contas afetadas.",
      });
    }

    const badRoot = allAccounts.filter((a) => a.level === 1 && a.parentId !== null);
    if (badRoot.length > 0) {
      checks.push({
        id: "W6", level: "WARNING",
        title: badRoot.length + " conta(s) de nivel 1 com parentId preenchido",
        description: "Contas de nivel 1 devem ter parentId = NULL.",
        count: badRoot.length,
        details: badRoot.slice(0, 10).map((a) => ({ code: a.code, name: a.name })),
        action: "UPDATE chart_of_accounts SET parent_id = NULL WHERE level = 1 AND company_id = '<id>';",
      });
    }

    const orphans = await this.prisma.$queryRaw<{ count: bigint; sample: string }[]>`
      SELECT COUNT(*) as count,
             STRING_AGG(DISTINCT ca.name, ', ') FILTER (WHERE ca.name IS NOT NULL) as sample
      FROM journal_entry_items jei
      JOIN journal_entries je ON je.id = jei.journal_entry_id
      JOIN chart_of_accounts ca ON ca.id = jei.account_id
      WHERE je.company_id = ${companyId}::uuid
        AND je.date >= ${ps}
        AND je.date <= ${pe}
        AND ca.deleted_at IS NOT NULL
    `;
    const orphanCount = Number(orphans[0]?.count ?? 0);
    if (orphanCount > 0) {
      checks.push({
        id: "C4", level: "ERROR",
        title: orphanCount + " partida(s) apontando para contas deletadas",
        description: "Lancamentos com account_id referenciando contas com deleted_at nao aparecem no I155/I250 do ECD.",
        count: orphanCount,
        details: [{ sample: orphans[0]?.sample }],
        action: "Remapeie as partidas orfas para contas ativas via SQL (secao 3.4 da base de conhecimento ECD).",
      });
    }

    const views = await this.prisma.accountingView.findMany({
      where: { companyId, anoBase: year, deletedAt: null },
      include: { mappings: { select: { id: true, accountId: true, aglutinationCode: true } } },
    });
    type ViewWithMappings = (typeof views)[0];

    const bpView: ViewWithMappings | undefined = views.find((v) => v.tipo === "BP");
    const dreView: ViewWithMappings | undefined = views.find((v) => v.tipo === "DRE");

    if (!bpView) {
      checks.push({
        id: "C5", level: "ERROR",
        title: "Visao Contabil BP nao configurada para " + year,
        description: "A visao do Balanco Patrimonial e obrigatoria para gerar I051/I052 e Bloco J (J100).",
        action: "Acesse Contabilidade > Visoes Contabeis e configure a visao BP para " + year + ".",
      });
    } else if (bpView.mappings.length === 0) {
      checks.push({
        id: "C5", level: "ERROR",
        title: "Visao BP de " + year + " existe mas nao tem mapeamentos",
        description: "Nenhuma conta analitica foi mapeada para codigos RFB no BP.",
        action: "Acesse Visoes Contabeis e execute o automapeamento BP.",
      });
    }

    if (!dreView) {
      checks.push({
        id: "C6", level: "ERROR",
        title: "Visao Contabil DRE nao configurada para " + year,
        description: "A visao da DRE e obrigatoria para gerar I052 e Bloco J (J150).",
        action: "Acesse Contabilidade > Visoes Contabeis e configure a visao DRE para " + year + ".",
      });
    } else if (dreView.mappings.length === 0) {
      checks.push({
        id: "C6", level: "ERROR",
        title: "Visao DRE de " + year + " existe mas nao tem mapeamentos",
        description: "Nenhuma conta analitica foi mapeada para codigos RFB na DRE.",
        action: "Acesse Visoes Contabeis e execute o automapeamento DRE.",
      });
    }

    if (bpView || dreView) {
      const allMappings = [...(bpView?.mappings ?? []), ...(dreView?.mappings ?? [])];
      if (allMappings.length > 0) {
        const allCodAgl = allMappings.map((m) => m.aglutinationCode).filter((x): x is string => Boolean(x));
        if (allCodAgl.length > 0) {
          const nonLeaf = await this.prisma.$queryRaw<{ codigo: string; descricao: string }[]>`
            SELECT DISTINCT r1.codigo, r1.descricao
            FROM rfb_aglutination_codes r1
            WHERE r1.codigo = ANY(${allCodAgl}::text[])
              AND r1.leiaute = 9
              AND EXISTS (
                SELECT 1 FROM rfb_aglutination_codes r2
                WHERE r2.codigo_pai = r1.codigo
                  AND r2.leiaute = r1.leiaute
                  AND r2.ano_base = r1.ano_base
              )
          `;
          if (nonLeaf.length > 0) {
            checks.push({
              id: "C7", level: "ERROR",
              title: nonLeaf.length + " mapeamento(s) usando codigo RFB totalizador (nao-folha)",
              description: "O I052 so aceita codigos folha da tabela RFB (sem filhos). Codigos intermediarios geram erro no PGE.",
              count: nonLeaf.length,
              details: nonLeaf,
              action: "Corrija os mapeamentos nas Visoes Contabeis usando o codigo filho mais especifico (nivel 5 BP, nivel 6 DRE).",
            });
          }
        }
      }
    }

    if (bpView && bpView.mappings.length > 0) {
      const wrongGroup: any[] = [];
      for (const m of bpView.mappings) {
        const acc = accountMap.get(m.accountId);
        if (!acc || !m.aglutinationCode) continue;
        const startsWithOne = m.aglutinationCode.startsWith("1");
        if (acc.type === "ASSET" && !startsWithOne) wrongGroup.push({ name: acc.name, type: acc.type, codAgl: m.aglutinationCode });
        if ((acc.type === "LIABILITY" || acc.type === "EQUITY") && startsWithOne) wrongGroup.push({ name: acc.name, type: acc.type, codAgl: m.aglutinationCode });
      }
      if (wrongGroup.length > 0) {
        checks.push({
          id: "C8", level: "ERROR",
          title: wrongGroup.length + " conta(s) mapeada(s) para grupo RFB incorreto no BP",
          description: "ASSET deve mapear para 1.xx (Ativo). LIABILITY/EQUITY deve mapear para 2.xx (Passivo/PL). Causa IND_GRP_BAL incorreto no J100.",
          count: wrongGroup.length,
          details: wrongGroup.slice(0, 20),
          action: "Corrija os mapeamentos na Visao BP.",
        });
      }

      const dreInBp = bpView.mappings.filter((m) => {
        const acc = accountMap.get(m.accountId);
        return acc && (acc.type === "REVENUE" || acc.type === "EXPENSE");
      });
      if (dreInBp.length > 0) {
        checks.push({
          id: "C9", level: "ERROR",
          title: dreInBp.length + " conta(s) de resultado mapeada(s) na visao BP",
          description: "Contas REVENUE/EXPENSE nao devem figurar no BP. Gera natureza divergente no I051.",
          count: dreInBp.length,
          action: "Remova essas contas do mapeamento BP.",
        });
      }
    }

    if (dreView && dreView.mappings.length > 0) {
      const bpInDre = dreView.mappings.filter((m) => {
        const acc = accountMap.get(m.accountId);
        return acc && (acc.type === "ASSET" || acc.type === "LIABILITY" || acc.type === "EQUITY");
      });
      if (bpInDre.length > 0) {
        checks.push({
          id: "C9b", level: "ERROR",
          title: bpInDre.length + " conta(s) patrimonial(is) mapeada(s) na visao DRE",
          description: "Contas ASSET/LIABILITY/EQUITY nao devem figurar na DRE.",
          count: bpInDre.length,
          action: "Remova essas contas do mapeamento DRE.",
        });
      }
    }

    const validQualif = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const signers = await this.prisma.personCompany.findMany({
      where: { companyId, assinaEcd: true },
      include: { person: { select: { fullName: true, cpf: true } } },
    });

    if (signers.length === 0) {
      checks.push({
        id: "C11", level: "ERROR",
        title: "Nenhum signatario ECD configurado",
        description: "O J930 requer ao menos um representante legal e um contador marcados como assinantes do ECD.",
        action: "Acesse o cadastro da empresa > aba Contabil e configure os signatarios com Assina ECD = true.",
      });
    } else {
      const hasAccountant = signers.some((s) => s.qualificacaoCvm === "10");
      if (!hasAccountant) {
        checks.push({
          id: "C11b", level: "ERROR",
          title: "Nenhum signatario com qualificacao de Contador (900)",
          description: "O J930 exige pelo menos um assinante com COD_QUALIF=900 (Contador/Contabilista).",
          action: "Marque o contador como Assina ECD com qualificacao 900 no cadastro da empresa.",
        });
      }
      const invalidQualif = signers.filter((s) => s.qualificacaoCvm && !validQualif.includes(s.qualificacaoCvm));
      if (invalidQualif.length > 0) {
        checks.push({
          id: "C12", level: "ERROR",
          title: invalidQualif.length + " signatario(s) com qualificacao invalida",
          description: "Qualificacoes validas: " + validQualif.join(", ") + ". Codigos 005, 010, 016 nao existem no PGE.",
          count: invalidQualif.length,
          details: invalidQualif.map((s) => ({ name: s.person?.fullName, qualificacaoCvm: s.qualificacaoCvm })),
          action: "Corrija as qualificacoes dos signatarios no cadastro da empresa.",
        });
      }
    }

    const entryCount = await this.prisma.journalEntry.count({
      where: { companyId, date: { gte: ps, lte: pe } },
    });

    const hasEncerramento = await this.prisma.journalEntry.findFirst({
      where: {
        companyId,
        date: { gte: ps, lte: pe },
        OR: [
          { description: { contains: "encerr", mode: "insensitive" } },
          { description: { contains: "zeramento", mode: "insensitive" } },
        ],
      },
    });

    const dreAccounts = allAccounts.filter((a) => a.isAnalytic && (a.type === "REVENUE" || a.type === "EXPENSE"));
    if (dreAccounts.length > 0 && !hasEncerramento) {
      checks.push({
        id: "C13", level: "WARNING",
        title: "Nenhum lancamento de encerramento encontrado no periodo",
        description: "Se gerado com Bloco J, o PGE exige I350 zerando as contas de resultado. Sem ele, ocorre erro de saldo divergente.",
        action: "Lance o encerramento contabil antes de gerar o ECD com Bloco J. Se nao houver encerramento, desabilite o Bloco J na geracao.",
      });
    }

    const balanceCheck = await this.prisma.$queryRaw<{ type: string; total: number }[]>`
      SELECT ca.type, SUM(
        CASE WHEN jei.type = 'DEBIT' THEN jei.value ELSE -jei.value END
      ) as total
      FROM journal_entry_items jei
      JOIN journal_entries je ON je.id = jei.journal_entry_id
      JOIN chart_of_accounts ca ON ca.id = jei.account_id
      WHERE je.company_id = ${companyId}::uuid
        AND je.date <= ${pe}
        AND ca.deleted_at IS NULL
        AND ca.is_analytic = true
      GROUP BY ca.type
    `;

    const byType = new Map<string, number>(balanceCheck.map((r) => [r.type, Number(r.total)]));
    const totalAsset = byType.get("ASSET") ?? 0;
    const totalLiab = byType.get("LIABILITY") ?? 0;
    const totalEquity = byType.get("EQUITY") ?? 0;
    const diff = Math.abs(totalAsset - (totalLiab + totalEquity));
    if (diff > 0.01 && entryCount > 0) {
      checks.push({
        id: "W2", level: "WARNING",
        title: "Balanco desequilibrado - diferenca de R$ " + diff.toFixed(2),
        description: "Ativo diferente de Passivo + PL calculado a partir dos lancamentos. Pode indicar lancamentos incorretos ou encerramento nao realizado.",
        action: "Verifique o Razao Analitico e o Balancete de Verificacao.",
      });
    }

    if (bpView || dreView) {
      const mappedIds = new Set([
        ...(bpView?.mappings.map((m) => m.accountId) ?? []),
        ...(dreView?.mappings.map((m) => m.accountId) ?? []),
      ]);
      const bpTypes = new Set(["ASSET", "LIABILITY", "EQUITY"]);
      const dreTypes = new Set(["REVENUE", "EXPENSE"]);
      const unmapped = allAccounts.filter(
        (a) => a.isAnalytic && !mappedIds.has(a.id) && (bpTypes.has(a.type) || dreTypes.has(a.type))
      );
      if (unmapped.length > 0) {
        checks.push({
          id: "W1", level: "WARNING",
          title: unmapped.length + " conta(s) analitica(s) sem mapeamento RFB",
          description: "Contas nao mapeadas nao aparecem no I051/I052. Se COD_PLAN_REF for informado no 0000, todas as analiticas devem estar mapeadas.",
          count: unmapped.length,
          details: unmapped.slice(0, 30).map((a) => ({ code: a.code, name: a.name, type: a.type })),
          action: "Mapeie as contas faltantes nas Visoes Contabeis ou desabilite COD_PLAN_REF no 0000.",
        });
      }
    }

    const analyticCount = allAccounts.filter((a) => a.isAnalytic).length;
    const syntheticCount = allAccounts.filter((a) => !a.isAnalytic).length;
    checks.push({ id: "I1", level: "INFO", title: "Plano de contas: " + analyticCount + " analiticas, " + syntheticCount + " sinteticas", description: "Total de contas ativas no plano para a empresa." });
    checks.push({ id: "I2", level: "INFO", title: entryCount + " lancamento(s) no periodo", description: "Lancamentos em journal_entries entre " + periodStart + " e " + periodEnd + "." });
    checks.push({ id: "I3", level: "INFO", title: "Visoes: " + (bpView?.mappings.length ?? 0) + " contas BP mapeadas, " + (dreView?.mappings.length ?? 0) + " contas DRE mapeadas", description: "Mapeamentos configurados para o ano " + year + "." });

    return {
      companyId, periodStart, periodEnd, checks,
      hasErrors: checks.some((c) => c.level === "ERROR"),
      hasWarnings: checks.some((c) => c.level === "WARNING"),
      generatedAt: new Date().toISOString(),
    };
  }
}
