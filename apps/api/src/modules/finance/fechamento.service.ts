// apps/api/src/modules/finance/fechamento.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FechamentoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Buscar ou criar fechamento ────────────────────────────────────────────

  async getOrCreate(companyId: string, competencia: string) {
    let fechamento = await this.prisma.fechamentoMensal.findUnique({
      where: { companyId_competencia: { companyId, competencia } },
      include: { itens: { orderBy: { modulo: 'asc' } } },
    });
    if (!fechamento) {
      fechamento = await this.prisma.fechamentoMensal.create({
        data: { companyId, competencia, status: 'ABERTO' },
        include: { itens: { orderBy: { modulo: 'asc' } } },
      });
    }
    return fechamento;
  }

  async findAll(companyId: string) {
    return this.prisma.fechamentoMensal.findMany({
      where: { companyId },
      include: { itens: true },
      orderBy: { competencia: 'desc' },
    });
  }

  // ── Calcular itens do fechamento ──────────────────────────────────────────

  async calcular(companyId: string, competencia: string) {
    const fechamento = await this.getOrCreate(companyId, competencia);
    if (fechamento.status === 'FECHADO') {
      throw new BadRequestException('Competencia fechada. Reabra para recalcular.');
    }

    const [y, m] = competencia.split('-').map(Number);
    const dataIni = new Date(Date.UTC(y, m - 1, 1));
    const dataFim = new Date(Date.UTC(y, m, 0, 23, 59, 59));

    const itens: any[] = [];

    // 1. PROVISOES
    const provisoes = await this.prisma.provisaoLancamento.findMany({
      where: { companyId, competencia },
      include: { provisao: true },
    });
    const totalProvisoes = provisoes.reduce((s, p) => s + Number(p.valor), 0);
    if (totalProvisoes > 0 || provisoes.length > 0) {
      itens.push({
        modulo: 'PROVISOES',
        descricao: `Provisões recorrentes (${provisoes.length} itens)`,
        valorCalculado: totalProvisoes,
        status: provisoes.length > 0 ? 'PENDENTE' : 'IGNORADO',
      });
    }

    // 2. PRO_LABORE
    const proLabore = await this.prisma.proLaboreCalculo.findMany({
      where: { companyId, competencia },
      include: { config: { include: { person: true } } },
    });
    const totalProLabore = proLabore.reduce((s, p) => s + Number(p.inssEmpresa), 0);
    if (proLabore.length > 0) {
      itens.push({
        modulo: 'PRO_LABORE',
        descricao: `Pró-labore (${proLabore.length} diretor(es))`,
        valorCalculado: proLabore.reduce((s, p) => s + Number(p.valorBruto) + Number(p.inssEmpresa), 0),
        status: proLabore.every(p => p.journalEntryId) ? 'GERADO' : 'PENDENTE',
      });
    }

    // 3. RENDA_FIXA
    const rendaFixa = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        sourceModule: 'INVESTMENT',
        date: { gte: dataIni, lte: dataFim },
        deletedAt: null,
      },
      include: { items: true },
    });
    const totalRendaFixa = rendaFixa.reduce((s, e) =>
      s + e.items.filter(i => i.type === 'DEBIT').reduce((ss, i) => ss + Number(i.value), 0), 0);
    if (rendaFixa.length > 0) {
      itens.push({
        modulo: 'RENDA_FIXA',
        descricao: `Renda fixa (${rendaFixa.length} lançamentos)`,
        valorCalculado: totalRendaFixa,
        status: 'GERADO',
      });
    }

    // 4. DEPRECIACAO
    const deprec = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        sourceModule: 'ASSET',
        date: { gte: dataIni, lte: dataFim },
        deletedAt: null,
      },
      include: { items: true },
    });
    const totalDepreciac = deprec.reduce((s, e) =>
      s + e.items.filter(i => i.type === 'DEBIT').reduce((ss, i) => ss + Number(i.value), 0), 0);
    if (totalDepreciac > 0) {
      itens.push({
        modulo: 'DEPRECIACAO',
        descricao: `Depreciação (${deprec.length} lançamentos)`,
        valorCalculado: totalDepreciac,
        status: 'GERADO',
      });
    }

    // 5. PIS_COFINS — calcular sobre receitas do mes
    const receitas = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        date: { gte: dataIni, lte: dataFim },
        deletedAt: null,
      },
      include: {
        items: {
          include: { account: true },
        },
      },
    });
    // Receitas = contas de natureza CREDIT no grupo 3
    let baseReceitas = 0;
    for (const entry of receitas) {
      for (const item of entry.items) {
        if (item.account.code.startsWith('3') && item.type === 'CREDIT') {
          baseReceitas += Number(item.value);
        }
      }
    }
    // Creditos PIS/COFINS das provisoes
    const creditosPis    = provisoes.reduce((s, p) => s + Number(p.valorPis), 0);
    const creditosCofins = provisoes.reduce((s, p) => s + Number(p.valorCofins), 0);
    const basePis    = Math.max(0, baseReceitas - creditosPis);
    const baseCofins = Math.max(0, baseReceitas - creditosCofins);
    const valPis    = Math.round(basePis    * 0.0165 * 100) / 100;
    const valCofins = Math.round(baseCofins * 0.076  * 100) / 100;

    itens.push({
      modulo: 'PIS_COFINS',
      descricao: `PIS (1,65%) R$ ${valPis.toFixed(2)} + COFINS (7,6%) R$ ${valCofins.toFixed(2)} — base R$ ${baseReceitas.toFixed(2)}`,
      valorCalculado: valPis + valCofins,
      status: 'PENDENTE',
      obs: JSON.stringify({ baseReceitas, creditosPis, creditosCofins, valPis, valCofins }),
    });

    // 6. IRPJ_CSLL — estimativa mensal Lucro Real
    // Base = Receitas - Despesas dedutíveis
    let totalDespesas = 0;
    for (const entry of receitas) {
      for (const item of entry.items) {
        if (item.account.code.startsWith('4') && item.type === 'DEBIT') {
          totalDespesas += Number(item.value);
        }
      }
    }
    const lucroEstimado = Math.max(0, baseReceitas - totalDespesas);
    const irpj  = Math.round(lucroEstimado * 0.15  * 100) / 100;
    const adicIR = Math.round(Math.max(0, lucroEstimado - 20000) * 0.10 * 100) / 100;
    const csll  = Math.round(lucroEstimado * 0.09  * 100) / 100;

    itens.push({
      modulo: 'IRPJ_CSLL',
      descricao: `IRPJ 15% R$ ${irpj.toFixed(2)} + Adicional 10% R$ ${adicIR.toFixed(2)} + CSLL 9% R$ ${csll.toFixed(2)} — lucro estimado R$ ${lucroEstimado.toFixed(2)}`,
      valorCalculado: irpj + adicIR + csll,
      status: 'PENDENTE',
      obs: JSON.stringify({ baseReceitas, totalDespesas, lucroEstimado, irpj, adicIR, csll }),
    });

    // Salvar itens — upsert por modulo
    for (const item of itens) {
      const existing = await this.prisma.fechamentoItem.findFirst({
        where: { fechamentoId: fechamento.id, modulo: item.modulo },
      });
      if (existing) {
        await this.prisma.fechamentoItem.update({
          where: { id: existing.id },
          data: { ...item, status: existing.status === 'GERADO' ? 'GERADO' : item.status },
        });
      } else {
        await this.prisma.fechamentoItem.create({
          data: { ...item, fechamentoId: fechamento.id },
        });
      }
    }

    return this.getOrCreate(companyId, competencia);
  }

  // ── Conferir item ─────────────────────────────────────────────────────────

  async conferirItem(itemId: string, userId: string, dto: { valorConfirmado?: number; obs?: string }) {
    return this.prisma.fechamentoItem.update({
      where: { id: itemId },
      data: {
        status: 'CONFERIDO',
        valorConfirmado: dto.valorConfirmado,
        obs: dto.obs,
        conferidoPorId: userId,
        conferidoEm: new Date(),
      },
    });
  }

  async ignorarItem(itemId: string) {
    return this.prisma.fechamentoItem.update({
      where: { id: itemId },
      data: { status: 'IGNORADO' },
    });
  }

  // ── Fechar mes ────────────────────────────────────────────────────────────

  async fecharMes(companyId: string, competencia: string, userId: string, opcoes?: { motivoMesCorrente?: string; confirmarPrevio?: boolean }) {
    const fechamento = await this.getOrCreate(companyId, competencia);
    const pendentes = fechamento.itens.filter(i => i.status === 'PENDENTE');
    if (pendentes.length > 0) {
      throw new BadRequestException(`Existem ${pendentes.length} item(ns) pendentes de conferência.`);
    }

    // Validar mes corrente
    const now = new Date();
    const mesCorrente = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const isMesCorrente = competencia === mesCorrente;
    if (isMesCorrente && !opcoes?.motivoMesCorrente) {
      throw new BadRequestException('MES_CORRENTE_SEM_MOTIVO');
    }

    // Verificar mes anterior
    const [y, m] = competencia.split('-').map(Number);
    const mesAnterior = m === 1
      ? `${y-1}-12`
      : `${y}-${String(m-1).padStart(2,'0')}`;

    const anterior = await this.prisma.fechamentoMensal.findUnique({
      where: { companyId_competencia: { companyId, competencia: mesAnterior } },
    });
    const previoAberto = !anterior || anterior.status === 'ABERTO' || anterior.status === 'REABERTO';

    if (previoAberto && !opcoes?.confirmarPrevio) {
      throw new BadRequestException('MES_ANTERIOR_ABERTO');
    }

    const isFechamentoPrevio = previoAberto && opcoes?.confirmarPrevio;

    await this.prisma.fechamentoMensal.update({
      where: { id: fechamento.id },
      data: {
        status: isFechamentoPrevio ? 'FECHADO_PREVIO' : 'FECHADO',
        fechadoEm: new Date(),
        fechadoPorId: userId,
        motivoReabertura: isFechamentoPrevio
          ? `Fechamento prévio — mês anterior (${mesAnterior}) não fechado. ${opcoes?.motivoMesCorrente ?? ''}`
          : opcoes?.motivoMesCorrente ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: isFechamentoPrevio ? 'FECHAMENTO_PREVIO' : isMesCorrente ? 'FECHAMENTO_MES_CORRENTE' : 'FECHAMENTO_MES',
        targetId: `${companyId}:${competencia}`,
        after: { status: 'FECHADO', competencia, isMesCorrente, isFechamentoPrevio, motivo: opcoes?.motivoMesCorrente },
      },
    });

    return {
      ok: true,
      isFechamentoPrevio,
      isMesCorrente,
      message: `Competência ${competencia} fechada${isFechamentoPrevio ? ' (Fechamento Prévio — mês anterior em aberto)' : ''}.`,
    };
  }

  // ── Reabrir mes ───────────────────────────────────────────────────────────

  async reabrirMes(companyId: string, competencia: string, userId: string, motivo: string) {
    if (!motivo?.trim()) throw new BadRequestException('Motivo de reabertura obrigatório.');

    // Reabrir este mes
    await this.prisma.fechamentoMensal.update({
      where: { companyId_competencia: { companyId, competencia } },
      data: {
        status: 'REABERTO',
        reabertoEm: new Date(),
        reabertoForId: userId,
        motivoReabertura: motivo,
      },
    });

    // Cascata: meses posteriores fechados voltam para REABERTO
    const posteriores = await this.prisma.fechamentoMensal.findMany({
      where: {
        companyId,
        competencia: { gt: competencia },
        status: 'FECHADO',
      },
    });

    if (posteriores.length > 0) {
      await this.prisma.fechamentoMensal.updateMany({
        where: {
          companyId,
          competencia: { gt: competencia },
          status: 'FECHADO',
        },
        data: { status: 'REABERTO', reabertoEm: new Date(), reabertoForId: userId, motivoReabertura: `Cascata de reabertura de ${competencia}` },
      });
    }

    // AuditLog
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'REABERTURA_MES',
        targetId: `${companyId}:${competencia}`,
        after: { status: 'REABERTO', competencia, motivo, cascata: posteriores.length },
      },
    });

    return { ok: true, message: `Competência ${competencia} reaberta. ${posteriores.length > 0 ? `${posteriores.length} mês(es) posterior(es) também reaberto(s).` : ''}` };
  }

  // ── Verificar se mes esta fechado (usado nos guards) ──────────────────────

  async isFechado(companyId: string, competencia: string): Promise<boolean> {
    const f = await this.prisma.fechamentoMensal.findUnique({
      where: { companyId_competencia: { companyId, competencia } },
    });
    return f?.status === 'FECHADO';
  }
}
