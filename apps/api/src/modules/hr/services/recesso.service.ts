import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { FeriasService } from './ferias.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');
import { Readable } from 'stream';

@Injectable()
export class RecessoService {
  constructor(
    private prisma: PrismaService,
    private ferias: FeriasService,
  ) {}

  // ── Dias uteis entre duas datas (exclui fds + feriados nacionais) ──────────
  private async calcularDiasUteis(companyId: string, inicio: Date, fim: Date): Promise<number> {
    const feriados = await this.prisma.holiday.findMany({
      where: {
        date: { gte: inicio, lte: fim },
        type: { in: ['NACIONAL', 'ESTADUAL', 'FACULTATIVO'] as any },
      },
      select: { date: true },
    });
    const feriadoSet = new Set(feriados.map((f: any) =>
      new Date(f.date).toISOString().slice(0, 10)
    ));
    let dias = 0;
    const cur = new Date(inicio);
    while (cur <= fim) {
      const dow = cur.getDay();
      const key = cur.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !feriadoSet.has(key)) dias++;
      cur.setDate(cur.getDate() + 1);
    }
    return dias;
  }

  // ── Criar recesso ─────────────────────────────────────────────────────────
  async criar(companyId: string, dto: {
    tipo:        string;
    descricao:   string;
    dataInicio:  string;
    dataFim:     string;
    observacao?: string;
  }, userId: string) {
    const inicio   = new Date(dto.dataInicio);
    const fim      = new Date(dto.dataFim);
    const diasUteis = await this.calcularDiasUteis(companyId, inicio, fim);
    return this.prisma.recessoColetivo.create({
      data: {
        companyId,
        tipo:       dto.tipo as any,
        descricao:  dto.descricao,
        dataInicio: inicio,
        dataFim:    fim,
        diasUteis,
        observacao: dto.observacao,
        createdById: userId,
      },
    });
  }

  // ── Listar recessos ───────────────────────────────────────────────────────
  async listar(companyId: string) {
    return this.prisma.recessoColetivo.findMany({
      where: { companyId },
      include: { _count: { select: { programacoes: true } } },
      orderBy: { dataInicio: 'desc' },
    });
  }

  // ── Aplica recesso em lote para todos os funcionarios ativos ──────────────
  async aplicarParaTodos(companyId: string, recessoId: string, userId: string) {
    const recesso = await this.prisma.recessoColetivo.findFirstOrThrow({
      where: { id: recessoId, companyId },
    });
    if (recesso.status === 'APLICADO')
      throw new BadRequestException('Recesso ja foi aplicado.');

    const funcionarios = await this.ferias.listarFuncionariosAtivos(companyId);
    const resultados: { employeeId: string; nome: string; status: string; periodoId?: string }[] = [];

    for (const emp of funcionarios) {
      try {
        // Inicializa periodos se nao existem
        await this.ferias.inicializarPeriodos(companyId, emp.id, userId).catch(() => {});

        // Busca periodo mais antigo com saldo disponivel
        const periodos = await this.prisma.periodoAquisitivoFerias.findMany({
          where: { companyId, employeeId: emp.id, diasSaldo: { gt: 0 } },
          orderBy: { anoAquisitivo: 'asc' },
        });

        const periodo = periodos.find((p: any) =>
          ['DISPONIVEL', 'ABERTO', 'PROGRAMADO'].includes(p.status)
        );

        if (!periodo) {
          resultados.push({ employeeId: emp.id, nome: (emp as any).fullName, status: 'SEM_SALDO' });
          continue;
        }

        const diasFerias = Math.min(recesso.diasUteis, periodo.diasSaldo);
        const dtInicio   = new Date(recesso.dataInicio);
        const dtFim      = new Date(recesso.dataFim);

        const calc = await this.ferias.calcularFerias({
          salarioBase: Number((emp as any).salary),
          diasFerias,
          diasAbono:   0,
        });

        await this.prisma.$transaction(async (tx: any) => {
          await tx.programacaoFerias.create({
            data: {
              companyId,
              employeeId:          emp.id,
              periodoAquisitivoId: periodo.id,
              recessoId,
              parcela:             1,
              dataInicio:          dtInicio,
              dataFim:             dtFim,
              diasFerias,
              diasAbono:           0,
              dataPagamento:       dtInicio, // pago no inicio do recesso
              salarioBase:         new Decimal(calc.salarioBase),
              valorFerias:         new Decimal(calc.valorFerias),
              valorTerco:          new Decimal(calc.valorTerco),
              totalBruto:          new Decimal(calc.totalBruto),
              valorInss:           new Decimal(calc.valorInss),
              valorIrrf:           new Decimal(calc.valorIrrf),
              totalLiquido:        new Decimal(calc.totalLiquido),
              status:              'PAGO',
              createdById:         userId,
            },
          });
          const novoGozados = periodo.diasGozados + diasFerias;
          await tx.periodoAquisitivoFerias.update({
            where: { id: periodo.id },
            data: {
              diasGozados: novoGozados,
              diasSaldo:   periodo.diasDireito - novoGozados,
              status:      novoGozados >= periodo.diasDireito ? 'GOZADO' : periodo.status,
            },
          });
        });
        resultados.push({ employeeId: emp.id, nome: (emp as any).fullName, status: 'OK', periodoId: periodo.id });
      } catch (err: any) {
        resultados.push({ employeeId: emp.id, nome: (emp as any).fullName, status: `ERRO: ${err.message}` });
      }
    }

    const aplicados = resultados.filter(r => r.status === 'OK').length;
    await this.prisma.recessoColetivo.update({
      where: { id: recessoId },
      data: { status: 'APLICADO', aplicadoEm: new Date(), totalFuncionarios: aplicados },
    });

    return { recessoId, diasUteis: recesso.diasUteis, resultados, totalAplicado: aplicados };
  }

  // ── Gera ZIP com todos os recibos do recesso ──────────────────────────────
  async gerarZipRecibos(companyId: string, recessoId: string): Promise<Buffer> {
    const programacoes = await this.prisma.programacaoFerias.findMany({
      where: { companyId, recessoId },
      select: { id: true, employee: { select: { fullName: true } } },
    });
    const archive = archiver('zip', { zlib: { level: 9 } }) as any;
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((res, rej) => {
      archive.on('end', res);
      archive.on('error', rej);
    });
    for (const prog of programacoes) {
      const html = await this.ferias.gerarReciboHtml(companyId, prog.id);
      const pdf  = await this.ferias.gerarPdf(html);
      const nome = (prog as any).employee?.fullName?.replace(/\s+/g, '_') ?? prog.id;
      archive.append(pdf as any, { name: `recibo-${nome}.pdf` });
    }
    archive.finalize();
    await done;
    return Buffer.concat(chunks);
  }

  // ── Preview: funcionarios e saldo antes de aplicar ────────────────────────
  async preview(companyId: string, recessoId: string) {
    const recesso = await this.prisma.recessoColetivo.findFirstOrThrow({
      where: { id: recessoId, companyId },
    });
    const funcionarios = await this.ferias.listarFuncionariosAtivos(companyId);
    const result = await Promise.all(funcionarios.map(async (emp: any) => {
      const periodos = await this.prisma.periodoAquisitivoFerias.findMany({
        where: { companyId, employeeId: emp.id, diasSaldo: { gt: 0 } },
        orderBy: { anoAquisitivo: 'asc' },
      });
      const periodo = periodos.find((p: any) =>
        ['DISPONIVEL', 'ABERTO', 'PROGRAMADO'].includes(p.status)
      );
      return {
        employeeId:  emp.id,
        nome:        emp.fullName,
        salario:     Number(emp.salary),
        diasSaldo:   periodo?.diasSaldo ?? 0,
        diasADebitar: periodo ? Math.min(recesso.diasUteis, periodo.diasSaldo) : 0,
        periodo:     periodo ? `${periodo.anoAquisitivo}/${periodo.anoAquisitivo+1}` : 'Sem saldo',
        temSaldo:    !!periodo && periodo.diasSaldo > 0,
      };
    }));
    return { recesso, funcionarios: result };
  }
}
