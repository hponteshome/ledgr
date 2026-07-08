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
