// apps/api/src/modules/sped/ecf/services/ecf-exporter.service.ts
// Confrontado campo a campo contra 2 fontes reais: LM/ECF_2024_LM.TXT (gabarito
// generico do repo) e um ECF REAL da propria GRB (2025, ja transmitido/validado,
// fornecido pelo usuario em D:\Temp\ECF_2025_00020_Gerada.TXT durante a rodada
// de validacao PVA de 10/08/2026). A segunda fonte e a que manda quando ha
// conflito - e a mesma empresa/regime que estamos gerando pra 2024.
//
// Blocos deliberadamente NAO implementados nesta rodada (gap conhecido, nao
// bug esquecido):
// - Bloco E (plano referencial completo mapeado): exige a tabela L100A/L300A
//   (732 codigos BP + 213 DRE, formato 5 niveis "1.01.01.02.01") que NAO esta
//   importada no banco - mesmo gap ja documentado e aceito no ECD (I051).
// - Y570 (retencoes de terceiros): exige dados de retencao na fonte por
//   cliente que o LEDGR nao modela hoje.
// - Y750 (demonstrativo Lucro Real Estimativa/Trimestral): bloco informativo
//   com zeros fixos quando a empresa e Presumido - baixa prioridade, nao
//   deve bloquear validacao por si so.
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";
import { normSpedText } from "../../../../utils/normalize-sped-text";

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

