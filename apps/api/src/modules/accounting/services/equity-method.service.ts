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
    let pl = 0;
    for (const b of balances as any[]) {
      const acc = b.account;
      if (acc.type === 'EQUITY' && acc.level === 1) {
        pl += acc.nature === 'CREDIT' ? -b.currentBalance : b.currentBalance;
      }
    }
    return pl;
  }

  private async saldoContabilInvestimento(companyId: string, accountId: string, referenceDate: Date) {
    const beginning = new Date(Date.UTC(1900, 0, 1));
    const { balances } = await this.trialBalance.getVerificationBalance(companyId, beginning, referenceDate);
    const linha = (balances as any[]).find(b => b.account.id === accountId);
    return linha ? linha.currentBalance : 0;
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

  async calcular(companyId: string, investmentId: string, referenceDateStr: string) {
    const investimento = await this.getInvestimentoOuFalha(companyId, investmentId);
    const referenceDate = new Date(referenceDateStr + 'T23:59:59Z');
    const ano = referenceDate.getUTCFullYear();

    const investeeYearClosed = await this.anoEncerradoNaInvestida(investimento.investeeCompanyId, ano);

    const investeePl = await this.calcularPLInvestida(investimento.investeeCompanyId, referenceDate);
    const percent = Number(investimento.percentOwned);
    const equityValue = investeePl * (percent / 100);
    const previousBookValue = await this.saldoContabilInvestimento(companyId, investimento.investmentAccountId, referenceDate);
    const adjustment = equityValue - previousBookValue;

    return {
      investment: investimento,
      referenceDate: referenceDateStr,
      investeeYear: ano,
      investeeYearClosed,
      investeePl,
      percentApplied: percent,
      equityValue,
      previousBookValue,
      adjustment,
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

    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        companyId,
        date: referenceDate,
        description: descricao,
        sourceModule: 'INVESTMENT',
        createdById: userId,
        items: {
          create: ganho
            ? [
                { accountId: investment.investmentAccountId, type: 'DEBIT', value: valorAbs },
                { accountId: investment.gainAccountId, type: 'CREDIT', value: valorAbs },
              ]
            : [
                { accountId: investment.lossAccountId, type: 'DEBIT', value: valorAbs },
                { accountId: investment.investmentAccountId, type: 'CREDIT', value: valorAbs },
              ],
        },
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
}
