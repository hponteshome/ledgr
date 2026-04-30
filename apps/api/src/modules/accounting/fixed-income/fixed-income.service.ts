// apps/api/src/modules/accounting/fixed-income/fixed-income.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateFixedIncomeDto, UpdateFixedIncomeDto,
  MonthlyUpdateDto, RedemptionDto, ProjectionParamsDto,
} from './dto/fixed-income.dto';

// ── Tabela regressiva IRRF (Instrução Normativa SRF 487/2004) ─────────────────
// Aplicada sobre o rendimento bruto acumulado no resgate
const IRRF_TABLE = [
  { maxDays: 180,  rate: 0.225 },
  { maxDays: 360,  rate: 0.200 },
  { maxDays: 720,  rate: 0.175 },
  { maxDays: Infinity, rate: 0.150 },
];

function irrfRate(calendarDays: number): number {
  return IRRF_TABLE.find(t => calendarDays <= t.maxDays)!.rate;
}

function calendarDaysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function lastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0); // day=0 → último dia do mês anterior
}

function toDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

// ── Linha de projeção mensal ──────────────────────────────────────────────────
export interface ProjectionLine {
  competence: string;        // "2024-01"
  calendarDays: number;      // dias corridos desde aplicação
  indexerRate: number;       // taxa mensal aplicada (ex: 0.009280)
  grossYield: number;        // rendimento bruto do período
  grossBalance: number;      // saldo bruto acumulado
  accumulatedYield: number;  // rendimento bruto acumulado total
  irrfRate: number;          // alíquota IRRF pelo prazo
  irrfOnRedemption: number;  // IRRF total se resgatasse nesta data
  netBalance: number;        // saldo líquido (bruto − IRRF acumulado)
  isProjected: boolean;      // false = dado real; true = projeção
  isRedemption?: boolean;    // true = evento de resgate nesta competência
  redemptionGross?: number;
  redemptionIrrf?: number;
  redemptionNet?: number;
}

