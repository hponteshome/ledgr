import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import * as puppeteer from 'puppeteer';

@Injectable()
export class DecimoTerceiroService {
  constructor(private prisma: PrismaService) {}

  // ── Calculo INSS progressivo ────────────────────────────────────────────────
  private async calcINSS(base: number): Promise<number> {
    const tabela = await this.prisma.tabelaInss.findMany({ orderBy: { faixaOrdem: 'asc' } });
    let total = 0, restante = base, anterior = 0;
    for (const f of tabela) {
      if (restante <= 0) break;
      const teto  = f.limiteAte ? Number(f.limiteAte) : Infinity;
      const faixa = Math.min(restante, teto - anterior);
      total       += faixa * Number(f.aliquota);
      restante    -= faixa;
      anterior     = teto;
    }
    return Math.round(total * 100) / 100;
  }

  // ── IRRF Lei 15.270/2025 (base sem deducao dependentes para 13o) ─────────────
  private calcIRRF(base: number): number {
    if (base <= 5000.00) return 0;
    if (base <= 7350.00) {
      const red = 978.62 - 0.133145 * base;
      return Math.max(0, Math.round((base * 0.275 - red) * 100) / 100);
    }
    return Math.round(base * 0.275 * 100) / 100;
  }

  // ── Meses trabalhados no ano (CLT: 15+ dias = mes completo) ─────────────────
  private mesesTrabalhados(ano: number, hireDate: Date, termDate?: Date | null): number {
    let meses = 0;
    for (let m = 0; m < 12; m++) {
      const mesIni  = new Date(ano, m, 1);
      const mesFim  = new Date(ano, m + 1, 0); // ultimo dia do mes
      // Funcionario nao estava ativo neste mes
      if (hireDate > mesFim) continue;
      if (termDate && termDate < mesIni) continue;
      // Admissao: se admitido apos dia 15 nao conta
      if (hireDate.getFullYear() === ano && hireDate.getMonth() === m) {
        if (hireDate.getDate() > 15) continue;
      }
      // Desligamento: se desligado antes do dia 16 nao conta
      if (termDate && termDate.getFullYear() === ano && termDate.getMonth() === m) {
        if (termDate.getDate() < 16) continue;
      }
      meses++;
    }
    return meses;
  }

