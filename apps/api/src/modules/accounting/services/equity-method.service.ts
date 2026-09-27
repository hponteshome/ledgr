// apps/api/src/modules/accounting/services/equity-method.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { TrialBalanceService } from './trial-balance.service';

export interface CreateEquityMethodDto {
  investeeCompanyId: string;
  percentOwned: number;
  investmentAccountCode: string;
  gainAccountCode: string;
  lossAccountCode: string;
  initialCost: number;
  acquisitionDate: string;
  notes?: string;
}

export interface UpdateEquityMethodDto {
  percentOwned?: number;
  investmentAccountCode?: string;
  gainAccountCode?: string;
  lossAccountCode?: string;
  // NOVO 25/09/2026: conta redutora (mais-valia) - so altera se informada,
  // deixar em branco preserva o valor ja gravado.
  reductionAccountCode?: string;
  // NOVO 25/09/2026: conta de provisao para perda excedente ao saldo do
  // investimento - so altera se informada.
  provisionAccountCode?: string;
  initialCost?: number;
  acquisitionDate?: string;
  notes?: string;
}

@Injectable()
export class EquityMethodService {
  constructor(
    private prisma: PrismaService,
    private trialBalance: TrialBalanceService,
  ) {}

  async list(companyId: string) {
    return this.prisma.equityMethodInvestment.findMany({
      where: { investorCompanyId: companyId, deletedAt: null },
      include: {
        investeeCompany: { select: { id: true, legalName: true, tradeName: true, taxId: true } },
        investmentAccount: { select: { id: true, code: true, name: true } },
        gainAccount: { select: { id: true, code: true, name: true } },
        lossAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // CRIADO 15/09/2026: sugere o % de participacao com base no Livro de
  // Registro de Socios (ShareholderRecord) da investida - procura, entre os
  // titulares ativos da investida, aquele cujo holderTaxId bate com o CNPJ
  // da propria empresa investidora. Nao sobrescreve nada sozinho - so
  // devolve a sugestao para o chamador decidir (form de cadastro / comparacao
  // no detalhe de uma participacao ja existente).
  async percentualSugerido(investorCompanyId: string, investeeCompanyId: string) {
    const investidora = await this.prisma.company.findUnique({ where: { id: investorCompanyId } });
    if (!investidora) throw new NotFoundException('Empresa investidora não encontrada.');
    const investidoraTaxId = investidora.taxId.replace(/\D/g, '');

    const registros = await this.prisma.shareholderRecord.findMany({
      where: { companyId: investeeCompanyId, isActive: true, deletedAt: null },
    });
    const registro = registros.find(r => r.holderTaxId.replace(/\D/g, '') === investidoraTaxId);

    if (!registro) {
      return { found: false, percentOwned: null, holderName: null };
    }
    return {
      found: true,
      percentOwned: Number(registro.percentOwned),
      holderName: registro.holderName,
      quantity: Number(registro.quantity),
      totalValue: Number(registro.totalValue),
    };
  }

  // CRIADO 15/09/2026: atualizacao explicita do % (nunca automatica) - usada
  // pelo botao "Atualizar" quando o Livro de Socios da investida diverge do
  // percentual gravado na participacao.
  async updatePercentOwned(companyId: string, investmentId: string, percentOwned: number) {
    await this.getInvestimentoOuFalha(companyId, investmentId);
    if (!percentOwned || percentOwned <= 0 || percentOwned > 100) {
      throw new BadRequestException('Percentual de participação deve estar entre 0 e 100.');
    }
    return this.prisma.equityMethodInvestment.update({
      where: { id: investmentId },
      data: { percentOwned },
    });
  }

  async create(companyId: string, user: any, dto: CreateEquityMethodDto) {
    const userId = user.id;
    if (dto.investeeCompanyId === companyId) {
      throw new BadRequestException('A empresa investida deve ser diferente da empresa investidora.');
    }
    if (!dto.percentOwned || dto.percentOwned <= 0 || dto.percentOwned > 100) {
      throw new BadRequestException('Percentual de participação deve estar entre 0 e 100.');
    }

    // CORRIGIDO 13/09/2026: Master Admin (permissions.all=true) nao precisa
    // de vinculo explicito em user_companies - mesmo criterio ja usado em
    // company.service.ts (findAvailable).
    const isMasterAdmin = (user?.profile?.permissions as any)?.all === true;
    if (!isMasterAdmin) {
      const acesso = await this.prisma.userCompany.findFirst({
        where: { userId, companyId: dto.investeeCompanyId },
      });
      if (!acesso) {
        throw new ForbiddenException('Você não tem acesso à empresa investida selecionada.');
      }
    }

    const investmentAccount = await this.prisma.chartOfAccounts.findFirst({
      where: { companyId, code: dto.investmentAccountCode, deletedAt: null },
    });
    if (!investmentAccount) {
      throw new BadRequestException(`Conta de Investimentos "${dto.investmentAccountCode}" não encontrada.`);
    }
    const gainAccount = await this.prisma.chartOfAccounts.findFirst({
      where: { companyId, code: dto.gainAccountCode, deletedAt: null },
    });
    if (!gainAccount) {
      throw new BadRequestException(`Conta de Ganho de Equivalência Patrimonial "${dto.gainAccountCode}" não encontrada.`);
    }
    const lossAccount = await this.prisma.chartOfAccounts.findFirst({
      where: { companyId, code: dto.lossAccountCode, deletedAt: null },
    });
    if (!lossAccount) {
      throw new BadRequestException(`Conta de Perda de Equivalência Patrimonial "${dto.lossAccountCode}" não encontrada.`);
    }

    return this.prisma.equityMethodInvestment.create({
      data: {
        investorCompanyId: companyId,
        investeeCompanyId: dto.investeeCompanyId,
        percentOwned: dto.percentOwned,
        investmentAccountId: investmentAccount.id,
        gainAccountId: gainAccount.id,
        lossAccountId: lossAccount.id,
        initialCost: dto.initialCost,
        acquisitionDate: new Date(dto.acquisitionDate + 'T00:00:00Z'),
        notes: dto.notes,
        createdById: userId,
      },
    });
  }

  async update(companyId: string, investmentId: string, dto: UpdateEquityMethodDto) {
    const existing = await this.prisma.equityMethodInvestment.findFirst({
      where: { id: investmentId, investorCompanyId: companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Participacao nao encontrada.");

    if (dto.percentOwned !== undefined && (dto.percentOwned <= 0 || dto.percentOwned > 100)) {
      throw new BadRequestException("Percentual de participacao deve estar entre 0 e 100.");
    }

    const data: any = {};
    if (dto.percentOwned !== undefined) data.percentOwned = dto.percentOwned;
    if (dto.initialCost !== undefined) data.initialCost = dto.initialCost;
    if (dto.acquisitionDate !== undefined) data.acquisitionDate = new Date(dto.acquisitionDate + "T00:00:00Z");
    if (dto.notes !== undefined) data.notes = dto.notes;

    const resolverConta = async (code: string, rotulo: string) => {
      const conta = await this.prisma.chartOfAccounts.findFirst({ where: { companyId, code, deletedAt: null } });
      if (!conta) throw new BadRequestException("Conta de " + rotulo + " \"" + code + "\" nao encontrada.");
      return conta.id;
    };
    if (dto.investmentAccountCode) data.investmentAccountId = await resolverConta(dto.investmentAccountCode, "Investimentos");
    if (dto.gainAccountCode) data.gainAccountId = await resolverConta(dto.gainAccountCode, "Ganho de Equivalencia Patrimonial");
    if (dto.lossAccountCode) data.lossAccountId = await resolverConta(dto.lossAccountCode, "Perda de Equivalencia Patrimonial");
    // reductionAccountCode so altera se vier preenchido - em branco preserva
    // o vinculo ja gravado (ex.: Hotelsys/Sunsys, configurado via SQL hoje).
    if (dto.reductionAccountCode) data.reductionAccountId = await resolverConta(dto.reductionAccountCode, "Redutora do Investimento");
    if (dto.provisionAccountCode) data.provisionAccountId = await resolverConta(dto.provisionAccountCode, "Provisao para Perdas em Investimentos");

    return this.prisma.equityMethodInvestment.update({ where: { id: investmentId }, data });
  }

  // Exclusao (soft-delete) da participacao. Bloqueada se ja existir
  // qualquer apuracao registrada - evita orfanizar equity_method_calculations
  // (usuario deve reverter todas as apuracoes primeiro, uma a uma).
  async remove(companyId: string, investmentId: string) {
    const existing = await this.prisma.equityMethodInvestment.findFirst({
      where: { id: investmentId, investorCompanyId: companyId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException("Participacao nao encontrada.");

    const calculoExistente = await this.prisma.equityMethodCalculation.findFirst({
      where: { investmentId },
    });
    if (calculoExistente) {
      throw new BadRequestException(
        "Existem apuracoes de Equivalencia Patrimonial registradas para esta participacao. Reverta todas as apuracoes (historico) antes de excluir.",
      );
    }

    return this.prisma.equityMethodInvestment.update({
      where: { id: investmentId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private async getInvestimentoOuFalha(companyId: string, investmentId: string) {
    const investimento = await this.prisma.equityMethodInvestment.findFirst({
      where: { id: investmentId, investorCompanyId: companyId, deletedAt: null },
      include: { investeeCompany: true, investmentAccount: true, gainAccount: true, lossAccount: true },
    });
    if (!investimento) throw new NotFoundException('Participação não encontrada.');
    return investimento;
  }

  // PL da investida na data de referencia: soma das raizes tipo EQUITY, sinal
  // natural (nature CREDIT: -raw) - mesmo criterio ja usado no ClosingPanel
  // (TrialBalanceView.tsx) e na DRE (DrePage.tsx).
  private async calcularPLInvestida(investeeCompanyId: string, referenceDate: Date) {
    const beginning = new Date(Date.UTC(1900, 0, 1));
    const { balances } = await this.trialBalance.getVerificationBalance(investeeCompanyId, beginning, referenceDate);

    // CORRIGIDO 25/09/2026: o filtro antigo (type==='EQUITY' && level===1) so
    // funciona quando o PL e uma raiz PROPRIA de nivel 1. No plano padrao da
    // Matriz, "23 Patrimonio Liquido" e EQUITY mas fica no nivel 2, dentro de
    // uma raiz unica "2 PASSIVO" (LIABILITY) - o filtro antigo nunca
    // encontrava nada, investeePl saia sempre 0, e o "adjustment" virava uma
    // baixa quase total do saldo do investimento (achado real: Hotelsys /
    // Sunsys). Novo criterio: soma toda conta EQUITY cujo PAI nao seja
    // tambem EQUITY - acha a(s) raiz(es) do PL onde quer que estejam na
    // arvore, sem depender de um numero de nivel fixo. So soma as raizes
    // (nao os descendentes) porque currentBalance de uma conta sintetica ja
    // e o rollup de baixo pra cima - somar filho e pai juntos dobraria.
    const contasEquity = await this.prisma.chartOfAccounts.findMany({
      where: { companyId: investeeCompanyId, deletedAt: null, type: 'EQUITY' as any },
      select: { id: true, nature: true, parentId: true },
    });
    const idsEquity = new Set(contasEquity.map(c => c.id));
    const balancePorId = new Map((balances as any[]).map(b => [b.account.id, b]));

    let pl = 0;
    for (const c of contasEquity) {
      if (c.parentId && idsEquity.has(c.parentId)) continue; // pai tambem EQUITY - nao e raiz, ja esta no rollup do pai
      const b = balancePorId.get(c.id);
      if (!b) continue;
      pl += c.nature === 'CREDIT' ? -b.currentBalance : b.currentBalance;
    }
    return pl;
  }

  // CORRIGIDO 25/09/2026: soma tambem a conta redutora (reductionAccountId),
  // quando configurada - o saldo liquido real do investimento (ex.: valor de
  // mercado na integralizacao MENOS o ganho nao realizado registrado em
  // conta propria) precisa entrar inteiro como "saldo anterior" da MEP,
  // senao o calculo ignora a reducao e infla o valor de referencia.
  private async saldoContabilInvestimento(companyId: string, accountId: string, reductionAccountId: string | null, referenceDate: Date) {
    const beginning = new Date(Date.UTC(1900, 0, 1));
    const { balances } = await this.trialBalance.getVerificationBalance(companyId, beginning, referenceDate);
    const linha = (balances as any[]).find(b => b.account.id === accountId);
    let total = linha ? linha.currentBalance : 0;
    if (reductionAccountId) {
      const linhaRed = (balances as any[]).find(b => b.account.id === reductionAccountId);
      total += linhaRed ? linhaRed.currentBalance : 0;
    }
    return total;
  }

  // CRIADO 13/09/2026: sem o encerramento do exercicio rodado na investida,
  // o PL apurado nessa data ainda e um corte parcial (ainda vai mudar) - MEP
  // calculado em cima disso e prematuro. Verifica se existe pelo menos um
  // JournalEntry com isClosingEntry=true dentro do ANO da data-base.
  private async anoEncerradoNaInvestida(investeeCompanyId: string, ano: number): Promise<boolean> {
    const inicioAno = new Date(Date.UTC(ano, 0, 1, 0, 0, 0, 0));
    const fimAno = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999));
    const encerramento = await this.prisma.journalEntry.findFirst({
      where: {
        companyId: investeeCompanyId,
        isClosingEntry: true,
        date: { gte: inicioAno, lte: fimAno },
        deletedAt: null,
      },
    });
    return !!encerramento;
  }

  // Resultado do exercicio (lucro/prejuizo) da investida no ano, mesma
  // tecnica ja validada de getResultadoContabil/getReceitasBrutas: soma o
  // movimento (credito-debito) das contas REVENUE/EXPENSE dentro do ano,
  // excluindo lancamentos de encerramento. NOVO 25/09/2026.
  private async getResultadoExercicioInvestida(investeeCompanyId: string, ano: number): Promise<number> {
    const ini = new Date(Date.UTC(ano, 0, 1));
    const fim = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999));
    const rows = await this.prisma.journalEntryItem.groupBy({
      by: ["type"],
      where: {
        journalEntry: { companyId: investeeCompanyId, deletedAt: null, isClosingEntry: false, date: { gte: ini, lte: fim } },
        account: { type: { in: ["REVENUE", "EXPENSE"] } as any },
      },
      _sum: { value: true },
    });
    const credito = Number(rows.find(r => r.type === "CREDIT")?._sum.value ?? 0);
    const debito = Number(rows.find(r => r.type === "DEBIT")?._sum.value ?? 0);
    return credito - debito;
  }

  async calcular(companyId: string, investmentId: string, referenceDateStr: string) {
    const investimento = await this.getInvestimentoOuFalha(companyId, investmentId);
    const referenceDate = new Date(referenceDateStr + 'T23:59:59Z');
    const ano = referenceDate.getUTCFullYear();

    const investeeYearClosed = await this.anoEncerradoNaInvestida(investimento.investeeCompanyId, ano);

    // CORRIGIDO 25/09/2026 (redesenho final): MEP correto e a participacao
    // no RESULTADO DO EXERCICIO da investida (lucro/prejuizo do periodo),
    // nao a variacao total do PL entre duas datas - essa ultima misturava
    // aportes de capital e outros movimentos de patrimonio como se fossem
    // "ganho" do investidor, alem de exigir uma cadeia fragil de apuracoes
    // anteriores (achados reais hoje: Hotelsys/Sunsys e Sunrise/Hotelsys,
    // ambos com resultado calculado muito acima do resultado real do
    // exercicio). Resultado do exercicio calculado com a MESMA tecnica ja
    // validada de getResultadoContabil/getReceitasBrutas
    // (apuracao.service.ts): movimento REVENUE/EXPENSE do ano, excluindo
    // encerramento. Cada ano passa a ser INDEPENDENTE - nao precisa mais de
    // cadeia por apuracao anterior nem de data de aquisicao para calcular.
    const percent = Number(investimento.percentOwned);
    const resultadoExercicio = await this.getResultadoExercicioInvestida(investimento.investeeCompanyId, ano);
    const investeePl = resultadoExercicio;
    const investeePlBase = 0;
    const adjustmentBruto = resultadoExercicio * (percent / 100);
    const previousBookValue = await this.saldoContabilInvestimento(companyId, investimento.investmentAccountId, (investimento as any).reductionAccountId ?? null, referenceDate);

    // NOVO 25/09/2026: piso zero (CPC 18 / IAS 28) - o investidor so
    // reconhece perda de equivalencia patrimonial ate o saldo contabil do
    // investimento zerar. Perda que exceder isso NAO e lancada (so seria,
    // separadamente, se houvesse obrigacao legal/construtiva de cobrir
    // prejuizo da investida - fora do escopo desta correcao). Sem o piso,
    // o saldo do investimento ficava negativo (achado real: Sunsys, saldo
    // R$654.714,83 com perda calculada de R$1.763.693,31).
    const equityValueBruto = previousBookValue + adjustmentBruto;
    const limitadoZero = equityValueBruto < 0;
    const provisionAccountId = (investimento as any).provisionAccountId ?? null;

    // NOVO 25/09/2026: quando ha conta de provisao configurada, a perda
    // excedente ao saldo do investimento NAO e mais descartada - a perda
    // economica INTEGRAL do periodo e reconhecida, dividida entre zerar o
    // investimento (valorZeragemInvestimento) e constituir/aumentar a
    // provisao (valorProvisao). Sem conta de provisao configurada, mantem o
    // comportamento anterior (para de reconhecer perda alem do saldo).
    let equityValue = equityValueBruto;
    let adjustment = adjustmentBruto;
    let valorZeragemInvestimento: number | null = null;
    let valorProvisao: number | null = null;
    let previousProvisionBalance: number | null = null;
    let provisionBalanceAfter: number | null = null;

    if (limitadoZero) {
      if (provisionAccountId) {
        const perdaTotal = Math.abs(adjustmentBruto);
        valorZeragemInvestimento = Math.max(0, Math.min(previousBookValue, perdaTotal));
        valorProvisao = perdaTotal - valorZeragemInvestimento;
        equityValue = 0;
        adjustment = adjustmentBruto;

        // NOVO 25/09/2026: saldo anterior/apos da conta de provisao, para
        // exibir na tela junto do valor que vai pra la (transparencia do
        // calculo, a pedido do usuario).
        const provisionRaw = await this.saldoContabilInvestimento(companyId, provisionAccountId, null, referenceDate);
        const provisionAccount = await this.prisma.chartOfAccounts.findUnique({ where: { id: provisionAccountId }, select: { nature: true } });
        const sinal = provisionAccount?.nature === 'CREDIT' ? -1 : 1;
        previousProvisionBalance = provisionRaw * sinal;
        provisionBalanceAfter = previousProvisionBalance + valorProvisao;
      } else {
        equityValue = 0;
        adjustment = -previousBookValue;
      }
    }

    return {
      investment: investimento,
      referenceDate: referenceDateStr,
      investeeYear: ano,
      investeeYearClosed,
      investeePl,
      investeePlBase,
      percentApplied: percent,
      equityValue,
      previousBookValue,
      adjustment,
      adjustmentBruto,
      limitadoZero,
      valorZeragemInvestimento,
      valorProvisao,
      previousProvisionBalance,
      provisionBalanceAfter,
    };
  }

  async lancar(companyId: string, userId: string, investmentId: string, referenceDateStr: string) {
    const preview = await this.calcular(companyId, investmentId, referenceDateStr);
    const { investment, adjustment } = preview;
    const referenceDate = new Date(referenceDateStr + 'T00:00:00Z');

    if (!preview.investeeYearClosed) {
      throw new BadRequestException(`${preview.investeeYear} não foi Encerrado na Investida!!!`);
    }

    if (Math.abs(adjustment) < 0.005) {
      throw new BadRequestException('Ajuste calculado é zero — nenhum lançamento a gerar.');
    }

    const existente = await this.prisma.equityMethodCalculation.findUnique({
      where: { investmentId_referenceDate: { investmentId, referenceDate } },
    });
    if (existente) {
      throw new BadRequestException('Já existe uma apuração de Equivalência Patrimonial para esta data.');
    }

    const ganho = adjustment > 0;
    const valorAbs = Math.abs(adjustment);
    const empresaInvestida = investment.investeeCompany.legalName || investment.investeeCompany.tradeName;
    const descricao = `Ajuste de Equivalência Patrimonial - ${empresaInvestida} - ${referenceDateStr.split('-').reverse().join('/')}`;

    // NOVO 25/09/2026: perda que excede o saldo do investimento, com conta
    // de provisao configurada - divide o credito entre zerar o investimento
    // (se sobrar algo) e constituir/aumentar a provisao pelo restante.
    const temSplitProvisao = !ganho && preview.valorProvisao !== null && preview.valorProvisao !== undefined && preview.valorProvisao > 0.005;
    const items = temSplitProvisao
      ? [
          { accountId: investment.lossAccountId, type: 'DEBIT' as const, value: valorAbs },
          ...(preview.valorZeragemInvestimento && preview.valorZeragemInvestimento > 0.005
            ? [{ accountId: investment.investmentAccountId, type: 'CREDIT' as const, value: preview.valorZeragemInvestimento }]
            : []),
          { accountId: (investment as any).provisionAccountId, type: 'CREDIT' as const, value: preview.valorProvisao! },
        ]
      : ganho
        ? [
            { accountId: investment.investmentAccountId, type: 'DEBIT' as const, value: valorAbs },
            { accountId: investment.gainAccountId, type: 'CREDIT' as const, value: valorAbs },
          ]
        : [
            { accountId: investment.lossAccountId, type: 'DEBIT' as const, value: valorAbs },
            { accountId: investment.investmentAccountId, type: 'CREDIT' as const, value: valorAbs },
          ];

    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        date: referenceDate,
        description: descricao,
        sourceModule: 'INVESTMENT',
        createdById: userId,
        items: { create: items },
      },
    });

    const calculo = await this.prisma.equityMethodCalculation.create({
      data: {
        investmentId,
        referenceDate,
        investeePl: preview.investeePl,
        percentApplied: preview.percentApplied,
        equityValue: preview.equityValue,
        previousBookValue: preview.previousBookValue,
        adjustment,
        journalEntryId: journalEntry.id,
        createdById: userId,
      },
    });

    return { calculo, journalEntry };
  }

  async historico(companyId: string, investmentId: string) {
    await this.getInvestimentoOuFalha(companyId, investmentId);
    return this.prisma.equityMethodCalculation.findMany({
      where: { investmentId },
      orderBy: { referenceDate: 'desc' },
      include: { journalEntry: { select: { id: true, date: true, description: true } } },
    });
  }

  // NOVO (18/09/2026): reverte um calculo de Equivalencia Patrimonial ja
  // gravado - apaga o lancamento contabil (soft-delete) E o registro de
  // apuracao (equity_method_calculations tem chave unica por investmentId+
  // referenceDate, entao apagar so o lancamento pelo Diario deixava o
  // registro de apuracao orfao, bloqueando um novo calculo pra mesma data
  // com "Ja existe uma apuracao para esta data"). Achado real: PL da
  // investida calculado incorretamente durante uma janela de manutencao do
  // Plano de Contas dela, gerando baixa total indevida do investimento.
  async reverter(companyId: string, investmentId: string, referenceDateStr: string) {
    await this.getInvestimentoOuFalha(companyId, investmentId);
    const referenceDate = new Date(referenceDateStr + 'T00:00:00Z');

    const calculo = await this.prisma.equityMethodCalculation.findUnique({
      where: { investmentId_referenceDate: { investmentId, referenceDate } },
    });
    if (!calculo) {
      throw new BadRequestException('Não há apuração de Equivalência Patrimonial gravada para esta data.');
    }

    await this.prisma.journalEntry.update({
      where: { id: calculo.journalEntryId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.equityMethodCalculation.delete({
      where: { id: calculo.id },
    });

    return { revertido: true };
  }
}
