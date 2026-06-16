// apps/api/src/modules/hr/services/rescisao.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MotivoRescisao, TipoAvisoPrevio, StatusRescisao } from '@prisma/client';

// -- Constantes legais --------------------------------------------------------
const ALIQ_FGTS = 0.08;
const DEDUCAO_DEPENDENTE_IRRF = 189.59; // valor fixo desde 2015

// -- Helpers numericos ---------------------------------------------------------
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// -- Helpers de data (UTC, evita bug de timezone Windows) ----------------------
function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

function formatDateISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysInMonthUTC(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

// Anos completos de servico entre duas datas
function anosCompletos(inicio: Date, fim: Date): number {
  let anos = fim.getUTCFullYear() - inicio.getUTCFullYear();
  const fimMD = fim.getUTCMonth() * 100 + fim.getUTCDate();
  const inicioMD = inicio.getUTCMonth() * 100 + inicio.getUTCDate();
  if (fimMD < inicioMD) anos--;
  return Math.max(0, anos);
}

// Ultimo aniversario de admissao <= ref (periodo aquisitivo de ferias em curso)
function ultimoAniversario(hireDate: Date, ref: Date): Date {
  let aniversario = new Date(Date.UTC(ref.getUTCFullYear(), hireDate.getUTCMonth(), hireDate.getUTCDate(), 12));
  if (aniversario > ref) {
    aniversario = new Date(Date.UTC(ref.getUTCFullYear() - 1, hireDate.getUTCMonth(), hireDate.getUTCDate(), 12));
  }
  if (aniversario < hireDate) aniversario = hireDate;
  return aniversario;
}

// Conta meses completos entre inicio e fim (inclusive), regra >=15 dias = mes completo
function contarMesesProporcionais(inicio: Date, fim: Date): number {
  if (fim < inicio) return 0;
  let meses = 0;
  let cursor = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), 1, 12));
  const fimCursor = new Date(Date.UTC(fim.getUTCFullYear(), fim.getUTCMonth(), 1, 12));
  while (cursor <= fimCursor) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const diasNoMes = daysInMonthUTC(year, month);
    const isInicioMes = year === inicio.getUTCFullYear() && month === inicio.getUTCMonth();
    const isFimMes = year === fim.getUTCFullYear() && month === fim.getUTCMonth();
    let diasContados: number;
    if (isInicioMes && isFimMes) {
      diasContados = fim.getUTCDate() - inicio.getUTCDate() + 1;
    } else if (isInicioMes) {
      diasContados = diasNoMes - inicio.getUTCDate() + 1;
    } else if (isFimMes) {
      diasContados = fim.getUTCDate();
    } else {
      diasContados = diasNoMes;
    }
    if (diasContados >= 15) meses++;
    cursor = new Date(Date.UTC(year, month + 1, 1, 12));
  }
  return Math.min(meses, 12);
}

// Dias de aviso previo conforme motivo (CLT art. 487, Lei 12.506/2011, art. 484-A)
function calcularDiasAviso(motivo: MotivoRescisao, hireDate: Date, dataAfastamento: Date): number {
  if (motivo === 'JUSTA_CAUSA' || motivo === 'TERMINO_CONTRATO_DETERMINADO') return 0;
  if (motivo === 'PEDIDO_DEMISSAO') return 30;
  const anos = anosCompletos(hireDate, dataAfastamento);
  const dias = Math.min(30 + anos * 3, 90);
  if (motivo === 'ACORDO_484A') return Math.round(dias / 2); // aviso pago pela metade
  return dias; // SEM_JUSTA_CAUSA, RESCISAO_INDIRETA
}

// Multa FGTS conforme motivo
function multaFgtsPercentual(motivo: MotivoRescisao): number {
  switch (motivo) {
    case 'SEM_JUSTA_CAUSA':
    case 'RESCISAO_INDIRETA':
      return 0.40;
    case 'ACORDO_484A':
      return 0.20;
    default:
      return 0;
  }
}

export interface CalcularRescisaoDto {
  motivo: MotivoRescisao;
  tipoAvisoPrevio: TipoAvisoPrevio;
  dataAviso: string;
  dataAfastamento: string;
  feriasVencidas?: boolean;
  feriasVencidasInicio?: string;
  feriasVencidasFim?: string;
  feriasVencidasDobro?: boolean;
  numDependentes?: number;
  saldoFgtsContaInformado?: number;
  outrosProventos?: number;
  outrosDescontos?: number;
  observacaoOutros?: string;
  observacao?: string;
}

@Injectable()
export class RescisaoService {
  constructor(private readonly prisma: PrismaService) {}

