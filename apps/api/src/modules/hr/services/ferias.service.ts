import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/client';
import * as puppeteer from 'puppeteer';

@Injectable()
export class FeriasService {
  constructor(private prisma: PrismaService) {}


  // Funcionarios ativos sem rescisao — para gestao de ferias
  async listarFuncionariosAtivos(companyId: string) {
    const comRescisao = await this.prisma.employeeTermination.findMany({
      where: { companyId },
      select: { employeeId: true },
    });
    const idsComRescisao = new Set(comRescisao.map((t: any) => t.employeeId));
    const emps = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { fullName: 'asc' },
    });
    return emps.filter((e: any) => !idsComRescisao.has(e.id));
  }


  // Funcionarios ativos sem rescisao — para gestao de ferias

  // ── Periodo Aquisitivo ────────────────────────────────────────────────────

  // Inicializa todos os periodos aquisitivos a partir da data de admissao
  async inicializarPeriodos(companyId: string, employeeId: string, userId: string) {
    const emp = await this.prisma.employee.findFirstOrThrow({
      where: { id: employeeId, companyId, deletedAt: null },
    });
    // Rejeita funcionarios com rescisao registrada
    const term = await this.prisma.employeeTermination.findFirst({
      where: { employeeId, companyId },
    });
    if (term) throw new BadRequestException(
      'Funcionario possui rescisao registrada — nao e possivel inicializar periodos de ferias.'
    );
    const admissao   = new Date(emp.hireDate);
    const hoje       = new Date();
    const periodos   = [];
    let   inicioPerf = new Date(admissao);

    while (inicioPerf < hoje) {
      const fimPerf      = new Date(inicioPerf);
      fimPerf.setFullYear(fimPerf.getFullYear() + 1);
      fimPerf.setDate(fimPerf.getDate() - 1);
      const inicioConc   = new Date(fimPerf);
      inicioConc.setDate(inicioConc.getDate() + 1);
      const fimConc      = new Date(inicioConc);
      fimConc.setFullYear(fimConc.getFullYear() + 1);
      fimConc.setDate(fimConc.getDate() - 1);
      const anoAquisitivo = inicioPerf.getFullYear();

      const existe = await this.prisma.periodoAquisitivoFerias.findFirst({
        where: { companyId, employeeId, anoAquisitivo },
      });
      if (!existe) {
        const status = fimConc < hoje ? 'VENCIDO'
                     : fimPerf < hoje ? 'DISPONIVEL'
                     : 'ABERTO';
        const p = await this.prisma.periodoAquisitivoFerias.create({
          data: {
            companyId, employeeId, anoAquisitivo,
            dataInicioPer:  inicioPerf,
            dataFimPer:     fimPerf,
            dataInicioConc: inicioConc,
            dataFimConc:    fimConc,
            diasDireito:    30,
            diasGozados:    0,
            diasSaldo:      30,
            status:         status as any,
            createdById:    userId,
          },
        });
        periodos.push(p);
      }
      inicioPerf = new Date(fimPerf);
      inicioPerf.setDate(inicioPerf.getDate() + 1);
    }
    return periodos;
  }

  async listarPeriodos(companyId: string, employeeId: string) {
    return this.prisma.periodoAquisitivoFerias.findMany({
      where: { companyId, employeeId },
      include: { programacoes: { orderBy: { dataInicio: 'asc' } } },
      orderBy: { anoAquisitivo: 'desc' },
    });
  }

  // ── Calculo de Ferias ─────────────────────────────────────────────────────

  private async calcINSS(base: number): Promise<number> {
    const tabela = await this.prisma.tabelaInss.findMany({ orderBy: { faixaOrdem: 'asc' } });
    let total = 0;
    let baseRestante = base;
    let faixaAnterior = 0;
    for (const faixa of tabela) {
      if (baseRestante <= 0) break;
      const teto = faixa.limiteAte ? Number(faixa.limiteAte) : Infinity;
      const faixaBase = Math.min(baseRestante, teto - faixaAnterior);
      total += faixaBase * Number(faixa.aliquota);
      baseRestante -= faixaBase;
      faixaAnterior = teto;
    }
    return Math.round(total * 100) / 100;
  }

  private calcIRRF(base: number): number {
    if (base <= 5000.00) return 0;
    if (base <= 7350.00) {
      const redutor = 978.62 - 0.133145 * base;
      return Math.max(0, Math.round((base * 0.275 - redutor) * 100) / 100);
    }
    return Math.round(base * 0.275 * 100) / 100;
  }

  async calcularFerias(params: {
    salarioBase:  number;
    diasFerias:   number;
    diasAbono:    number;
    numDependentes?: number;
  }) {
    const { salarioBase, diasFerias, diasAbono = 0, numDependentes = 0 } = params;
    const valorFerias = salarioBase * diasFerias / 30;
    const valorTerco  = valorFerias / 3;
    // Abono pecuniario: venda de ate 10 dias + 1/3
    const valorAbono  = diasAbono > 0
      ? (salarioBase * diasAbono / 30) * (1 + 1/3)
      : 0;
    const totalBruto  = valorFerias + valorTerco + valorAbono;
    // INSS incide sobre ferias + terco (abono e isento)
    const baseInss    = valorFerias + valorTerco;
    const valorInss   = await this.calcINSS(baseInss);
    // IRRF — Lei 15.270/2025 (deduca dependentes R$189,59/dep)
    const deducaoDep  = numDependentes * 189.59;
    const baseIrrf    = Math.max(0, totalBruto - valorInss - deducaoDep);
    const valorIrrf   = this.calcIRRF(baseIrrf);
    const totalLiquido = totalBruto - valorInss - valorIrrf;
    return {
      salarioBase, diasFerias, diasAbono,
      valorFerias:   Math.round(valorFerias  * 100) / 100,
      valorTerco:    Math.round(valorTerco   * 100) / 100,
      valorAbono:    Math.round(valorAbono   * 100) / 100,
      totalBruto:    Math.round(totalBruto   * 100) / 100,
      valorInss:     Math.round(valorInss    * 100) / 100,
      valorIrrf:     Math.round(valorIrrf    * 100) / 100,
      totalLiquido:  Math.round(totalLiquido * 100) / 100,
    };
  }

  // ── Agendamento ──────────────────────────────────────────────────────────

  async agendar(companyId: string, employeeId: string, dto: {
    periodoAquisitivoId: string;
    parcela:             number;
    dataInicio:          string;
    dataFim:             string;
    diasFerias:          number;
    diasAbono:           number;
    numDependentes?:     number;
    observacao?:         string;
  }, userId: string) {
    const periodo = await this.prisma.periodoAquisitivoFerias.findFirstOrThrow({
      where: { id: dto.periodoAquisitivoId, companyId, employeeId },
      include: { programacoes: { where: { status: { not: 'CANCELADA' } } } },
    });
    // Valida saldo
    const diasJaAgendados = periodo.programacoes.reduce((s: number, p: any) => s + p.diasFerias, 0);
    if (diasJaAgendados + dto.diasFerias > periodo.diasDireito)
      throw new BadRequestException(`Saldo insuficiente: ${periodo.diasSaldo} dias disponivel`);
    // Valida fracionamento (max 3 parcelas, minimo 14 dias na maior)
    if (periodo.programacoes.length >= 3)
      throw new BadRequestException('Maximo 3 parcelas de ferias permitidas');

    const emp   = await this.prisma.employee.findFirstOrThrow({ where: { id: employeeId, companyId } });
    const calc  = await this.calcularFerias({
      salarioBase:     Number(emp.salary),
      diasFerias:      dto.diasFerias,
      diasAbono:       dto.diasAbono,
      numDependentes:  dto.numDependentes ?? 0,
    });
    // Aviso: 30 dias antes do inicio
    const dtInicio   = new Date(dto.dataInicio);
    const dtAviso    = new Date(dtInicio);
    dtAviso.setDate(dtAviso.getDate() - 30);
    // Pagamento: 3 dias antes
    const dtPgto     = new Date(dtInicio);
    dtPgto.setDate(dtPgto.getDate() - 3);

    const prog = await this.prisma.$transaction(async (tx: any) => {
      const p = await tx.programacaoFerias.create({
        data: {
          companyId, employeeId,
          periodoAquisitivoId: dto.periodoAquisitivoId,
          parcela:       dto.parcela,
          dataInicio:    new Date(dto.dataInicio),
          dataFim:       new Date(dto.dataFim),
          diasFerias:    dto.diasFerias,
          diasAbono:     dto.diasAbono,
          dataAviso:     dtAviso,
          dataPagamento: dtPgto,
          salarioBase:   new Decimal(calc.salarioBase),
          valorFerias:   new Decimal(calc.valorFerias),
          valorTerco:    new Decimal(calc.valorTerco),
          valorAbono:    new Decimal(calc.valorAbono),
          totalBruto:    new Decimal(calc.totalBruto),
          valorInss:     new Decimal(calc.valorInss),
          valorIrrf:     new Decimal(calc.valorIrrf),
          totalLiquido:  new Decimal(calc.totalLiquido),
          status:        'AGENDADA',
          observacao:    dto.observacao,
          createdById:   userId,
        },
      });
      // Atualiza periodo
      const novoGozados = diasJaAgendados + dto.diasFerias;
      await tx.periodoAquisitivoFerias.update({
        where: { id: dto.periodoAquisitivoId },
        data: {
          diasGozados: novoGozados,
          diasSaldo:   periodo.diasDireito - novoGozados,
          status:      novoGozados >= periodo.diasDireito ? 'PROGRAMADO' : 'DISPONIVEL',
        },
      });
      return p;
    });
    return { ...prog, calculo: calc };
  }

  async atualizarStatus(companyId: string, id: string, status: string) {
    return this.prisma.programacaoFerias.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async listarProgramacoes(companyId: string, filters?: { employeeId?: string; status?: string }) {
    return this.prisma.programacaoFerias.findMany({
      where: {
        companyId,
        ...(filters?.employeeId && { employeeId: filters.employeeId }),
        ...(filters?.status && { status: filters.status as any }),
      },
      include: { employee: { select: { id: true, fullName: true, role: true } } },
      orderBy: { dataInicio: 'asc' },
    });
  }

  // ── PDFs ─────────────────────────────────────────────────────────────────

  async gerarAvisoHtml(companyId: string, id: string): Promise<string> {
    const prog = await this.prisma.programacaoFerias.findFirstOrThrow({
      where: { id, companyId },
      include: {
        employee: true,
        company:  true,
      },
    });
    const emp = prog.employee as any;
    const co  = prog.company  as any;
    const fmt = (d: Date | string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
    const brl = (v: any) => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#222}
  h2{text-align:center;font-size:16px;margin-bottom:4px}
  .sub{text-align:center;font-size:12px;color:#555;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin:12px 0}
  td{padding:6px 8px;border:0.5px solid #ccc}
  .label{font-weight:bold;background:#f5f5f5;width:40%}
  .totais{background:#f0f7ff;font-weight:bold}
  .assinaturas{display:flex;justify-content:space-around;margin-top:60px}
  .assin{text-align:center;width:40%}
  .linha{border-top:1px solid #333;padding-top:4px;margin-top:40px}
</style></head><body>
<h2>${co.name ?? co.tradeName}</h2>
<div class="sub">CNPJ: ${co.taxId} — AVISO DE FÉRIAS</div>
<table>
  <tr><td class="label">Funcionário</td><td>${emp.fullName}</td></tr>
  <tr><td class="label">CPF</td><td>${emp.taxId}</td></tr>
  <tr><td class="label">Cargo</td><td>${emp.role ?? '—'}</td></tr>
  <tr><td class="label">Data de Admissão</td><td>${fmt(emp.hireDate)}</td></tr>
  <tr><td class="label">Período de Férias</td><td>${fmt(prog.dataInicio)} a ${fmt(prog.dataFim)}</td></tr>
  <tr><td class="label">Dias de Férias</td><td>${prog.diasFerias} dias</td></tr>
  ${prog.diasAbono > 0 ? `<tr><td class="label">Abono Pecuniário</td><td>${prog.diasAbono} dias</td></tr>` : ''}
  <tr><td class="label">Data do Aviso</td><td>${fmt(prog.dataAviso)}</td></tr>
  <tr><td class="label">Data de Pagamento</td><td>${fmt(prog.dataPagamento)}</td></tr>
</table>
<p style="font-size:11px;margin-top:20px">
  O(a) empregado(a) fica ciente de que suas férias se iniciarão em ${fmt(prog.dataInicio)},
  conforme artigos 135 e 136 da CLT. O pagamento será efetuado até ${fmt(prog.dataPagamento)}.
</p>
<div class="assinaturas">
  <div class="assin"><div class="linha">${co.name ?? co.tradeName}<br>Empregador</div></div>
  <div class="assin"><div class="linha">${emp.fullName}<br>Empregado(a) — Ciente</div></div>
</div>
<p style="text-align:center;font-size:10px;margin-top:30px;color:#888">
  Emitido em ${new Date().toLocaleDateString('pt-BR')} — LEDGR Gestão Empresarial
</p>
</body></html>`;
  }

  async gerarReciboHtml(companyId: string, id: string): Promise<string> {
    const prog = await this.prisma.programacaoFerias.findFirstOrThrow({
      where: { id, companyId },
      include: { employee: true, company: true },
    });
    const emp = prog.employee as any;
    const co  = prog.company  as any;
    const fmt = (d: any) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
    const brl = (v: any) => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#222}
  h2{text-align:center;font-size:16px;margin-bottom:4px}
  .sub{text-align:center;font-size:12px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin:8px 0}
  td{padding:6px 8px;border:0.5px solid #ccc}
  .label{font-weight:bold;background:#f5f5f5;width:50%}
  .vr{text-align:right}
  .desc{background:#fff0f0}.prov{background:#f0fff0}
  .total{background:#e8f4fd;font-weight:bold;font-size:13px}
  .assin{text-align:center;margin-top:60px}
  .linha{border-top:1px solid #333;padding-top:4px;margin-top:40px;display:inline-block;width:300px}
</style></head><body>
<h2>${co.name ?? co.tradeName}</h2>
<div class="sub">CNPJ: ${co.taxId} — RECIBO DE FÉRIAS</div>
<table>
  <tr><td class="label">Funcionário</td><td>${emp.fullName}</td>
      <td class="label">CPF</td><td>${emp.taxId}</td></tr>
  <tr><td class="label">Período Aquisitivo</td><td colspan="3">Parcela ${prog.parcela}</td></tr>
  <tr><td class="label">Férias de</td><td>${fmt(prog.dataInicio)}</td>
      <td class="label">a</td><td>${fmt(prog.dataFim)}</td></tr>
  <tr><td class="label">Dias de Férias</td><td>${prog.diasFerias}</td>
      <td class="label">Abono Pecuniário</td><td>${prog.diasAbono} dias</td></tr>
</table>
<table>
  <tr><th style="background:#f0f7ff;text-align:left;padding:6px 8px">Descrição</th>
      <th style="background:#f0f7ff;text-align:right;padding:6px 8px">Valor</th></tr>
  <tr class="prov"><td class="label">Férias (${prog.diasFerias} dias)</td>
      <td class="vr">${brl(prog.valorFerias)}</td></tr>
  <tr class="prov"><td class="label">1/3 Constitucional</td>
      <td class="vr">${brl(prog.valorTerco)}</td></tr>
  ${Number(prog.valorAbono)>0 ? `<tr class="prov"><td class="label">Abono Pecuniário (${prog.diasAbono} dias)</td><td class="vr">${brl(prog.valorAbono)}</td></tr>` : ''}
  <tr><td class="label" style="text-align:right">Total Bruto</td>
      <td class="vr">${brl(prog.totalBruto)}</td></tr>
  <tr class="desc"><td class="label">(-) INSS</td>
      <td class="vr">(${brl(prog.valorInss)})</td></tr>
  <tr class="desc"><td class="label">(-) IRRF</td>
      <td class="vr">(${brl(prog.valorIrrf)})</td></tr>
  <tr class="total"><td>TOTAL LÍQUIDO</td>
      <td class="vr">${brl(prog.totalLiquido)}</td></tr>
</table>
<p style="font-size:11px;margin-top:12px">
  Pagamento em ${fmt(prog.dataPagamento)} (3 dias antes do início, conforme art. 145 CLT).
</p>
<div class="assin">
  <div class="linha">${emp.fullName}<br>Empregado(a) — Recebi</div>
</div>
<p style="text-align:center;font-size:10px;margin-top:20px;color:#888">
  Emitido em ${new Date().toLocaleDateString('pt-BR')} — LEDGR Gestão Empresarial
</p>
</body></html>`;
  }

  async gerarPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf  = await page.pdf({ format: 'A4', margin: { top:'20mm',bottom:'20mm',left:'15mm',right:'15mm' } });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
