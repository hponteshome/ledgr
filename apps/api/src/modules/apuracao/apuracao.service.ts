// apps/api/src/modules/apuracao/apuracao.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ApuracaoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Busca resultado contabil do periodo (receitas - despesas) ──────────────
  async getResultadoContabil(companyId: string, competencia: string) {
    const [ano, mes] = competencia.split('-').map(Number);
    const ini = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    const rows = await this.prisma.journalEntryItem.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: { companyId, date: { gte: ini, lte: fim } },
        account: { type: { in: ['REVENUE', 'EXPENSE'] as any } },
      },
      _sum: { value: true },
    });

    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: rows.map(r => r.accountId) } },
      select: { id: true, type: true, nature: true, code: true, name: true },
    });

    const accMap = new Map(accounts.map(a => [a.id, a]));

    let receitas = 0, despesas = 0;
    const detalhes: any[] = [];

    for (const row of rows) {
      const acc = accMap.get(row.accountId);
      if (!acc) continue;
      const val = Number(row._sum.value ?? 0);
      const saldo = acc.nature === 'CREDIT' ? val : -val;
      if (acc.type === 'REVENUE') receitas += saldo;
      else despesas += Math.abs(saldo);
      detalhes.push({ ...acc, saldo: acc.type === 'REVENUE' ? saldo : -Math.abs(saldo) });
    }

    return { receitas, despesas, resultado: receitas - despesas, detalhes };
  }

  // ── Busca receitas brutas para PIS/COFINS ──────────────────────────────────
  async getReceitasBrutas(companyId: string, competencia: string) {
    const [ano, mes] = competencia.split('-').map(Number);
    const ini = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    const rows = await this.prisma.journalEntryItem.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: { companyId, date: { gte: ini, lte: fim } },
        account: { type: 'REVENUE' as any },
      },
      _sum: { value: true },
    });

    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: rows.map(r => r.accountId) } },
      select: { id: true, code: true, name: true, nature: true },
    });
    const accMap = new Map(accounts.map(a => [a.id, a]));

    let total = 0;
    const itens: any[] = [];
    for (const row of rows) {
      const acc = accMap.get(row.accountId);
      if (!acc) continue;
      const val = Number(row._sum.value ?? 0);
      total += val;
      itens.push({ accountId: row.accountId, code: acc.code, name: acc.name, valor: val });
    }
    return { total, itens };
  }

  // ── Calcular e salvar apuracao PIS/COFINS ──────────────────────────────────
  async calcularPisCofins(companyId: string, competencia: string, dto: any, userId: string) {
    const regime = dto.regime ?? 'LUCRO_REAL';
    const aliqPis    = regime === 'LUCRO_REAL' ? 0.0165 : 0.0065;
    const aliqCofins = regime === 'LUCRO_REAL' ? 0.076  : 0.03;

    const { total: receitaBruta } = await this.getReceitasBrutas(companyId, competencia);
    const receitaExcluida = Number(dto.receitaExcluida ?? 0);
    const base = receitaBruta - receitaExcluida;

    const creditosPis    = regime === 'LUCRO_REAL' ? Number(dto.creditosPis    ?? 0) : 0;
    const creditosCofins = regime === 'LUCRO_REAL' ? Number(dto.creditosCofins ?? 0) : 0;

    const pisBruto    = base * aliqPis;
    const cofinsBruto = base * aliqCofins;
    const pisDevido    = Math.max(0, pisBruto    - creditosPis);
    const cofinsDevido = Math.max(0, cofinsBruto - creditosCofins);

    return this.prisma.apuracaoImpostos.upsert({
      where: { companyId_competencia_tipo: { companyId, competencia, tipo: 'PIS_COFINS' as any } },
      create: {
        companyId, competencia, tipo: 'PIS_COFINS' as any, regime, status: 'APURADO' as any,
        receitaBruta: new Prisma.Decimal(receitaBruta.toFixed(2)),
        receitaExcluida: new Prisma.Decimal(receitaExcluida.toFixed(2)),
        baseCalculoPis: new Prisma.Decimal(base.toFixed(2)),
        baseCalculoCofins: new Prisma.Decimal(base.toFixed(2)),
        aliqPis: new Prisma.Decimal(aliqPis),
        aliqCofins: new Prisma.Decimal(aliqCofins),
        creditosPis: new Prisma.Decimal(creditosPis.toFixed(2)),
        creditosCofins: new Prisma.Decimal(creditosCofins.toFixed(2)),
        pisBruto: new Prisma.Decimal(pisBruto.toFixed(2)),
        cofinsBruto: new Prisma.Decimal(cofinsBruto.toFixed(2)),
        pisDevido: new Prisma.Decimal(pisDevido.toFixed(2)),
        cofinsDevido: new Prisma.Decimal(cofinsDevido.toFixed(2)),
        createdById: userId,
      },
      update: {
        regime, status: 'APURADO' as any,
        receitaBruta: new Prisma.Decimal(receitaBruta.toFixed(2)),
        receitaExcluida: new Prisma.Decimal(receitaExcluida.toFixed(2)),
        baseCalculoPis: new Prisma.Decimal(base.toFixed(2)),
        baseCalculoCofins: new Prisma.Decimal(base.toFixed(2)),
        aliqPis: new Prisma.Decimal(aliqPis),
        aliqCofins: new Prisma.Decimal(aliqCofins),
        creditosPis: new Prisma.Decimal(creditosPis.toFixed(2)),
        creditosCofins: new Prisma.Decimal(creditosCofins.toFixed(2)),
        pisBruto: new Prisma.Decimal(pisBruto.toFixed(2)),
        cofinsBruto: new Prisma.Decimal(cofinsBruto.toFixed(2)),
        pisDevido: new Prisma.Decimal(pisDevido.toFixed(2)),
        cofinsDevido: new Prisma.Decimal(cofinsDevido.toFixed(2)),
      },
    });
  }

  // ── Calcular e salvar apuracao IRPJ/CSLL ──────────────────────────────────
  async calcularIrpjCsll(companyId: string, competencia: string, dto: any, userId: string) {
    const regime = dto.regime ?? 'LUCRO_REAL';
    const { resultado } = await this.getResultadoContabil(companyId, competencia);

    let baseIrpj: number, baseCsll: number;
    let lucroReal: number | null = null;
    let basePresumidaIrpj: number | null = null;
    let basePresumidaCsll: number | null = null;

    if (regime === 'LUCRO_REAL') {
      const adicoes      = Number(dto.adicoes      ?? 0);
      const exclusoes    = Number(dto.exclusoes    ?? 0);
      const compensacoes = Number(dto.compensacoes ?? 0);
      lucroReal = resultado + adicoes - exclusoes;
      baseIrpj  = Math.max(0, lucroReal - compensacoes);
      baseCsll  = Math.max(0, lucroReal - compensacoes);
    } else {
      // Lucro Presumido
      const receitaBruta     = Number(dto.receitaBruta ?? 0);
      const percPresuncaoIrpj = Number(dto.percPresuncaoIrpj ?? 0.32);
      const percPresuncaoCsll = Number(dto.percPresuncaoCsll ?? 0.32);
      basePresumidaIrpj = receitaBruta * percPresuncaoIrpj;
      basePresumidaCsll = receitaBruta * percPresuncaoCsll;
      baseIrpj = basePresumidaIrpj;
      baseCsll = basePresumidaCsll;
    }

    // IRPJ: 15% + adicional 10% sobre excedente de R$ 20.000/mes
    const irpjBase      = baseIrpj * 0.15;
    const excedente     = Math.max(0, baseIrpj - 20000);
    const adicionalIrpj = excedente * 0.10;
    const irpjDevido    = irpjBase + adicionalIrpj;
    const csllDevida    = baseCsll * 0.09;

    const data: any = {
      companyId, competencia, tipo: 'IRPJ_CSLL' as any, regime, status: 'APURADO' as any,
      resultadoContabil: new Prisma.Decimal(resultado.toFixed(2)),
      adicoes:       new Prisma.Decimal((Number(dto.adicoes ?? 0)).toFixed(2)),
      exclusoes:     new Prisma.Decimal((Number(dto.exclusoes ?? 0)).toFixed(2)),
      compensacoes:  new Prisma.Decimal((Number(dto.compensacoes ?? 0)).toFixed(2)),
      lucroReal:     lucroReal != null ? new Prisma.Decimal(lucroReal.toFixed(2)) : null,
      basePresumidaIrpj: basePresumidaIrpj != null ? new Prisma.Decimal(basePresumidaIrpj.toFixed(2)) : null,
      basePresumidaCsll: basePresumidaCsll != null ? new Prisma.Decimal(basePresumidaCsll.toFixed(2)) : null,
      baseIrpj:      new Prisma.Decimal(baseIrpj.toFixed(2)),
      baseCsll:      new Prisma.Decimal(baseCsll.toFixed(2)),
      irpjDevido:    new Prisma.Decimal(irpjDevido.toFixed(2)),
      csllDevida:    new Prisma.Decimal(csllDevida.toFixed(2)),
      adicionalIrpj: new Prisma.Decimal(adicionalIrpj.toFixed(2)),
      createdById:   userId,
    };

    return this.prisma.apuracaoImpostos.upsert({
      where: { companyId_competencia_tipo: { companyId, competencia, tipo: 'IRPJ_CSLL' as any } },
      create: data,
      update: { ...data, createdById: undefined },
    });
  }

  // ── LALUR ─────────────────────────────────────────────────────────────────
  async getLalur(companyId: string, competencia: string) {
    return this.prisma.lalurItem.findMany({
      where: { companyId, competencia },
      orderBy: [{ tipo: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addLalurItem(companyId: string, competencia: string, dto: any, userId: string) {
    // Buscar ou criar apuracao IRPJ_CSLL
    let apuracao = await this.prisma.apuracaoImpostos.findFirst({
      where: { companyId, competencia, tipo: 'IRPJ_CSLL' as any },
    });
    if (!apuracao) {
      apuracao = await this.prisma.apuracaoImpostos.create({
        data: { companyId, competencia, tipo: 'IRPJ_CSLL' as any,
          regime: 'LUCRO_REAL', status: 'RASCUNHO' as any, createdById: userId },
      });
    }
    return this.prisma.lalurItem.create({
      data: {
        apuracaoId: apuracao.id, companyId, competencia,
        tipo: dto.tipo, imposto: dto.imposto ?? 'AMBOS',
        descricao: dto.descricao,
        valor: new Prisma.Decimal(Number(dto.valor).toFixed(2)),
        contaId: dto.contaId ?? null,
        observacao: dto.observacao ?? null,
      },
    });
  }

  async deleteLalurItem(companyId: string, id: string) {
    return this.prisma.lalurItem.deleteMany({ where: { id, companyId } });
  }

  // ── Listar apuracoes ───────────────────────────────────────────────────────
  async listar(companyId: string, ano?: string) {
    const where: any = { companyId };
    if (ano) where.competencia = { startsWith: ano };
    return this.prisma.apuracaoImpostos.findMany({
      where, orderBy: [{ competencia: 'desc' }, { tipo: 'asc' }],
      include: { lalurItens: true },
    });
  }

  async getByCompetencia(companyId: string, competencia: string) {
    const [pis, irpj, lalur, resultado, receitas] = await Promise.all([
      this.prisma.apuracaoImpostos.findFirst({ where: { companyId, competencia, tipo: 'PIS_COFINS' as any }, include: { lalurItens: true } }),
      this.prisma.apuracaoImpostos.findFirst({ where: { companyId, competencia, tipo: 'IRPJ_CSLL' as any }, include: { lalurItens: true } }),
      this.getLalur(companyId, competencia),
      this.getResultadoContabil(companyId, competencia),
      this.getReceitasBrutas(companyId, competencia),
    ]);
    return { pis, irpj, lalur, resultado, receitas };
  }
}