  // -- Tabelas legais (banco) ---------------------------------------------
  private async getTabelaInss(ano: number) {
    let rows = await this.prisma.tabelaInss.findMany({ where: { ano }, orderBy: { faixaOrdem: 'asc' } });
    if (rows.length === 0) {
      const all = await this.prisma.tabelaInss.findMany({ orderBy: [{ ano: 'desc' }, { faixaOrdem: 'asc' }] });
      const ultimoAno = all[0]?.ano;
      rows = all.filter(r => r.ano === ultimoAno);
    }
    return rows;
  }

  private async getTabelaIrrf(ano: number) {
    let rows = await this.prisma.tabelaIrrf.findMany({ where: { ano }, orderBy: [{ tipo: 'asc' }, { faixaOrdem: 'asc' }] });
    if (rows.length === 0) {
      const anos = await this.prisma.tabelaIrrf.findMany({ orderBy: { ano: 'desc' }, select: { ano: true }, distinct: ['ano'] });
      const ultimoAno = anos[0]?.ano;
      rows = await this.prisma.tabelaIrrf.findMany({ where: { ano: ultimoAno }, orderBy: [{ tipo: 'asc' }, { faixaOrdem: 'asc' }] });
    }
    return {
      progressiva: rows.filter(r => r.tipo === 'PROGRESSIVA'),
      redutor: rows.filter(r => r.tipo === 'REDUTOR'),
    };
  }

  private calcularInss(base: number, tabela: { limiteAte: any; aliquota: any; deducao: any }[]): { valor: number; aliq: number } {
    if (base <= 0 || tabela.length === 0) return { valor: 0, aliq: 0 };
    const ultima = tabela[tabela.length - 1];
    let faixa = tabela.find(f => base <= Number(f.limiteAte));
    let baseCalc = base;
    if (!faixa) {
      faixa = ultima;
      baseCalc = Number(ultima.limiteAte); // teto
    }
    const valor = Math.max(0, round2(baseCalc * Number(faixa.aliquota) - Number(faixa.deducao)));
    return { valor, aliq: Number(faixa.aliquota) };
  }

  private calcularIrpfProgressivo(base: number, tabela: { limiteAte: any; aliquota: any; deducao: any }[]): { valor: number; aliq: number; deducao: number } {
    if (base <= 0 || tabela.length === 0) return { valor: 0, aliq: 0, deducao: 0 };
    const faixa = tabela.find(f => base <= Number(f.limiteAte)) ?? tabela[tabela.length - 1];
    const valor = Math.max(0, round2(base * Number(faixa.aliquota) - Number(faixa.deducao)));
    return { valor, aliq: Number(faixa.aliquota), deducao: Number(faixa.deducao) };
  }

  private calcularRedutor(salarioReferencia: number, tabela: { limiteAte: any; deducao: any }[]): number {
    if (tabela.length === 0) return 0;
    const faixa = tabela.find(f => salarioReferencia <= Number(f.limiteAte)) ?? tabela[tabela.length - 1];
    return Number(faixa.deducao); // 999999 = isencao total
  }

