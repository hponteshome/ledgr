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

  // ── Gerar DARF HTML ────────────────────────────────────────────────────────
  async gerarDarfHtml(companyId: string, competencia: string, tipo: string): Promise<{ html: string }> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const apuracao = await this.prisma.apuracaoImpostos.findFirst({
      where: { companyId, competencia, tipo: tipo as any },
    });
    if (!apuracao) throw new Error('Apuracao nao encontrada para ' + competencia + ' / ' + tipo);

    const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtCNPJ = (v: string) => (v||'').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    const fmtComp = (c: string) => { const [y,m]=c.split('-'); return m+'/'+y; };
    const venc = (comp: string) => {
      const [y,m] = comp.split('-').map(Number);
      const d = m === 12 ? new Date(y+1,0,25) : new Date(y,m,25);
      return d.toLocaleDateString('pt-BR');
    };

    const css = '<style>*{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}body{background:#fff;padding:20px}' +
      '.guia{border:2px solid #000;width:720px;margin:0 auto}' +
      '.hdr{background:#004080;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center}' +
      '.hdr h1{font-size:13px;font-weight:bold}.cod{font-size:22px;font-weight:bold;letter-spacing:2px}' +
      '.sec{border-bottom:1px solid #000;padding:8px 12px}' +
      '.row{display:grid;gap:8px;margin-top:6px}' +
      '.f label{font-size:9px;text-transform:uppercase;color:#555;display:block}.f span{font-size:12px;font-weight:bold}' +
      '.tot{background:#f0f0f0;padding:10px 12px;display:flex;justify-content:space-between;align-items:center}' +
      '.tot label{font-size:10px;text-transform:uppercase;color:#555}' +
      '.tot span{font-size:20px;font-weight:bold;color:#004080}' +
      '.foot{padding:6px 10px;font-size:9px;color:#555;text-align:center}' +
      '.sep{border-top:2px dashed #000;margin:16px 0;padding-top:16px}' +
      '</style>';

    let html = '<!DOCTYPE html><html><head><meta charset=utf-8>' + css + '</head><body>';

    const renderDarf = (titulo: string, subtitulo: string, codReceita: string, valor: number) => {
      if (valor <= 0) return '';
      return '<div class=guia>' +
        '<div class=hdr><div><h1>DARF - DOCUMENTO DE ARRECADACAO DE RECEITAS FEDERAIS</h1>' +
        '<div style=font-size:10px>' + subtitulo + '</div></div><div class=cod>' + codReceita + '</div></div>' +
        '<div class=sec><div class=row style=grid-template-columns:repeat(3,1fr)>' +
        '<div class=f><label>CNPJ Contribuinte</label><span>' + fmtCNPJ(company.taxId) + '</span></div>' +
        '<div class=f><label>Nome Empresarial</label><span>' + company.legalName + '</span></div>' +
        '<div class=f><label>Periodo de Apuracao</label><span>' + fmtComp(competencia) + '</span></div>' +
        '</div></div>' +
        '<div class=sec><div class=row style=grid-template-columns:repeat(4,1fr)>' +
        '<div class=f><label>Codigo Receita</label><span>' + codReceita + '</span></div>' +
        '<div class=f><label>Tipo</label><span>' + titulo + '</span></div>' +
        '<div class=f><label>Regime</label><span>' + (apuracao.regime === 'LUCRO_REAL' ? 'Nao-Cumulativo' : 'Cumulativo') + '</span></div>' +
        '<div class=f><label>Base de Calculo</label><span>R$ ' + fmtBRL(Number(apuracao.receitaBruta ?? apuracao.baseIrpj ?? 0)) + '</span></div>' +
        '</div>' +
        '<div class=row style="grid-template-columns:repeat(3,1fr);margin-top:10px">' +
        '<div class=f><label>Valor Principal</label><span>R$ ' + fmtBRL(valor) + '</span></div>' +
        '<div class=f><label>Multa</label><span>R$ 0,00</span></div>' +
        '<div class=f><label>Juros / Encargos</label><span>R$ 0,00</span></div>' +
        '</div></div>' +
        '<div class=tot>' +
        '<div><label>Vencimento</label><div style=font-size:14px;font-weight:bold>' + venc(competencia) + '</div></div>' +
        '<div style=text-align:right><label>Valor Total a Recolher</label><div><span>R$ ' + fmtBRL(valor) + '</span></div></div>' +
        '</div>' +
        '<div class=foot>Guia gerada pelo LEDGR &mdash; Verificar valores antes do pagamento.</div>' +
        '</div>';
    };

    if (tipo === 'PIS_COFINS') {
      const pis    = Number(apuracao.pisDevido    ?? 0);
      const cofins = Number(apuracao.cofinsDevido ?? 0);
      // PIS cod 6912 (nao-cumulativo) ou 8109 (cumulativo)
      // COFINS cod 5856 (nao-cumulativo) ou 2172 (cumulativo)
      const codPis    = apuracao.regime === 'LUCRO_REAL' ? '6912' : '8109';
      const codCofins = apuracao.regime === 'LUCRO_REAL' ? '5856' : '2172';
      html += renderDarf('PIS', 'PIS sobre Receita', codPis, pis);
      if (pis > 0 && cofins > 0) html += '<div style="page-break-after:always"></div>';
      html += renderDarf('COFINS', 'COFINS sobre Receita', codCofins, cofins);
    } else {
      const irpj = Number(apuracao.irpjDevido ?? 0);
      const csll = Number(apuracao.csllDevida ?? 0);
      // IRPJ cod 2362 (estimativa mensal Lucro Real) / CSLL cod 2484
      html += renderDarf('IRPJ', 'Imposto de Renda Pessoa Juridica', '2362', irpj);
      if (irpj > 0 && csll > 0) html += '<div style="page-break-after:always"></div>';
      html += renderDarf('CSLL', 'Contribuicao Social sobre Lucro Liquido', '2484', csll);
    }

    html += '</body></html>';
    return { html };
  }

  async gerarDarfPdf(companyId: string, competencia: string, tipo: string): Promise<{ pdf: Buffer; filename: string }> {
    const { html } = await this.gerarDarfHtml(companyId, competencia, tipo);
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdf = Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
      return { pdf, filename: 'DARF_' + tipo + '_' + competencia.replace('-','_') + '.pdf' };
    } finally {
      await browser.close();
    }
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
