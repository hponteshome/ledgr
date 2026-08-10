// apps/api/src/modules/sped/ecf/services/ecf-exporter.service.ts
// Baseado no gabarito real LM/ECF_2024_LM.TXT (blocos 0/J/Y/9 conferidos campo a
// campo contra esse arquivo). Blocos K/N (apuracao Lucro Presumido) nao tem
// gabarito real disponivel no projeto - construidos a partir do esquema do
// ecf-parser.service.ts (posicoes de campo), tratar como primeira tentativa a
// validar/corrigir contra o PVA real (ECF/SpedECF), mesmo metodo ja usado no ECD.
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";

export interface EcfExportOptions {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  // Codigos oficiais (Manual de Orientacao ECF, registro 0010.FORMA_TRIB):
  // 1=Real 2=Real/Arbitrado 3=Presumido/Real 4=Presumido/Real/Arbitrado
  // 5=Presumido (puro) 6=Arbitrado 7=Presumido/Arbitrado 8=Imune 9=Isenta.
  // Achado real no PVA (10/08/2026, GRB): "2" (copiado do gabarito LM sem
  // verificar) e Real/Arbitrado, nao Presumido - causou erro "trimestre nao
  // permite a forma de tributacao P". Presumido puro e sempre "5".
  formaTributacao?: "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
  tipEcf?: "0" | "1" | "2" | "3";
}

@Injectable()
export class EcfExporterService {
  private readonly logger = new Logger(EcfExporterService.name);
  constructor(private prisma: PrismaService) {}

