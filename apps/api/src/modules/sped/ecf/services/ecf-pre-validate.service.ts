import { Injectable } from "@nestjs/common";
import { PrismaService } from "@prisma/prisma.service";
import { getEcfLayout } from "./ecf-exporter.service";

export type EcfCheckLevel = "ERROR" | "WARNING" | "INFO";

export interface EcfPreValidateCheck {
  id: string;
  level: EcfCheckLevel;
  title: string;
  description: string;
  count?: number;
  details?: any[];
  action?: string;
}

export interface EcfPreValidateResult {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  checks: EcfPreValidateCheck[];
  hasErrors: boolean;
  hasWarnings: boolean;
  generatedAt: string;
}

@Injectable()
export class EcfPreValidateService {
  constructor(private prisma: PrismaService) {}

  async validate(
    companyId: string,
    periodStart: string,
    periodEnd: string
  ): Promise<EcfPreValidateResult> {
    const checks: EcfPreValidateCheck[] = [];
    const ps = new Date(periodStart + "T00:00:00.000Z");
    const pe = new Date(periodEnd + "T23:59:59.999Z");
    const anoBase = parseInt(periodStart.substring(0, 4), 10);

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });

    if (!company?.state) {
      checks.push({
        id: "C1", level: "ERROR",
        title: "Empresa sem UF cadastrada",
        description: "O campo Estado (UF) e usado no registro 0030 do ECF.",
        action: "Edite o cadastro da empresa e preencha o campo Estado.",
      });
    }

    if (!company?.street || !company?.zipCode) {
      checks.push({
        id: "C2", level: "ERROR",
        title: "Endereco fiscal incompleto",
        description: "Logradouro e CEP sao obrigatorios no registro 0030 do ECF.",
        action: "Edite o cadastro da empresa e complete o endereco (rua, numero, CEP).",
      });
    }

    if (!company?.codMun) {
      checks.push({
        id: "C3", level: "WARNING",
        title: "Codigo do municipio (IBGE) nao cadastrado",
        description: "O registro 0030 sai sem o campo COD_MUN quando ausente.",
        action: "Preencha o codigo IBGE do municipio no cadastro da empresa.",
      });
    }

    if (!company?.mainActivity) {
      checks.push({
        id: "C4", level: "WARNING",
        title: "CNAE (atividade principal) nao cadastrado",
        description: "O registro 0030 sai sem o campo CNAE quando ausente.",
        action: "Preencha o CNAE (codigo RFB, ex: 6911701) em Atividade Principal.",
      });
    }

    checks.push({
      id: "C5", level: "WARNING",
      title: "Natureza Juridica sem campo de codigo RFB no cadastro",
      description: "O cadastro da empresa hoje so guarda Natureza Juridica como texto livre, sem o codigo numerico RFB (ex: 2232) que o registro 0030 exige. Gap estrutural conhecido, nao resolve por edicao de cadastro ainda.",
      action: "Pendencia de desenvolvimento: adicionar campo de codigo RFB de Natureza Juridica ao cadastro de empresa.",
    });

    const signers = await this.prisma.personCompany.findMany({
      where: { companyId, assinaEcf: true },
      include: { person: { select: { fullName: true, cpf: true, crcNumber: true, crcState: true } } },
    });

    if (signers.length === 0) {
      checks.push({
        id: "C6", level: "ERROR",
        title: "Nenhum signatario ECF configurado",
        description: "O registro 0930 requer ao menos um assinante marcado com Assina ECF = true.",
        action: "Acesse os vinculos de pessoas da empresa e marque Assina ECF para o(s) responsavel(is).",
      });
    }

    const contadorSigner = signers.find((s) => (s.role || "").toLowerCase() === "contador");
    if (signers.length > 0 && !contadorSigner) {
      checks.push({
        id: "C7", level: "ERROR",
        title: "Nenhum signatario com role=contador entre os assinantes ECF",
        description: "O registro 0930 exige um assinante com qualificacao de Contador (COD_QUALIF=900).",
        action: "Marque o vinculo do contador responsavel com Assina ECF = true e role = contador.",
      });
    }

    if (contadorSigner) {
      const accConfig = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
      const crc = contadorSigner.person?.crcNumber || accConfig?.accountantCrc;
      if (!crc) {
        checks.push({
          id: "C8", level: "ERROR",
          title: "CRC do contador nao cadastrado",
          description: "COD_QUALIF=900 no registro 0930 exige NUM_SEQ_CRC preenchido (cadastro da pessoa ou Configuracao Contabil da empresa).",
          action: "Preencha o CRC no cadastro da pessoa do contador ou na aba Contabil da empresa.",
        });
      }
    }

    const shareholders = await this.prisma.companyShareholder.findMany({
      where: { companyId }, // IMPL-ECF-01: socios PF e PJ
      include: { person: { select: { fullName: true } } },
    });

    if (shareholders.length === 0) {
      checks.push({
        id: "C9", level: "WARNING",
        title: "Nenhum socio (CompanyShareholder) cadastrado",
        description: "O bloco Y600 (quadro societario) ficara vazio sem socios cadastrados.",
        action: "Cadastre os socios PF em Societario > Quadro de Socios.",
      });
    } else {
      const noPercent = shareholders.filter((s) => s.participacaoPercent == null);
      if (noPercent.length > 0) {
        checks.push({
          id: "C10", level: "WARNING",
          title: noPercent.length + " socio(s) sem participacaoPercent cadastrado",
          description: "Y600 sera gerado com 0,00 de participacao para esses socios.",
          count: noPercent.length,
          details: noPercent.slice(0, 20).map((s) => ({ name: s.person?.fullName })),
          action: "Preencha o percentual de participacao no cadastro societario.",
        });
      }
    }

    const allAccounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true, isAnalytic: true, name: true },
    });

    const badCode = allAccounts.filter((a) => a.isAnalytic && (a.code.length <= 6 || a.code.includes(".")));
    if (badCode.length > 0) {
      checks.push({
        id: "C11", level: "ERROR",
        title: badCode.length + " conta(s) analitica(s) com codigo invalido para ECF",
        description: "COD_CTA no C050/J050 deve usar o codigo contabil completo, nunca reduced_code nem codigo pontilhado.",
        count: badCode.length,
        details: badCode.slice(0, 20).map((a) => ({ code: a.code, name: a.name })),
        action: "Corrija os codigos das contas analiticas (mesma pendencia ja tratada no ECD).",
      });
    }

    const views = await this.prisma.accountingView.findMany({
      where: { companyId, isActive: true },
      include: { mappings: { select: { accountId: true } } },
    });
    const mappedCount = views.reduce((sum, v) => sum + v.mappings.length, 0);
    if (mappedCount === 0) {
      checks.push({
        id: "W1", level: "WARNING",
        title: "Nenhuma conta mapeada em Visoes Contabeis",
        description: "O referencial (J051/C051/K156) ficara vazio em todo o arquivo.",
        action: "Configure as Visoes Contabeis BP/DRE da empresa.",
      });
    }

    // IMPL-ECF-02: TIP_ESC_PRE do regime do periodo x condicoes da dispensa da ECD
    const reg: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT forma_tributacao, tip_esc_pre FROM company_tax_regimes WHERE company_id = $1::uuid AND dt_ini <= $3::date
        AND (dt_fin IS NULL OR dt_fin >= $2::date) ORDER BY dt_ini DESC LIMIT 1`, companyId, periodStart, periodEnd);
    const est: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT premissas FROM tax_regime_studies WHERE company_id = $1::uuid AND ano = $2::int AND status = 'CONCLUIDO'
        AND deleted_at IS NULL ORDER BY versao DESC LIMIT 1`, companyId, anoBase);
    const tipEsc = reg[0]?.tip_esc_pre === "L" ? "L" : "C";
    const presumido = ["3", "4", "5", "7"].includes(String(reg[0]?.forma_tributacao ?? "5"));
    if (tipEsc === "L" && est[0]?.premissas?.distribuicaoAcimaBase) {
      checks.push({ id: "E1", level: "ERROR", title: "ECD obrigatoria: distribuicao de lucros acima da base presumida",
        description: "ECD OBRIGATORIA - o estudo concluido do ano marca distribuicao de lucros acima da base presumida (IN RFB 2.003/2021, art. 3, par. 1): TIP_ESC_PRE = L nao se aplica. Transmita a ECD e use TIP_ESC_PRE = C no regime do periodo.", action: "Transmita a ECD do periodo e altere o TIP_ESC_PRE do regime para C." });
    } else if (tipEsc === "L") {
      checks.push({ id: "E2", level: "WARNING", title: "Livro Caixa (TIP_ESC_PRE = L): condicoes da dispensa da ECD",
        description: "ATENCAO - TIP_ESC_PRE = L (Livro Caixa, sem ECD). A dispensa da ECD do Presumido (IN RFB 2.003/2021, art. 3, II) so vale se: (1) o Livro Caixa ou a escrituracao contabil registrar TODA a movimentacao financeira, inclusive bancaria (Lei 8.981/1995, art. 45, par. unico) - mantenha o Diario/Livro Caixa do periodo arquivado e disponivel; (2) nao houver distribuicao de lucros, sem IRRF, acima da base presumida menos os tributos (IN RFB 2.003/2021, art. 3, par. 1) - se houver, a ECD e obrigatoria e o TIP_ESC_PRE deve ser C.", action: "Arquive o Diario/Livro Caixa do periodo e confirme que nao houve distribuicao acima da base presumida." });
    } else if (presumido) {
      checks.push({ id: "E3", level: "WARNING", title: "Escrituracao contabil (TIP_ESC_PRE = C): ECD do periodo transmitida?",
        description: "ATENCAO - TIP_ESC_PRE = C (escrituracao contabil) no Presumido: a ECD do periodo deve estar transmitida (obrigatoria ou facultativa) - o PVA recupera a ECD. Se a ECD nao for entregue, cadastre TIP_ESC_PRE = L no regime do periodo e mantenha o Livro Caixa.", action: "Confirme a transmissao da ECD ou cadastre TIP_ESC_PRE = L no regime do periodo." });
    }

    const entryCount = await this.prisma.journalEntry.count({
      where: { companyId, date: { gte: ps, lte: pe }, deletedAt: null },
    });

    const codVer = getEcfLayout(anoBase).codVer; // IMPL-ECF-01: mesma tabela do exporter
    checks.push({ id: "I1", level: "INFO", title: "Leiaute ECF em uso: " + codVer, description: "Determinado pelo ano-calendario " + anoBase + " (tabela ECF_LAYOUT_BY_YEAR do exporter)." });

    const analyticCount = allAccounts.filter((a) => a.isAnalytic).length;
    checks.push({ id: "I2", level: "INFO", title: "Plano de contas: " + analyticCount + " conta(s) analitica(s) ativa(s)", description: "Total de contas analiticas ativas no plano." });
    checks.push({ id: "I3", level: "INFO", title: entryCount + " lancamento(s) no periodo", description: "Lancamentos em journal_entries entre " + periodStart + " e " + periodEnd + "." });
    checks.push({ id: "I4", level: "INFO", title: signers.length + " signatario(s) ECF configurado(s)", description: "Total de vinculos com assinaEcf=true." });

    return {
      companyId, periodStart, periodEnd, checks,
      hasErrors: checks.some((c) => c.level === "ERROR"),
      hasWarnings: checks.some((c) => c.level === "WARNING"),
      generatedAt: new Date().toISOString(),
    };
  }
}