  // ── Calcula 13o para todos os funcionarios ativos da empresa ─────────────────
  async calcularParaEmpresa(companyId: string, ano: number, userId: string) {
    // Apenas funcionarios sem desligamento (ou desligados em ano futuro)
    const emps = await this.prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      include: { terminations: { where: { companyId } } },
    });

    const resultados = [];
    for (const emp of emps) {
      try {
        const r = await this.calcularUm(companyId, emp.id, ano, userId);
        resultados.push({ employeeId: emp.id, nome: emp.fullName, status: 'OK', ...r });
      } catch(e: any) {
        resultados.push({ employeeId: emp.id, nome: emp.fullName, status: 'ERRO: ' + e.message });
      }
    }
    return { ano, total: resultados.filter(r => r.status === 'OK').length, resultados };
  }

  async calcularUm(companyId: string, employeeId: string, ano: number, userId: string) {
    const emp  = await this.prisma.employee.findFirstOrThrow({
      where: { id: employeeId, companyId, deletedAt: null },
      include: { terminations: { where: { companyId } } },
    });
    const term       = (emp.terminations as any[])[0];
    const hireDate   = new Date(emp.hireDate);
    const termDate   = term ? new Date(term.dataDesligamento ?? term.lastWorkingDay) : null;
    const meses      = this.mesesTrabalhados(ano, hireDate, termDate);
    if (meses === 0) throw new BadRequestException('Funcionario nao trabalhou em ' + ano);

    const salarioBase  = Number(emp.salary);
    const valorBruto   = Math.round(salarioBase * meses / 12 * 100) / 100;
    const primeiraParcela = Math.round(valorBruto / 2 * 100) / 100;
    const valorInss    = await this.calcINSS(valorBruto);
    const baseIRRF     = Math.max(0, valorBruto - valorInss);
    const valorIrrf    = this.calcIRRF(baseIRRF);
    const segundaLiq   = Math.round((valorBruto - primeiraParcela - valorInss - valorIrrf) * 100) / 100;

    // Upsert — recalcula se ja existia
    const existing = await this.prisma.decimoTerceiro.findFirst({
      where: { companyId, employeeId, ano },
    });
    const data = {
      companyId, employeeId, ano, mesesTrabalhados: meses,
      salarioBase:         new Decimal(salarioBase),
      mediaVariavel:       new Decimal(0),
      valorBruto:          new Decimal(valorBruto),
      primeiraParcelaValor:new Decimal(primeiraParcela),
      segundaParcelaValor: new Decimal(Math.round((valorBruto - primeiraParcela) * 100) / 100),
      valorInss:           new Decimal(valorInss),
      valorIrrf:           new Decimal(valorIrrf),
      segundaParcelaLiquido: new Decimal(segundaLiq),
      status:              'CALCULADO' as const,
      createdById:         userId,
    };
    if (existing) {
      return this.prisma.decimoTerceiro.update({ where: { id: existing.id }, data });
    }
    return this.prisma.decimoTerceiro.create({ data });
  }

  async listar(companyId: string, ano: number) {
    return this.prisma.decimoTerceiro.findMany({
      where: { companyId, ano },
      include: { employee: { select: { id: true, fullName: true, role: true, taxId: true } } },
      orderBy: { employee: { fullName: 'asc' } },
    });
  }

  async pagarPrimeira(companyId: string, id: string, dataPgto: string) {
    return this.prisma.decimoTerceiro.update({
      where: { id },
      data: { primeiraParcelaPagoEm: new Date(dataPgto), status: 'PRIMEIRA_PAGA' },
    });
  }

  async pagarSegunda(companyId: string, id: string, dataPgto: string) {
    return this.prisma.decimoTerceiro.update({
      where: { id },
      data: { segundaParcelaPagoEm: new Date(dataPgto), status: 'QUITADO' },
    });
  }

  async gerarReciboHtml(companyId: string, id: string, parcela: 1 | 2): Promise<string> {
    const dt = await this.prisma.decimoTerceiro.findFirstOrThrow({
      where: { id, companyId },
      include: { employee: true, company: true },
    });
    const emp = dt.employee as any;
    const co  = dt.company  as any;
    const brl = (v: any) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    const fmt = (d: any) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
    const isPrim = parcela === 1;

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:40px;color:#222}
  h2{text-align:center;font-size:16px;margin-bottom:2px}
  .sub{text-align:center;font-size:12px;color:#555;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin:10px 0}
  td{padding:6px 8px;border:0.5px solid #ccc}
  .lbl{font-weight:bold;background:#f5f5f5;width:50%}
  .vr{text-align:right}
  .prov{background:#f0fff0}.desc{background:#fff0f0}
  .tot{background:#e8f4fd;font-weight:bold;font-size:13px}
  .assin{text-align:center;margin-top:60px}
  .linha{border-top:1px solid #333;padding-top:4px;margin-top:40px;display:inline-block;width:280px}
</style></head><body>
<h2>${co.name ?? co.tradeName}</h2>
<div class="sub">CNPJ: ${co.taxId} — RECIBO DE ${isPrim?'1ª':'2ª'} PARCELA DO 13º SALÁRIO ${dt.ano}</div>
<table>
  <tr><td class="lbl">Funcionário</td><td>${emp.fullName}</td>
      <td class="lbl">CPF</td><td>${emp.taxId}</td></tr>
  <tr><td class="lbl">Cargo</td><td>${emp.role??'—'}</td>
      <td class="lbl">Meses Trabalhados</td><td>${dt.mesesTrabalhados}/12</td></tr>
</table>
<table>
  <tr><th style="background:#f0f7ff;text-align:left;padding:6px 8px">Descrição</th>
      <th style="background:#f0f7ff;text-align:right;padding:6px 8px">Valor</th></tr>
  <tr class="prov"><td class="lbl">13º Salário Bruto (${dt.mesesTrabalhados}/12)</td>
      <td class="vr">${brl(dt.valorBruto)}</td></tr>
  ${isPrim ? `
  <tr class="prov"><td class="lbl">1ª Parcela (50% do bruto)</td>
      <td class="vr">${brl(dt.primeiraParcelaValor)}</td></tr>
  <tr class="tot"><td>VALOR A RECEBER</td><td class="vr">${brl(dt.primeiraParcelaValor)}</td></tr>
  ` : `
  <tr><td class="lbl">(-) 1ª Parcela já paga</td>
      <td class="vr">(${brl(dt.primeiraParcelaValor)})</td></tr>
  <tr class="desc"><td class="lbl">(-) INSS (sobre total bruto)</td>
      <td class="vr">(${brl(dt.valorInss)})</td></tr>
  <tr class="desc"><td class="lbl">(-) IRRF</td>
      <td class="vr">(${brl(dt.valorIrrf)})</td></tr>
  <tr class="tot"><td>2ª PARCELA LÍQUIDA</td><td class="vr">${brl(dt.segundaParcelaLiquido)}</td></tr>
  `}
</table>
<p style="font-size:10px;color:#888;margin-top:8px">
  ${isPrim
    ? 'Prazo legal: até 30 de novembro (CLT art. 3º, §2º, Lei 4.749/1965)'
    : 'Prazo legal: até 20 de dezembro (CLT art. 1º, Lei 4.749/1965) — Dedução INSS + IRRF sobre total bruto'}
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
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf  = await page.pdf({ format: 'A4',
        margin: { top:'20mm', bottom:'20mm', left:'15mm', right:'15mm' } });
      return Buffer.from(pdf);
    } finally { await browser.close(); }
  }
}
