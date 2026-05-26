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
  layoutVersion?: string;
}

@Injectable()
export class EcdExporterService {
  private readonly logger = new Logger(EcdExporterService.name);
  constructor(private prisma: PrismaService) {}

  async export(options: EcdExportOptions): Promise<Buffer> {
    const {
      companyId, periodStart, periodEnd,
      bookNumber = "1", bookNature = "Livro Diario Geral",
      bookType = "G", layoutVersion = "9.00",
    } = options;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxId: true, legalName: true, state: true, city: true, nire: true },
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
      where: { companyId, anoBase, isActive: true },
      include: { mappings: { select: { accountId: true, aglutinationCode: true } } },
    });
    const i052Map = new Map<string, string>(); // accountId -> aglCode
    for (const view of viewsI052) {
      for (const m of view.mappings) i052Map.set(m.accountId, m.aglutinationCode);
    }

    // Lancamentos do periodo
    const entries = await this.prisma.journalEntry.findMany({
      where: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null },
      include: { items: { include: { account: { select: { code: true, reducedCode: true } } } } },
      orderBy: { date: "asc" },
    });

    // Saldo inicial por conta (account_balance)
    const i155Rows = await this.prisma.accountBalance.findMany({
      where: { companyId, referenceDate: { lt: new Date(periodStart) } },
      orderBy: { referenceDate: "desc" },
    });
    const saldoIni = new Map<string, number>();
    for (const row of i155Rows) {
      if (!saldoIni.has(row.accountId) && analyticIds.has(row.accountId))
        saldoIni.set(row.accountId, Number(row.balance));
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
    add(P+"0000"+P+"LECD"+P+dtIni+P+dtFin+P+company.legalName+P+cnpj+P+(company.state||"")+P+P+"3550308"+P+"60959347"+P+P+"0"+P+(company.nire?"1":"1")+P+"0"+P+P+"0"+P+"0"+P+P+"N"+P+"N"+P+"0"+P+"0"+P+"1"+P);
    add(P+"0001"+P+"0"+P);
    add(P+"0007"+P+(company.state||"")+P+P);
    const idx0990 = lines.length;
    add(P+"0990"+P+"PLACEHOLDER"+P);

    // BLOCO C (vazio)
    add(P+"C001"+P+"1"+P);
    add(P+"C990"+P+"2"+P);

    // ── BLOCO I ──────────────────────────────────────────────────────────
    add(P+"I001"+P+"0"+P);
    // |I010|IND_ESC|COD_VER_LC|
    add(P+"I010"+P+bookType+P+layoutVersion+P);
    // |I030|DESC_ESC|NR_LIVRO|NR_ORD|TIPO_LIVRO|QTD_PAG|NOME|NIRE|CNPJ|DT_ARQ|NOM_COM|CIDADE|DT_FIN|
    const totalPag = entries.length > 0 ? String(entries.length + 100) : "100";
    add(P+"I030"+P+"TERMO DE ABERTURA"+P+bookNumber+P+bookNature+P+totalPag+P+company.legalName+P+(company.nire||"")+P+cnpj+P+dtIni+P+P+(company.city||"Sao Paulo")+P+dtFin+P);

    // Pre-calcular codigos DRE_ para contas de resultado (mesmo codigo usado no J150)
    const dreTypes2 = new Set(["REVENUE","EXPENSE"]);
    const dreCodeMap = new Map<string, string>(); // accountId -> DRE_NNN_DO0_cod
    let dreSeq = 0;
    for (const acc of accounts) {
      if (!acc.isAnalytic) continue;
      if (!dreTypes2.has(acc.type.toString())) continue;
      if (!i052Map.has(acc.id)) continue;
      const rc = (acc as any).reducedCode || acc.code;
      const seq = String(dreSeq).padStart(3, "0");
      dreCodeMap.set(acc.id, ("DRE_" + seq + "_DO0_" + rc).padEnd(30, " "));
      dreSeq++;
    }

    // I050 + I051 + I052 — plano de contas com referencial
    for (const acc of accounts) {
      const dtAlt      = this.fmtDate(acc.createdAt);
      const natCode    = this.typeToNat(acc.type.toString());
      const indCta     = acc.isAnalytic ? "A" : "S";
      const parentCode = acc.parentId ? (codeById.get(acc.parentId) ?? "") : "";
      const reducedCode = (acc as any).reducedCode || acc.code;
      // |I050|DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|NOME_CTA|
      add(P+"I050"+P+dtAlt+P+natCode+P+indCta+P+acc.level+P+reducedCode+P+parentCode+P+acc.name+P);
      if (acc.isAnalytic) {
        // I051: |I051||COD_REF| — codigo referencial RFB (mapeado via Visoes Contabeis)
        const aglCode = i052Map.get(acc.id) ?? "";
        add(P+"I051"+P+P+aglCode+P);
        // I052: |I052||BAL_codCta| — codigo de aglutinacao com padding 20 chars
        const balCode = "BAL_" + reducedCode.padEnd(20, " ");
        add(P+"I052"+P+P+balCode+P);
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
        const reducedCode = (acc as any).reducedCode || acc.code;
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
        const codCta  = item.account.reducedCode || item.account.code;
        // |I250|COD_CTA|VL_DC|IND_DC|NUM_ARQ|COD_HIST|DSC_HIST|COD_PART|NR_DOC|
        add(P+"I250"+P+codCta+P+P+this.fmtDec(Number(item.value))+P+sign+P+"0"+P+"1"+P+hist+P+P);
      }
    }

    // I350/I355 — saldos de contas de resultado antes do encerramento
    const dreTypes = new Set(["REVENUE","EXPENSE"]);
    // I355: excluir contas que nao sao de resultado (ex: depreciacoes classificadas como despesa mas sem lancamento de encerramento)
    const dreAccounts = accounts.filter(a => {
      if (!a.isAnalytic || !dreTypes.has(a.type.toString())) return false;
      const mv = dreMap.get(a.id);
      if (!mv) return false;
      const saldo = mv.cre - mv.deb;
      return saldo !== 0; // so incluir contas com saldo liquido nao zero
    });
    if (dreAccounts.length > 0) {
      add(P+"I350"+P+dtFin+P);
      for (const acc of dreAccounts) {
        const mv = dreMap.get(acc.id) ?? { deb: 0, cre: 0 };
        const saldo = mv.cre - mv.deb;
        if (saldo === 0) continue;
        const dc = saldo >= 0 ? "C" : "D";
        const reducedCode = (acc as any).reducedCode || acc.code;
        add(P+"I355"+P+reducedCode+P+P+this.fmtDec(Math.abs(saldo))+P+dc+P);
      }
    }

    const idxI001   = lines.findIndex(l => l === P+"I001"+P+"0"+P);
    const blocoIQtd = lines.length - idxI001;
    add(P+"I990"+P+(blocoIQtd + 1)+P);

    // ── BLOCO J ──────────────────────────────────────────────────────────
    add(P+"J001"+P+"0"+P);
    // |J005|DT_INI|DT_FIN|ID_DEM| (3 campos reais conforme gabarito IOB)
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
    for (const acc of accounts) {
      if (!bpTypes.has(acc.type.toString())) continue;
      const hasMaping   = acc.isAnalytic && i052Map.has(acc.id);
      // Incluir: sinteticas (T) sempre; analiticas so se tem mapeamento I052 (D)
      if (acc.isAnalytic && !hasMaping) continue;
      const saldoFin    = rollupMap.get(acc.id) ?? 0;
      const saldoIniVal = saldoIniRollup.get(acc.id) ?? 0;
      // Incluir sinteticas mesmo com saldo zero se tiverem filhos com mapeamento
      const hasMapedChild = !acc.isAnalytic && accounts.some(child => child.parentId === acc.id && i052Map.has(child.id));
      if (saldoFin === 0 && saldoIniVal === 0 && !hasMaping && !hasMapedChild) continue;
      const reducedCode = (acc as any).reducedCode || acc.code;
      const balCode     = "BAL_" + reducedCode;
      const parentRed   = acc.parentId ? ((accounts.find(a => a.id === acc.parentId) as any)?.reducedCode || codeById.get(acc.parentId) || "") : "";
      const balParent   = parentRed ? "BAL_" + parentRed : "";
      const indCta      = acc.type.toString() === "ASSET" ? "A" : "P";
      const dcIni       = saldoIniVal >= 0 ? "D" : "C";
      const dcFin       = saldoFin >= 0 ? "D" : "C";
      const tipoCodAgl  = hasMaping ? "D" : "T";
      add(P+"J100"+P+balCode+P+tipoCodAgl+P+acc.level+P+balParent+P+indCta+P+acc.name+P+this.fmtDec(Math.abs(saldoIniVal))+P+dcIni+P+this.fmtDec(Math.abs(saldoFin))+P+dcFin+P+P);
    }

    // J150 — DRE usando codigos do I052 (gabarito Kipstone)
    // COD_AGL=DRE_NNN_DO0_codCta pad30, COD_AGL_SUP=totalizador pad30, IND_ENCERR sequencial
    const TITULO_DRE = "DRE_119_TITULO_LUCRO_PREJUIZO".padEnd(30, " ");
    let indEncerr = 0;
    let totalDREVal = 0;
    const j150Lines: string[] = [];
    for (const acc of accounts) {
      if (!acc.isAnalytic) continue;
      if (!dreTypes.has(acc.type.toString())) continue;
      const aglCode152 = i052Map.get(acc.id);
      if (!aglCode152) continue;
      const mv152 = dreRollup.get(acc.id) ?? { deb: 0, cre: 0 };
      const vlOri  = Math.abs(mv152.deb - mv152.cre);
      const dc152  = "D"; // J150 IND_DC sempre D para linhas de detalhe
      const seq152 = String(indEncerr).padStart(3, "0");
      const cod152 = (acc as any).reducedCode || acc.code;
      const dreCode152 = ("DRE_" + seq152 + "_DO0_" + cod152).padEnd(30, " ");
      totalDREVal += (dc152 === "D" ? 1 : -1) * vlOri;
      j150Lines.push(P+"J150"+P+indEncerr+P+dreCode152+P+dc152+P+"2"+P+TITULO_DRE+P+acc.name+P+this.fmtDec(vlOri)+P+dc152+P+this.fmtDec(vlOri)+P+dc152+P+"D"+P+P);
      indEncerr++;
    }
    // Linha totalizadora
    const vlTotalDRE = Math.abs(totalDREVal);
    const dcTotalDRE = totalDREVal >= 0 ? "D" : "C";
    const emptyPad30 = "".padEnd(30, " ");
    j150Lines.push(P+"J150"+P+indEncerr+P+TITULO_DRE+P+"T"+P+"1"+P+emptyPad30+P+"PREJUIZO LIQUIDO DO EXERCICIO"+P+this.fmtDec(vlTotalDRE)+P+dcTotalDRE+P+this.fmtDec(vlTotalDRE)+P+dcTotalDRE+P+"D"+P+P);
    for (const l152 of j150Lines) add(l152);
    // J900 — Termo de Encerramento
    // |J900|DESC_ESC|NR_LIVRO|TIPO_LIVRO|NOME|QTD_PAG|DT_INI|DT_FIN|
    add(P+"J900"+P+"TERMO DE ENCERRAMENTO"+P+bookNumber+P+bookNature+P+company.legalName+P+totalPag+P+dtIni+P+dtFin+P);

    // J930 — Signatario (pessoa juridica responsavel)
    // |J930|NOME|CPF_CNPJ|QUALIF|COD_QUALIF|CRC|UF_CRC|NR_ORD|DT_ENTRAD|DT_SAIDA|TIPO_ASSIN|
    // J930 linha 1: representante legal (pessoa juridica - e-CNPJ)
    add(P+"J930"+P+company.legalName+P+cnpj+P+"Pessoa Juridica (e-CNPJ ou e-PJ)"+P+"001"+P+P+P+P+P+P+P+"S"+P);
    // J930 linha 2: contador responsavel (qualificacao 900) — buscar do CompanyAccountingConfig
    const accConfig = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    if (accConfig?.accountantName && accConfig?.accountantCrc) {
      const crcVal = (accConfig.accountantCrc||"").replace(/\D/g,"");
      const crcUf  = accConfig.accountantCrcState || (company.state||"SP");
      const cpfContador = accConfig.accountantPersonId ? "" : "";
      add(P+"J930"+P+(accConfig.accountantName||"")+P+cpfContador+P+"Contador"+P+"900"+P+crcVal+P+crcUf+P+P+P+P+P+"S"+P);
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
    return Buffer.from(content, "latin1");
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
      case "EXPENSE":   return "05";
      default:          return "09";
    }
  }
}