@Injectable()
export class FixedIncomeService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD básico
  // ═══════════════════════════════════════════════════════════════════════════

  async findAll(companyId: string) {
    return this.prisma.fixedIncomeInvestment.findMany({
      where: { companyId, deletedAt: null },
      include: { events: { orderBy: { eventDate: 'desc' }, take: 1 } },
      orderBy: { applicationDate: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const inv = await this.prisma.fixedIncomeInvestment.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        events: { orderBy: { eventDate: 'asc' } },
        rates:  { orderBy: { competence: 'asc' } },
      },
    });
    if (!inv) throw new NotFoundException('Investimento não encontrado');
    return inv;
  }

  async create(companyId: string, createdById: string, dto: CreateFixedIncomeDto) {
    return this.prisma.fixedIncomeInvestment.create({
      data: {
        companyId,
        description:     dto.description,
        type:            dto.type as any,
        issuerName:      dto.issuerName,
        issuerCnpj:      dto.issuerCnpj,
        externalCode:    dto.externalCode,
        indexer:         dto.indexer as any,
        indexerRate:     dto.indexerRate,
        fixedRate:       dto.fixedRate,
        capitalInitial:  dto.capitalInitial,
        capitalCurrent:  dto.capitalInitial,
        capitalBalance:  dto.capitalInitial,
        applicationDate: toDate(dto.applicationDate),
        maturityDate:    toDate(dto.maturityDate),
        irrfExempt:      dto.irrfExempt ?? false,
        assetAccountId:  dto.assetAccountId || null,
        revenueAccountId: dto.revenueAccountId || null,
        irrfAccountId:   dto.irrfAccountId || null,
        notes:           dto.notes,
        // evento inicial de aplicação
        events: {
          create: {
            companyId,
            eventType:    'APLICACAO',
            eventDate:    toDate(dto.applicationDate),
            grossAmount:  0,
            netAmount:    0,
            irrfAmount:   0,
            balanceAfter: dto.capitalInitial,
            notes:        `Aplicação inicial — ${dto.issuerName}`,
          },
        },
      },
    });
  }

  async softDelete(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.fixedIncomeInvestment.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELADO' as any },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ATUALIZAÇÃO MENSAL (regime de competência — Lucro Real)
  // ═══════════════════════════════════════════════════════════════════════════

  async applyMonthlyUpdate(
    id: string, companyId: string, createdById: string, dto: MonthlyUpdateDto,
  ) {
    const inv = await this.findOne(id, companyId);

    // Idempotência: impede dupla atualização da mesma competência
    const existing = await this.prisma.fixedIncomeMonthlyRate.findUnique({
      where: { investmentId_competence: { investmentId: id, competence: dto.competence } },
    });
    if (existing) throw new BadRequestException(`Competência ${dto.competence} já atualizada`);

    const appDate       = new Date(inv.applicationDate);
    const [yyyy, mm]    = dto.competence.split('-').map(Number);
    const fimMes        = lastDayOfMonth(yyyy, mm);
    const dias          = calendarDaysBetween(appDate, fimMes);
    const aliq          = inv.irrfExempt ? 0 : irrfRate(dias);
    const indiceAplic   = dto.indexerRate * (Number(inv.indexerRate) / 100);
    const rendBruto     = Number(inv.capitalCurrent) * indiceAplic;
    const novoSaldo     = Number(inv.capitalCurrent) + rendBruto;
    const rendAcum      = novoSaldo - Number(inv.capitalInitial);
    const irrfTotal     = rendAcum * aliq;
    const saldoLiq      = novoSaldo - irrfTotal;

    return this.prisma.$transaction(async tx => {
      // 1. Salvar taxa mensal
      await tx.fixedIncomeMonthlyRate.create({
        data: {
          investmentId: id, companyId,
          competence:   dto.competence,
          indexerRate:  dto.indexerRate,
          businessDays: dto.businessDays,
          calendarDays: dto.calendarDays ?? dias,
        },
      });

      // 2. Evento de atualização de competência
      const event = await tx.fixedIncomeEvent.create({
        data: {
          investmentId: id, companyId,
          eventType:    'ATUALIZACAO_SALDO',
          eventDate:    fimMes,
          competence:   dto.competence,
          grossAmount:  rendBruto,
          netAmount:    rendBruto * (1 - aliq), // aproximação — IRRF é sobre acumulado
          irrfAmount:   irrfTotal - Number(inv.irrfAccumulated), // delta IRRF do período
          irrfRate:     aliq,
          balanceAfter: novoSaldo,
          notes:        dto.journalDescription ?? `Atualização CDB — ${dto.competence}`,
        },
      });

      // 3. Atualizar saldo no investimento
      const updated = await tx.fixedIncomeInvestment.update({
        where: { id },
        data: {
          capitalCurrent:  novoSaldo,
          irrfAccumulated: irrfTotal,
          lastUpdateDate:  fimMes,
        },
      });

      // 4. Lançamento contábil (opcional)
      let journalEntry = null;
      if (dto.generateJournalEntry && inv.revenueAccountId && inv.assetAccountId) {
        journalEntry = await tx.journalEntry.create({
          data: {
            companyId,
            date:         fimMes,
            description:  `Receita financeira CDB — ${inv.issuerName} — ${dto.competence}`,
            sourceModule: 'ACCOUNTING',
            createdById,
            items: {
              create: [
                // Débito: Ativo (CDB a receber aumenta)
                { accountId: inv.assetAccountId!, value: rendBruto, type: 'DEBIT' },
                // Crédito: Receita financeira
                { accountId: inv.revenueAccountId!, value: rendBruto, type: 'CREDIT' },
                // Débito: IRRF a recuperar (antecipação de IRPJ/CSLL no Lucro Real)
                ...(inv.irrfAccountId ? [
                  { accountId: inv.irrfAccountId, value: irrfTotal - Number(inv.irrfAccumulated), type: 'DEBIT' as any },
                ] : []),
              ],
            },
          },
        });

        await tx.fixedIncomeEvent.update({
          where: { id: event.id },
          data: { journalEntryId: journalEntry.id },
        });
      }

      return { event, updated, journalEntry };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESGATE (antecipado ou no vencimento)
  // ═══════════════════════════════════════════════════════════════════════════

  async applyRedemption(
    id: string, companyId: string, createdById: string, dto: RedemptionDto,
  ) {
    const inv = await this.findOne(id, companyId);
    if (inv.status === 'RESGATADO' || inv.status === 'CANCELADO') {
      throw new BadRequestException('Investimento já encerrado');
    }

    const redemptionDate  = toDate(dto.redemptionDate);
    const appDate         = new Date(inv.applicationDate);
    const dias            = calendarDaysBetween(appDate, redemptionDate);
    const aliq            = inv.irrfExempt ? 0 : irrfRate(dias);

    // Valores informados pelo usuario (extrato bancario)
    const principalResg   = Number(dto.redemptionPrincipal ?? 0);
    const rendBrutoResg   = Number(dto.redemptionYield ?? 0);   // bruto calculado pelo frontend
    const irrfResg        = Number(dto.irrfAmount ?? (rendBrutoResg * aliq));
    const rendLiqResg     = rendBrutoResg - irrfResg;
    const valorBrutoResg  = principalResg + rendBrutoResg;
    const valorLiqResg    = Number(dto.netAmount ?? (principalResg + rendLiqResg));

    const saldoBrutoAtual = Number(inv.capitalCurrent);
    const isTotal         = dto.isTotal || (principalResg >= Number(inv.capitalBalance ?? inv.capitalInitial) - 0.01);
    const saldoRestante   = isTotal ? 0 : Math.max(0, saldoBrutoAtual - valorBrutoResg);
    const capitalRestante = isTotal ? 0 : Math.max(0, Number(inv.capitalBalance ?? inv.capitalInitial) - principalResg);

    const eventType = isTotal ? 'RESGATE_VENCIMENTO' : 'RESGATE_ANTECIPADO';
    const novoStatus = isTotal ? 'RESGATADO' : 'ATIVO';

    return this.prisma.$transaction(async tx => {
      const event = await tx.fixedIncomeEvent.create({
        data: {
          investmentId:       id,
          companyId,
          eventType:          eventType as any,
          eventDate:          redemptionDate,
          competence:         `${redemptionDate.getFullYear()}-${String(redemptionDate.getMonth()+1).padStart(2,'0')}`,
          grossAmount:        valorBrutoResg,
          netAmount:          valorLiqResg,
          irrfAmount:         irrfResg,
          irrfRate:           aliq,
          balanceAfter:       saldoRestante,
          redemptionPrincipal: principalResg,
          redemptionYield:    rendBrutoResg,
          redemptionTotal:    valorLiqResg,
          notes:              dto.notes ?? (isTotal ? 'Resgate total' : 'Resgate parcial'),
        },
      });

      const updated = await tx.fixedIncomeInvestment.update({
        where: { id },
        data: {
          capitalCurrent:  Math.max(saldoRestante, capitalRestante),
          capitalBalance:  capitalRestante,
          totalRedeemed:   Number(inv.totalRedeemed ?? 0) + valorLiqResg,
          totalRedeemedPrincipal: Number(inv.totalRedeemedPrincipal ?? 0) + principalResg,
          irrfAccumulated: Number(inv.irrfAccumulated ?? 0) + irrfResg,
          status:          novoStatus as any,
          lastUpdateDate:  redemptionDate,
        },
      });

      return {
        event,
        updated,
        summary: {
          grossRedemption: valorBrutoResg,
          principalRedeemed: principalResg,
          yieldRedeemed: rendBrutoResg,
          irrfRetained: irrfResg,
          netReceived: valorLiqResg,
          effectiveRate: aliq,
          calendarDays: dias,
          remainingBalance: saldoRestante,
        },
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROJEÇÃO — motor de simulação
  // ═══════════════════════════════════════════════════════════════════════════

  async buildProjection(
    id: string, companyId: string, params: ProjectionParamsDto,
  ): Promise<ProjectionLine[]> {
    const inv = await this.findOne(id, companyId);
    const rates = inv.rates as any[]; // taxas reais já registradas

    const appDate     = new Date(inv.applicationDate);
    const matDate     = params.projectionUntil
                        ? toDate(params.projectionUntil)
                        : new Date(inv.maturityDate);
    const projRate    = params.projectedMonthlyRate ?? 0.0095; // default 0,95% a.m.
    const pctIndexer  = Number(inv.indexerRate) / 100;

    // Resgates parciais agendados na projeção
    const redemptions = (params.partialRedemptions ?? []).map(r => ({
      date: toDate(r.date),
      amount: r.amount,
    }));

    const lines: ProjectionLine[] = [];
    let saldoBruto     = Number(inv.capitalInitial);
    let capitalBase    = Number(inv.capitalInitial);
    let rendAcum       = 0;
    let irrfAcumPrev   = 0;

    // Começa no mês da aplicação
    let cursor = new Date(appDate.getFullYear(), appDate.getMonth(), 1);

    while (true) {
      const yyyy   = cursor.getFullYear();
      const mm     = cursor.getMonth() + 1;
      const comp   = `${yyyy}-${String(mm).padStart(2,'0')}`;
      const fimMes = lastDayOfMonth(yyyy, mm);

      if (fimMes > matDate) break;

      // Taxa real ou projetada
      const rateRecord = rates.find((r: any) => r.competence === comp);
      const isProjected = !rateRecord;
      const rawRate     = rateRecord ? Number(rateRecord.indexerRate) : projRate;
      const indiceAplic = rawRate * pctIndexer;

      const rendMes  = saldoBruto * indiceAplic;
      saldoBruto     = saldoBruto + rendMes;
      rendAcum       += rendMes;

      const dias    = calendarDaysBetween(appDate, fimMes);
      const aliq    = inv.irrfExempt ? 0 : irrfRate(dias);
      const irrfTot = rendAcum * aliq;
      const saldoLiq = saldoBruto - irrfTot;

      // Verificar resgate neste mês
      const redemption = redemptions.find(r =>
        r.date.getFullYear() === yyyy && r.date.getMonth() + 1 === mm
      );

      const line: ProjectionLine = {
        competence:       comp,
        calendarDays:     dias,
        indexerRate:      indiceAplic,
        grossYield:       rendMes,
        grossBalance:     saldoBruto,
        accumulatedYield: rendAcum,
        irrfRate:         aliq,
        irrfOnRedemption: irrfTot,
        netBalance:       saldoLiq,
        isProjected,
      };

      if (redemption) {
        const isTotal    = redemption.amount === 0 || redemption.amount >= saldoBruto;
        const prop       = isTotal ? 1 : Math.min(redemption.amount / saldoBruto, 1);
        const brutoResg  = saldoBruto * prop;
        const rendResg   = rendAcum * prop;
        const diasR      = calendarDaysBetween(appDate, redemption.date);
        const aliqR      = inv.irrfExempt ? 0 : irrfRate(diasR);
        const irrfResg   = rendResg * aliqR;

        line.isRedemption    = true;
        line.redemptionGross = brutoResg;
        line.redemptionIrrf  = irrfResg;
        line.redemptionNet   = brutoResg - irrfResg;

        saldoBruto   = isTotal ? 0 : saldoBruto - brutoResg;
        capitalBase  = isTotal ? 0 : capitalBase * (1 - prop);
        rendAcum     = isTotal ? 0 : rendAcum * (1 - prop);

        if (isTotal) { lines.push(line); break; }
      }

      lines.push(line);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return lines;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SIMULAÇÃO SEM PERSISTÊNCIA (endpoint público)
  // ═══════════════════════════════════════════════════════════════════════════

  async simulate(params: {
    capitalInitial: number;
    applicationDate: string;
    maturityDate: string;
    indexerRate: number;    // % do CDI (ex: 96)
    indexer: string;
    irrfExempt: boolean;
    projectedMonthlyRate: number;
    historicalRates: { competence: string; rate: number }[];
    partialRedemptions?: { date: string; amount: number }[];
  }): Promise<ProjectionLine[]> {
    const appDate    = toDate(params.applicationDate);
    const matDate    = toDate(params.maturityDate);
    const pctIndexer = params.indexerRate / 100;
    const projRate   = params.projectedMonthlyRate;

    const redemptions = (params.partialRedemptions ?? []).map(r => ({
      date: toDate(r.date), amount: r.amount,
    }));

    const lines: ProjectionLine[] = [];
    let saldoBruto = params.capitalInitial;
    let rendAcum   = 0;

    let cursor = new Date(appDate.getFullYear(), appDate.getMonth(), 1);

    while (true) {
      const yyyy   = cursor.getFullYear();
      const mm     = cursor.getMonth() + 1;
      const comp   = `${yyyy}-${String(mm).padStart(2,'0')}`;
      const fimMes = lastDayOfMonth(yyyy, mm);
      if (fimMes > matDate) break;

      const hist = params.historicalRates.find(h => h.competence === comp);
      const isProjected = !hist;
      const rawRate     = hist ? hist.rate : projRate;
      const indice      = rawRate * pctIndexer;

      const rendMes = saldoBruto * indice;
      saldoBruto    = saldoBruto + rendMes;
      rendAcum      += rendMes;

      const dias   = calendarDaysBetween(appDate, fimMes);
      const aliq   = params.irrfExempt ? 0 : irrfRate(dias);
      const irrfTot = rendAcum * aliq;
      const saldoLiq = saldoBruto - irrfTot;

      const redemption = redemptions.find(r =>
        r.date.getFullYear() === yyyy && r.date.getMonth() + 1 === mm
      );

      const line: ProjectionLine = {
        competence: comp, calendarDays: dias, indexerRate: indice,
        grossYield: rendMes, grossBalance: saldoBruto, accumulatedYield: rendAcum,
        irrfRate: aliq, irrfOnRedemption: irrfTot, netBalance: saldoLiq, isProjected,
      };

      if (redemption) {
        const isTotal   = redemption.amount === 0 || redemption.amount >= saldoBruto;
        const prop      = isTotal ? 1 : Math.min(redemption.amount / saldoBruto, 1);
        const brutoResg = saldoBruto * prop;
        const rendResg  = rendAcum * prop;
        const diasR     = calendarDaysBetween(appDate, redemption.date);
        const aliqR     = params.irrfExempt ? 0 : irrfRate(diasR);

        line.isRedemption    = true;
        line.redemptionGross = brutoResg;
        line.redemptionIrrf  = rendResg * aliqR;
        line.redemptionNet   = brutoResg - (rendResg * aliqR);

        saldoBruto = isTotal ? 0 : saldoBruto - brutoResg;
        rendAcum   = isTotal ? 0 : rendAcum * (1 - prop);
        if (isTotal) { lines.push(line); break; }
      }

      lines.push(line);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return lines;
  }
  async deleteEvent(invId: string, eventId: string, companyId: string) {
    const inv = await this.findOne(invId, companyId);
    const event = (inv.events as any[]).find((e: any) => e.id === eventId);
    if (!event) throw new NotFoundException('Evento nao encontrado');
    if (event.eventType === 'APLICACAO') throw new BadRequestException('Nao e possivel excluir o evento de aplicacao');
    const principal = Number(event.redemptionPrincipal ?? 0);
    const liquido = Number(event.netAmount ?? 0);
    await this.prisma.$transaction(async tx => {
      await tx.fixedIncomeEvent.delete({ where: { id: eventId } });
      await tx.fixedIncomeInvestment.update({
        where: { id: invId },
        data: {
          capitalBalance: { increment: principal },
          totalRedeemed: { decrement: liquido },
          totalRedeemedPrincipal: { decrement: principal },
          capitalCurrent: { increment: Number(event.grossAmount ?? 0) || liquido },
        },
      });
    });
  }

  async updateEvent(invId: string, eventId: string, companyId: string, dto: any) {
    await this.findOne(invId, companyId);
    return this.prisma.fixedIncomeEvent.update({
      where: { id: eventId },
      data: {
        eventDate: dto.redemptionDate ? new Date(dto.redemptionDate) : undefined,
        redemptionPrincipal: dto.redemptionPrincipal,
        redemptionYield: dto.redemptionYield,
        irrfAmount: dto.irrfAmount,
        netAmount: dto.netAmount,
        notes: dto.notes,
      },
    });
  }

  async updateInvestment(id: string, companyId: string, dto: any) {
    await this.findOne(id, companyId);
    return this.prisma.fixedIncomeInvestment.update({
      where: { id },
      data: {
        description: dto.description,
        capitalInitial: dto.capitalInitial ? Number(dto.capitalInitial) : undefined,
        capitalBalance: dto.capitalInitial ? Number(dto.capitalInitial) : undefined,
        issuerName: dto.issuerName,
        issuerCnpj: dto.issuerCnpj || null,
        indexer: dto.indexer,
        indexerRate: dto.indexerRate,
        maturityDate: dto.maturityDate ? new Date(dto.maturityDate) : undefined,
        irrfExempt: dto.irrfExempt,
        assetAccountId: dto.assetAccountId || null,
        revenueAccountId: dto.revenueAccountId || null,
        irrfAccountId: dto.irrfAccountId || null,
        notes: dto.notes,
      },
    });
  }

  async getSummary(companyId: string) {
    const investments = await this.prisma.fixedIncomeInvestment.findMany({
      where: { companyId, deletedAt: null, status: 'ATIVO' },
    });

    const totalCapitalInitial = investments.reduce((s, i) => s + Number(i.capitalInitial), 0);
    const totalCapitalBalance = investments.reduce((s, i) => s + Number((i as any).capitalBalance ?? i.capitalInitial), 0);
    const totalCapitalCurrent = investments.reduce((s, i) => s + Number(i.capitalCurrent), 0);
    const totalRedeemed = investments.reduce((s, i) => s + Number((i as any).totalRedeemed ?? 0), 0);
    const totalRedeemedPrincipal = investments.reduce((s, i) => s + Number((i as any).totalRedeemedPrincipal ?? 0), 0);

    // Rendimento por investimento (capitalCurrent - capitalBalance), apenas positivos
    const totalRendBruto = investments.reduce((s, i) => {
      const rend = Number(i.capitalCurrent) - Number((i as any).capitalBalance ?? i.capitalInitial);
      return s + Math.max(0, rend);
    }, 0);

    // IRRF acumulado real dos eventos de resgate
    const irrfAccum = investments.reduce((s, i) => s + Number(i.irrfAccumulated ?? 0), 0);
    // IRRF estimado sobre rendimento nao resgatado (15% - maioria passou 720 dias)
    const irrfEstimado = totalRendBruto * 0.15;
    const totalIrrf = irrfAccum + irrfEstimado;
    const totalSaldoLiq = totalCapitalCurrent - irrfEstimado;

    return {
      count: investments.length,
      totalCapitalInitial,
      totalCapitalBalance,
      totalCapitalCurrent,
      totalRendBruto,
      totalIrrf,
      totalSaldoLiq,
      totalRedeemed,
      totalRedeemedPrincipal,
    };
  }

}