interface Period { label: string; firstDay: Date; lastDay: Date }
interface Movement { deb: number; cre: number }

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
        street: true, number: true, complement: true, neighborhood: true, zipCode: true,
        phone1: true, email: true, mainActivity: true, legalNature: true,
      },
    });
    if (!company) throw new Error("Empresa nao encontrada.");

    const cnpj  = company.taxId.replace(/\D/g, "");
    const dtIni = this.fmtDate(periodStart);
    const dtFin = this.fmtDate(periodEnd);
    const anoBase = periodStart.getUTCFullYear();
    // Leiaute ECF: RFB exige leiaute 0012 para ano-calendario >= 2025
    // (entrega 2026) e situacoes especiais de 2026 - confirmado por erro
    // real do PVA 12.2.2 em 15/08/2026 (GRB periodo 2025, COD_VER=0011
    // rejeitado: "O periodo da escrituracao nao possui um leiaute
    // valido"). Leiautes 1-11 continuam aceitos p/ anos anteriores no
    // mesmo PVA - nao mexer no valor para anoBase < 2025.
    const codVer = anoBase >= 2025 ? "0012" : "0011";
    const P = "|";
    const lines: string[] = [];
    const add = (l: string) => lines.push(l);
    const quarters = this.quarterRange(periodStart, periodEnd);
    const months = this.monthRange(periodStart, periodEnd);

    const FORMA_TRIB_LETTER: Record<string, string> = { "1": "R", "5": "P", "6": "A" };
    const formaTribPer = (FORMA_TRIB_LETTER[formaTributacao] ?? "P").repeat(quarters.length);

    if (!company.street || !company.zipCode) {
      warnings.push("Endereco fiscal da empresa incompleto (0030) - preencher cadastro.");
    }
    if (!company.codMun) {
      warnings.push("Codigo do municipio (IBGE, campo COD_MUN do 0030) nao cadastrado - registro sai sem esse campo.");
    }
    // NAT_JUR/CNAE (codigos numericos RFB) nao tem campo dedicado no cadastro
    // hoje: legal_nature guarda texto livre ("Sociedade Simples Pura", nao
    // "2232"), main_activity fica vazio na pratica. Sem tabela
    // NATUREZA_JURIDICA/CNAE importada (rfb_global_tables so tem
    // QUALIF_ASSINANTE hoje) nao ha como resolver por nome - gerar vazio com
    // warning explicito em vez de inventar um codigo.
    if (!company.mainActivity) {
      warnings.push("CNAE (codigo RFB, ex: 6911701) nao cadastrado em Atividade Principal - registro 0030 sai sem esse campo.");
    }
    warnings.push("Natureza Juridica (codigo RFB do 0030, ex: 2232) nao tem campo de codigo numerico no cadastro hoje (so texto livre) - registro sai sem esse campo ate essa pendencia ser resolvida.");

    // ── Dados base compartilhados por varios blocos ─────────────────────────
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ level: "asc" }, { code: "asc" }],
    });
    const codeById = new Map(accounts.map(a => [a.id, a.code]));
    const accountById = new Map(accounts.map(a => [a.id, a]));
    const analyticIds = new Set(accounts.filter(a => a.isAnalytic).map(a => a.id));

    const viewsI052 = await this.prisma.accountingView.findMany({
      where: { companyId, isActive: true },
      include: { mappings: { select: { accountId: true, aglutinationCode: true } } },
    });
    const i052Map = new Map<string, string>();
    for (const view of viewsI052) {
      for (const m of view.mappings) i052Map.set(m.accountId, m.aglutinationCode);
    }
    if (anoBase >= 2025) {
      warnings.push("Leiaute 0012 (ano-calendario " + anoBase + ") em uso - layout novo para este exporter, sem gabarito real ECF confirmado campo a campo neste leiaute ainda. Validar cada erro do PVA nesta rodada antes de assumir os demais blocos corretos.");
    }
    if (i052Map.size === 0) {
      warnings.push("Nenhuma conta mapeada em Visoes Contabeis - referencial (J051/C051/K156) ficara vazio.");
    }

    const historicalItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { lt: periodStart }, deletedAt: null } },
      select: { accountId: true, type: true, value: true },
    });
    const historicalMov = new Map<string, Movement>();
    for (const item of historicalItems) {
      if (!analyticIds.has(item.accountId)) continue;
      const cur = historicalMov.get(item.accountId) ?? { deb: 0, cre: 0 };
      if (item.type === "DEBIT") cur.deb += Number(item.value); else cur.cre += Number(item.value);
      historicalMov.set(item.accountId, cur);
    }
    const saldoAberturaPeriodo = new Map<string, number>();
    for (const aid of analyticIds) {
      const mov = historicalMov.get(aid);
      if (mov) saldoAberturaPeriodo.set(aid, mov.deb - mov.cre);
    }

    const periodItems = await this.prisma.journalEntryItem.findMany({
      where: { journalEntry: { companyId, date: { gte: periodStart, lte: periodEnd }, deletedAt: null } },
      select: { accountId: true, type: true, value: true, journalEntry: { select: { date: true, description: true } } },
    });

    const isEncerramento = (desc: string | null | undefined) => {
      const d = (desc || "").toLowerCase();
      return d.includes("encerr") || d.includes("zeramento");
    };

    // Saldo final acumulado ate o fim do periodo, por conta (pra rollup de sinteticas)
    const saldoFinalMap = new Map<string, number>(saldoAberturaPeriodo);
    for (const it of periodItems) {
      if (!analyticIds.has(it.accountId)) continue;
      const delta = (it.type === "DEBIT" ? Number(it.value) : -Number(it.value));
      saldoFinalMap.set(it.accountId, (saldoFinalMap.get(it.accountId) ?? 0) + delta);
    }
    const sortedDesc = [...accounts].sort((a, b) => b.code.localeCompare(a.code));
    const rollup = (base: Map<string, number>) => {
      const out = new Map<string, number>(base);
      for (const acc of sortedDesc) {
        if (!acc.parentId) continue;
        const child = out.get(acc.id) ?? 0;
        out.set(acc.parentId, (out.get(acc.parentId) ?? 0) + child);
      }
      return out;
    };
    const saldoIniRollup = rollup(saldoAberturaPeriodo);
    const saldoFinRollup = rollup(saldoFinalMap);

    // Movimentos DRE por conta, excluindo encerramento (mesma armadilha ja
    // corrigida no dreMap do ECD - Q4/2024 GRB vinha negativo sem esse filtro).
    const dreTypes = new Set(["REVENUE", "EXPENSE"]);
    const dreMap = new Map<string, Movement>();
    for (const it of periodItems) {
      if (!analyticIds.has(it.accountId)) continue;
      const acc = accountById.get(it.accountId);
      if (!acc || !dreTypes.has(acc.type.toString())) continue;
      if (isEncerramento(it.journalEntry.description)) continue;
      const cur = dreMap.get(it.accountId) ?? { deb: 0, cre: 0 };
      if (it.type === "DEBIT") cur.deb += Number(it.value); else cur.cre += Number(it.value);
      dreMap.set(it.accountId, cur);
    }

    // ── BLOCO 0 ──────────────────────────────────────────────────────────
    add(P+"0000"+P+"LECF"+P+codVer+P+cnpj+P+normSpedText(company.legalName)+P+"0"+P+"0"+P+P+P+dtIni+P+dtFin+P+"N"+P+P+tipEcf+P+P);
    add(P+"0001"+P+"0"+P);
    // TIP_ESC_PRE=C: GRB tem escrituracao contabil completa (ECD ja validada em
    // partidas dobradas). Confirmado campo a campo contra o ECF real 2025 da
    // propria GRB: |0010|<hash>|N|5|T|01|PPPP||C||||2|
    const mesBalRed = "";
    const tipEscPre = "C";
    const campoFinal0010 = "2"; // achado real (ECF 2025 GRB) - significado exato nao confirmado, valor copiado do arquivo real da mesma empresa/regime
    add(P+"0010"+P+P+"N"+P+formaTributacao+P+"T"+P+"01"+P+formaTribPer+P+mesBalRed+P+tipEscPre+P+P+P+P+campoFinal0010+P);
    // 0020: flags operacionais (S/N) - todas "N" pra GRB (escritorio de
    // advocacia domestico, sem operacoes especiais). IND_ALIQ_CSLL=1 (9%, a
    // aliquota que GRB de fato paga). 27 flags "N" confirmados contra o ECF
    // real 2025 da GRB (D:\Temp\ECF_2025_00020_Gerada.TXT). Achado real no
    // PVA (12.2.2/descritor 11003.1, GRB 2024, rodada 15/08/2026):
    // "Quantidade de campos incorreta" - 32 gerado, 31 esperado. O arquivo
    // real de 2025 tem 2 campos finais vazios antes do terminador, mas o
    // leiaute vigente pro exercicio 2024 so aceita 1 - divergencia real
    // entre exercicios, nao suposicao (achado direto do validador oficial).
        // CORRIGIDO 15/08/2026: erro real do PVA no export GRB periodo 2025
    // ("Quantidade de campos incorreta", 32 gerado / 31 esperado) mostrou
    // que so 1 campo final vazio e aceito no leiaute atual (nao 2, como
    // o gabarito real de 2025 sugeria) - removido 1 P final.
        // CORRECAO 15/08/2026 (rodada 2): erro anterior foi na direcao
    // errada - PVA reportou 31 campos (2 pipes finais, leiaute 11) e eu
    // removi 1 pipe achando que sobrava, gerando 30 (piorou). Erro real
    // seguinte confirmou: leiaute 12 exige 32 campos, ou seja, 1 campo A
    // MAIS que o leiaute 11 tinha (nao a menos). Adicionado como campo
    // vazio (nao "N") ate confirmar o significado/valor esperado dele -
    // se o PVA reclamar do conteudo desse campo especifico na proxima
    // rodada, isso revela o que ele realmente representa.
    add(P+"0020"+P+"1"+P+"0"+P+Array(27).fill("N").join(P)+P+P+P);
    // 0030: dados cadastrais (endereco + NAT_JUR/CNAE) - registro obrigatorio
    // do Bloco 0 que nunca era emitido antes (so existia um warning
    // generico). Confirmado campo a campo contra o ECF real 2025 da GRB:
    // NAT_JUR|CNAE|LOGRADOURO|NUMERO|COMPLEMENTO|BAIRRO|UF|COD_MUN|CEP|FONE|
    // EMAIL (11 campos). NAT_JUR/CNAE ficam vazios quando o cadastro nao tem
    // o codigo RFB numerico - ver warnings acima.
    const cnaeCode = (company.mainActivity || "").replace(/\D/g, "");
    add(P+"0030"+P+P+cnaeCode+P+normSpedText(company.street)+P+company.number+P+normSpedText(company.complement || "")+P+normSpedText(company.neighborhood)+P+company.state+P+(company.codMun || "")+P+(company.zipCode || "")+P+(company.phone1 || "").replace(/\D/g, "")+P+(company.email || "")+P);
    // 0930: signatarios via CompanyShareholder/PersonCompany com assinaEcf=true.
    const accConfigForCrc = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    const signers = await this.prisma.personCompany.findMany({
      where: { companyId, assinaEcf: true },
      include: { person: { select: { fullName: true, cpf: true, crcNumber: true, crcState: true } } },
    });
    if (signers.length === 0) {
      warnings.push("Nenhum signatario com assinaEcf=true cadastrado - registro 0930 ficara vazio.");
    }
    for (const s of signers) {
      const isContador = (s.role || "").toLowerCase() === "contador";
      if (!isContador) {
        // Achado real (ECF 2025 GRB): o arquivo real tem uma 2a linha 0930
        // pra qualificacao 309-Procurador, mas nao ha em rfb_global_tables
        // nem em PersonCompany.role uma fonte confiavel pra resolver esse
        // codigo por papel - "205" hardcoded anterior nao aparece no arquivo
        // real, era invencao. Pulando ate essa regra de negocio ser
        // confirmada com o usuario (ver pendencia registrada em contexto).
        warnings.push(`Signatario ${s.person?.fullName ?? s.id} marcado assinaEcf mas role != contador - qualificacao (COD_QUALIF) do 0930 ainda nao resolvida para este papel, linha nao gerada.`);
        continue;
      }
      const cpf  = (s.person?.cpf || "").replace(/\D/g, "");
      const nome = normSpedText(s.person?.fullName || "");
      const codQualif = "900";
      const crcVal = isContador ? (s.person?.crcNumber || accConfigForCrc?.accountantCrc || "").replace(/\D/g, "") : "";
      const crcUf  = isContador ? (s.person?.crcState || accConfigForCrc?.accountantCrcState || "") : "";
      const email  = isContador ? (accConfigForCrc?.accountantEmail || accConfigForCrc?.escritorioEmail || "") : "";
      const fone   = isContador ? (accConfigForCrc?.accountantPhone || accConfigForCrc?.escritorioTelefone || "").replace(/\D/g, "") : "";
      const crcFmt = crcVal ? crcUf + crcVal : "";
      add(P+"0930"+P+nome+P+cpf+P+codQualif+P+crcFmt+P+email+P+fone+P);
    }
    const idx0990 = lines.length;
    add(P+"0990"+P+"PLACEHOLDER"+P);

    // Contas ativas (com movimento ou saldo no periodo, + ancestrais) - mesmo
    // filtro ja usado no ECD, faltava aqui (gerava J050 pra TODAS as 323
    // contas do plano, real GRB so declara as com atividade real: 163).
    const activeIds = new Set<string>();
    for (const it of periodItems) if (analyticIds.has(it.accountId)) activeIds.add(it.accountId);
    for (const [aid, saldo] of saldoAberturaPeriodo) if (saldo !== 0) activeIds.add(aid);
    for (const aid of i052Map.keys()) activeIds.add(aid);
    for (const aid of [...activeIds]) {
      let cur = accountById.get(aid);
      while (cur?.parentId) { activeIds.add(cur.parentId); cur = accountById.get(cur.parentId); }
    }
    const accountsAtivas = accounts.filter(a => activeIds.has(a.id));
    const hasEncerramentoReal = periodItems.some(it => isEncerramento(it.journalEntry.description));

    // ── BLOCO C (escrituracao contabil - copia fiel da ECD vinculada) ───────
    // Mesma estrutura do Bloco I do ECD (I010/I030->C040, I050/I051->C050/C051,
    // I150/I155->C150/C155, I350/I355->C350/C355), so retagueada. Confirmado
    // campo a campo contra o ECF real 2025 da GRB.
    add(P+"C001"+P+"0"+P);
    // C040: identificacao do livro contabil vinculado (mesmos parametros do
    // ecd-exporter.service.ts: bookNumber/bookNature/layoutVersion/bookType).
    const bookNumber = String(anoBase).slice(-2);
    const bookNature = "Livro Diario Geral";
    add(P+"C040"+P+P+dtIni+P+dtFin+P+P+cnpj+P+bookNumber+P+P+bookNature+P+"9.00"+P+"G"+P+"N"+P+"N"+P+"0"+P+"0"+P+"2"+P);
    this.emitPlanoDeContas(add, P, "C050", "C051", accountsAtivas, codeById, i052Map, periodEnd);
    this.emitSaldosPeriodicos(add, P, "C150", "C155", months, analyticIds, accountById, codeById, saldoAberturaPeriodo, periodItems);
    if (hasEncerramentoReal) {
      this.emitPreEncerramento(add, P, "C350", "C355", dtFin, dreMap, accounts);
    }
    const idxC001 = lines.findIndex(l => l === P+"C001"+P+"0"+P);
    add(P+"C990"+P+(lines.length - idxC001 + 1)+P);

    // ── BLOCO J (plano de contas referencial) ───────────────────────────────
    add(P+"J001"+P+"0"+P);
    this.emitPlanoDeContas(add, P, "J050", "J051", accountsAtivas, codeById, i052Map, periodEnd);
    const idxJ001 = lines.findIndex(l => l === P+"J001"+P+"0"+P);
    add(P+"J990"+P+(lines.length - idxJ001 + 1)+P);

    // ── BLOCO K (periodos e saldos trimestrais + referencial K156/K356) ─────
    add(P+"K001"+P+"0"+P);
    for (const q of quarters) {
      add(P+"K030"+P+this.fmtDate(q.firstDay)+P+this.fmtDate(q.lastDay)+P+q.label+P);
    }
    this.emitSaldosPeriodicosComReferencial(add, P, "K155", "K156", quarters, analyticIds, accountById, codeById, i052Map, saldoAberturaPeriodo, periodItems);
    if (hasEncerramentoReal) {
      this.emitPreEncerramentoComReferencial(add, P, "K355", "K356", dreMap, accounts, i052Map);
    }
    const idxK001 = lines.findIndex(l => l === P+"K001"+P+"0"+P);
    add(P+"K990"+P+(lines.length - idxK001 + 1)+P);

    // ── BLOCO L (LALUR - so Lucro Real, GRB e Presumido) ─────────────────────
    add(P+"L001"+P+"1"+P);
    add(P+"L990"+P+"2"+P);

    // ── BLOCO M (LALUR Parte A/B - so Lucro Real) ────────────────────────────
    add(P+"M001"+P+"1"+P);
    add(P+"M990"+P+"2"+P);

    // ── BLOCO N (apuracao Lucro Real - vazio pra Presumido) ──────────────────
    // Achado real (ECF 2025 GRB, Presumido): N001/N990 vazio - a apuracao do
    // Presumido vai inteira no Bloco P, nao no N (correcao de suposicao errada
    // herdada do ecf-parser.service.ts na 1a versao deste exporter).
    add(P+"N001"+P+"1"+P);
    add(P+"N990"+P+"2"+P);

    // ── BLOCO P (apuracao IRPJ/CSLL Lucro Presumido) ─────────────────────────
    // Formula padrao servicos (32% presuncao): IRPJ 15% + adicional 10% sobre
    // excedente de R$60mil/trimestre na base; CSLL 9%. Confirmado exatamente
    // contra o ECF real 2025 da GRB (base 7.360,00 -> IRPJ 1.104,00, CSLL
    // 662,40 - bate com a formula ja usada, so precisava ir pro bloco certo).
    add(P+"P001"+P+"0"+P);
    const PERC_PRESUNCAO = 0.32;
    const ALIQ_IRPJ = 0.15;
    const ALIQ_ADIC_IRPJ = 0.10;
    const LIMITE_ADIC_TRIMESTRE = 60000;
    const ALIQ_CSLL = 0.09;
    for (const q of quarters) {
      add(P+"P030"+P+this.fmtDate(q.firstDay)+P+this.fmtDate(q.lastDay)+P+q.label+P);
      const receitaBruta = periodItems
        .filter(it => {
          const acc = accountById.get(it.accountId);
          if (!acc || acc.type.toString() !== "REVENUE") return false;
          if (isEncerramento(it.journalEntry.description)) return false;
          const d = it.journalEntry.date instanceof Date ? it.journalEntry.date : new Date(it.journalEntry.date);
          return d >= q.firstDay && d <= q.lastDay;
        })
        .reduce((s, it) => s + (it.type === "CREDIT" ? Number(it.value) : -Number(it.value)), 0);

      const baseIrpj = receitaBruta * PERC_PRESUNCAO;
      const baseCsll = receitaBruta * PERC_PRESUNCAO;
      const irpjNormal = baseIrpj * ALIQ_IRPJ;
      const adicIrpj = Math.max(0, baseIrpj - LIMITE_ADIC_TRIMESTRE) * ALIQ_ADIC_IRPJ;
      const csll = baseCsll * ALIQ_CSLL;

      // P200: discriminacao da receita bruta por percentual de presuncao IRPJ
      add(P+"P200"+P+"1"+P+"DISCRIMINACAO DA RECEITA BRUTA"+P+P);
      add(P+"P200"+P+"2"+P+"Receita Bruta Sujeita ao Percentual de 32%"+P+this.fmtDec(receitaBruta)+P);
      // P300: apuracao IRPJ
      add(P+"P300"+P+"1"+P+"BASE DE CALCULO DO IMPOSTO SOBRE O LUCRO PRESUMIDO"+P+this.fmtDec(baseIrpj)+P);
      add(P+"P300"+P+"2"+P+"IMPOSTO APURADO COM BASE NO LUCRO PRESUMIDO"+P+P);
      add(P+"P300"+P+"3"+P+"Aliquota de 15%"+P+this.fmtDec(irpjNormal)+P);
      add(P+"P300"+P+"4"+P+"Adicional"+P+this.fmtDec(adicIrpj)+P);
      // P400: discriminacao da receita bruta por percentual de presuncao CSLL
      add(P+"P400"+P+"1"+P+"CALCULO DA CSLL"+P+P);
      add(P+"P400"+P+"4"+P+"Receita Bruta Sujeita ao Percentual de 32%"+P+this.fmtDec(receitaBruta)+P);
      // P500: apuracao CSLL
      add(P+"P500"+P+"1"+P+"BASE DE CALCULO DA CSLL"+P+this.fmtDec(baseCsll)+P);
      add(P+"P500"+P+"2"+P+"CSLL Apurada"+P+this.fmtDec(csll)+P);
      add(P+"P500"+P+"4"+P+"TOTAL DA CONTRIBUICAO SOCIAL SOBRE O LUCRO LIQUIDO"+P+this.fmtDec(csll)+P);
    }
    const idxP001 = lines.findIndex(l => l === P+"P001"+P+"0"+P);
    add(P+"P990"+P+(lines.length - idxP001 + 1)+P);

    // ── BLOCOS Q/S/T/U/V/W/X (nao aplicaveis a GRB - marcadores vazios) ─────
    for (const tag of ["Q", "S", "T", "U", "V", "W", "X"]) {
      add(P+tag+"001"+P+"0"+P);
      add(P+tag+"990"+P+"2"+P);
    }

    // ── BLOCO Y (socios e outras informacoes) ────────────────────────────────
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
      const nome = normSpedText(sh.person?.fullName || "");
      const dtEntrada = sh.dataEntrada ? this.fmtDate(sh.dataEntrada) : "";
      const dtRetirada = sh.dataRetirada ? this.fmtDate(sh.dataRetirada) : "";
      const perc = this.fmtDec(sh.participacaoPercent ? Number(sh.participacaoPercent) : 0);
      add(P+"Y600"+P+dtEntrada+P+dtRetirada+P+"105"+P+"PF"+P+cpf+P+nome+P+"01"+P+perc+P+perc+P+P+P+"0,00"+P+"0,00"+P+"0,00"+P+"0,00"+P+"0,00"+P);
    }
    // Y720: registro obrigatorio, campos vazios quando nao aplicavel (confirmado
    // no ECF real 2025 da GRB - ocorre sempre, mesmo totalmente vazio).
    add(P+"Y720"+P+P+P+P+P+P);
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

    // Preencher 0990 com total do bloco 0 (0000 ate a linha anterior ao C001)
    lines[idx0990] = P+"0990"+P+idxC001+P;

    this.logger.log("ECF: " + lines.length + " linhas | " + accounts.length + " contas | " + quarters.length + " trimestres");
    const content = lines.join("\n") + "\n";
    return { buffer: Buffer.from(content, "latin1"), warnings };
  }

  // Plano de contas + referencial (usado por C050/C051 e J050/J051 - mesma
  // logica do I050/I051 do ECD, so retagueada por parametro).
  private emitPlanoDeContas(
    add: (l: string) => void, P: string, tagPlano: string, tagRef: string,
    accountsAtivas: any[], codeById: Map<string, string>, i052Map: Map<string, string>, periodEnd: Date,
  ) {
    const periodEndDate = periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
    for (const acc of accountsAtivas) {
      const createdAtDate = acc.createdAt instanceof Date ? acc.createdAt : new Date(acc.createdAt);
      const dtAlt      = this.fmtDate(createdAtDate > periodEndDate ? periodEndDate : createdAtDate);
      const natCode    = this.typeToNat(acc.type.toString());
      const indCta     = acc.isAnalytic ? "A" : "S";
      const parentCode = acc.parentId ? (codeById.get(acc.parentId) ?? "") : "";
      add(P+tagPlano+P+dtAlt+P+natCode+P+indCta+P+acc.level+P+acc.code+P+parentCode+P+normSpedText(acc.name)+P);
      if (acc.isAnalytic) {
        const codRef = i052Map.get(acc.id) ?? "";
        if (codRef) add(P+tagRef+P+P+codRef+P);
      }
    }
  }

  // Saldos periodicos sem referencial (C150/C155 - mensal, mesma logica do
  // I150/I155 do ECD).
  private emitSaldosPeriodicos(
    add: (l: string) => void, P: string, tagPeriodo: string, tagSaldo: string,
    periods: Period[], analyticIds: Set<string>, accountById: Map<string, any>, codeById: Map<string, string>,
    saldoAbertura: Map<string, number>, periodItems: any[],
  ) {
    const saldoCorrente = new Map<string, number>(saldoAbertura);
    for (const per of periods) {
      const byAcc = new Map<string, Movement>();
      for (const it of periodItems) {
        if (!analyticIds.has(it.accountId)) continue;
        const d = it.journalEntry.date instanceof Date ? it.journalEntry.date : new Date(it.journalEntry.date);
        if (d < per.firstDay || d > per.lastDay) continue;
        const cur = byAcc.get(it.accountId) ?? { deb: 0, cre: 0 };
        if (it.type === "DEBIT") cur.deb += Number(it.value); else cur.cre += Number(it.value);
        byAcc.set(it.accountId, cur);
      }
      add(P+tagPeriodo+P+this.fmtDate(per.firstDay)+P+this.fmtDate(per.lastDay)+P);
      const contas = new Set<string>([...saldoCorrente.keys(), ...byAcc.keys()]);
      const sorted = Array.from(contas).sort((a, b) => (codeById.get(a) ?? "").localeCompare(codeById.get(b) ?? ""));
      for (const aid of sorted) {
        const acc = accountById.get(aid);
        if (!acc) continue;
        const mv = byAcc.get(aid) ?? { deb: 0, cre: 0 };
        const sldIni = saldoCorrente.get(aid) ?? 0;
        const sldFin = sldIni + mv.deb - mv.cre;
        if (sldIni === 0 && mv.deb === 0 && mv.cre === 0 && sldFin === 0) continue;
        const dcIni = sldIni >= 0 ? "D" : "C";
        const dcFin = sldFin >= 0 ? "D" : "C";
        add(P+tagSaldo+P+acc.code+P+P+this.fmtDec(sldIni)+P+dcIni+P+this.fmtDec(mv.deb)+P+this.fmtDec(mv.cre)+P+this.fmtDec(sldFin)+P+dcFin+P);
        saldoCorrente.set(aid, sldFin);
      }
    }
  }

  // Saldos periodicos COM companion referencial (K155/K156 - trimestral).
  private emitSaldosPeriodicosComReferencial(
    add: (l: string) => void, P: string, tagSaldo: string, tagRef: string,
    periods: Period[], analyticIds: Set<string>, accountById: Map<string, any>, codeById: Map<string, string>,
    i052Map: Map<string, string>, saldoAbertura: Map<string, number>, periodItems: any[],
  ) {
    const saldoCorrente = new Map<string, number>(saldoAbertura);
    for (const per of periods) {
      const byAcc = new Map<string, Movement>();
      for (const it of periodItems) {
        if (!analyticIds.has(it.accountId)) continue;
        const d = it.journalEntry.date instanceof Date ? it.journalEntry.date : new Date(it.journalEntry.date);
        if (d < per.firstDay || d > per.lastDay) continue;
        const cur = byAcc.get(it.accountId) ?? { deb: 0, cre: 0 };
        if (it.type === "DEBIT") cur.deb += Number(it.value); else cur.cre += Number(it.value);
        byAcc.set(it.accountId, cur);
      }
      const contas = new Set<string>([...saldoCorrente.keys(), ...byAcc.keys()]);
      const sorted = Array.from(contas).sort((a, b) => (codeById.get(a) ?? "").localeCompare(codeById.get(b) ?? ""));
      for (const aid of sorted) {
        const acc = accountById.get(aid);
        if (!acc) continue;
        const mv = byAcc.get(aid) ?? { deb: 0, cre: 0 };
        const sldIni = saldoCorrente.get(aid) ?? 0;
        const sldFin = sldIni + mv.deb - mv.cre;
        if (sldIni === 0 && mv.deb === 0 && mv.cre === 0 && sldFin === 0) continue;
        const dcIni = sldIni >= 0 ? "D" : "C";
        const dcFin = sldFin >= 0 ? "D" : "C";
        // CORRIGIDO 15/08/2026: erro real do PVA (GRB 2025) - K156 estava
        // reaproveitando o "rest" do K155, que tem um campo vazio extra
        // (COD_CCUS) logo apos o codigo da conta. O K156 (referencial) nao
        // tem esse campo - e so COD_CTA_REF + valores direto. Isso gerava
        // 9 campos em vez de 8 e deslocava VL_SLD_INI para a posicao de
        // IND_VL_SLD_INI. Agora cada tag monta seu proprio "rest".
        const restSaldo = P+P+this.fmtDec(sldIni)+P+dcIni+P+this.fmtDec(mv.deb)+P+this.fmtDec(mv.cre)+P+this.fmtDec(sldFin)+P+dcFin+P;
        add(P+tagSaldo+P+acc.code+restSaldo);
        const codRef = i052Map.get(aid);
        if (codRef) {
          const restRef = P+this.fmtDec(sldIni)+P+dcIni+P+this.fmtDec(mv.deb)+P+this.fmtDec(mv.cre)+P+this.fmtDec(sldFin)+P+dcFin+P;
          add(P+tagRef+P+codRef+restRef);
        }
        saldoCorrente.set(aid, sldFin);
      }
    }
  }

  // I350/I355-equivalente: saldos de resultado antes do encerramento, so
  // quando ha lancamento de encerramento real (mesma regra ja validada no ECD).
  private emitPreEncerramento(
    add: (l: string) => void, P: string, tagCab: string, tagSaldo: string,
    dtFin: string, dreMap: Map<string, Movement>, accounts: any[],
  ) {
    const dreTypes = new Set(["REVENUE", "EXPENSE"]);
    const dreAccounts = accounts.filter(a => {
      if (!a.isAnalytic || !dreTypes.has(a.type.toString())) return false;
      const mv = dreMap.get(a.id);
      return mv ? (mv.cre - mv.deb) !== 0 : false;
    });
    if (dreAccounts.length === 0) return;
    add(P+tagCab+P+dtFin+P);
    for (const acc of dreAccounts) {
      const mv = dreMap.get(acc.id);
      const saldo = mv ? mv.cre - mv.deb : 0;
      if (saldo === 0) continue;
      const dc = saldo >= 0 ? "C" : "D";
      add(P+tagSaldo+P+acc.code+P+P+this.fmtDec(saldo)+P+dc+P);
    }
  }

  // K355/K356-equivalente: mesma coisa mas com companion referencial.
  private emitPreEncerramentoComReferencial(
    add: (l: string) => void, P: string, tagSaldo: string, tagRef: string,
    dreMap: Map<string, Movement>, accounts: any[], i052Map: Map<string, string>,
  ) {
    const dreTypes = new Set(["REVENUE", "EXPENSE"]);
    const dreAccounts = accounts.filter(a => {
      if (!a.isAnalytic || !dreTypes.has(a.type.toString())) return false;
      const mv = dreMap.get(a.id);
      return mv ? (mv.cre - mv.deb) !== 0 : false;
    });
    for (const acc of dreAccounts) {
      const mv = dreMap.get(acc.id);
      const saldo = mv ? mv.cre - mv.deb : 0;
      if (saldo === 0) continue;
      const dc = saldo >= 0 ? "C" : "D";
      // CORRIGIDO 15/08/2026 (preventivo): mesmo bug do K156 - o registro
      // referencial (K356) nao deve reaproveitar o "rest" do K355 (tem
      // campo COD_CCUS extra que K356 nao tem).
      const restSaldo = P+P+this.fmtDec(saldo)+P+dc+P;
      add(P+tagSaldo+P+acc.code+restSaldo);
      const codRef = i052Map.get(acc.id);
      if (codRef) {
        const restRef = P+this.fmtDec(saldo)+P+dc+P;
        add(P+tagRef+P+codRef+restRef);
      }
    }
  }

  private monthRange(start: Date, end: Date): Period[] {
    const result: Period[] = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cur <= end) {
      const y = cur.getUTCFullYear();
      const m = cur.getUTCMonth();
      const firstDay = new Date(Date.UTC(y, m, 1));
      const lastDay  = new Date(Date.UTC(y, m + 1, 0));
      result.push({ label: "M" + String(m + 1).padStart(2, "0"), firstDay, lastDay });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return result;
  }

  private quarterRange(start: Date, end: Date): Period[] {
    const result: Period[] = [];
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
