import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// Multiplicadores por tipo de hora
function getMultiplicador(tipoHora: string, bh: any): number {
  switch (tipoHora) {
    case 'NORMAL':     return 1.00; // sem acrescimo -- compensacao simples 1:1
    case 'NOTURNA':    return Number(bh.multNoturno) * 1.50; // HE 50% + adicional noturno
    case 'FDS_SABADO': return Number(bh.multSabado);
    case 'FDS_DOMINGO':return Number(bh.multDomingo);
    case 'FERIADO':    return Number(bh.multFeriado);
    default:           return 1.50; // DIURNA — HE 50%
  }
}

function fmtMin(min: number): string {
  const abs = Math.abs(min);
  const h   = Math.floor(abs / 60);
  const m   = abs % 60;
  const sig = min < 0 ? '-' : '';
  return `${sig}${h}h${String(m).padStart(2,'0')}`;
}

@Injectable()
export class BancoHorasService {
  constructor(private prisma: PrismaService) {}

  // Garante que o registro BancoHoras existe para o funcionario
  private async ensureBH(tx: any, companyId: string, employeeId: string) {
    let bh = await tx.bancoHoras.findFirst({ where: { companyId, employeeId } });
    if (!bh) {
      bh = await tx.bancoHoras.create({
        data: { companyId, employeeId, saldoMinutos: 0, multNoturno: 1.20,
                multSabado: 1.50, multDomingo: 2.00, multFeriado: 2.00 },
      });
    }
    return bh;
  }

