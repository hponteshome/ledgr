import { NotFoundException, BadRequestException } from '@nestjs/common'; // Seguranca 0A (04/10/2026): erros de negocio com o codigo HTTP certo
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

// ── Tabela central de leiaute ECF por ano-calendario ─────────────────────
// A RFB nao publica tabela local para os leiautes atuais (10/11/12) - o
// motor dinamico baseado em tabela (recursos/tabelas/SPEDECF_DINAMICO_*)
// so cobre 2014-2021, confirmado por inspecao da pasta local do PVA em
// 16/08/2026. Por isso, cada linha abaixo foi confirmada contra um erro
// REAL do PVA (nao suposicao/documentacao) - metodologia ja validada no
// ECD. Ao aparecer o leiaute 13 (esperado ano-calendario 2026), adicionar
// uma entrada nova aqui, testando campo a campo do mesmo jeito.
interface EcfLayoutConfig {
  codVer: string;
  campo0020ExtrasCount: number; // quantos pipes extras alem dos 27 flags "N"
}
const ECF_LAYOUT_BY_YEAR: Record<number, EcfLayoutConfig> = {
  // IMPL-ECF-01 (12/11/2026): leiaute 0009 - ano-calendario 2022 e 0010 - ano-calendario 2023.
  // campo0020ExtrasCount a confirmar pelo PVA (mesma metodologia das linhas abaixo).
  // 0009: 0020 com 30 campos (27 flags + 1 campo final) - confirmado pelo PVA em 12/11/2026 (LM 2022: "30 esperado, 31 encontrado")
  2022: { codVer: "0009", campo0020ExtrasCount: 1 },
  // 0010: 0020 por analogia com o 0009 - a confirmar no PVA
  2023: { codVer: "0010", campo0020ExtrasCount: 1 },
  // leiaute 0011 - ano-calendario 2024 (entrega 2025)
  2024: { codVer: "0011", campo0020ExtrasCount: 2 },
  // leiaute 0012 - ano-calendario >= 2025 (entrega 2026) - confirmado
  // contra PVA 12.2.2 real em 15-16/08/2026 (GRB 2025)
  2025: { codVer: "0012", campo0020ExtrasCount: 3 },
};
export function getEcfLayout(anoBase: number): EcfLayoutConfig {
  // Anos nao mapeados usam a config do leiaute conhecido mais recente -
  // arriscado (ver pendencia), mas melhor que travar a geracao. Loga um
  // aviso explicito na lista de warnings via warnings.push no export().
  const known = Object.keys(ECF_LAYOUT_BY_YEAR).map(Number).sort((a, b) => b - a);
  const match = known.find((y) => anoBase >= y) ?? known[known.length - 1];
  return ECF_LAYOUT_BY_YEAR[match];
}

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
  // IMPL-ECF-01: escrituracao do Presumido (0010.TIP_ESC_PRE): C = contabil (ECD vinculada), L = livro caixa (sem ECD).
  // Padrao: company_tax_regimes.tip_esc_pre do periodo; sem cadastro = C.
  tipEscPre?: "C" | "L";
  // IMPL-ECF-01: origem da receita do Bloco P: RAZAO (lancamentos) ou ESTUDO (estudo CONCLUIDO do Comparativo de Regimes do ano).
  // Padrao: ESTUDO quando houver estudo concluido do ano, senao RAZAO.
  fonteReceita?: "RAZAO" | "ESTUDO";
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
      tipEcf = "0",
    } = options;
    const warnings: string[] = [];
    // IMPL-ECF-01: regime do periodo (company_tax_regimes) e a fonte padrao de FORMA_TRIB, FORMA_APUR,
    // TIP_ESC_PRE e IND_REC_RECEITA - vale para qualquer empresa/ano; parametros explicitos prevalecem.
    const regRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT forma_tributacao, periodo_apuracao_irpj, tip_esc_pre, criterio_receita FROM company_tax_regimes
        WHERE company_id = $1::uuid AND dt_ini <= $3::date AND (dt_fin IS NULL OR dt_fin >= $2::date)
        ORDER BY dt_ini DESC LIMIT 1`,
      companyId, periodStart.toISOString().slice(0, 10), periodEnd.toISOString().slice(0, 10));
    const regime = regRows[0] ?? null;
    const formaTributacao: string = options.formaTributacao ?? regime?.forma_tributacao ?? "5";
    if (!options.formaTributacao && !regime) warnings.push("Regime do periodo nao cadastrado (company_tax_regimes) - usando FORMA_TRIB 5 (Presumido).");
    const formaApur = (["1", "2"].includes(formaTributacao) && regime?.periodo_apuracao_irpj === "A") ? "A" : "T";
    const tipEscPre: "C" | "L" = options.tipEscPre ?? (regime?.tip_esc_pre === "L" ? "L" : "C");
    const indRecReceita = regime?.criterio_receita === "CAIXA" ? "1" : "2";

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        taxId: true, legalName: true, state: true, city: true, nire: true, codMun: true,
        street: true, number: true, complement: true, neighborhood: true, zipCode: true,
        phone1: true, email: true, mainActivity: true, legalNature: true,
      },
    });
    if (!company) throw new NotFoundException("Empresa nao encontrada.");

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
    const ecfLayout = getEcfLayout(anoBase);
    const codVer = ecfLayout.codVer;
    if (!(anoBase in ECF_LAYOUT_BY_YEAR)) {
      warnings.push("Ano-calendario " + anoBase + " nao tem leiaute ECF confirmado no exporter - usando config do leiaute " + codVer + " como aproximacao. Validar campo a campo no PVA antes de considerar correto.");
    }
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
      select: { accountId: true, type: true, value: true, journalEntry: { select: { date: true, description: true, isClosingEntry: true } } },
    });

    // CORRIGIDO 23/08/2026: helper isEncerramento(desc) removido - substituido
    // por leitura direta de journalEntry.isClosingEntry (campo estruturado)
    // nos 3 pontos que o usavam.
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
      if (it.journalEntry.isClosingEntry) continue;
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
    // IMPL-ECF-01: ultimo campo do 0010 = IND_REC_RECEITA (criterio de reconhecimento de receitas do Presumido):
    // 1 = caixa, 2 = competencia (GRB = 2, o valor antes fixo). Vem de company_tax_regimes.criterio_receita.
    const campoFinal0010 = indRecReceita;
    add(P+"0010"+P+P+"N"+P+formaTributacao+P+formaApur+P+"01"+P+formaTribPer+P+mesBalRed+P+tipEscPre+P+P+P+P+campoFinal0010+P);
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
    // CORRIGIDO 16/08/2026: o campo extra do 0020 (32 vs 31) e exclusivo
    // do leiaute 0012 (ano-calendario >= 2025) - erro real do PVA na GRB
    // 2024 confirmou que o leiaute 0011 continua exigindo 31 campos.
    // Nao fixar o numero de pipes finais - condicionar sempre por anoBase,
    // mesmo criterio ja usado em codVer.
    add(P+"0020"+P+"1"+P+"0"+P+Array(27).fill("N").join(P)+P.repeat(ecfLayout.campo0020ExtrasCount));
    // 0030: dados cadastrais (endereco + NAT_JUR/CNAE) - registro obrigatorio
    // do Bloco 0 que nunca era emitido antes (so existia um warning
    // generico). Confirmado campo a campo contra o ECF real 2025 da GRB:
    // NAT_JUR|CNAE|LOGRADOURO|NUMERO|COMPLEMENTO|BAIRRO|UF|COD_MUN|CEP|FONE|
    // EMAIL (11 campos). NAT_JUR/CNAE ficam vazios quando o cadastro nao tem
    // o codigo RFB numerico - ver warnings acima.
    // IMPL-ECF-04: 0030 - natureza juridica (codigo RFB a partir do texto do cadastro) e e-mail com fallback.
    const natJurCode = this.natJurCode(company.legalNature);
    // IMPL-ECF-05: a ECF usa somente o cadastro LEDGR. Pendencias/inconsistencias bloqueiam a geracao (lista completa).
    const pendCad: string[] = [];
    if (!natJurCode) pendCad.push("Cadastro da empresa > Natureza Juridica: '" + (company.legalNature || "") + "' nao corresponde a um codigo da tabela RFB (ex.: Sociedade Empresaria Limitada, Sociedade Simples Limitada).");
    const email0030 = (company.email || "").trim();
    if (!email0030) pendCad.push("Cadastro da empresa > E-mail: obrigatorio (registro 0030).");
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email0030)) pendCad.push("Cadastro da empresa > E-mail invalido: " + email0030);
    // IMPL-RFB-01: CNAE = codigo no inicio do campo ("6462000 - Holdings..." ou "64.62-0-00 - ...")
    const cnaeCode = ((company.mainActivity || "").match(/^\s*([\d.\-\/]+)/)?.[1] || "").replace(/\D/g, "");
    if (cnaeCode.length !== 7) pendCad.push("Cadastro da empresa > Atividade Principal (CNAE): " + (company.mainActivity ? "'" + company.mainActivity + "' nao e um CNAE de 7 digitos" : "nao preenchida") + ".");
    if (!company.codMun) pendCad.push("Cadastro da empresa > Codigo do municipio (IBGE): nao preenchido.");
    if (!company.street || !company.number || !company.neighborhood || !company.zipCode) pendCad.push("Cadastro da empresa > Endereco incompleto (logradouro, numero, bairro e CEP).");
    add(P+"0030"+P+natJurCode+P+cnaeCode+P+normSpedText(company.street)+P+company.number+P+normSpedText(company.complement || "")+P+normSpedText(company.neighborhood)+P+company.state+P+(company.codMun || "")+P+(company.zipCode || "")+P+(company.phone1 || "").replace(/\D/g, "")+P+email0030+P);
    // 0930: signatarios via CompanyShareholder/PersonCompany com assinaEcf=true.
    const accConfigForCrc = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    const signers = await this.prisma.personCompany.findMany({
      where: { companyId, assinaEcf: true },
      include: { person: { select: { fullName: true, cpf: true, crcNumber: true, crcState: true, email: true, phone1: true } } },
    });
    // IMPL-ECF-04: 0930 generico - signatarios sem repetir CPF, vindos de: vinculos de pessoas com "assina ECF",
    // socios PF com "assina ECF", responsavel legal e contador da configuracao contabil. COD_QUALIF pela tabela de
    // qualificacao do assinante (900 contador, 205 administrador, 203 diretor, 309 procurador...). A ECF exige
    // contador + representante legal (exceto imunes/isentas sem ECD).
    const sig0930: { nome: string; cpf: string; qualif: string; crc: string; email: string; fone: string }[] = [];
    const addSig = (o: { nome?: string | null; cpf?: string | null; qualif: string | null; origem: string; email?: string | null; fone?: string | null; crcNum?: string | null; crcUf?: string | null }) => {
      const cpfS = (o.cpf || "").replace(/\D/g, "");
      if (!cpfS || sig0930.some(x => x.cpf === cpfS)) return;
      if (!o.qualif) {
        warnings.push("0930: " + (o.nome || cpfS) + " (" + o.origem + ") marcado para assinar a ECF, mas o papel nao corresponde a uma qualificacao de assinante (administrador, diretor, procurador, contador...) - linha nao gerada.");
        return;
      }
      const isCont = o.qualif === "900";
      const crcNum = isCont ? (o.crcNum || accConfigForCrc?.accountantCrc || "").replace(/\D/g, "") : "";
      const crcUf = isCont ? (o.crcUf || accConfigForCrc?.accountantCrcState || "") : "";
      if (isCont) {
        const pN = (o.crcNum || "").replace(/\D/g, "").replace(/^0+/, ""), cN = (accConfigForCrc?.accountantCrc || "").replace(/\D/g, "").replace(/^0+/, "");
        const pU = (o.crcUf || "").trim().toUpperCase(), cU = (accConfigForCrc?.accountantCrcState || "").trim().toUpperCase();
        if (pN && cN && pN !== cN) pendCad.push("CRC do contador " + (o.nome || cpfS) + " divergente: cadastro da pessoa " + pN + " x configuracao contabil " + cN + ".");
        if (pU && cU && pU !== cU) pendCad.push("UF do CRC do contador " + (o.nome || cpfS) + " divergente: cadastro da pessoa " + pU + " x configuracao contabil " + cU + ".");
        if (!crcNum || !crcUf) pendCad.push("CRC do contador " + (o.nome || cpfS) + " incompleto (numero e UF) - cadastro da pessoa ou configuracao contabil.");
      }
      const email = ((isCont ? (accConfigForCrc?.accountantEmail || accConfigForCrc?.escritorioEmail || o.email) : (o.email || company.email)) || "").trim();
      const fone = ((isCont ? (accConfigForCrc?.accountantPhone || accConfigForCrc?.escritorioTelefone || o.fone) : (o.fone || company.phone1)) || "").replace(/\D/g, "");
      if (!email) pendCad.push("Signatario " + (o.nome || cpfS) + " > E-mail: obrigatorio no 0930 (" + (isCont ? "configuracao contabil ou cadastro da pessoa" : "cadastro da pessoa ou da empresa") + ").");
      sig0930.push({ nome: normSpedText(o.nome || ""), cpf: cpfS, qualif: o.qualif, crc: crcNum ? crcUf + crcNum : "", email, fone });
    };
    for (const s of signers) {
      addSig({ nome: s.person?.fullName, cpf: s.person?.cpf, qualif: this.qualifAssinante(s.role, (s as any).qualificacaoCvm), origem: "vinculo " + s.role,
        email: s.person?.email, fone: s.person?.phone1, crcNum: s.person?.crcNumber, crcUf: s.person?.crcState });
    }
    const shSigners = await this.prisma.companyShareholder.findMany({
      where: { companyId, assinaEcf: true, personId: { not: null } },
      include: { person: { select: { fullName: true, cpf: true, email: true, phone1: true } } },
    });
    for (const s of shSigners) {
      addSig({ nome: s.person?.fullName, cpf: s.person?.cpf, qualif: this.qualifAssinante(s.qualificacao, null), origem: "socio", email: s.person?.email, fone: s.person?.phone1 });
    }
    if (accConfigForCrc?.legalRepCpf) {
      addSig({ nome: accConfigForCrc.legalRepName, cpf: accConfigForCrc.legalRepCpf, qualif: this.qualifAssinante(accConfigForCrc.legalRepRole, null) ?? "205", origem: "responsavel legal da configuracao contabil" });
    }
    if (accConfigForCrc?.accountantCpf) {
      addSig({ nome: accConfigForCrc.accountantName, cpf: accConfigForCrc.accountantCpf, qualif: "900", origem: "contador da configuracao contabil" });
    }
    const exigeContador = !["8", "9"].includes(formaTributacao); // imunes/isentas sem ECD: so representante legal
    const contadores = sig0930.filter(x => x.qualif === "900");
    if (exigeContador && contadores.length === 0) pendCad.push("Signatarios ECF: nenhum contador - marque 'assina ECF' no vinculo do contador ou preencha o contador na configuracao contabil.");
    if (contadores.length > 1) pendCad.push("Signatarios ECF: mais de um contador (" + contadores.map(x => x.nome).join(", ") + ") - o contador da configuracao contabil deve ser o mesmo marcado 'assina ECF'.");
    if (!sig0930.some(x => x.qualif !== "900")) pendCad.push("Signatarios ECF: nenhum representante legal - marque 'assina ECF' no socio-administrador ou preencha o responsavel legal na configuracao contabil.");
    if (pendCad.length) {
      throw new BadRequestException("ECF nao gerada - corrija o cadastro no LEDGR:\n- " + pendCad.join("\n- "));
    }
    for (const g of sig0930) add(P+"0930"+P+g.nome+P+g.cpf+P+g.qualif+P+g.crc+P+g.email+P+g.fone+P);
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
    const hasEncerramentoReal = periodItems.some(it => it.journalEntry.isClosingEntry);

    // IMPL-ECF-01: TIP_ESC_PRE=C -> blocos C/J/K completos (escrituracao contabil vinculada, validado GRB 2025).
    // TIP_ESC_PRE=L -> livro caixa, sem ECD: blocos C/J/K vazios (indicador 1).
    const idxC001 = lines.length;
    if (tipEscPre === "L") {
      for (const tag of ["C", "J", "K"]) { add(P+tag+"001"+P+"1"+P); add(P+tag+"990"+P+"2"+P); }
    } else {
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
    }

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
    // IMPL-ECF-04: codigos/descricoes oficiais das tabelas dinamicas do PVA (linha vigente no periodo).
    const tabP = this.loadEcfDynamicTables(["P200", "P300", "P400", "P500"], periodStart, periodEnd, warnings);
    const dP = (reg: string, cod: string, fb: string) => tabP[reg]?.get(cod) ?? fb;
    // IMPL-ECF-01: receita do Bloco P - ESTUDO (estudo CONCLUIDO do Comparativo de Regimes do ano: receita
    // tributavel apos exclusoes, outras receitas e % de presuncao) ou RAZAO (lancamentos, comportamento anterior).
    const estRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT resultado, premissas FROM tax_regime_studies WHERE company_id = $1::uuid AND ano = $2::int
        AND status = 'CONCLUIDO' AND deleted_at IS NULL ORDER BY versao DESC LIMIT 1`, companyId, anoBase);
    const estudo: any = estRows[0]?.resultado ?? null;
    // IMPL-ECF-02: condicoes da dispensa da ECD no Presumido - aviso destacado (topo da lista) e bloqueio na contradicao
    const distribAcima = !!estRows[0]?.premissas?.distribuicaoAcimaBase;
    if (tipEscPre === "L") {
      if (distribAcima) throw new BadRequestException("ECD OBRIGATORIA - o estudo concluido do ano marca distribuicao de lucros acima da base presumida (IN RFB 2.003/2021, art. 3, par. 1): TIP_ESC_PRE = L nao se aplica. Transmita a ECD e use TIP_ESC_PRE = C no regime do periodo.");
      warnings.unshift("ATENCAO - TIP_ESC_PRE = L (Livro Caixa, sem ECD). A dispensa da ECD do Presumido (IN RFB 2.003/2021, art. 3, II) so vale se: (1) o Livro Caixa ou a escrituracao contabil registrar TODA a movimentacao financeira, inclusive bancaria (Lei 8.981/1995, art. 45, par. unico) - mantenha o Diario/Livro Caixa do periodo arquivado e disponivel; (2) nao houver distribuicao de lucros, sem IRRF, acima da base presumida menos os tributos (IN RFB 2.003/2021, art. 3, par. 1) - se houver, a ECD e obrigatoria e o TIP_ESC_PRE deve ser C.");
    } else if (["3", "4", "5", "7"].includes(formaTributacao)) {
      warnings.unshift("ATENCAO - TIP_ESC_PRE = C (escrituracao contabil) no Presumido: a ECD do periodo deve estar transmitida (obrigatoria ou facultativa) - o PVA recupera a ECD. Se a ECD nao for entregue, cadastre TIP_ESC_PRE = L no regime do periodo e mantenha o Livro Caixa.");
    }
    const fonteReceita = options.fonteReceita ?? (estudo ? "ESTUDO" : "RAZAO");
    if (fonteReceita === "ESTUDO" && !estudo) throw new NotFoundException("Fonte de receita ESTUDO: nao ha estudo CONCLUIDO do Comparativo de Regimes para " + anoBase + ".");
    warnings.push("Bloco P: receita lida do " + (fonteReceita === "ESTUDO" ? "estudo concluido do Comparativo de Regimes (receita tributavel apos exclusoes)" : "razao (lancamentos de receita)") + ".");
    const PERC_PRESUNCAO = fonteReceita === "ESTUDO" && estudo?.presuncao != null ? Number(estudo.presuncao) / 100 : 0.32;
    if (Math.abs(PERC_PRESUNCAO - 0.32) > 0.0001) warnings.push("Presuncao de " + (PERC_PRESUNCAO * 100) + "%: P200/P400 deste exporter so tem a linha de 32% - conferir as linhas no PVA.");
    const ALIQ_IRPJ = 0.15;
    const ALIQ_ADIC_IRPJ = 0.10;
    const LIMITE_ADIC_TRIMESTRE = 60000;
    const ALIQ_CSLL = 0.09;
    // IMPL-ECF-04: linha do P200/P400 conforme o % de presuncao (P200: 2=1,6% 4=8% 6=16% 8=32% 9=38,4%;
    // P400: 2=12% 4=32% 5=38,4%). Antes a receita saia sempre no codigo 2 do P200 (que e 1,6%).
    const ppIrpj = Math.round(PERC_PRESUNCAO * 1000) / 10;
    const COD_P200: Record<string, string> = { "1.6": "2", "8": "4", "16": "6", "32": "8", "38.4": "9" };
    const codP200 = COD_P200[String(ppIrpj)] ?? "8";
    if (!COD_P200[String(ppIrpj)]) warnings.push("P200: presuncao de " + ppIrpj + "% sem linha na tabela - usada a de 32%. Conferir no PVA.");
    const ppCsll = ppIrpj === 32 ? 32 : ppIrpj === 38.4 ? 38.4 : 12;
    const codP400 = ppCsll === 32 ? "4" : ppCsll === 38.4 ? "5" : "2";
    const pctTxt = (n: number) => String(n).replace(".", ",");
    // IMPL-ECF-07: receitas do periodo para o Y672 (mesma base do bloco P)
    var totRecY672 = 0;
    for (const q of quarters) {
      add(P+"P030"+P+this.fmtDate(q.firstDay)+P+this.fmtDate(q.lastDay)+P+q.label+P);
      let receitaBruta = 0, outrasReceitas = 0;
      if (fonteReceita === "ESTUDO") {
        const m0 = q.firstDay.getUTCMonth(), m1 = q.lastDay.getUTCMonth();
        for (const m of (estudo?.receita?.meses ?? [])) {
          const i = Number(m.mes) - 1;
          if (i >= m0 && i <= m1) { receitaBruta += Number(m.tributavel) || 0; outrasReceitas += Number(m.outras) || 0; }
        }
      } else receitaBruta = periodItems
        .filter(it => {
          const acc = accountById.get(it.accountId);
          if (!acc || acc.type.toString() !== "REVENUE") return false;
          if (it.journalEntry.isClosingEntry) return false;
          const d = it.journalEntry.date instanceof Date ? it.journalEntry.date : new Date(it.journalEntry.date);
          return d >= q.firstDay && d <= q.lastDay;
        })
        .reduce((s, it) => s + (it.type === "CREDIT" ? Number(it.value) : -Number(it.value)), 0);

      const baseIrpj = receitaBruta * PERC_PRESUNCAO + outrasReceitas;
      const baseCsll = receitaBruta * PERC_PRESUNCAO + outrasReceitas;
      const irpjNormal = baseIrpj * ALIQ_IRPJ;
      const adicIrpj = Math.max(0, baseIrpj - LIMITE_ADIC_TRIMESTRE) * ALIQ_ADIC_IRPJ;
      const csll = baseCsll * ALIQ_CSLL;

      // P200: discriminacao da receita bruta por percentual de presuncao IRPJ
      add(P+"P200"+P+"1"+P+dP("P200", "1", "DISCRIMINAÇÃO DA RECEITA BRUTA")+P+P);
      add(P+"P200"+P+codP200+P+dP("P200", codP200, "Receita Bruta Sujeita ao Percentual de " + pctTxt(ppIrpj) + "%")+P+this.fmtDec(receitaBruta)+P);
      if (outrasReceitas > 0) add(P+"P200"+P+"20"+P+dP("P200", "20", "Demais Receitas e Ganhos de Capital")+P+this.fmtDec(outrasReceitas)+P);
      totRecY672 += receitaBruta + outrasReceitas;
      // P300: apuracao IRPJ
      add(P+"P300"+P+"1"+P+dP("P300", "1", "BASE DE CÁLCULO DO IMPOSTO SOBRE O LUCRO PRESUMIDO")+P+this.fmtDec(baseIrpj)+P);
      add(P+"P300"+P+"2"+P+dP("P300", "2", "IMPOSTO APURADO COM BASE NO LUCRO PRESUMIDO")+P+P);
      add(P+"P300"+P+"3"+P+dP("P300", "3", "Alíquota de 15%")+P+this.fmtDec(irpjNormal)+P);
      add(P+"P300"+P+"4"+P+dP("P300", "4", "Adicional")+P+this.fmtDec(adicIrpj)+P);
      // P400: discriminacao da receita bruta por percentual de presuncao CSLL
      add(P+"P400"+P+"1"+P+dP("P400", "1", "CÁLCULO DA CSLL")+P+P);
      add(P+"P400"+P+codP400+P+dP("P400", codP400, "Receita Bruta Sujeita ao Percentual de " + pctTxt(ppCsll) + "%")+P+this.fmtDec(receitaBruta)+P);
      // P500: apuracao CSLL
      add(P+"P500"+P+"1"+P+dP("P500", "1", "BASE DE CÁLCULO DA CSLL")+P+this.fmtDec(baseCsll)+P);
      add(P+"P500"+P+"2"+P+dP("P500", "2", "CSLL Apurada")+P+this.fmtDec(csll)+P);
      add(P+"P500"+P+"4"+P+dP("P500", "4", "TOTAL DA CONTRIBUIÇÃO SOCIAL SOBRE O LUCRO LÍQUIDO")+P+this.fmtDec(csll)+P);
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
    // IMPL-ECF-01: Y600 com socios PF e PJ vigentes no periodo (entrada ate o fim e sem retirada antes do inicio).
    const shareholders: any[] = await this.prisma.companyShareholder.findMany({
      where: { companyId },
      include: { person: { select: { fullName: true, cpf: true } } },
    });
    const vigentes = shareholders.filter((sh: any) =>
      (!sh.dataEntrada || new Date(sh.dataEntrada) <= periodEnd) && (!sh.dataRetirada || new Date(sh.dataRetirada) >= periodStart));
    if (vigentes.length === 0) warnings.push("Nenhum socio vigente no periodo (company_shareholders) - Y600 ficara vazio.");
    const pjIds = vigentes.filter((sh: any) => sh.shareholderType === "PJ" && sh.shareholderCompanyId).map((sh: any) => sh.shareholderCompanyId);
    const pjs: any[] = pjIds.length ? await this.prisma.company.findMany({ where: { id: { in: pjIds } }, select: { id: true, taxId: true, legalName: true } }) : [];
    const pjById = new Map(pjs.map((c: any) => [c.id, c]));
    for (const sh of vigentes) {
      const isPj = sh.shareholderType === "PJ";
      const pj: any = isPj ? pjById.get(sh.shareholderCompanyId) : null;
      if (isPj && !pj) { warnings.push("Socio PJ " + sh.id + " sem empresa vinculada (shareholder_company_id) - linha Y600 nao gerada."); continue; }
      const doc = String((isPj ? pj.taxId : sh.person?.cpf) || "").replace(/\D/g, "");
      const nome = normSpedText(String((isPj ? pj.legalName : sh.person?.fullName) || ""));
      if (sh.participacaoPercent == null) warnings.push("Socio " + nome + " sem participacaoPercent cadastrado - Y600 gerado com 0,00.");
      const dtEntrada = sh.dataEntrada ? this.fmtDate(sh.dataEntrada) : "";
      const dtRetirada = sh.dataRetirada && new Date(sh.dataRetirada) <= periodEnd ? this.fmtDate(sh.dataRetirada) : "";
      const perc = this.fmtDec(sh.participacaoPercent ? Number(sh.participacaoPercent) : 0);
      add(P+"Y600"+P+dtEntrada+P+dtRetirada+P+"105"+P+(isPj ? "PJ" : "PF")+P+doc+P+nome+P+this.qualifSocioY600(natJurCode, isPj)+P+perc+P+perc+P+P+P+"0,00"+P+"0,00"+P+"0,00"+P+"0,00"+P+"0,00"+P);
    }
    // Y720: registro obrigatorio, campos vazios quando nao aplicavel (confirmado
    // no ECF real 2025 da GRB - ocorre sempre, mesmo totalmente vazio).
    // IMPL-ECF-07 (12/11/2026): Y672 (Outras Informacoes - Presumido/Arbitrado) gerado pelo LEDGR - regra geral.
    // Capital: Livro de Registro de Quotas/Acoes (registros ativos, descontando emissoes posteriores a cada data);
    // sem livro, capital do cadastro (equity). Receitas = mesma base do bloco P. Demais campos 0,00 (saldos
    // contabeis de caixa/aplicacoes/contas: proxima evolucao). Sem capital no LEDGR a geracao e bloqueada.
    if (["3", "4", "5", "6", "7"].includes(formaTributacao)) {
      const regs = await this.prisma.shareholderRecord.findMany({
        where: { companyId, deletedAt: null, isActive: true }, select: { totalValue: true },
      });
      const emis = await this.prisma.shareTransfer.findMany({
        where: { companyId, fromRecordId: null }, select: { transferDate: true, quantity: true, nominalValue: true },
      });
      const eqRow = await this.prisma.company.findUnique({ where: { id: companyId }, select: { equity: true } });
      const capCadastro = Number(eqRow?.equity ?? 0);
      const somaLivro = regs.reduce((s, r) => s + Number(r.totalValue ?? 0), 0);
      const capEm = (d: Date) => {
        if (!regs.length) return capCadastro;
        const posteriores = emis.filter(x => new Date(x.transferDate) > d)
          .reduce((s, x) => s + Number(x.quantity ?? 0) * Number(x.nominalValue ?? 0), 0);
        return somaLivro - posteriores;
      };
      const capIni = capEm(new Date(periodStart.getTime() - 86400000)), capFim = capEm(periodEnd);
      if (!(capFim > 0)) {
        throw new BadRequestException("ECF nao gerada - corrija o cadastro no LEDGR:\n- Capital social (Y672): nao encontrado no Livro de Registro de Quotas/Acoes nem no capital do cadastro da empresa.");
      }
      if (!regs.length) warnings.push("Y672: Livro de Registro de Quotas/Acoes sem registros - capital do cadastro (" + this.fmtDec(capCadastro) + ") usado no inicio e no fim do periodo.");
      else if (Math.abs(somaLivro - capCadastro) > 0.005) warnings.push("Y672: capital do Livro de Quotas/Acoes (" + this.fmtDec(somaLivro) + ") difere do capital do cadastro (" + this.fmtDec(capCadastro) + ") - usado o do livro.");
      const z = "0,00";
      const y672 = [this.fmtDec(capIni), this.fmtDec(capFim), z, z, z, z, z, z, z, z, z, z, z, z, this.fmtDec(totRecY672), z, ""];
      add(P+"Y672"+P+y672.join(P)+P);
    }
    // IMPL-ECF-08 (13/11/2026): Y720 (Informacoes de Periodos Anteriores) - obrigatorio na entrega em ATRASO, para
    // todas as PJ. Campos: LUC_LIQ|DT_LUC_LIQ|REC_BRUT_ANT|INTIMACAO|INT_ATRASO. Presumido/Arbitrado/Imune/Isenta
    // (formas 5-9): so INTIMACAO (LUC_LIQ/REC_BRUT_ANT nao podem ser preenchidos); INT_ATRASO so se INTIMACAO = S.
    // Prazo: ultimo dia util de julho do ano seguinte; situacao especial (periodo nao termina em 31/12): ultimo dia
    // util do 3o mes seguinte ao fim do periodo. Dentro do prazo, Lucro Real mantem o comportamento validado (GRB).
    {
      const fimPer = new Date(periodEnd);
      const ehAnual = fimPer.getUTCMonth() === 11 && fimPer.getUTCDate() === 31;
      const prazo = ehAnual ? new Date(Date.UTC(fimPer.getUTCFullYear() + 1, 6, 31))
                            : new Date(Date.UTC(fimPer.getUTCFullYear(), fimPer.getUTCMonth() + 4, 0));
      while (prazo.getUTCDay() === 0 || prazo.getUTCDay() === 6) prazo.setUTCDate(prazo.getUTCDate() - 1);
      const emAtraso = Date.now() > prazo.getTime() + 86400000;
      const real = ["1", "2", "3", "4"].includes(formaTributacao);
      if (emAtraso) {
        add(P+"Y720"+P+P+P+P+"N"+P+P);
        warnings.push("Y720: entrega apos o prazo legal (" + this.fmtDate(prazo) + ") - INTIMACAO = N (sem termo de intimacao da RFB). Se houve intimacao, altere no PVA (INTIMACAO = S e INT_ATRASO).");
        if (real) warnings.push("Y720: Lucro Real/forma mista em atraso - LUC_LIQ, DT_LUC_LIQ e REC_BRUT_ANT ainda nao sao calculados pelo LEDGR; preencher no PVA.");
      } else if (real) {
        add(P+"Y720"+P+P+P+P+P+P);
      }
    }
    const idxY001 = lines.findIndex(l => l === P+"Y001"+P+"0"+P);
    add(P+"Y990"+P+(lines.length - idxY001 + 1)+P);

    // ── BLOCO 9 (encerramento) ───────────────────────────────────────────
    // IMPL-ECF-06 (12/11/2026): blocos sem dados (X001 seguido de X990|2|) nao sao gerados - padrao do ECF
    // aceito pela RFB (LM 2024: so 0, J, L, M, Y e 9). Vale para qualquer empresa/regime; blocos 0 e 9 e blocos
    // com conteudo permanecem. 0990/9900/9999 sao calculados depois desta etapa.
    for (let i = lines.length - 2; i >= 0; i--) {
      const mb = /^\|([A-Z])001\|[01]\|$/.exec(lines[i]);
      if (mb && lines[i + 1] === P + mb[1] + "990" + P + "2" + P) lines.splice(i, 2);
    }
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

  // IMPL-ECF-04: tabelas dinamicas do PVA ECF (recursos/tabelas): "SPEDECF_DINAMICO_<ano>$SPEDECF_DINAMICA_<REG>$<versao>$<id>",
  // latin1, linhas CODIGO|DESCRICAO|DT_INI|DT_FIM|... - usa a linha vigente no periodo, da tabela mais recente.
  private loadEcfDynamicTables(regs: string[], periodStart: Date, periodEnd: Date, warnings: string[]): Record<string, Map<string, string>> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs"); const path = require("path");
    const dir = process.env.ECF_PVA_TABELAS_DIR || "C:\\Arquivos de Programas RFB\\Programas SPED\\SpedECF\\recursos\\tabelas";
    const out: Record<string, Map<string, string>> = {};
    let files: string[] = [];
    try { files = fs.readdirSync(dir); } catch {
      warnings.push("Tabelas dinamicas do PVA ECF nao encontradas em " + dir + " (defina ECF_PVA_TABELAS_DIR) - descricoes do bloco P saem do texto interno.");
      return out;
    }
    const parseD = (s: string) => (s && s.length === 8 ? Date.UTC(+s.slice(4), +s.slice(2, 4) - 1, +s.slice(0, 2)) : NaN);
    const ini = periodStart.getTime(), fim = periodEnd.getTime();
    for (const reg of regs) {
      const cand = files
        .map(f => { const m = /^SPEDECF_DINAMICO_(\d{4})\$SPEDECF_DINAMICA_([A-Z0-9]+)\$(\d+)\$(\d+)$/.exec(f); return m && m[2] === reg ? { f, ano: +m[1], ver: +m[3] } : null; })
        .filter((x): x is { f: string; ano: number; ver: number } => !!x)
        .sort((a, b) => a.ano - b.ano || a.ver - b.ver);
      const map = new Map<string, string>();
      for (const c of cand) {
        let txt = "";
        try { txt = fs.readFileSync(path.join(dir, c.f), "latin1"); } catch { continue; }
        for (const ln of txt.split(/\r?\n/)) {
          const p = ln.split("|");
          if (p.length < 4 || !p[0] || p[0].startsWith("vers")) continue;
          const di = parseD(p[2]); const df = p[3] ? parseD(p[3]) : Infinity;
          if (!isNaN(di) && di > fim) continue;
          if (df < ini) continue;
          map.set(p[0].trim(), p[1].trim());
        }
      }
      if (map.size) out[reg] = map;
      else warnings.push("Tabela dinamica " + reg + " do PVA nao encontrada em " + dir + " - descricoes internas usadas.");
    }
    return out;
  }

  // IMPL-ECF-04: codigo RFB de natureza juridica a partir do texto do cadastro (ou do proprio codigo, ex "224-0").
  private natJurCode(txt?: string | null): string {
    const s = (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
    const dig = s.replace(/\D/g, "");
    if (dig.length === 4 && /^[\d\s.\-]+$/.test(s)) return dig;
    const T: [string, string][] = [
      ["empresa publica", "2011"], ["sociedade de economia mista", "2038"], ["sociedade anonima aberta", "2046"],
      ["sociedade anonima fechada", "2054"], ["sociedade empresaria limitada", "2062"], ["sociedade empresaria em nome coletivo", "2076"],
      ["sociedade empresaria em comandita simples", "2089"], ["sociedade empresaria em comandita por acoes", "2097"],
      ["sociedade em conta de participacao", "2127"], ["empresario individual", "2135"], ["cooperativas de consumo", "2330"], ["cooperativa", "2143"],
      ["consorcio de sociedades", "2151"], ["grupo de sociedades", "2160"], ["sociedade simples pura", "2232"],
      ["sociedade simples limitada", "2240"], ["sociedade simples em nome coletivo", "2259"], ["sociedade simples em comandita simples", "2267"],
      ["empresa binacional", "2275"], ["consorcio de empregadores", "2283"], ["consorcio simples", "2291"],
      ["eireli de natureza simples", "2313"], ["natureza simples", "2313"], ["empresa individual de responsabilidade limitada", "2305"], ["eireli", "2305"],
      ["sociedade unipessoal de advocacia", "2321"], ["empresa simples de inovacao", "2348"],
      ["associacao privada", "3999"], ["fundacao privada", "3069"], ["sociedade anonima", "2054"], ["sociedade limitada", "2062"], ["ltda", "2062"],
    ];
    for (const [k, v] of T) if (s === k) return v;
    for (const [k, v] of T) if (s.includes(k)) return v;
    return "";
  }

  // IMPL-ECF-04: Y600 QUALIF - 01/02 acionista/socio PF, 03/04 acionista/socio PJ (Brasil), 09 titular.
  private qualifSocioY600(natJur: string, isPj: boolean): string {
    if (!isPj && ["2135", "2305", "2313"].includes(natJur)) return "09";
    const acionista = ["2038", "2046", "2054", "2097"].includes(natJur);
    return isPj ? (acionista ? "03" : "04") : (acionista ? "01" : "02");
  }

  // IMPL-ECF-04: COD_QUALIF do 0930 (tabela de qualificacao do assinante) a partir do papel/qualificacao cadastrada.
  private qualifAssinante(role?: string | null, cvm?: string | null): string | null {
    const s = (role || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (s.includes("contador") || s.includes("contabilista")) return "900";
    if (s.includes("procurador")) return "309";
    if (s.includes("inventariante")) return "312";
    if (s.includes("liquidante")) return "313";
    if (s.includes("interventor")) return "315";
    if (s.includes("conselheiro")) return "204";
    if (s.includes("diretor") || s.includes("presidente")) return "203";
    if (s.includes("administrador")) return "205";
    if (s.includes("titular")) return "401";
    if (s.includes("empresario")) return "801";
    const c = (cvm || "").replace(/\D/g, "");
    if (["49", "05", "5"].includes(c)) return "205";
    if (["10", "16"].includes(c)) return "203";
    return null;
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
