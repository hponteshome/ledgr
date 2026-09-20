// apps/api/src/modules/apuracao/apuracao.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ApuracaoService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Busca resultado contabil do periodo (receitas - despesas) ──────────────
  async getResultadoContabil(companyId: string, competencia: string, competenciaFim?: string) {
    const [ano, mes] = competencia.split('-').map(Number);
    const fimComp = competenciaFim ?? competencia;
    const [anoF, mesF] = fimComp.split('-').map(Number);
    // CORRIGIDO 20/09/2026: datas em UTC (lancamentos sao gravados em UTC; com Date local o
    // dia 01/01 saia do ano e o 01/01 seguinte entrava). Fim = ultimo dia do mes, 23:59:59.999.
    const ini = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(anoF, mesF, 0, 23, 59, 59, 999));

    // CORRIGIDO 20/09/2026: antes somava o "value" de TODAS as partidas (debito + credito juntos),
    // incluia lancamentos excluidos (soft-delete) e os de encerramento (isClosingEntry) - cada
    // encerramento gravado/revertido inflava o resultado (ex.: 2018 = 64,5 mi em vez de 3,1 mi).
    // Agora usa o movimento real por conta (debito x credito), so lancamentos ativos e sem encerramento
    // - mesma base do DRE (excludeClosing) e da tela de Encerramento de Exercicios.
    const rows = await this.prisma.journalEntryItem.groupBy({
      by: ['accountId', 'type'],
      where: {
        journalEntry: { companyId, deletedAt: null, isClosingEntry: false, date: { gte: ini, lte: fim } },
        account: { type: { in: ['REVENUE', 'EXPENSE'] as any } },
      },
      _sum: { value: true },
    });

    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: Array.from(new Set(rows.map(r => r.accountId))) } },
      select: { id: true, type: true, nature: true, code: true, name: true },
    });

    const accMap = new Map(accounts.map(a => [a.id, a]));

    const porConta = new Map<string, { debito: number; credito: number }>();
    for (const row of rows) {
      const m = porConta.get(row.accountId) ?? { debito: 0, credito: 0 };
      const val = Number(row._sum.value ?? 0);
      if (row.type === 'DEBIT') m.debito += val;
      else m.credito += val;
      porConta.set(row.accountId, m);
    }

    let receitas = 0, despesas = 0;
    const detalhes: any[] = [];

    for (const [accountId, m] of porConta) {
      const acc = accMap.get(accountId);
      if (!acc) continue;
      if (acc.type === 'REVENUE') {
        const saldo = m.credito - m.debito;
        receitas += saldo;
        detalhes.push({ ...acc, saldo });
      } else {
        const despesa = m.debito - m.credito;
        despesas += despesa;
        detalhes.push({ ...acc, saldo: -despesa });
      }
    }

    return { receitas, despesas, resultado: receitas - despesas, detalhes };
  }

  // ── Busca receitas brutas para PIS/COFINS ──────────────────────────────────
  async getReceitasBrutas(companyId: string, competencia: string, competenciaFim?: string) {
    const [ano, mes] = competencia.split('-').map(Number);
    const fimComp = competenciaFim ?? competencia;
    const [anoF, mesF] = fimComp.split('-').map(Number);
    // CORRIGIDO 20/09/2026: receita bruta = movimento REAL das contas de receita (credito - debito). Antes somava o
    // value de todas as partidas (debito + credito juntos), incluia lancamentos excluidos (deletedAt) e de
    // encerramento (isClosingEntry - o encerramento debita a receita e ENTRAVA somando) e usava Date local.
    // Mesmos criterios do getResultadoContabil (datas em UTC).
    const ini = new Date(Date.UTC(ano, mes - 1, 1));
    const fim = new Date(Date.UTC(anoF, mesF, 0, 23, 59, 59, 999));

    const rows = await this.prisma.journalEntryItem.groupBy({
      by: ['accountId', 'type'],
      where: {
        journalEntry: { companyId, deletedAt: null, isClosingEntry: false, date: { gte: ini, lte: fim } },
        account: { type: 'REVENUE' as any },
      },
      _sum: { value: true },
    });

    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { id: { in: Array.from(new Set(rows.map(r => r.accountId))) } },
      select: { id: true, code: true, name: true, nature: true },
    });
    const accMap = new Map(accounts.map(a => [a.id, a]));

    const porConta = new Map<string, { debito: number; credito: number }>();
    for (const row of rows) {
      const m = porConta.get(row.accountId) ?? { debito: 0, credito: 0 };
      const val = Number(row._sum.value ?? 0);
      if (row.type === 'DEBIT') m.debito += val;
      else m.credito += val;
      porConta.set(row.accountId, m);
    }

    let total = 0;
    const itens: any[] = [];
    for (const [accountId, m] of porConta) {
      const acc = accMap.get(accountId);
      if (!acc) continue;
      const val = m.credito - m.debito;
      total += val;
      itens.push({ accountId, code: acc.code, name: acc.name, valor: val });
    }
    return { total, itens };
  }

  // ── Calcular e salvar apuracao PIS/COFINS ──────────────────────────────────
  async calcularPisCofins(companyId: string, competencia: string, dto: any, userId: string) {
    const regime = dto.regime ?? 'LUCRO_REAL';
    const competenciaFim = dto.competenciaFim ?? competencia;
    const aliqPis    = regime === 'LUCRO_REAL' ? 0.0165 : 0.0065;
    const aliqCofins = regime === 'LUCRO_REAL' ? 0.076  : 0.03;

    const { total: receitaBruta } = await this.getReceitasBrutas(companyId, competencia, competenciaFim);
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
    const competenciaIni = dto.competenciaInicio ?? competencia;
    const competenciaFim = dto.competenciaFim ?? competencia;
    const { resultado } = await this.getResultadoContabil(companyId, competenciaIni, competenciaFim);

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
      // Lucro Presumido: acumula receitas do periodo
      const { total: receitaBrutaAcum } = await this.getReceitasBrutas(companyId, competenciaIni, competenciaFim);
      const receitaBruta = Number(dto.receitaBruta) || receitaBrutaAcum;
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
    // NOVO 20/09/2026: a compensacao de prejuizos fiscais nao e lancada aqui - a Parte B nativa a calcula
    // sozinha (saldo disponivel e trava de 30% do lucro real). Itens COMPENSACAO antigos continuam visiveis.
    if (dto?.tipo === 'COMPENSACAO') {
      throw new BadRequestException('A compensação de prejuízos fiscais é calculada automaticamente na Parte B do Livro LALUR (limite de 30% do lucro real) e não é lançada como ajuste.');
    }
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


  // ── Sugerir itens LALUR a partir de contas marcadas ──────────────────────
  async sugerirLalur(companyId: string, competencia: string) {
    const [ano, mes] = competencia.split('-').map(Number);
    const ini = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    // Buscar contas com deducibilidade configurada (nao totalmente dedutiveis)
    const contas = await this.prisma.chartOfAccounts.findMany({
      where: {
        companyId,
        isAnalytic: true,
        type: 'EXPENSE' as any,
        dedutibilidade: { in: ['NAO_DEDUTIVEL', 'PARCIALMENTE_DEDUTIVEL'] },
      },
      select: {
        id: true, code: true, name: true,
        dedutibilidade: true, percDeducao: true,
        lalurTipoAjuste: true, lalurDescricao: true,
      },
    });

    if (!contas.length) return { sugestoes: [], message: 'Nenhuma conta configurada como nao-dedutivel.' };

    // Buscar saldos do periodo
    const saldos = await this.prisma.journalEntryItem.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: { companyId, date: { gte: ini, lte: fim } },
        account: { id: { in: contas.map(c => c.id) } },
      },
      _sum: { value: true },
    });

    const saldoMap = new Map(saldos.map(s => [s.accountId, Number(s._sum.value ?? 0)]));

    const sugestoes = contas
      .map(conta => {
        const saldoTotal = saldoMap.get(conta.id) ?? 0;
        if (saldoTotal <= 0) return null;
        const percNaoDedu = conta.dedutibilidade === 'NAO_DEDUTIVEL'
          ? 100
          : 100 - Number(conta.percDeducao ?? 100);
        const valorAjuste = saldoTotal * (percNaoDedu / 100);
        if (valorAjuste <= 0) return null;
        return {
          accountId: conta.id,
          code: conta.code,
          name: conta.name,
          dedutibilidade: conta.dedutibilidade,
          percDeducao: Number(conta.percDeducao ?? 100),
          percNaoDedu,
          saldoTotal,
          valorAjuste: Math.round(valorAjuste * 100) / 100,
          tipo: conta.lalurTipoAjuste ?? 'ADICAO',
          imposto: 'AMBOS',
          descricao: conta.lalurDescricao ?? ('Adicao: ' + conta.name + ' (nao dedutivel)'),
        };
      })
      .filter(Boolean);

    return { sugestoes, total: sugestoes.reduce((s, i) => s + (i?.valorAjuste ?? 0), 0) };
  }

  // ── Aplicar sugestoes LALUR em lote ───────────────────────────────────────
  async aplicarSugestoes(companyId: string, competencia: string, sugestoes: any[], userId: string) {
    const resultados = [];
    for (const s of sugestoes) {
      const item = await this.addLalurItem(companyId, competencia, {
        tipo: s.tipo,
        imposto: s.imposto,
        descricao: s.descricao,
        valor: s.valorAjuste,
        contaId: s.accountId,
        observacao: 'Sugerido automaticamente - ' + s.dedutibilidade + ' ' + s.percNaoDedu + '% nao dedutivel',
      }, userId);
      resultados.push(item);
    }
    return resultados;
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

  // ── Busca NFS-e do periodo para detalhamento da base ─────────────────────
  async getDocumentosFiscaisPeriodo(companyId: string, competenciaIni: string, competenciaFim: string) {
    const [anoI, mesI] = competenciaIni.split('-').map(Number);
    const [anoF, mesF] = competenciaFim.split('-').map(Number);
    const ini = new Date(anoI, mesI - 1, 1);
    const fim = new Date(anoF, mesF, 0, 23, 59, 59);
    const docs = await this.prisma.fiscalDocument.findMany({
      where: {
        companyId,
        issueDate: { gte: ini, lte: fim },
        deletedAt: null,
        integrationStatus: 'INTEGRATED',
      },
      select: {
        id: true, documentNumber: true, issuerName: true, issuerCnpj: true,
        issueDate: true, competenceMonth: true,
        grossAmount: true, netAmount: true, discountAmount: true,
        pisAmount: true, cofinsAmount: true, irAmount: true,
        csllAmount: true, inssAmount: true, issAmount: true,
        notes: true,
      },
      orderBy: [{ competenceMonth: 'asc' }, { documentNumber: 'asc' }],
    });
    const totais = docs.reduce((acc, d) => ({
      grossAmount:  acc.grossAmount  + Number(d.grossAmount),
      pisAmount:    acc.pisAmount    + Number(d.pisAmount),
      cofinsAmount: acc.cofinsAmount + Number(d.cofinsAmount),
      irAmount:     acc.irAmount     + Number(d.irAmount),
      csllAmount:   acc.csllAmount   + Number(d.csllAmount),
      inssAmount:   acc.inssAmount   + Number(d.inssAmount),
      issAmount:    acc.issAmount    + Number(d.issAmount),
    }), { grossAmount:0, pisAmount:0, cofinsAmount:0, irAmount:0, csllAmount:0, inssAmount:0, issAmount:0 });
    return { docs, totais, total: docs.length };
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

  // CRIADO 26/08/2026: Parte B NATIVA do LALUR - calculada a partir dos
  // lancamentos contabeis reais (getResultadoContabil, anual) + ajustes ja
  // lancados na Parte A (LalurItem) do mesmo ano. Distinta da Parte B
  // importada da ECF (EcfPartB) - esta reflete a escrituracao propria em
  // LEDGR, usada para o Livro LALUR oficial e conciliacao cruzada.
  // NOVO 20/09/2026: calculo em CADEIA - recalcula, em ordem, do primeiro ano escriturado da empresa
  // (primeiro lancamento ativo, inclusive abertura) ate o ano pedido. Cada ano parte do saldo final do
  // anterior, entao calcular so um ano deixava os seguintes desatualizados e exigia clicar ano a ano.
  // Mantem a assinatura e o retorno (Parte B do ano pedido), entao controller e tela nao mudam.
  async calcularPartBNativa(companyId: string, ano: string, userId?: string) {
    const alvo = Number(ano);
    const primeiro = await this.getPrimeiroAnoEscrituracao(companyId);
    const inicio = primeiro !== null && primeiro < alvo ? primeiro : alvo;

    let resultado: Record<string, any> = {};
    for (let a = inicio; a <= alvo; a++) {
      resultado = await this.calcularAnoPartBNativa(companyId, String(a), userId);
    }
    return resultado;
  }

  private async getPrimeiroAnoEscrituracao(companyId: string): Promise<number | null> {
    const r = await this.prisma.journalEntry.aggregate({
      where: { companyId, deletedAt: null },
      _min: { date: true },
    });
    const anoLancamento = r._min.date ? r._min.date.getUTCFullYear() : null;
    // Inclui anos ja gravados na Parte B (ex.: saldo inicial manual informado antes do primeiro lancamento)
    const rb = await this.prisma.lalurPartBNativo.aggregate({ where: { companyId }, _min: { ano: true } });
    const anoRegistro = rb._min.ano ? Number(rb._min.ano) : null;
    if (anoLancamento === null) return anoRegistro;
    return anoRegistro !== null ? Math.min(anoLancamento, anoRegistro) : anoLancamento;
  }

  // Calculo de UM ano (usado pela cadeia acima).
  private async calcularAnoPartBNativa(companyId: string, ano: string, userId?: string) {
    const competenciaIni = `${ano}-01`;
    const competenciaFim = `${ano}-12`;
    const { resultado } = await this.getResultadoContabil(companyId, competenciaIni, competenciaFim);

    // NOVO 20/09/2026: saldo de abertura de prejuizo (Lancamento de Abertura) na conta de Prejuizo do
    // Exercicio configurada no encerramento - a Parte B nativa comecava sempre do zero e ignorava o
    // prejuizo acumulado que veio de exercicios anteriores ao primeiro ano escriturado no LEDGR.
    const configEnc = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    const contaPrejuizoId = configEnc?.encerramentoContaPrejuizoExercicioId ?? null;

    const itensAno = await this.prisma.lalurItem.findMany({
      where: { companyId, competencia: { gte: competenciaIni, lte: competenciaFim } },
    });

    const resultados: Record<string, any> = {};

    for (const tipoTributo of ['I', 'C']) {
      const imposto = tipoTributo === 'I' ? 'IRPJ' : 'CSLL';
      const adicoes = itensAno
        .filter(i => i.tipo === 'ADICAO' && (i.imposto === imposto || i.imposto === 'AMBOS'))
        .reduce((s, i) => s + Number(i.valor), 0);
      const exclusoes = itensAno
        .filter(i => i.tipo === 'EXCLUSAO' && (i.imposto === imposto || i.imposto === 'AMBOS'))
        .reduce((s, i) => s + Number(i.valor), 0);

      const lucroReal = resultado + adicoes - exclusoes;

      // Saldo inicial: valor MANUAL (informado na tela do Livro) sobrepoe o automatico
      // (saldo final do ano anterior + abertura da contabilidade).
      const existente = await this.prisma.lalurPartBNativo.findUnique({
        where: { companyId_ano_tipoTributo: { companyId, ano, tipoTributo } },
        select: { saldoInicialManual: true },
      });
      const saldoInicial = existente?.saldoInicialManual != null
        ? Number(existente.saldoInicialManual)
        : await this.calcularSaldoInicialAuto(companyId, ano, tipoTributo, contaPrejuizoId);

      let novoPrejuizo = 0, compensacao = 0;
      if (lucroReal < 0) {
        // gera novo prejuizo/base negativa a compensar em anos futuros
        novoPrejuizo = Math.abs(lucroReal);
      } else if (lucroReal > 0 && saldoInicial > 0) {
        // TRAVA DOS 30%: compensacao de prejuizo fiscal nunca pode exceder
        // 30% do lucro real positivo do proprio ano (Lei 9.065/1995, art. 15/16)
        const limiteTrava = lucroReal * 0.30;
        compensacao = Math.min(saldoInicial, limiteTrava);
      }
      const saldoFinal = saldoInicial + novoPrejuizo - compensacao;

      const salvo = await this.prisma.lalurPartBNativo.upsert({
        where: { companyId_ano_tipoTributo: { companyId, ano, tipoTributo } },
        create: {
          companyId, ano, tipoTributo, saldoInicial, novoPrejuizo, compensacao, saldoFinal,
          lucroRealAno: lucroReal, createdById: userId,
        },
        update: { saldoInicial, novoPrejuizo, compensacao, saldoFinal, lucroRealAno: lucroReal },
      });
      resultados[tipoTributo] = salvo;
    }

    return resultados;
  }

  // NOVO 20/09/2026: saldo inicial AUTOMATICO de um ano/tributo = saldo final do ano anterior (ja gravado)
  // + saldo de abertura que passou a existir desde o inicio daquele ano (ver getSaldoAberturaPrejuizo).
  // Sem ano anterior gravado: usa direto a abertura anterior a 01/01 do ano.
  private async calcularSaldoInicialAuto(companyId: string, ano: string, tipoTributo: string, contaPrejuizoId: string | null): Promise<number> {
    const aberturaAno = await this.getSaldoAberturaPrejuizo(companyId, contaPrejuizoId, Number(ano));
    const anterior = await this.prisma.lalurPartBNativo.findFirst({
      where: { companyId, tipoTributo, ano: { lt: ano } },
      orderBy: { ano: 'desc' },
    });
    if (anterior) {
      const aberturaAnterior = await this.getSaldoAberturaPrejuizo(companyId, contaPrejuizoId, Number(anterior.ano));
      return Math.max(0, Number(anterior.saldoFinal) + aberturaAno - aberturaAnterior);
    }
    return Math.max(0, aberturaAno);
  }

  // NOVO 20/09/2026: saldos iniciais do ano (IRPJ e CSLL) para a tela: automatico, manual (se houver) e efetivo.
  async getSaldosIniciais(companyId: string, ano: string) {
    const configEnc = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    const contaPrejuizoId = configEnc?.encerramentoContaPrejuizoExercicioId ?? null;
    const saldos: Record<string, { automatico: number; manual: number | null; efetivo: number }> = {};
    for (const tipoTributo of ['I', 'C']) {
      const automatico = await this.calcularSaldoInicialAuto(companyId, ano, tipoTributo, contaPrejuizoId);
      const linha = await this.prisma.lalurPartBNativo.findUnique({
        where: { companyId_ano_tipoTributo: { companyId, ano, tipoTributo } },
        select: { saldoInicial: true, saldoInicialManual: true },
      });
      const manual = linha?.saldoInicialManual != null ? Number(linha.saldoInicialManual) : null;
      saldos[tipoTributo] = { automatico, manual, efetivo: manual ?? (linha ? Number(linha.saldoInicial) : automatico) };
    }
    return { ano, saldos };
  }

  // NOVO 20/09/2026: grava (ou limpa, com null) o saldo inicial MANUAL do ano por tributo e recalcula a cadeia.
  // So mexe nos tributos informados no corpo ({ I?, C? }).
  async definirSaldoInicial(companyId: string, ano: string, saldos: { I?: number | null; C?: number | null }, userId?: string) {
    if (!/^\d{4}$/.test(ano)) throw new BadRequestException('Ano invalido.');
    for (const tipoTributo of ['I', 'C'] as const) {
      if (!(tipoTributo in saldos)) continue;
      const bruto = saldos[tipoTributo];
      const manual = bruto === null || bruto === undefined ? null : Number(bruto);
      if (manual !== null && (!Number.isFinite(manual) || manual < 0)) {
        throw new BadRequestException('Saldo inicial invalido para ' + (tipoTributo === 'I' ? 'IRPJ' : 'CSLL') + '.');
      }
      await this.prisma.lalurPartBNativo.upsert({
        where: { companyId_ano_tipoTributo: { companyId, ano, tipoTributo } },
        create: { companyId, ano, tipoTributo, saldoInicial: manual ?? 0, saldoFinal: manual ?? 0, saldoInicialManual: manual, createdById: userId },
        update: { saldoInicialManual: manual },
      });
    }
    // recalcula do 1o ano ate o ultimo ano ja gravado (ou o ano informado, se maior)
    const ultimo = await this.prisma.lalurPartBNativo.aggregate({ where: { companyId }, _max: { ano: true } });
    const alvo = Math.max(Number(ano), ultimo._max.ano ? Number(ultimo._max.ano) : 0);
    await this.calcularPartBNativa(companyId, String(alvo), userId);
    return this.getSaldosIniciais(companyId, ano);
  }

  // CRIADO 20/09/2026: saldo devedor (D - C) da conta de Prejuizo do Exercicio ate 31/12 do ano anterior,
  // SEM lancamentos de encerramento e sem excluidos - ou seja, o que veio de saldo de abertura
  // (Lancamento de Abertura). Os encerramentos ficam de fora porque o prejuizo de cada ano ja entra
  // na Parte B pelo proprio calculo (novoPrejuizo).
  private async getSaldoAberturaPrejuizo(companyId: string, contaId: string | null, ano: number): Promise<number> {
    if (!contaId) return 0;
    const rows = await this.prisma.journalEntryItem.groupBy({
      by: ['type'],
      where: {
        accountId: contaId,
        journalEntry: { companyId, deletedAt: null, isClosingEntry: false, date: { lt: new Date(Date.UTC(ano, 0, 1)) } },
      },
      _sum: { value: true },
    });
    let debito = 0, credito = 0;
    for (const r of rows) {
      const v = Number(r._sum.value ?? 0);
      if (r.type === 'DEBIT') debito += v;
      else credito += v;
    }
    return debito - credito;
  }

  // CRIADO 26/08/2026: dados formatados para o Livro LALUR oficial
  // (Relatorios -> Contabilidade), Parte A + Parte B, ano completo.
  async getLivroLalur(companyId: string, ano: string) {
    // NOVO 20/09/2026: recalcula a Parte B nativa (cadeia) ao abrir o Livro. Antes era so um retrato
    // gravado no ultimo clique em "Calcular Parte B" e ficava defasado a cada lancamento, encerramento
    // ou ajuste da Parte A. Idempotente (upsert por empresa/ano/tributo); se falhar, o Livro ainda abre
    // com o ultimo retrato gravado.
    try {
      await this.calcularPartBNativa(companyId, ano);
    } catch (e) {
      console.error('[LALUR] Falha ao recalcular Parte B nativa:', e);
    }

    const competenciaIni = `${ano}-01`;
    const competenciaFim = `${ano}-12`;

    const [parteA, parteB] = await Promise.all([
      this.prisma.lalurItem.findMany({
        where: { companyId, competencia: { gte: competenciaIni, lte: competenciaFim } },
        orderBy: [{ competencia: 'asc' }, { tipo: 'asc' }],
      }),
      this.prisma.lalurPartBNativo.findMany({
        where: { companyId, ano: { lte: ano } },
        orderBy: [{ tipoTributo: 'asc' }, { ano: 'asc' }],
      }),
    ]);

    return { parteA, parteB };
  }
}
