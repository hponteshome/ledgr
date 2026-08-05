// apps/api/src/modules/sped/ecd/services/ecd-exporter.service.ts
// Baseado no gabarito IOB (ECD_G_2024_00011.TXT) — Leiaute 9
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";

export interface EcdExportOptions {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  bookNumber?: string;
  bookNature?: string;
  bookType?: "G" | "R" | "B";
  tipEcd?: string;
  indSitEsp?: string;
  codPlanRef?: string;
  hashAnterior?: string;
  includeBlocoJ?: boolean;
  layoutVersion?: string;
}

@Injectable()
export class EcdExporterService {
  private readonly logger = new Logger(EcdExporterService.name);
  constructor(private prisma: PrismaService) {}

  async export(options: EcdExportOptions): Promise<{ buffer: Buffer; warnings: string[] }> {
    const {
      companyId, periodStart, periodEnd,
      bookNumber = String(periodStart.getUTCFullYear()).slice(-2), bookNature = "Livro Diario Geral",
      bookType = "G", layoutVersion = "9.00",
      tipEcd = "0", indSitEsp = "", codPlanRef = "", hashAnterior = "", includeBlocoJ = true,
    } = options;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxId: true, legalName: true, state: true, city: true, nire: true, codMun: true, registerOrg: true },
    });
    if (!company) throw new Error("Empresa nao encontrada.");

    const cnpj  = company.taxId.replace(/\D/g, "");
    const dtIni = this.fmtDate(periodStart);
    const dtFin = this.fmtDate(periodEnd);
    const P = "|";

    // Plano de contas
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ level: "asc" }, { code: "asc" }],
    });
    const codeById    = new Map(accounts.map(a => [a.id, a.code]));
    const analyticIds = new Set(accounts.filter(a => a.isAnalytic).map(a => a.id));

    // I052 mapeamentos (conta -> codigo aglutinacao)
    const anoBase = periodStart.getUTCFullYear();
    const viewsI052 = await this.prisma.accountingView.findMany({
      where: { companyId, isActive: true },
      include: { mappings: { select: { accountId: true, aglutinationCode: true } } },
    });
    const i052Map = new Map<string, string>(); // accountId -> aglCode
    for (const view of viewsI052) {
      for (const m of view.mappings) i052Map.set(m.accountId, m.aglutinationCode);
    }

          // i051Map: accountId -> codigo referencial RFB (COD_CTA_REF)
          // Usar diretamente o codigo de aglutinacao como referencia RFB
          // i051Map: accountId -> codigo referencial RFB (COD_CTA_REF). Corrigido 04/08/2026:
          // estava aliasado em i052Map (codigo de aglutinacao) - errado, I051 e registro
          // proprio, distinto do I052. Bug real confirmado no PVA (GRB): natureza da conta
          // referencial diferente da natureza da conta pai. Usa spedCode auditado (01/08/2026).
          const i051Map = new Map<string, string>();
          for (const acc of accounts) {
            if (acc.isAnalytic && acc.spedCode) i051Map.set(acc.id, acc.spedCode);
          }

    // Lancamentos do periodo
    const entries = await this.prisma.journalEntry.findMany({
      where: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null },
      include: { items: { include: { account: { select: { code: true, reducedCode: true } } } } },
      orderBy: { date: "asc" },
    });

    // Saldo inicial por conta: mesma logica hibrida do TrialBalanceService
    // .getVerificationBalance (ja validada no Balancete de Verificacao) - prioriza
    // soma real de JournalEntryItem anterior ao periodo; accountBalance (snapshot
    // de ECD importado) so entra como fallback quando nao ha lancamento nativo.
    // Corrige achado real de 02/08/2026: lancamento de Capital Social da Pontes
    // Contabilidade (data 2005) nao aparecia no I155 porque accountBalance so e
    // populado por importacao de ECD, nunca por lancamento feito no proprio LEDGR.
    const historicalItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { lt: periodStart }, deletedAt: null } },
      select: { accountId: true, type: true, value: true },
    });
    const historicalMov = new Map<string, { deb: number; cre: number }>();
    for (const item of historicalItems) {
      if (!analyticIds.has(item.accountId)) continue;
      const cur = historicalMov.get(item.accountId) ?? { deb: 0, cre: 0 };
      if (item.type === "DEBIT") cur.deb += Number(item.value);
      else cur.cre += Number(item.value);
      historicalMov.set(item.accountId, cur);
    }

    const i155Rows = await this.prisma.accountBalance.findMany({
      where: { companyId, referenceDate: { lt: new Date(periodStart) } },
      orderBy: { referenceDate: "desc" },
    });
    const i155Snapshot = new Map<string, number>();
    for (const row of i155Rows) {
      if (!i155Snapshot.has(row.accountId) && analyticIds.has(row.accountId))
        i155Snapshot.set(row.accountId, Number(row.balance));
    }

    const saldoIni = new Map<string, number>();
    for (const aid of analyticIds) {
      const mov = historicalMov.get(aid);
      const fromMov = mov ? mov.deb - mov.cre : 0;
      if (fromMov !== 0) {
        saldoIni.set(aid, fromMov);
      } else if (i155Snapshot.has(aid)) {
        saldoIni.set(aid, i155Snapshot.get(aid)!);
      }
    }

    // Movimentos do periodo por mes e conta
    const periodItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null } },
      select: { accountId: true, type: true, value: true, journalEntry: { select: { date: true } } },
    });
    const byMonthAcc = new Map<string, Map<string, { deb: number; cre: number }>>();
    for (const item of periodItems) {
      if (!analyticIds.has(item.accountId)) continue;
      const d   = item.journalEntry.date instanceof Date ? item.journalEntry.date : new Date(item.journalEntry.date);
      const key = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
      if (!byMonthAcc.has(key)) byMonthAcc.set(key, new Map());
      const accMap = byMonthAcc.get(key)!;
      if (!accMap.has(item.accountId)) accMap.set(item.accountId, { deb: 0, cre: 0 });
      const mv = accMap.get(item.accountId)!;
      if (item.type === "DEBIT") mv.deb += Number(item.value);
      else                       mv.cre += Number(item.value);
    }

    // Rollup BP para sinteticas
    const saldoFinalMap = new Map<string, number>(saldoIni);
    for (const [, accMap] of byMonthAcc) {
      for (const [aid, mv] of accMap) {
        saldoFinalMap.set(aid, (saldoFinalMap.get(aid) ?? 0) + mv.deb - mv.cre);
      }
    }
    const rollupMap = new Map<string, number>(saldoFinalMap);
    const idToCode  = new Map(accounts.map(a => [a.id, a.code]));
    const sorted    = [...accounts].sort((a, b) => idToCode.get(b.id)!.localeCompare(idToCode.get(a.id)!));
    for (const acc of sorted) {
      if (!acc.parentId) continue;
      const child = rollupMap.get(acc.id) ?? 0;
      rollupMap.set(acc.parentId, (rollupMap.get(acc.parentId) ?? 0) + child);
    }

    // Movimentos DRE por conta
    const dreMap = new Map<string, { deb: number; cre: number }>();
    for (const [, accMap] of byMonthAcc) {
      for (const [aid, mv] of accMap) {
        const acc = accounts.find(a => a.id === aid);
        if (!acc || !["REVENUE","EXPENSE"].includes(acc.type.toString())) continue;
        const cur = dreMap.get(aid) ?? { deb: 0, cre: 0 };
        dreMap.set(aid, { deb: cur.deb + mv.deb, cre: cur.cre + mv.cre });
      }
    }
    const dreRollup = new Map<string, { deb: number; cre: number }>(dreMap);
    for (const acc of sorted) {
      if (!acc.parentId) continue;
      if (!["REVENUE","EXPENSE"].includes(acc.type.toString())) continue;
      const child  = dreRollup.get(acc.id) ?? { deb: 0, cre: 0 };
      const parent = dreRollup.get(acc.parentId) ?? { deb: 0, cre: 0 };
      dreRollup.set(acc.parentId, { deb: parent.deb + child.deb, cre: parent.cre + child.cre });
    }

    const months = this.monthRange(periodStart, periodEnd);
    const lines: string[] = [];
    const add = (l: string) => lines.push(l);

    // ── BLOCO 0 ──────────────────────────────────────────────────────────
    // |0000|LECD|DT_INI|DT_FIN|NOME|CNPJ|UF|COD_MUN|COD_PLAN_REF|IND_ESC|COD_SCP|
    //       HASH|VERSAO_APP|DT_LAS_EXP|TP_LIVRACAO|IND_SIT|NR_REC_ANT|NR_SEQ_ECD|
      add(
        P+"0000"
        +P+"LECD"                          // 1  LECD
        +P+dtIni                           // 2  DT_INI
        +P+dtFin                           // 3  DT_FIN
        +P+company.legalName               // 4  NOME
        +P+cnpj                            // 5  CNPJ
        +P+(company.state||"")             // 6  UF
        +P+""                              // 7  IE (vazio)
        +P+(company.codMun||"3550308")     // 8  COD_MUN
        +P+(company.nire||"")              // 9  NRE - real, nao mais sempre vazio
        +P+(indSitEsp||"")                 // 10 (vazio no arquivo real)
        +P+"0"                             // 11
        +P+"0"                             // 12
        +P+tipEcd                          // 13
        +P+(hashAnterior||"")              // 14 (vazio no arquivo real)
        +P+"0"                             // 15
        +P+"0"                             // 16
        +P+""                              // 17 (vazio no arquivo real)
        +P+"N"                             // 18
        +P+"N"                             // 19
        +P+"0"                             // 20
        +P+"0"                             // 21
        +P+(codPlanRef||"")                // 22 (arquivo real tinha "2" aqui - significado nao confirmado, mantido vazio)
        +P
      );
    add(P+"0001"+P+"0"+P);
    add(P+"0007"+P+(company.state||"")+P+P);
    const idx0990 = lines.length;
    add(P+"0990"+P+"PLACEHOLDER"+P);

    // BLOCO C (vazio)
    add(P+"C001"+P+"1"+P);
    add(P+"C990"+P+"2"+P);

    // ── BLOCO I ──────────────────────────────────────────────────────────
    // I001 campo 02 = "Indicador de Movimento": 0 = bloco COM dados informados,
    // 1 = bloco sem nenhum dado (usado so quando a ECD depende de escrituracao ja
    // armazenada no PVA para o mesmo CNPJ/periodo - NAO e sobre ter ou nao lancamento).
    // Erro real de PVA (02/08/2026): "A importacao de arquivos sem o bloco I,
    // pressupoe a existencia de uma escrituracao nas bases do sistema" - o exporter
    // sempre gera I050 (plano de contas) e I150/I155 (saldos), entao o Bloco I
    // SEMPRE tem dados, independente de haver lancamento (I200/I250) ou nao.
    add(P+"I001"+P+"0"+P);
    // |I010|IND_ESC|COD_VER_LC|
    add(P+"I010"+P+bookType+P+layoutVersion+P);
    // |I030|DESC_ESC|NR_LIVRO|NR_ORD|TIPO_LIVRO|QTD_PAG|NOME|NIRE|CNPJ|DT_ARQ|NOM_COM|CIDADE|DT_FIN|
    const totalPag = entries.length > 0 ? String(entries.length + 100) : "100";
    // Campo 12 = DT_EX_SOCIAL (data de encerramento FORMAL do exercicio social, nao o
    // fim do periodo da ECD). Preencher exige um I350 correspondente - bug real
    // confirmado no PVA (GRB) ate 04/08/2026. So preenche se houve encerramento real.
    const hasEncerramentoDT030 = entries.some(e =>
      e.description?.toLowerCase().includes("encerr") || e.description?.toLowerCase().includes("zeramento")
    );
    // Campo 12 = DT_EX_SOCIAL - SEMPRE obrigatorio (confirmado 2x no PVA hoje, 05/08/2026,
    // GRB: preenchido demais -> exige Bloco J; vazio -> "Campo obrigatorio nao preenchido").
    // A condicionalidade real (manual oficial) e sobre essa data cair DENTRO ou FORA do
    // periodo da ECD, nao sobre o campo poder ficar vazio. Para um ECD de ano completo
    // (janeiro a dezembro), a data de encerramento do exercicio social sempre cai dentro
    // do periodo - entao nao ha como evitar o Bloco J virar obrigatorio nesse caso.
    add(P+"I030"+P+"TERMO DE ABERTURA"+P+bookNumber+P+bookNature+P+totalPag+P+company.legalName+P+(company.nire||"")+P+cnpj+P+dtIni+P+P+(company.city||"Sao Paulo")+P+dtFin+P);

    // Pre-calcular codigos DRE_ para contas de resultado (mesmo codigo usado no J150)
    const dreTypes2 = new Set(["REVENUE","EXPENSE"]);
    const dreCodeMap = new Map<string, string>(); // accountId -> DRE_NNN_DO0_cod
    let dreSeq = 0;
    for (const acc of accounts) {
      if (!acc.isAnalytic) continue;
      if (!dreTypes2.has(acc.type.toString())) continue;
      if (!i052Map.has(acc.id)) continue;
      const rc = acc.code;
      const seq = String(dreSeq).padStart(3, "0");
      dreCodeMap.set(acc.id, ("DRE_" + seq + "_DO0_" + rc).padEnd(30, " "));
      dreSeq++;
    }

    // I050 + I051 + I052 — apenas contas com movimento ou saldo (+ ancestrais sinteticos)
    const analyticWithData = new Set<string>();
    for (const [, accMap] of byMonthAcc) {
      for (const aid of accMap.keys()) analyticWithData.add(aid);
    }
    for (const [aid, saldo] of saldoIni) {
      if (saldo !== 0) analyticWithData.add(aid);
    }
    for (const aid of i052Map.keys()) analyticWithData.add(aid);
    const accountById = new Map(accounts.map(a => [a.id, a]));
    const activeIds = new Set<string>(analyticWithData);
    for (const aid of analyticWithData) {
      let cur = accountById.get(aid);
      while (cur?.parentId) {
        activeIds.add(cur.parentId);
        cur = accountById.get(cur.parentId);
      }
    }
    const accountsFiltered = accounts.filter(a => activeIds.has(a.id));
    for (const acc of accountsFiltered) {
      const dtAlt      = this.fmtDate(acc.createdAt);
      const natCode    = this.typeToNat(acc.type.toString());
      const indCta     = acc.isAnalytic ? "A" : "S";
      const parentCode = acc.parentId ? (codeById.get(acc.parentId) ?? "") : "";
      const reducedCode = acc.code;
      if (!reducedCode) continue;
      // |I050|DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|NOME_CTA|
      add(P+"I050"+P+dtAlt+P+natCode+P+indCta+P+acc.level+P+reducedCode+P+parentCode+P+acc.name+P);
          if (acc.isAnalytic) {
            // I051: COD_CTA_REF = codigo referencial RFB (obrigatorio para todas as naturezas)
            const i051Val = i051Map.get(acc.id) ?? "";
            // I051 so pode existir se COD_PLAN_REF estiver preenchido no 0000 - achado real
            // no PVA (05/08/2026, GRB): 169 erros "Registro nao deve existir... Nao houve
            // informacao de plano referencial no registro 0000 (COD_PLAN_REF)" quando
            // codPlanRef ficou vazio (decisao deliberada de 01/08/2026 - L100A/L300A
            // completo nao importado). Confirma a REGRA_I051_OBRIGATORIO ja documentada:
            // e o INVERSO tambem vale - sem COD_PLAN_REF, I051 e PROIBIDO, nao so opcional.
            if (i051Val && codPlanRef) add(P+"I051"+P+P+i051Val+P);
            // I052: COD_AGL = codigo de aglutinacao para Bloco J
            const i052Val = i052Map.get(acc.id) ?? "";
            if (i052Val) add(P+"I052"+P+P+i052Val+P);
          }
    }
    // I075 — historico padronizado (minimo requerido)
    add(P+"I075"+P+"1"+P+"Livre"+P);

    // I150/I155 — saldos periodicos
    const saldoCorrente = new Map<string, number>(saldoIni);
    for (const { year, month, firstDay, lastDay } of months) {
      const monthKey = year + "-" + String(month).padStart(2, "0");
      const accMap   = byMonthAcc.get(monthKey);
      const contasDoMes = new Set<string>([
        ...Array.from(saldoCorrente.entries()).filter(([, v]) => v !== 0).map(([k]) => k),
        ...(accMap ? Array.from(accMap.keys()) : []),
      ]);
      if (contasDoMes.size === 0) {
        // Inclui ao menos uma conta com saldo zero (obrigatorio para evitar inatividade)
        const firstAnalytic = accounts.find(a => a.isAnalytic);
        if (firstAnalytic) {
          add(P+"I150"+P+this.fmtDate(firstDay)+P+this.fmtDate(lastDay)+P);
          const rc = (firstAnalytic as any).reducedCode || firstAnalytic.code;
          add(P+"I155"+P+rc+P+P+"0"+P+"D"+P+"0"+P+"0"+P+"0"+P+"D"+P);
        }
        continue;
      }
      add(P+"I150"+P+this.fmtDate(firstDay)+P+this.fmtDate(lastDay)+P);
      const sortedContas = Array.from(contasDoMes).sort((a, b) => (codeById.get(a) ?? "").localeCompare(codeById.get(b) ?? ""));
      for (const aid of sortedContas) {
        const acc = accounts.find(a => a.id === aid);
        if (!acc) continue;
        const mv     = accMap?.get(aid) ?? { deb: 0, cre: 0 };
        const sldIni = saldoCorrente.get(aid) ?? 0;
        const sldFin = sldIni + mv.deb - mv.cre;
        const dcIni  = sldIni >= 0 ? "D" : "C";
        const dcFin  = sldFin >= 0 ? "D" : "C";
        const reducedCode = acc.code;
        // |I155|COD_CTA|COD_CTA_REF|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRED|VL_SLD_FIN|IND_DC_FIN|
        add(P+"I155"+P+reducedCode+P+P+this.fmtDec(Math.abs(sldIni))+P+dcIni+P+this.fmtDec(mv.deb)+P+this.fmtDec(mv.cre)+P+this.fmtDec(Math.abs(sldFin))+P+dcFin+P);
        saldoCorrente.set(aid, sldFin);
      }
    }

    // I200/I250 — lancamentos
    let numLcto = 0;
    for (const entry of entries) {
      numLcto++;
      const totalDeb = entry.items.reduce((s, i) => s + (i.type === "DEBIT" ? Number(i.value) : 0), 0);
      const dt = entry.date instanceof Date ? entry.date : new Date(entry.date);
      const hist = (entry.description || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9 \-]/g, " ")
        .replace(/\s+/g, " ").trim().substring(0, 40);
      // |I200|NUM_ORD|DT_LCTO|VL_LCTO|IND_LCTO|DSC_COMPL|NR_DOC|
      add(P+"I200"+P+numLcto+P+this.fmtDate(dt)+P+this.fmtDec(totalDeb)+P+"N"+P+P);
      for (const item of entry.items) {
        const sign    = item.type === "DEBIT" ? "D" : "C";
        const codCta  = item.account.code;
        // |I250|COD_CTA|VL_DC|IND_DC|NUM_ARQ|COD_HIST|DSC_HIST|COD_PART|NR_DOC|
        add(P+"I250"+P+codCta+P+P+this.fmtDec(Number(item.value))+P+sign+P+"0"+P+"1"+P+hist+P+P);
      }
    }

            // I350/I355 — saldos de contas de resultado antes do encerramento
            // I350 apenas se ha lancamentos de encerramento reais (zeramento de resultado)
            const dreTypes = new Set(["REVENUE","EXPENSE"]);
            const hasEncerramento = entries.some(e =>
              e.description?.toLowerCase().includes("encerr") ||
              e.description?.toLowerCase().includes("zeramento")
            );
            const dreAccounts = (hasEncerramento ? accounts : []).filter(a => {
              if (!a.isAnalytic || !dreTypes.has(a.type.toString())) return false;
              const mv = dreMap.get(a.id);
              return mv ? (mv.cre - mv.deb) !== 0 : false;
            });
            if (dreAccounts.length > 0) {
              add(P+"I350"+P+dtFin+P);
              for (const acc of dreAccounts) {
                const mv = dreMap.get(acc.id);
                let saldo: number;
                if (mv) {
                  saldo = mv.cre - mv.deb;
                } else {
                  const bal = saldoFinalMap.get(acc.id) ?? 0;
                  saldo = -bal;
                }
                if (saldo === 0) continue;
                const dc = saldo >= 0 ? "C" : "D";
                const reducedCode = acc.code;
                add(P+"I355"+P+reducedCode+P+P+this.fmtDec(Math.abs(saldo))+P+dc+P);
              }
            }
    const idxI001   = lines.findIndex(l => l === P+"I001"+P+"0"+P);
    const blocoIQtd = lines.length - idxI001;
    add(P+"I990"+P+(blocoIQtd + 1)+P);

    // ── BLOCO J ──────────────────────────────────────────────────────────
    add(P+"J001"+P+"0"+P);
    // |J005|DT_INI|DT_FIN|ID_DEM| (3 campos reais conforme gabarito IOB)
    // Bloco J condicionado a includeBlocoJ - achado real no PVA (05/08/2026, GRB):
    // declarar J005/J100/J150 exige um I350 correspondente para a mesma data de fim,
    // que so existe se houver lancamento de encerramento contabil real no periodo.
    // Decisao do usuario: gerar sem Bloco J quando nao ha encerramento, em vez de
    // forcar um I350/encerramento ficticio so para o arquivo passar na validacao.
    if (includeBlocoJ) {
      add(P+"J005"+P+dtIni+P+dtFin+P+"1"+P+P);
  
      // J100 — Balanco Patrimonial usando codigos BAL_ do referencial
      // |J100|COD_AGL|IND_TIPO_CALC|NIVEL|COD_AGL_SUP|IND_CTA|NOME_CTA|VL_CTA_INI|IND_DC_INI|VL_CTA_FIN|IND_DC_FIN|
      const bpTypes = new Set(["ASSET","LIABILITY","EQUITY"]);
      // Rollup saldo inicial para sinteticas
      const saldoIniRollup = new Map<string, number>(saldoIni);
      const bpSorted = [...accounts].filter(a => bpTypes.has(a.type.toString())).sort((a,b) => ((b as any).reducedCode||b.code).localeCompare(((a as any).reducedCode||a.code)));
      for (const acc of bpSorted) {
        if (!acc.parentId) continue;
        const child = saldoIniRollup.get(acc.id) ?? 0;
        saldoIniRollup.set(acc.parentId, (saldoIniRollup.get(acc.parentId) ?? 0) + child);
      }
      // J100 — hierarquia completa usando tabela RFB (totalizadores T + detalhes D)
      // 1. Buscar todos os codigos RFB do BP 2025
      const rfbBP = await this.prisma.rfbAglutinationCode.findMany({
        where: { leiaute: 9, anoBase, tipo: "BP" },
        orderBy: { ordem: "asc" },
      });
      const rfbBPMap = new Map(rfbBP.map(r => [r.codigo, r]));
      // 2. Acumular saldos por codigo RFB (detalhe)
      const j100Det = new Map<string, { ini: number; fin: number; nome: string; indCta: string }>();
      for (const acc of accounts) {
        if (!bpTypes.has(acc.type.toString())) continue;
        if (!acc.isAnalytic || !i052Map.has(acc.id)) continue;
        const aglCode     = i052Map.get(acc.id)!;
        const saldoFin    = rollupMap.get(acc.id) ?? 0;
        const saldoIniVal = saldoIniRollup.get(acc.id) ?? 0;
        const indCta      = acc.type.toString() === "ASSET" ? "A" : "P";
        if (!j100Det.has(aglCode)) j100Det.set(aglCode, { ini: 0, fin: 0, nome: rfbBPMap.get(aglCode)?.descricao || acc.name, indCta });
        const e = j100Det.get(aglCode)!; e.ini += saldoIniVal; e.fin += saldoFin;
      }
      // 3. Expandir para incluir todos os ancestrais como totalizadores
      const j100Tot = new Map<string, { ini: number; fin: number; nome: string; indCta: string; nivel: number; pai: string }>();
      for (const [aglCode, det] of j100Det) {
        // Propagar saldo para todos os ancestrais
        // Propagar do detalhe ate a raiz, incluindo a raiz
        let cur = rfbBPMap.get(aglCode);
        while (cur) {
          const paiCod = cur.codigoPai;
          if (!paiCod) break; // chegou na raiz, nao propagar mais
          const pai = rfbBPMap.get(paiCod);
          if (!pai) break;
          if (!j100Tot.has(pai.codigo)) {
            j100Tot.set(pai.codigo, { ini: 0, fin: 0, nome: pai.descricao, indCta: pai.codigo.startsWith("1") ? "A" : "P", nivel: pai.nivel, pai: pai.codigoPai || "" });
          }
          const t = j100Tot.get(pai.codigo)!; t.ini += det.ini; t.fin += det.fin;
          cur = pai;
        }
      }
      // 4. Emitir na ordem RFB: totalizadores primeiro (por ordem), depois detalhes
      const j100Lines: string[] = [];
      // Totalizadores ordenados por ordem RFB
      const totOrdered = rfbBP.filter(r => j100Tot.has(r.codigo));
      for (const r of totOrdered) {
        const t = j100Tot.get(r.codigo)!;
        const dcIni = t.ini >= 0 ? "D" : "C";
        const dcFin = t.fin >= 0 ? "D" : "C";
        j100Lines.push(P+"J100"+P+r.codigo+P+"T"+P+r.nivel+P+(r.codigoPai||"")+P+t.indCta+P+r.descricao.substring(0,60)+P+this.fmtDec(Math.abs(t.ini))+P+dcIni+P+this.fmtDec(Math.abs(t.fin))+P+dcFin+P+P);
      }
      // Detalhes
      for (const [aglCode, det] of j100Det) {
        const rfbRow = rfbBPMap.get(aglCode);
        const nivel  = rfbRow?.nivel ?? 5;
        const pai    = rfbRow?.codigoPai ?? "";
        const dcIni  = det.ini >= 0 ? "D" : "C";
        const dcFin  = det.fin >= 0 ? "D" : "C";
        j100Lines.push(P+"J100"+P+aglCode+P+"D"+P+nivel+P+pai+P+det.indCta+P+det.nome.substring(0,60)+P+this.fmtDec(Math.abs(det.ini))+P+dcIni+P+this.fmtDec(Math.abs(det.fin))+P+dcFin+P+P);
      }
      for (const l of j100Lines) add(l);
  
          // J150 - DRE usando codigos do I052, com hierarquia real (mesmo padrao do J100)
          // Reescrito 04/08/2026 apos achado real no PVA (empresa GRB): a versao anterior
          // tinha os campos desalinhados do layout oficial. Confirmado via fonte externa
          // (vriconsulting, exemplo real de linha J150) a ordem correta:
          // NU_ORDEM|COD_AGL|IND_COD_AGL|NIVEL_AGL|COD_AGL_SUP|DESCR_COD_AGL|VL_CTA_INI|
          // IND_DC_INI|VL_CTA_FIN|IND_DC_FIN|IND_DC_CTA|NUM_CCUS. A versao anterior tinha
          // NIVEL_AGL fixo em "2" para toda linha, COD_AGL_SUP substituido por uma string
          // fixa sem sentido (TITULO_DRE), e VL_CTA_INI duplicando o valor do periodo atual
          // (sem saldo do periodo anterior real - nao trackeamos isso hoje, entao fica
          // "0,00" honestamente em vez de inventar um valor errado).
          const rfbDRE = await this.prisma.rfbAglutinationCode.findMany({ where: { leiaute: 9, anoBase, tipo: "DRE" }, orderBy: { ordem: "asc" } });
          const rfbDREMap = new Map(rfbDRE.map(r => [r.codigo, r]));
  
          // Detalhe: soma por codigo de aglutinacao (folha)
          const j150Det = new Map<string, number>(); // aglCode -> valor (positivo=despesa, negativo=receita)
          for (const acc of accounts) {
            if (!acc.isAnalytic) continue;
            if (!dreTypes.has(acc.type.toString())) continue;
            const aglCode152 = i052Map.get(acc.id);
            if (!aglCode152) continue;
            const mv152 = dreRollup.get(acc.id) ?? { deb: 0, cre: 0 };
            const vlOri = mv152.deb - mv152.cre;
            j150Det.set(aglCode152, (j150Det.get(aglCode152) ?? 0) + vlOri);
          }
  
          // Totalizadores: propaga cada detalhe ate a raiz via codigoPai, somando (mesmo padrao do J100)
          const j150Tot = new Map<string, number>();
          for (const [aglCode, val] of j150Det) {
            let cur = rfbDREMap.get(aglCode);
            while (cur) {
              const paiCod = cur.codigoPai;
              if (!paiCod) break;
              j150Tot.set(paiCod, (j150Tot.get(paiCod) ?? 0) + val);
              cur = rfbDREMap.get(paiCod);
            }
          }
  
          
          const j150Lines: string[] = [];
          let nuOrdem152 = 1;
          let totalDREVal = 0;
          for (const val of j150Det.values()) totalDREVal += val;
  
          // Totalizadores primeiro, na ordem RFB (mesmo padrao do J100)
          const totOrdered152 = rfbDRE.filter(r => j150Tot.has(r.codigo));
          for (const r of totOrdered152) {
            const val = j150Tot.get(r.codigo)!;
            const dcVal = val >= 0 ? "D" : "C";
            const vlAbs = this.fmtDec(Math.abs(val));
            // IND_GRP_DRE (R=Receita/D=Despesa) NAO e um campo novo/extra - e o ULTIMO campo antes de
            // NUM_CCUS, que eu tratava incorretamente como copia do indicador D/C (dcVal). Confirmado
            // no PVA (GRB, 04/08/2026): inserir um campo novo para isso quebrou a contagem (14 campos
            // gerados vs 13 esperados pelo leiaute real), causando 131 erros em cascata por desalinhamento.
            // Correcao: mantem 13 campos, so troca o VALOR do ultimo campo de dcVal para R/D.
            j150Lines.push(P+"J150"+P+nuOrdem152+P+r.codigo+P+"T"+P+r.nivel+P+(r.codigoPai||"")+P+r.descricao.substring(0,60)+P+"0,00"+P+"D"+P+vlAbs+P+dcVal+P+(val>=0?"D":"R")+P+P);
            nuOrdem152++;
          }
  
          // Detalhes
          for (const [aglCode, val] of j150Det) {
            const r = rfbDREMap.get(aglCode);
            const nivel = r?.nivel ?? 6;
            const pai = r?.codigoPai ?? "";
            const nome = (r?.descricao ?? aglCode).substring(0, 60);
            const dcVal = val >= 0 ? "D" : "C";
            const vlAbs = this.fmtDec(Math.abs(val));
            j150Lines.push(P+"J150"+P+nuOrdem152+P+aglCode+P+"D"+P+nivel+P+pai+P+nome+P+"0,00"+P+"D"+P+vlAbs+P+dcVal+P+(val>=0?"D":"R")+P+P);
            nuOrdem152++;
          }
  
          for (const l152 of j150Lines) add(l152);
    }
    // J900 — Termo de Encerramento
    // |J900|DESC_ESC|NR_LIVRO|TIPO_LIVRO|NOME|QTD_PAG|DT_INI|DT_FIN|
    add(P+"J900"+P+"TERMO DE ENCERRAMENTO"+P+bookNumber+P+bookNature+P+company.legalName+P+totalPag+P+dtIni+P+dtFin+P);

    // J930 — Signatario
    // Layout RFB: |J930|COD_QUALIF|CPF_CNPJ|NOME|CRC|DT_INI|DT_FIM|IND_RESP|IND_AUD|
    // J930 linha 1: pessoa juridica responsavel (e-CNPJ) — COD_QUALIF 001
    add(P+"J930"+P+company.legalName+P+cnpj+P+"Pessoa Juridica (e-CNPJ)"+P+"001"+P+P+P+P+P+P+P+"S"+P);
    // J930 linha 2: contador responsavel — COD_QUALIF 900
    // J930 linha 2: removida em 04/08/2026 - gerava contador DUPLICADO no J930. Desde a
    // sincronizacao automatica (accounting-config.service.ts upsertConfig ->
    // person_companies, 03-04/08/2026), o loop de personLinks abaixo ja cobre isso via
    // role='contador'. Bug real confirmado no PVA (GRB): registro duplicado por chave
    // IDENT_CPF_CNPJ+COD_ASSIN (Helenilto 2x como COD_ASSIN=900, uma linha completa via
    // accConfig e uma vazia via personLinks sem CRC), a vazia ainda disparava mais 4
    // erros de campo obrigatorio + qualificacao "Contador/Contabilista" nao reconhecida.
    // J930 linhas 3+: socios/administradores/contador que assinam ECD/ECF.
    // COD_ASSIN resolvido pela Tabela de Qualificacao do Assinante oficial da RFB
    // (rfb_global_tables, tabela=QUALIF_ASSINANTE), carregada de
    // SPEDCONTABIL_GLOBAL$SPEDCONTABIL_QUALIF_ASSINANTE - nao mais hardcoded "205"
    // para todo mundo. role='contador' -> 900 (com CRC, exigido pela
    // REGRA_ADVERTENCIA_CONTADOR); demais roles -> mapa abaixo; sem match -> 999 Outros.
    const qualifRows = await this.prisma.rfbGlobalTable.findMany({
      where: { sistema: "SPEDCONTABIL", tabela: "QUALIF_ASSINANTE" },
    });
    const qualifByCodigo = new Map(qualifRows.map(q => [q.codigo, q.nome]));
    const ROLE_TO_COD_ASSIN: Record<string, string> = {
      contador: "900",
      diretor_presidente: "203", diretor_vice_presidente: "203",
      diretor_financeiro: "203", diretor_operacional: "203",
      procurador: "309",
      socio: "801", acionista: "801",
      representante_legal: "205",
      secretario: "999", responsavel_tecnico: "999", outro: "999",
    };
    const personLinks = await this.prisma.personCompany.findMany({
      where: { companyId, OR: [{ assinaEcd: true }, { assinaEcf: true }] },
      include: { person: { select: { fullName: true, cpf: true, crcNumber: true, crcState: true } } },
    });
    // Fallback de CRC: person.crcNumber (global, cadastro da Pessoa Fisica) pode ficar vazio
    // mesmo quando a empresa TEM o CRC do contador cadastrado - so que na aba Contabil
    // (company_accounting_configs), campo separado, especifico por empresa. Achado real
    // (05/08/2026, GRB): CRC 029136 estava la (confirmado no widget de preview J930 que
    // le dessa tabela), mas o exporter so olhava person.crcNumber (vazio) e nunca essa
    // fonte, gerando linha 900 sem CRC (REGRA_ADVERTENCIA_CONTADOR).
    const accConfigForCrc = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    for (const link of personLinks) {
      const cpf  = (link.person?.cpf||"").replace(/\D/g,"");
      const nome = link.person?.fullName || "";
      const roleKey  = (link.role || "").toLowerCase();
      const codAssin = ROLE_TO_COD_ASSIN[roleKey] ?? "999";
      const nomeQualif = qualifByCodigo.get(codAssin) ?? "Outros";
      if (codAssin === "900") {
        // REGRA_ADVERTENCIA_CONTADOR: NUM_SEQ_CRC e DT_CRC devem vir preenchidos.
        // EMAIL/FONE tambem obrigatorios para o contador, achado real no PVA (05/08/2026,
        // GRB) - antes ficavam vazios. IDENT_QUALIF: o texto importado da tabela oficial
        // ("Contador/Contabilista", de rfb_global_tables) NAO e reconhecido pelo PVA - os
        // exemplos do proprio manual usam sempre so "Contador", texto mais simples.
        const crcVal = (link.person?.crcNumber || accConfigForCrc?.accountantCrc || "").replace(/\D/g,"");
        const crcUf  = link.person?.crcState || accConfigForCrc?.accountantCrcState || "";
        const emailContador = accConfigForCrc?.accountantEmail || accConfigForCrc?.escritorioEmail || "";
        const foneContador  = (accConfigForCrc?.accountantPhone || accConfigForCrc?.escritorioTelefone || "").replace(/\D/g,"");
        const qualifContador = "Contador";
        add(P+"J930"+P+nome+P+cpf+P+qualifContador+P+codAssin+P+crcVal+P+emailContador+P+foneContador+P+crcUf+P+(crcUf?crcUf+"/"+crcVal:"")+P+P+"N"+P);
      } else {
        add(P+"J930"+P+nome+P+cpf+P+nomeQualif+P+codAssin+P+P+P+P+P+P+P+"N"+P);
      }
    }

    const idxJ001   = lines.findIndex(l => l === P+"J001"+P+"0"+P);
    const blocoJQtd = lines.length - idxJ001;
    add(P+"J990"+P+(blocoJQtd + 1)+P);

    // BLOCO K (vazio)
    add(P+"K001"+P+"1"+P);
    add(P+"K990"+P+"2"+P);

    // ── BLOCO 9 ──────────────────────────────────────────────────────────
    add(P+"9001"+P+"0"+P);
    const regCounts = new Map<string, number>();
    for (const l of lines) {
      const r = l.split(P)[1];
      if (r) regCounts.set(r, (regCounts.get(r) ?? 0) + 1);
    }
    // Adicionar 9900 para cada tipo de registro
    for (const [reg, count] of Array.from(regCounts.entries()).sort()) {
      add(P+"9900"+P+reg+P+count+P);
    }
    // 9900 para os proprios registros 9 (aproximado)
    add(P+"9900"+P+"9001"+P+"1"+P);
    add(P+"9900"+P+"9900"+P+(regCounts.size + 2)+P);
    add(P+"9900"+P+"9990"+P+"1"+P);
    add(P+"9900"+P+"9999"+P+"1"+P);
    add(P+"9990"+P+(lines.length - lines.findIndex(l => l === P+"9001"+P+"0"+P) + 4)+P);
    add(P+"9999"+P+(lines.length + 1)+P);

    // Preencher 0990 com total do Bloco 0
    const idxC001 = lines.findIndex(l => l === P+"C001"+P+"1"+P);
    lines[idx0990] = P+"0990"+P+idxC001+P;

    this.logger.log("ECD: " + lines.length + " linhas | " + accounts.length + " contas | " + entries.length + " lancamentos");
    const content = lines.join("\n") + "\n";
    const warnings: string[] = [];
    return { buffer: Buffer.from(content, "latin1"), warnings };
  }

  private monthRange(start: Date, end: Date) {
    const result: { year: number; month: number; firstDay: Date; lastDay: Date }[] = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const m = cur.getUTCMonth();
      const firstDay = new Date(Date.UTC(y, m, 1));
      const lastDay  = new Date(Date.UTC(y, m + 1, 0));
      result.push({ year: y, month: m + 1, firstDay, lastDay });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return result;
  }

  private fmtDate(date: Date | string): string {
    const d  = date instanceof Date ? date : new Date(date);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return dd + mm + String(d.getUTCFullYear());
  }

  private fmtDec(v: number): string {
    return Math.abs(v).toFixed(2).replace(".", ",");
  }

  private typeToNat(type: string): string {
    switch (type) {
      case "ASSET":     return "01";
      case "LIABILITY": return "02";
      case "EQUITY":    return "03";
      case "REVENUE":   return "04";
          case "EXPENSE":   return "04";
      default:          return "09";
    }
  }
}