  // Credita horas extras com tipo e multiplicador automatico
  async creditar(companyId: string, employeeId: string, dto: {
    minutosOriginais: number;
    tipoHora:         string;
    data:             string;
    competencia:      string;
    descricao?:       string;
    folhaId?:         string;
  }, userId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const bh   = await this.ensureBH(tx, companyId, employeeId);
      const mult = getMultiplicador(dto.tipoHora, bh);
      const minutosConvertidos = Math.round(dto.minutosOriginais * mult);
      const saldoApos = bh.saldoMinutos + minutosConvertidos;

      await tx.bancoHorasLancamento.create({
        data: {
          bancoHorasId:     bh.id,
          companyId,
          employeeId,
          tipo:             'CREDITO',
          tipoHora:         dto.tipoHora as any,
          multiplicador:    new Decimal(mult.toFixed(2)),
          minutosOriginais: dto.minutosOriginais,
          minutos:          minutosConvertidos,
          saldoApos,
          data:             new Date(dto.data),
          competencia:      dto.competencia,
          descricao:        dto.descricao,
          folhaId:          dto.folhaId,
          createdById:      userId,
        },
      });
      await tx.bancoHoras.update({ where: { id: bh.id }, data: { saldoMinutos: saldoApos } });
      return { saldoApos, minutosConvertidos, multiplicador: mult, fmtSaldo: fmtMin(saldoApos) };
    });
  }

  // Debita horas (compensacao)
  async debitar(companyId: string, employeeId: string, dto: {
    minutos:     number;
    data:        string;
    competencia: string;
    descricao?:  string;
  }, userId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const bh = await this.ensureBH(tx, companyId, employeeId);
      if (bh.saldoMinutos < dto.minutos)
        throw new BadRequestException(`Saldo insuficiente: ${fmtMin(bh.saldoMinutos)}`);
      const saldoApos = bh.saldoMinutos - dto.minutos;
      await tx.bancoHorasLancamento.create({
        data: {
          bancoHorasId:     bh.id,
          companyId,
          employeeId,
          tipo:             'DEBITO',
          tipoHora:         'DIURNA',
          multiplicador:    new Decimal('1.00'),
          minutosOriginais: dto.minutos,
          minutos:          -dto.minutos,
          saldoApos,
          data:             new Date(dto.data),
          competencia:      dto.competencia,
          descricao:        dto.descricao,
          createdById:      userId,
        },
      });
      await tx.bancoHoras.update({ where: { id: bh.id }, data: { saldoMinutos: saldoApos } });
      return { saldoApos, fmtSaldo: fmtMin(saldoApos) };
    });
  }

  // Ajuste manual
  async ajustar(companyId: string, employeeId: string, dto: {
    minutos: number; data: string; competencia: string; descricao?: string;
  }, userId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const bh = await this.ensureBH(tx, companyId, employeeId);
      const saldoApos = bh.saldoMinutos + dto.minutos;
      await tx.bancoHorasLancamento.create({
        data: {
          bancoHorasId: bh.id, companyId, employeeId,
          tipo: 'AJUSTE', tipoHora: 'DIURNA',
          multiplicador: new Decimal('1.00'),
          minutosOriginais: Math.abs(dto.minutos),
          minutos: dto.minutos, saldoApos,
          data: new Date(dto.data), competencia: dto.competencia,
          descricao: dto.descricao, createdById: userId,
        },
      });
      await tx.bancoHoras.update({ where: { id: bh.id }, data: { saldoMinutos: saldoApos } });
      return { saldoApos, fmtSaldo: fmtMin(saldoApos) };
    });
  }

  // Estorno de lancamento -- reversao auditavel, NUNCA edita ou exclui o original
  async estornar(companyId: string, employeeId: string, lancamentoId: string, motivo: string, userId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const original = await tx.bancoHorasLancamento.findFirst({
        where: { id: lancamentoId, companyId, employeeId },
      });
      if (!original) throw new BadRequestException('Lancamento nao encontrado.');
      if (original.estornado) throw new BadRequestException('Lancamento ja foi estornado.');
      if (original.tipo === 'ESTORNO') throw new BadRequestException('Nao e possivel estornar um estorno.');

      const bh = await this.ensureBH(tx, companyId, employeeId);
      const minutosReversos = -original.minutos;
      const saldoApos = bh.saldoMinutos + minutosReversos;

      const estorno = await tx.bancoHorasLancamento.create({
        data: {
          bancoHorasId: bh.id, companyId, employeeId,
          tipo: 'ESTORNO', tipoHora: original.tipoHora,
          multiplicador: new Decimal('1.00'),
          minutosOriginais: Math.abs(minutosReversos),
          minutos: minutosReversos,
          saldoApos,
          data: new Date(),
          competencia: original.competencia,
          descricao: motivo || ('Estorno do lancamento de ' + original.data.toISOString().slice(0, 10)),
          estornoDeId: original.id,
          createdById: userId,
        },
      });

      await tx.bancoHorasLancamento.update({ where: { id: original.id }, data: { estornado: true } });
      await tx.bancoHoras.update({ where: { id: bh.id }, data: { saldoMinutos: saldoApos } });

      // AuditLog -- campos corretos conforme schema do projeto
      await tx.auditLog.create({
        data: {
          actorId:  userId,
          action:   'ESTORNAR_BANCO_HORAS',
          targetId: original.id,
          before:   { minutos: original.minutos, saldoApos: original.saldoApos, tipo: original.tipo } as any,
          after:    { estornoId: estorno.id, minutosReversos, saldoApos, motivo } as any,
          ip:       null,
        },
      });

      return { saldoApos, fmtSaldo: fmtMin(saldoApos), estornoId: estorno.id };
    });
  }

  // Correcao de lancamento -- estorna o original e (opcionalmente) lanca o corrigido, tudo em uma unica transacao.
  // "Apenas estornar" cobre o caso de reversao total (nao lanca nada novo).
  async corrigir(companyId: string, employeeId: string, lancamentoId: string, dto: {
    apenasEstornar: boolean;
    tipo?: string; tipoHora?: string; minutosOriginais?: number;
    data?: string; competencia?: string; descricao?: string; motivo?: string;
  }, userId: string) {
    return this.prisma.$transaction(async (tx: any) => {
      const original = await tx.bancoHorasLancamento.findFirst({
        where: { id: lancamentoId, companyId, employeeId },
      });
      if (!original) throw new BadRequestException('Lancamento nao encontrado.');
      if (original.estornado) throw new BadRequestException('Lancamento ja foi estornado.');
      if (original.tipo === 'ESTORNO') throw new BadRequestException('Nao e possivel corrigir um estorno.');

      const bh = await this.ensureBH(tx, companyId, employeeId);

      // 1) Estorna o lancamento original (preservado no historico, nunca editado/excluido)
      const minutosReversos = -original.minutos;
      let saldoApos = bh.saldoMinutos + minutosReversos;

      const estorno = await tx.bancoHorasLancamento.create({
        data: {
          bancoHorasId: bh.id, companyId, employeeId,
          tipo: 'ESTORNO', tipoHora: original.tipoHora,
          multiplicador: new Decimal('1.00'),
          minutosOriginais: Math.abs(minutosReversos),
          minutos: minutosReversos,
          saldoApos,
          data: new Date(),
          competencia: original.competencia,
          descricao: dto.motivo || ('Estorno para correcao do lancamento de ' + original.data.toISOString().slice(0, 10)),
          estornoDeId: original.id,
          createdById: userId,
        },
      });

      await tx.bancoHorasLancamento.update({ where: { id: original.id }, data: { estornado: true } });

      let novo: any = null;

      // 2) Lanca o valor corrigido (se nao for "apenas estornar")
      if (!dto.apenasEstornar) {
        const tipo = dto.tipo ?? original.tipo;
        const tipoHora = dto.tipoHora ?? original.tipoHora;
        const minutosOriginaisIn = dto.minutosOriginais ?? original.minutosOriginais;
        const dataIn = dto.data ?? original.data.toISOString().slice(0, 10);
        const competenciaIn = dto.competencia ?? original.competencia;
        const descricaoIn = dto.descricao ?? original.descricao;

        let minutos: number;
        let mult = new Decimal('1.00');
        if (tipo === 'CREDITO') {
          const m = getMultiplicador(tipoHora, bh);
          mult = new Decimal(m.toFixed(2));
          minutos = Math.round(minutosOriginaisIn * m);
        } else if (tipo === 'AJUSTE') {
          minutos = minutosOriginaisIn;
        } else {
          minutos = -Math.abs(minutosOriginaisIn);
        }

        saldoApos = saldoApos + minutos;

        novo = await tx.bancoHorasLancamento.create({
          data: {
            bancoHorasId: bh.id, companyId, employeeId,
            tipo, tipoHora,
            multiplicador: mult,
            minutosOriginais: Math.abs(minutosOriginaisIn),
            minutos, saldoApos,
            data: new Date(dataIn), competencia: competenciaIn,
            descricao: descricaoIn ?? undefined,
            createdById: userId,
          },
        });
      }

      await tx.bancoHoras.update({ where: { id: bh.id }, data: { saldoMinutos: saldoApos } });

      await tx.auditLog.create({
        data: {
          actorId:  userId,
          action:   dto.apenasEstornar ? 'ESTORNAR_BANCO_HORAS' : 'CORRIGIR_BANCO_HORAS',
          targetId: original.id,
          before:   { minutos: original.minutos, saldoApos: original.saldoApos, tipo: original.tipo } as any,
          after:    { estornoId: estorno.id, novoId: novo?.id ?? null, saldoApos, motivo: dto.motivo } as any,
          ip:       null,
        },
      });

      return { saldoApos, fmtSaldo: fmtMin(saldoApos), estornoId: estorno.id, novoId: novo?.id ?? null };
    });
  }

  // Saldo do funcionario
  async getSaldo(companyId: string, employeeId: string) {
    const bh = await this.prisma.bancoHoras.findFirst({
      where: { companyId, employeeId },
      include: { lancamentos: { orderBy: { data: 'desc' }, take: 50 } },
    });
    if (!bh) return { saldoMinutos: 0, fmtSaldo: '0h00', lancamentos: [], config: null };
    return {
      ...bh,
      fmtSaldo: fmtMin(bh.saldoMinutos),
      lancamentos: bh.lancamentos.map((l: any) => ({
        ...l,
        fmtMinutos: fmtMin(l.minutos),
        fmtSaldoApos: fmtMin(l.saldoApos),
      })),
    };
  }

  // Relatorio empresa — todos os funcionarios
  async getRelatorio(companyId: string) {
    const bhs = await this.prisma.bancoHoras.findMany({
      where: { companyId },
      include: { employee: { select: { id: true, fullName: true, role: true, taxId: true } } },
      orderBy: { employee: { fullName: 'asc' } },
    });
    return bhs.map((bh: any) => ({
      ...bh,
      fmtSaldo: fmtMin(bh.saldoMinutos),
      alerta: bh.limiteMinutos && bh.saldoMinutos >= (bh.limiteMinutos * 0.8),
    }));
  }

  // Configura multiplicadores do BH (CCT customizado)
  async configurar(companyId: string, employeeId: string, config: {
    limiteMinutos?: number; validadeMeses?: number;
    multNoturno?: number; multSabado?: number; multDomingo?: number; multFeriado?: number;
  }) {
    const bh = await this.prisma.bancoHoras.findFirst({ where: { companyId, employeeId } });
    if (!bh) throw new BadRequestException('Banco de horas nao inicializado');
    return this.prisma.bancoHoras.update({
      where: { id: bh.id },
      data: {
        limiteMinutos: config.limiteMinutos,
        validadeMeses: config.validadeMeses,
        multNoturno:   config.multNoturno ? new Decimal(config.multNoturno) : undefined,
        multSabado:    config.multSabado  ? new Decimal(config.multSabado)  : undefined,
        multDomingo:   config.multDomingo ? new Decimal(config.multDomingo) : undefined,
        multFeriado:   config.multFeriado ? new Decimal(config.multFeriado) : undefined,
      },
    });
  }
}