  // -- Motor de calculo (preview, nao persiste) ----------------------------
  async calcular(companyId: string, employeeId: string, dto: CalcularRescisaoDto) {
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Funcionario nao encontrado');

    const salarioBase = Number(employee.salary);
    const hireDate = employee.hireDate;
    const dataAfastamento = parseDateUTC(dto.dataAfastamento);
    const dataAviso = parseDateUTC(dto.dataAviso);

    if (dataAfastamento < hireDate) {
      throw new BadRequestException('Data de afastamento anterior a data de admissao');
    }
    if (dataAviso > dataAfastamento) {
      throw new BadRequestException('Data do aviso posterior a data de afastamento');
    }

    const numDependentes = dto.numDependentes ?? await this.prisma.employeeDependent.count({ where: { employeeId, companyId, irDeduction: true } });

    // Aviso previo
    const diasAvisoPrevio = calcularDiasAviso(dto.motivo, hireDate, dataAfastamento);
    // Saldo de salario
    const saldoSalarioDias = dataAfastamento.getUTCDate();
    const saldoSalarioValor = round2((salarioBase / 30) * saldoSalarioDias);

    // Aviso previo: calcula dias trabalhados / indenizados / projecao
    let diasAvisoTrabalhados = 0;
    let diasAvisoIndenizados = 0;
    let avisoPrevioValor = 0;
    let outrosDescontosCalc = round2(Number(dto.outrosDescontos ?? 0));
    let observacaoOutrosCalc: string | null = dto.observacaoOutros ?? null;
    let dataProjecaoFim = dataAfastamento; // default: sem projecao

    if (diasAvisoPrevio > 0) {
      if (dto.tipoAvisoPrevio === 'INDENIZADO') {
        // Empregado dispensado imediatamente: todo o aviso eh indenizado
        diasAvisoIndenizados = diasAvisoPrevio;
        avisoPrevioValor     = round2((salarioBase / 30) * diasAvisoPrevio);
        dataProjecaoFim      = addDaysUTC(dataAfastamento, diasAvisoPrevio);
      } else if (dto.tipoAvisoPrevio === 'TRABALHADO_PARCIAL') {
        // Aviso comunicado e empregado trabalhou ate dataAfastamento, restante indenizado
        // dias trabalhados = intervalo dataAviso..dataAfastamento inclusive
        diasAvisoTrabalhados = Math.round(
          (dataAfastamento.getTime() - dataAviso.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
        diasAvisoIndenizados = Math.max(0, diasAvisoPrevio - diasAvisoTrabalhados);
        avisoPrevioValor     = round2((salarioBase / 30) * diasAvisoIndenizados);
        dataProjecaoFim      = diasAvisoIndenizados > 0
          ? addDaysUTC(dataAfastamento, diasAvisoIndenizados)
          : dataAfastamento;
      } else if (dto.tipoAvisoPrevio === 'TRABALHADO') {
        diasAvisoTrabalhados = diasAvisoPrevio;
        // dataProjecaoFim = dataAfastamento (sem projecao adicional)
      } else if (dto.tipoAvisoPrevio === 'NAO_CUMPRIDO') {
        // Empregado pediu demissao e nao cumpriu: desconto de 1 salario (30 dias)
        const descontoAviso = round2((salarioBase / 30) * diasAvisoPrevio);
        outrosDescontosCalc = round2(outrosDescontosCalc + descontoAviso);
        const nota = 'Aviso previo nao cumprido: desconto ' + diasAvisoPrevio + 'd (R$ ' + descontoAviso.toFixed(2) + ')';
        observacaoOutrosCalc = observacaoOutrosCalc ? observacaoOutrosCalc + ' | ' + nota : nota;
      }
      // DISPENSADO: aviso dado mas empregador dispensou cumprimento — valor pago como trabalhado
    }

    // 13o salario proporcional
    let decimoTerceiroMeses = 0;
    let decimoTerceiroValor = 0;
    if (dto.motivo !== 'JUSTA_CAUSA') {
      const inicio13 = hireDate.getUTCFullYear() === dataProjecaoFim.getUTCFullYear()
        ? hireDate
        : new Date(Date.UTC(dataProjecaoFim.getUTCFullYear(), 0, 1, 12));
      decimoTerceiroMeses = contarMesesProporcionais(inicio13, dataProjecaoFim);
      decimoTerceiroValor = round2((salarioBase / 12) * decimoTerceiroMeses);
    }

    // Ferias proporcionais
    let feriasPropMeses = 0;
    let feriasPropValor = 0;
    let feriasPropTerco = 0;
    if (dto.motivo !== 'JUSTA_CAUSA') {
      const inicioFerias = ultimoAniversario(hireDate, dataProjecaoFim);
      feriasPropMeses = contarMesesProporcionais(inicioFerias, dataProjecaoFim);
      feriasPropValor = round2((salarioBase / 12) * feriasPropMeses);
      feriasPropTerco = round2(feriasPropValor / 3);
    }

    // Ferias vencidas
    let feriasVencidasValor = 0;
    let feriasVencidasTerco = 0;
    if (dto.feriasVencidas) {
      const fator = dto.feriasVencidasDobro ? 2 : 1;
      feriasVencidasValor = round2(salarioBase * fator);
      feriasVencidasTerco = round2(feriasVencidasValor / 3);
    }

    // INSS (tributacao separada: saldo de salario e 13o)
    const tabelaInss = await this.getTabelaInss(dataAfastamento.getUTCFullYear());
    const inssSaldo = this.calcularInss(saldoSalarioValor, tabelaInss);
    const inss13 = this.calcularInss(decimoTerceiroValor, tabelaInss);
    const valorInss = round2(inssSaldo.valor + inss13.valor);
    const baseInss = round2(saldoSalarioValor + decimoTerceiroValor);

    // IRRF (tabela progressiva + redutor Lei 15.270/2025)
    const { progressiva, redutor } = await this.getTabelaIrrf(dataAfastamento.getUTCFullYear());
    const deducaoDep = round2(numDependentes * DEDUCAO_DEPENDENTE_IRRF);
    const redutorValor = this.calcularRedutor(salarioBase, redutor);

    const baseIrrfSaldo = Math.max(0, round2(saldoSalarioValor - inssSaldo.valor - deducaoDep));
    const irpfSaldo = this.calcularIrpfProgressivo(baseIrrfSaldo, progressiva);
    const irpfFinalSaldo = Math.max(0, round2(irpfSaldo.valor - redutorValor));

    const baseIrrf13 = Math.max(0, round2(decimoTerceiroValor - inss13.valor - deducaoDep));
    const irpf13 = this.calcularIrpfProgressivo(baseIrrf13, progressiva);
    const irpfFinal13 = Math.max(0, round2(irpf13.valor - redutorValor));

    const valorIrrf = round2(irpfFinalSaldo + irpfFinal13);
    const baseIrrf = round2(baseIrrfSaldo + baseIrrf13);

    // FGTS
    const baseFgtsMes = round2(
      saldoSalarioValor + avisoPrevioValor + decimoTerceiroValor +
      feriasPropValor + feriasPropTerco + feriasVencidasValor + feriasVencidasTerco
    );
    const fgtsSobreVerbas = round2(baseFgtsMes * ALIQ_FGTS);
    const saldoFgtsConta = round2(Number(dto.saldoFgtsContaInformado ?? 0));
    const multaPerc = multaFgtsPercentual(dto.motivo);
    const multaFgtsValor = round2(saldoFgtsConta * multaPerc);

    // Totais
    const outrosProventos = round2(Number(dto.outrosProventos ?? 0));
    const totalProventos = round2(
      saldoSalarioValor + avisoPrevioValor + decimoTerceiroValor +
      feriasVencidasValor + feriasVencidasTerco + feriasPropValor + feriasPropTerco + outrosProventos
    );
    const totalDescontos = round2(valorInss + valorIrrf + outrosDescontosCalc);
    const totalLiquido = round2(totalProventos - totalDescontos);

    return {
      employee: {
        id: employee.id,
        fullName: employee.fullName,
        role: employee.role,
        taxId: employee.taxId,
        salary: salarioBase,
        hireDate: formatDateISO(hireDate),
      },
      parametros: {
        motivo: dto.motivo,
        tipoAvisoPrevio: dto.tipoAvisoPrevio,
        dataAviso: dto.dataAviso,
        dataAfastamento: dto.dataAfastamento,
        diasAvisoPrevio,
        diasAvisoTrabalhados,
        diasAvisoIndenizados,
        dataProjecaoFim: formatDateISO(dataProjecaoFim),
        numDependentes,
      },
      proventos: {
        saldoSalarioDias,
        saldoSalarioValor,
        avisoPrevioValor,
        decimoTerceiroMeses,
        decimoTerceiroValor,
        feriasVencidas: !!dto.feriasVencidas,
        feriasVencidasValor,
        feriasVencidasTerco,
        feriasPropMeses,
        feriasPropValor,
        feriasPropTerco,
        outrosProventos,
        totalProventos,
      },
      descontos: {
        // INSS separado por competencia
        inssRemun:  { base: saldoSalarioValor,   valor: inssSaldo.valor, aliq: inssSaldo.aliq },
        inss13:     { base: decimoTerceiroValor,  valor: inss13.valor,    aliq: inss13.aliq   },
        valorInss,
        // IRRF separado por competencia
        irrfRemun:  { base: baseIrrfSaldo, valor: irpfFinalSaldo, aliq: irpfSaldo.aliq, deducao: redutorValor },
        irrf13:     { base: baseIrrf13,    valor: irpfFinal13,    aliq: irpf13.aliq,    deducao: redutorValor },
        valorIrrf,
        // Legado (soma) mantido para persistencia
        baseInss,
        aliqInss: inssSaldo.aliq,
        baseIrrf,
        deducaoIrrf: redutorValor,
        aliqIrrf: irpfSaldo.aliq,
        outrosDescontos: outrosDescontosCalc,
        observacaoOutros: observacaoOutrosCalc,
        totalDescontos,
      },
      totalLiquido,
      fgts: {
        baseFgtsMes,
        fgtsSobreVerbas,
        saldoFgtsContaInformado: saldoFgtsConta,
        multaFgtsPercentual: multaPerc,
        multaFgtsValor,
      },
    };
  }

  // -- Confirma e persiste a rescisao --------------------------------------
  async confirmar(companyId: string, employeeId: string, userId: string, dto: CalcularRescisaoDto) {
    const existing = await this.prisma.employeeTermination.findFirst({
      where: { companyId, employeeId, status: { not: 'CANCELADA' }, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException('Ja existe uma rescisao registrada para este funcionario (status: ' + existing.status + ')');
    }

    const preview = await this.calcular(companyId, employeeId, dto);
    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId } });
    if (!employee) throw new NotFoundException('Funcionario nao encontrado');

    return this.prisma.$transaction(async (tx) => {
      const termination = await tx.employeeTermination.create({
        data: {
          companyId,
          employeeId,
          motivo: dto.motivo,
          tipoAvisoPrevio: dto.tipoAvisoPrevio,
          dataAfastamento: parseDateUTC(dto.dataAfastamento),
          dataAviso: parseDateUTC(dto.dataAviso),
          dataProjecaoFim: parseDateUTC(preview.parametros.dataProjecaoFim),
          diasAvisoPrevio: preview.parametros.diasAvisoPrevio,
          diasAvisoTrabalhados: preview.parametros.diasAvisoTrabalhados,
          diasAvisoIndenizados: preview.parametros.diasAvisoIndenizados,
          salarioBase: employee.salary,
          numDependentes: preview.parametros.numDependentes,
          admissaoData: employee.hireDate,
          saldoSalarioDias: preview.proventos.saldoSalarioDias,
          saldoSalarioValor: preview.proventos.saldoSalarioValor,
          avisoPrevioValor: preview.proventos.avisoPrevioValor,
          decimoTerceiroMeses: preview.proventos.decimoTerceiroMeses,
          decimoTerceiroValor: preview.proventos.decimoTerceiroValor,
          feriasVencidas: preview.proventos.feriasVencidas,
          feriasVencidasInicio: dto.feriasVencidasInicio ? parseDateUTC(dto.feriasVencidasInicio) : null,
          feriasVencidasFim: dto.feriasVencidasFim ? parseDateUTC(dto.feriasVencidasFim) : null,
          feriasVencidasDobro: !!dto.feriasVencidasDobro,
          feriasVencidasValor: preview.proventos.feriasVencidasValor,
          feriasVencidasTerco: preview.proventos.feriasVencidasTerco,
          feriasPropMeses: preview.proventos.feriasPropMeses,
          feriasPropValor: preview.proventos.feriasPropValor,
          feriasPropTerco: preview.proventos.feriasPropTerco,
          totalProventos: preview.proventos.totalProventos,
          baseInss: preview.descontos.baseInss,
          aliqInss: preview.descontos.aliqInss,
          valorInss: preview.descontos.valorInss,
          baseIrrf: preview.descontos.baseIrrf,
          deducaoIrrf: preview.descontos.deducaoIrrf,
          aliqIrrf: preview.descontos.aliqIrrf,
          valorIrrf: preview.descontos.valorIrrf,
          baseFgtsMes: preview.fgts.baseFgtsMes,
          fgtsSobreVerbas: preview.fgts.fgtsSobreVerbas,
          saldoFgtsContaInformado: preview.fgts.saldoFgtsContaInformado,
          multaFgtsPercentual: preview.fgts.multaFgtsPercentual,
          multaFgtsValor: preview.fgts.multaFgtsValor,
          outrosProventos: preview.proventos.outrosProventos,
          outrosDescontos: preview.descontos.outrosDescontos,
          observacaoOutros: preview.descontos.observacaoOutros,
          totalDescontos: preview.descontos.totalDescontos,
          totalLiquido: preview.totalLiquido,
          status: 'CALCULADA',
          observacao: dto.observacao ?? null,
          createdById: userId,
        },
      });

      await tx.employee.update({
        where: { id: employeeId },
        data: {
          status: 'terminated',
          terminationDate: parseDateUTC(dto.dataAfastamento),
        },
      });

      return termination;
    });
  }

  // -- Consulta rescisoes do funcionario -------------------------------------
  async buscar(companyId: string, employeeId: string) {
    return this.prisma.employeeTermination.findMany({
      where: { companyId, employeeId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -- Atualiza status (homologar / pagar / cancelar) -------------------------
  async atualizarStatus(companyId: string, id: string, status: StatusRescisao) {
    const termination = await this.prisma.employeeTermination.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!termination) throw new NotFoundException('Rescisao nao encontrada');

    const data: any = { status };
    if (status === 'HOMOLOGADA') data.homologadoEm = new Date();
    if (status === 'PAGA') data.pagoEm = new Date();

    if (status === 'CANCELADA') {
      await this.prisma.employee.update({
        where: { id: termination.employeeId },
        data: { status: 'active', terminationDate: null },
      });
    }

    return this.prisma.employeeTermination.update({ where: { id }, data });
  }
}