  async export(options: EcfExportOptions): Promise<{ buffer: Buffer; warnings: string[] }> {
    const {
      companyId, periodStart, periodEnd,
      formaTributacao = "5", // 5=Lucro Presumido (puro) - default pra GRB, ajustar via cadastro no futuro
      tipEcf = "0",
    } = options;
    const warnings: string[] = [];

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        taxId: true, legalName: true, state: true, city: true, nire: true, codMun: true,
        street: true, number: true, neighborhood: true, zipCode: true,
      },
    });
    if (!company) throw new Error("Empresa nao encontrada.");

    const cnpj  = company.taxId.replace(/\D/g, "");
    const dtIni = this.fmtDate(periodStart);
    const dtFin = this.fmtDate(periodEnd);
    const anoBase = periodStart.getUTCFullYear();
    const P = "|";
    const lines: string[] = [];
    const add = (l: string) => lines.push(l);
    const quarters = this.quarterRange(periodStart, periodEnd);
    // FORMA_TRIB_PER (0010, campo 7): 1 letra por trimestre do ano-calendario,
    // nao o numero de FORMA_TRIB. Achado real no PVA (ECF, 10/08/2026, GRB):
    // "RRRR" copiado do gabarito LM/ECF_2024_LM.TXT sem verificar - a LM e
    // Lucro Real (tem blocos L/M de LALUR), R = Real. Presumido = P.
    // Letras validas por trimestre (Manual ECF, 0010.FORMA_TRIB_PER): R=Real,
    // P=Presumido, A=Arbitrado, E=Real Estimativa, 0=fora do periodo. So cobre
    // aqui as formas "puras" (1,5,6) - formas mistas (2,3,4,7) exigiriam
    // FORMA_TRIB_PER variando por trimestre real, fora de escopo enquanto so
    // GRB (Presumido puro) e o alvo.
    const FORMA_TRIB_LETTER: Record<string, string> = { "1": "R", "5": "P", "6": "A" };
    const formaTribPer = (FORMA_TRIB_LETTER[formaTributacao] ?? "P").repeat(quarters.length);

    if (!company.street || !company.zipCode) {
      warnings.push("Endereco fiscal da empresa incompleto (0030) - preencher cadastro.");
    }

    // ── BLOCO 0 ──────────────────────────────────────────────────────────
    // |0000|LECF|VERSAO|CNPJ|NOME|IND_SIT_INI|SIT_ESP|DT_SIT_ESP|DT_INI|DT_FIN|RETIF|NUM_REC|TIP_ECF|IND_DESENQ|
    // Campos fixos (0/0/vazio/vazio/N/vazio/0/vazio/vazio) copiados literalmente do
    // gabarito real (empresa em situacao regular, nao retificadora, sem desenquadramento).
    add(P+"0000"+P+"LECF"+P+"0011"+P+cnpj+P+company.legalName+P+"0"+P+"0"+P+P+P+dtIni+P+dtFin+P+"N"+P+P+tipEcf+P+P);
    add(P+"0001"+P+"0"+P);
    // |0010|HASH_ECF_ANTERIOR|OPT_REFIS_PAES|FORMA_TRIB|FORMA_APUR|COD_QUALIF_PJ|
    //       FORMA_TRIB_PER|MES_BAL_RED|TIP_ESC_PRE|TIP_ENT|FORMA_APUR_I|APUR_CSLL|OPT_EXT_RTT|
    // FORMA_APUR: Lucro Presumido e sempre trimestral ("T"), Real pode ser T ou A.
    // MES_BAL_RED: so quando FORMA_APUR=Anual (nao aplicavel, GRB e trimestral).
    // TIP_ESC_PRE: obrigatorio quando FORMA_TRIB abrange Lucro Presumido (3,4,5,7,10) -
    // achado real no PVA (10/08/2026, GRB): campo vazio rejeitado. L=Livro Caixa,
    // C=Contabil - GRB tem escrituracao contabil completa (ECD ja validada em
    // partidas dobradas), entao "C".
    const mesBalRed = "";
    const tipEscPre = "C";
    add(P+"0010"+P+P+"N"+P+formaTributacao+P+"T"+P+"01"+P+formaTribPer+P+mesBalRed+P+tipEscPre+P+P+P+P+P);
    // |0930|NOME|CPF|COD_QUALIF|CRC|EMAIL|FONE| — mesmo padrao do J930 do ECD:
    // sinatarios via CompanyShareholder/PersonCompany com assinaEcf=true.
    const accConfigForCrc = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    const signers = await this.prisma.personCompany.findMany({
      where: { companyId, assinaEcf: true },
      include: { person: { select: { fullName: true, cpf: true, crcNumber: true, crcState: true } } },
    });
    if (signers.length === 0) {
      warnings.push("Nenhum signatario com assinaEcf=true cadastrado - registro 0930 ficara vazio.");
    }
    for (const s of signers) {
      const cpf  = (s.person?.cpf || "").replace(/\D/g, "");
      const nome = s.person?.fullName || "";
      const isContador = (s.role || "").toLowerCase() === "contador";
      const codQualif = isContador ? "900" : "205";
      const crcVal = isContador ? (s.person?.crcNumber || accConfigForCrc?.accountantCrc || "").replace(/\D/g, "") : "";
      const crcUf  = isContador ? (s.person?.crcState || accConfigForCrc?.accountantCrcState || "") : "";
      const email  = isContador ? (accConfigForCrc?.accountantEmail || accConfigForCrc?.escritorioEmail || "") : "";
      const fone   = isContador ? (accConfigForCrc?.accountantPhone || accConfigForCrc?.escritorioTelefone || "").replace(/\D/g, "") : "";
      const crcFmt = crcVal ? crcUf + crcVal : "";
      add(P+"0930"+P+nome+P+cpf+P+codQualif+P+crcFmt+P+email+P+fone+P);
    }
    const idx0990 = lines.length;
    add(P+"0990"+P+"PLACEHOLDER"+P);

    // ── BLOCO J (plano de contas referencial) ───────────────────────────────
    // Mesma logica do I050/I051 do ECD (chart+i052Map), so troca a tag do
    // registro. J050 NAO tem o campo "codCcus" que o parser assume - confirmado
    // pelo gabarito real (dtAlt|codNat|indCta|nivel|codCta|codCtaMae|nomeCta).
    add(P+"J001"+P+"0"+P);
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ level: "asc" }, { code: "asc" }],
    });
    const codeById = new Map(accounts.map(a => [a.id, a.code]));
    const viewsI052 = await this.prisma.accountingView.findMany({
      where: { companyId, isActive: true },
      include: { mappings: { select: { accountId: true, aglutinationCode: true } } },
    });
    const i052Map = new Map<string, string>();
    for (const view of viewsI052) {
      for (const m of view.mappings) i052Map.set(m.accountId, m.aglutinationCode);
    }
    if (i052Map.size === 0) {
      warnings.push("Nenhuma conta mapeada em Visoes Contabeis - J051 (referencial) ficara vazio.");
    }
    const periodEndDate = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
    for (const acc of accounts) {
      const createdAtDate = acc.createdAt instanceof Date ? acc.createdAt : new Date(acc.createdAt);
      const dtAlt      = this.fmtDate(createdAtDate > periodEndDate ? periodEndDate : createdAtDate);
      const natCode    = this.typeToNat(acc.type.toString());
      const indCta     = acc.isAnalytic ? "A" : "S";
      const parentCode = acc.parentId ? (codeById.get(acc.parentId) ?? "") : "";
      add(P+"J050"+P+dtAlt+P+natCode+P+indCta+P+acc.level+P+acc.code+P+parentCode+P+acc.name+P);
      if (acc.isAnalytic) {
        const codRef = i052Map.get(acc.id) ?? "";
        if (codRef) add(P+"J051"+P+P+codRef+P);
      }
    }
    const idxJ001 = lines.findIndex(l => l === P+"J001"+P+"0"+P);
    add(P+"J990"+P+(lines.length - idxJ001 + 1)+P);

    // ── BLOCO K (periodos e saldos) ─────────────────────────────────────────
    // SEM gabarito real disponivel - esquema herdado das posicoes lidas pelo
    // proprio ecf-parser.service.ts. Candidato prioritario a corrigir na
    // primeira rodada de validacao PVA.
    add(P+"K001"+P+"0"+P);
    const analyticIds = new Set(accounts.filter(a => a.isAnalytic).map(a => a.id));
    const historicalItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { lt: periodStart }, deletedAt: null } },
      select: { accountId: true, type: true, value: true },
    });
    const historicalMov = new Map<string, { deb: number; cre: number }>();
    for (const item of historicalItems) {
      if (!analyticIds.has(item.accountId)) continue;
      const cur = historicalMov.get(item.accountId) ?? { deb: 0, cre: 0 };
      if (item.type === "DEBIT") cur.deb += Number(item.value); else cur.cre += Number(item.value);
      historicalMov.set(item.accountId, cur);
    }
    const saldoCorrente = new Map<string, number>();
    for (const aid of analyticIds) {
      const mov = historicalMov.get(aid);
      if (mov) saldoCorrente.set(aid, mov.deb - mov.cre);
    }
    const periodItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null } },
      select: { accountId: true, type: true, value: true, journalEntry: { select: { date: true, description: true } } },
    });
    for (const q of quarters) {
      const inQuarter = periodItems.filter(it => {
        const d = it.journalEntry.date instanceof Date ? it.journalEntry.date : new Date(it.journalEntry.date);
        return d >= q.firstDay && d <= q.lastDay;
      });
      const byAcc = new Map<string, { deb: number; cre: number }>();
      for (const it of inQuarter) {
        if (!analyticIds.has(it.accountId)) continue;
        const cur = byAcc.get(it.accountId) ?? { deb: 0, cre: 0 };
        if (it.type === "DEBIT") cur.deb += Number(it.value); else cur.cre += Number(it.value);
        byAcc.set(it.accountId, cur);
      }
      add(P+"K030"+P+this.fmtDate(q.firstDay)+P+this.fmtDate(q.lastDay)+P+q.label+P);
      const contasDoTrimestre = new Set<string>([...saldoCorrente.keys(), ...byAcc.keys()]);
      const sortedContas = Array.from(contasDoTrimestre).sort((a, b) => (codeById.get(a) ?? "").localeCompare(codeById.get(b) ?? ""));
      for (const aid of sortedContas) {
        const acc = accounts.find(a => a.id === aid);
        if (!acc) continue;
        const mv = byAcc.get(aid) ?? { deb: 0, cre: 0 };
        const sldIni = saldoCorrente.get(aid) ?? 0;
        const sldFin = sldIni + mv.deb - mv.cre;
        if (sldIni === 0 && mv.deb === 0 && mv.cre === 0 && sldFin === 0) continue;
        const dcIni = sldIni >= 0 ? "D" : "C";
        const dcFin = sldFin >= 0 ? "D" : "C";
        add(P+"K155"+P+acc.code+P+P+this.fmtDec(sldIni)+P+dcIni+P+this.fmtDec(mv.deb)+P+this.fmtDec(mv.cre)+P+this.fmtDec(sldFin)+P+dcFin+P);
        saldoCorrente.set(aid, sldFin);
      }
    }
    const idxK001 = lines.findIndex(l => l === P+"K001"+P+"0"+P);
    add(P+"K990"+P+(lines.length - idxK001 + 1)+P);

    // ── BLOCO N (apuracao IRPJ/CSLL - Lucro Presumido) ──────────────────────
    // Formula padrao Lucro Presumido - servicos (32% presuncao, ja documentada
    // em LEDGR-ECD-Aprendizado 8.1 e no schema ApuracaoImpostos): base = 32% da
    // receita bruta trimestral; IRPJ 15% + adicional 10% sobre o que exceder
    // R$60.000,00 na base do trimestre; CSLL 9%. Receita bruta calculada direto
    // de journal_entry_items (contas REVENUE), EXCLUINDO lancamentos de
    // encerramento (mesma armadilha ja corrigida no dreMap do ECD - confirmado
    // que sem esse filtro o Q4/2024 da GRB vem negativo).
    add(P+"N001"+P+"0"+P);
    const PERC_PRESUNCAO = 0.32;
    const ALIQ_IRPJ = 0.15;
    const ALIQ_ADIC_IRPJ = 0.10;
    const LIMITE_ADIC_TRIMESTRE = 60000;
    const ALIQ_CSLL = 0.09;
    for (const q of quarters) {
      const receitaBruta = periodItems
        .filter(it => {
          const acc = accounts.find(a => a.id === it.accountId);
          if (!acc || acc.type.toString() !== "REVENUE") return false;
          const desc = (it.journalEntry.description || "").toLowerCase();
          if (desc.includes("encerr") || desc.includes("zeramento")) return false;
          const d = it.journalEntry.date instanceof Date ? it.journalEntry.date : new Date(it.journalEntry.date);
          return d >= q.firstDay && d <= q.lastDay;
        })
        .reduce((s, it) => s + (it.type === "CREDIT" ? Number(it.value) : -Number(it.value)), 0);

      const baseIrpj = receitaBruta * PERC_PRESUNCAO;
      const baseCsll = receitaBruta * PERC_PRESUNCAO;
      const irpjNormal = baseIrpj * ALIQ_IRPJ;
      const adicIrpj = Math.max(0, baseIrpj - LIMITE_ADIC_TRIMESTRE) * ALIQ_ADIC_IRPJ;
      const csll = baseCsll * ALIQ_CSLL;

      add(P+"N030"+P+this.fmtDate(q.firstDay)+P+this.fmtDate(q.lastDay)+P+q.label+P);
      add(P+"N630"+P+this.fmtDec(irpjNormal)+P+this.fmtDec(adicIrpj)+P+"0,00"+P+this.fmtDec(irpjNormal + adicIrpj)+P);
      add(P+"N670"+P+this.fmtDec(csll)+P);
    }
    const idxN001 = lines.findIndex(l => l === P+"N001"+P+"0"+P);
    add(P+"N990"+P+(lines.length - idxN001 + 1)+P);

    // ── BLOCO Y (socios) ─────────────────────────────────────────────────
    // Y600 a partir de CompanyShareholder real (sem fabricar percentual quando
    // participacaoPercent nao esta cadastrado - fica "0,00" e vira advertencia).
    add(P+"Y001"+P+"0"+P);
    const shareholders = await this.prisma.companyShareholder.findMany({
      where: { companyId, shareholderType: "PF" },
      include: { person: { select: { fullName: true, cpf: true } } },
    });
    if (shareholders.length === 0) {
      warnings.push("Nenhum socio (CompanyShareholder) cadastrado - bloco Y600 ficara vazio.");
    }
    for (const sh of shareholders) {
      if (sh.participacaoPercent == null) {
        warnings.push(`Socio ${sh.person?.fullName ?? sh.id} sem participacaoPercent cadastrado - Y600 gerado com 0,00.`);
      }
      const cpf = (sh.person?.cpf || "").replace(/\D/g, "");
      const nome = sh.person?.fullName || "";
      const dtEntrada = sh.dataEntrada ? this.fmtDate(sh.dataEntrada) : "";
      const dtRetirada = sh.dataRetirada ? this.fmtDate(sh.dataRetirada) : "";
      const perc = this.fmtDec(sh.participacaoPercent ? Number(sh.participacaoPercent) : 0);
      add(P+"Y600"+P+dtEntrada+P+dtRetirada+P+"105"+P+"PF"+P+cpf+P+nome+P+"01"+P+perc+P+perc+P+P+P+"0,00"+P+"0,00"+P+"0,00"+P+"0,00"+P+"0,00"+P);
    }
    const idxY001 = lines.findIndex(l => l === P+"Y001"+P+"0"+P);
    add(P+"Y990"+P+(lines.length - idxY001 + 1)+P);

    // ── BLOCO 9 (encerramento) ───────────────────────────────────────────
    add(P+"9001"+P+"0"+P);
    const regCounts = new Map<string, number>();
    for (const l of lines) {
      const r = l.split(P)[1];
      if (r) regCounts.set(r, (regCounts.get(r) ?? 0) + 1);
    }
    for (const [reg, count] of Array.from(regCounts.entries()).sort()) {
      add(P+"9900"+P+reg+P+count+P);
    }
    add(P+"9900"+P+"9001"+P+"1"+P);
    add(P+"9900"+P+"9900"+P+(regCounts.size + 2)+P);
    add(P+"9900"+P+"9990"+P+"1"+P);
    add(P+"9900"+P+"9999"+P+"1"+P);
    add(P+"9990"+P+(lines.length - lines.findIndex(l => l === P+"9001"+P+"0"+P) + 4)+P);
    add(P+"9999"+P+(lines.length + 1)+P);

    // Preencher 0990 com total do bloco 0 (0000 ate a linha anterior ao J001)
    lines[idx0990] = P+"0990"+P+idxJ001+P;

    this.logger.log("ECF: " + lines.length + " linhas | " + accounts.length + " contas | " + quarters.length + " trimestres");
    const content = lines.join("\n") + "\n";
    return { buffer: Buffer.from(content, "latin1"), warnings };
  }

  private quarterRange(start: Date, end: Date) {
    const result: { label: string; firstDay: Date; lastDay: Date }[] = [];
    let q = Math.floor(start.getUTCMonth() / 3);
    const year = start.getUTCFullYear();
    while (true) {
      const firstMonth = q * 3;
      const firstDay = new Date(Date.UTC(year, firstMonth, 1));
      const lastDay = new Date(Date.UTC(year, firstMonth + 3, 0));
      if (firstDay > end) break;
      result.push({ label: "T" + String(q + 1).padStart(2, "0"), firstDay, lastDay });
      q++;
      if (q > 3) break;
    }
    return result;
  }

  private fmtDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
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
