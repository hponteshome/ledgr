// apps/api/src/modules/darfs/darfs.service.ts
// DARFs: calculo de multa de mora e juros Selic, registro (tax_darfs), impressao HTML e PDF.
// O DARF impresso e documento de controle; o DARF numerado com codigo de barras e emitido pela RFB (Sicalc).
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const r2 = (v: number) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const pad = (n: number) => String(n).padStart(2, '0');
const isoOk = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const toUtc = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fromUtc = (d: Date) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const addDias = (s: string, n: number) => { const d = toUtc(s); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d); };
function addMonth(ym: string, k: number): string {
  let [y, m] = ym.split('-').map(Number);
  m += k;
  while (m > 12) { m -= 12; y++; }
  while (m < 1) { m += 12; y--; }
  return y + '-' + pad(m);
}
function pascoa(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mes - 1, dia));
}
function feriados(y: number): Set<string> {
  const s = new Set<string>(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'].map((x) => y + '-' + x));
  if (y >= 2024) s.add(y + '-11-20');
  const p = pascoa(y);
  for (const n of [-48, -47, -2, 60]) { const d = new Date(p); d.setUTCDate(d.getUTCDate() + n); s.add(fromUtc(d)); } // carnaval, sexta santa, corpus christi (sem expediente bancario)
  return s;
}
/** Vencimento em dia nao util e antecipado para o dia util anterior (regra dos tributos federais). */
export function diaUtilAnterior(s: string): string {
  let d = s;
  for (let k = 0; k < 10; k++) {
    const dt = toUtc(d), dow = dt.getUTCDay();
    if (dow !== 0 && dow !== 6 && !feriados(dt.getUTCFullYear()).has(d)) return d;
    d = addDias(d, -1);
  }
  return d;
}
const MODOS = ['SICALC', 'DENUNCIA', 'SEM'];

@Injectable()
export class DarfsService {
  constructor(private readonly prisma: PrismaService) {}

  private async selicMap(de: string, ate: string): Promise<Record<string, number>> {
    const rows: any[] = await (this.prisma as any).indicadorEconomico.findMany({
      where: { indicador: 'SELIC', competencia: { gte: de, lte: ate } },
      select: { competencia: true, taxaMensal: true },
    });
    const m: Record<string, number> = {};
    for (const r of rows) m[r.competencia] = Number(r.taxaMensal);
    return m;
  }

  /** Calcula multa de mora e juros de cada DARF para a data de pagamento (sem gravar). */
  async calcular(body: any) {
    const dataPagamento: string = body?.dataPagamento;
    if (!isoOk(dataPagamento)) throw new BadRequestException('Informe a data de pagamento');
    const modoPadrao = MODOS.includes(body?.multaModo) ? body.multaModo : 'SICALC';
    const ajustar = body?.ajustarVencimento !== false;
    const itens: any[] = Array.isArray(body?.itens) ? body.itens : [];
    if (!itens.length) throw new BadRequestException('Nenhum DARF informado');
    const pagYm = dataPagamento.slice(0, 7);
    const venctos = itens.map((i) => String(i?.vencimento ?? '')).filter(isoOk).sort();
    const selic = venctos.length ? await this.selicMap(venctos[0].slice(0, 7), pagYm) : {};
    const faltantes = new Set<string>();
    const out = itens.map((i, idx) => {
      const erros: string[] = [];
      const codigo = String(i?.codigo ?? '').replace(/\D/g, '');
      if (codigo.length !== 4) erros.push('codigo da receita deve ter 4 digitos');
      if (!isoOk(i?.periodoApuracao)) erros.push('periodo de apuracao invalido');
      if (!isoOk(i?.vencimento)) erros.push('vencimento invalido');
      const principal = r2(Number(i?.principal) || 0);
      if (principal <= 0) erros.push('principal deve ser maior que zero');
      const modo = MODOS.includes(i?.multaModo) ? i.multaModo : modoPadrao;
      let venc = isoOk(i?.vencimento) ? i.vencimento : null;
      if (venc && ajustar) venc = diaUtilAnterior(venc);
      let diasAtraso = 0, multaPct = 0, selicPct = 0;
      if (venc && dataPagamento > venc) {
        diasAtraso = Math.round((toUtc(dataPagamento).getTime() - toUtc(venc).getTime()) / 86400000);
        if (modo === 'SICALC') multaPct = Math.min(20, r2(diasAtraso * 0.33));
        const vm = venc.slice(0, 7);
        if (pagYm > vm) {
          selicPct = 1;
          for (let ym = addMonth(vm, 1); ym < pagYm; ym = addMonth(ym, 1)) {
            if (ym in selic) selicPct += Number(selic[ym]); else faltantes.add(ym);
          }
          selicPct = r2(selicPct);
        }
      }
      const multa = r2(principal * multaPct / 100);
      const juros = r2(principal * selicPct / 100);
      return {
        idx, codigo, descricao: String(i?.descricao ?? '').slice(0, 200), periodoApuracao: i?.periodoApuracao ?? null,
        vencimentoInformado: i?.vencimento ?? null, vencimento: venc, referencia: i?.referencia ? String(i.referencia).slice(0, 30) : null,
        principal, multaModo: modo, diasAtraso, multaPct, multa, selicPct, juros, total: r2(principal + multa + juros), erros,
      };
    });
    const alertas: string[] = [];
    if (faltantes.size) alertas.push('Selic nao cadastrada em Tabelas Legais para: ' + [...faltantes].sort().join(', ') + ' - juros subestimados.');
    if (out.some((o) => o.multaModo === 'DENUNCIA')) alertas.push('Denuncia espontanea (art. 138 do CTN): sem multa de mora; o Sicalc inclui a multa automaticamente, entao o DARF deve ser emitido com o campo da multa zerado.');
    alertas.push('O DARF impresso pelo LEDGR e documento de controle. Para pagar com codigo de barras, emita o DARF numerado no Sicalc com os mesmos valores.');
    const soma = (k: string) => r2(out.reduce((s, o: any) => s + (o.erros.length ? 0 : Number(o[k])), 0));
    return { dataPagamento, itens: out, totais: { principal: soma('principal'), multa: soma('multa'), juros: soma('juros'), total: soma('total') }, alertas };
  }

  /** Calcula e grava os DARFs validos como um lote. */
  async salvar(companyId: string, body: any, user: any) {
    const calc = await this.calcular(body);
    const validos = calc.itens.filter((i: any) => !i.erros.length);
    if (!validos.length) throw new BadRequestException('Nenhum DARF valido para gravar');
    const lote = randomUUID();
    const origem = ['ESTUDO_REGIME', 'APURACAO', 'MANUAL'].includes(body?.origem) ? body.origem : 'MANUAL';
    const origemId = body?.origemId && /^[0-9a-f-]{36}$/i.test(body.origemId) ? body.origemId : null;
    const autor = user?.name ?? user?.nome ?? user?.email ?? null;
    for (const i of validos) {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO tax_darfs (company_id, lote_id, origem, origem_id, codigo, descricao, periodo_apuracao, vencimento, numero_referencia,
               data_pagamento_prevista, principal, multa_modo, multa_pct, multa, selic_pct, juros, total, status, created_by_id, autor_nome)
        VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7::date, $8::date, $9, $10::date, $11, $12, $13, $14, $15, $16, $17, 'GERADO', $18::uuid, $19)`,
        companyId, lote, origem, origemId, i.codigo, i.descricao, i.periodoApuracao, i.vencimento, i.referencia,
        calc.dataPagamento, i.principal, i.multaModo, i.multaPct, i.multa, i.selicPct, i.juros, i.total, user?.id ?? null, autor);
    }
    return { loteId: lote, gravados: validos.length, ignorados: calc.itens.length - validos.length, ...calc };
  }

  async listar(companyId: string, q: any) {
    const ano = q?.ano ? Number(q.ano) : null;
    const status = ['GERADO', 'PAGO', 'CANCELADO'].includes(q?.status) ? q.status : null;
    return this.prisma.$queryRawUnsafe(`
      SELECT id::text AS id, lote_id::text AS lote_id, origem, codigo, descricao,
             to_char(periodo_apuracao, 'YYYY-MM-DD') AS periodo_apuracao, to_char(vencimento, 'YYYY-MM-DD') AS vencimento,
             numero_referencia, to_char(data_pagamento_prevista, 'YYYY-MM-DD') AS data_pagamento_prevista,
             principal::float8 AS principal, multa_modo, multa::float8 AS multa, selic_pct::float8 AS selic_pct, juros::float8 AS juros, total::float8 AS total,
             status, to_char(pago_em, 'YYYY-MM-DD') AS pago_em, valor_pago::float8 AS valor_pago, numero_documento, autor_nome,
             to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
        FROM tax_darfs
       WHERE company_id = $1::uuid AND deleted_at IS NULL
         AND ($2::int IS NULL OR extract(year FROM periodo_apuracao)::int = $2::int)
         AND ($3::text IS NULL OR status = $3::text)
       ORDER BY periodo_apuracao, codigo, created_at`, companyId, ano, status);
  }

  async registrarPagamento(companyId: string, id: string, body: any) {
    if (!isoOk(body?.pagoEm)) throw new BadRequestException('Informe a data do pagamento');
    const valor = r2(Number(body?.valorPago) || 0);
    if (valor <= 0) throw new BadRequestException('Informe o valor pago');
    const n = await this.prisma.$executeRawUnsafe(`
      UPDATE tax_darfs SET status = 'PAGO', pago_em = $3::date, valor_pago = $4, numero_documento = $5, updated_at = now()
       WHERE id = $1::uuid AND company_id = $2::uuid AND deleted_at IS NULL AND status <> 'CANCELADO'`,
      id, companyId, body.pagoEm, valor, body?.numeroDocumento ? String(body.numeroDocumento).slice(0, 40) : null);
    if (!n) throw new NotFoundException('DARF nao encontrado ou cancelado');
    return { ok: true };
  }

  async cancelar(companyId: string, id: string) {
    const n = await this.prisma.$executeRawUnsafe(`
      UPDATE tax_darfs SET status = 'CANCELADO', updated_at = now() WHERE id = $1::uuid AND company_id = $2::uuid AND deleted_at IS NULL AND status = 'GERADO'`, id, companyId);
    if (!n) throw new BadRequestException('So DARF com situacao GERADO pode ser cancelado');
    return { ok: true };
  }

  /** HTML de impressao: resumo + 2 DARFs por pagina A4. */
  async html(companyId: string, ids: string[]): Promise<{ html: string }> {
    const lista = (Array.isArray(ids) ? ids : []).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
    if (!lista.length) throw new BadRequestException('Selecione ao menos um DARF');
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT codigo, descricao, to_char(periodo_apuracao, 'DD/MM/YYYY') AS pa, to_char(vencimento, 'DD/MM/YYYY') AS venc,
             numero_referencia, to_char(data_pagamento_prevista, 'DD/MM/YYYY') AS pag, principal::float8 AS principal,
             multa_modo, multa::float8 AS multa, selic_pct::float8 AS selic_pct, juros::float8 AS juros, total::float8 AS total, status
        FROM tax_darfs WHERE company_id = $1::uuid AND deleted_at IS NULL AND id = ANY($2::uuid[])
       ORDER BY periodo_apuracao, codigo`, companyId, lista);
    if (!rows.length) throw new NotFoundException('DARFs nao encontrados');
    const emp: any[] = await this.prisma.$queryRawUnsafe(`SELECT legal_name, tax_id, phone_1 FROM companies WHERE id = $1::uuid`, companyId);
    const e = emp[0] ?? {};
    const cnpj = String(e.tax_id ?? '').replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    const fone = String(e.phone_1 ?? '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
    const n = (v: number) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const css = `<style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,Helvetica,sans-serif}
      body{padding:12mm 10mm;color:#000}
      h2{font-size:14px;margin-bottom:4px} .sub{font-size:11px;margin-bottom:10px;color:#333}
      table.res{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px}
      table.res th,table.res td{border:1px solid #999;padding:3px 5px} table.res th{background:#eee} .r{text-align:right}
      .nota{font-size:9px;color:#444;margin-top:6px;line-height:1.4}
      .pg{page-break-before:always}
      .darf{display:grid;grid-template-columns:55% 45%;border:1.5px solid #000;margin-bottom:9mm;height:118mm}
      .esq{border-right:1.5px solid #000;display:flex;flex-direction:column}
      .cab{display:flex;gap:8px;align-items:center;padding:6px 8px;border-bottom:1px solid #000}
      .brasao{width:38px;height:38px;border:1.5px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:bold;text-align:center}
      .cab .t{font-size:8.5px;line-height:1.35} .cab .t b{font-size:10px}
      .sig{font-size:22px;font-weight:bold;letter-spacing:3px;margin-left:auto}
      .c01{padding:5px 8px;border-bottom:1px solid #000;font-size:8px} .c01 .v{font-size:11px;font-weight:bold;margin-top:3px}
      .obs{padding:6px 8px;font-size:9.5px;line-height:1.45;flex:1}
      .aviso{padding:5px 8px;font-size:8px;border-top:1px dashed #000;color:#333}
      .dir .f{display:grid;grid-template-columns:22px 1fr auto;align-items:center;border-bottom:1px solid #000;height:9.6mm;padding-right:6px}
      .dir .f .n{font-size:9px;font-weight:bold;text-align:center;border-right:1px solid #000;height:100%;display:flex;align-items:center;justify-content:center}
      .dir .f .l{font-size:7.5px;padding-left:5px;line-height:1.2} .dir .f .v{font-size:12px;font-weight:bold}
      .dir .aut{font-size:7.5px;padding:4px 6px}
    </style>`;
    const multaTxt = (m: string) => (m === 'DENUNCIA' ? 'Sem multa de mora - denuncia espontanea (art. 138 do CTN)' : m === 'SEM' ? 'Sem multa' : 'Multa de mora 0,33% ao dia, limitada a 20%');
    const tot = (k: string) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);
    let h = `<!DOCTYPE html><html><head><meta charset="utf-8">${css}</head><body>`;
    h += `<h2>DARFs - resumo para pagamento</h2><div class="sub">${esc(e.legal_name)} - CNPJ ${cnpj}${rows[0].pag ? ' - pagamento previsto em ' + rows[0].pag : ''}</div>`;
    h += '<table class="res"><tr><th>#</th><th>Codigo</th><th>Descricao</th><th>Periodo de apuracao</th><th>Vencimento</th><th class="r">Principal</th><th class="r">Multa</th><th class="r">Juros</th><th class="r">Total</th><th>Situacao</th></tr>';
    rows.forEach((r, i) => { h += `<tr><td>${i + 1}</td><td>${r.codigo}</td><td>${esc(r.descricao)}</td><td>${r.pa}</td><td>${r.venc}</td><td class="r">${n(r.principal)}</td><td class="r">${n(r.multa)}</td><td class="r">${n(r.juros)}</td><td class="r"><b>${n(r.total)}</b></td><td>${r.status}</td></tr>`; });
    h += `<tr><th colspan="5" class="r">Total</th><th class="r">${n(tot('principal'))}</th><th class="r">${n(tot('multa'))}</th><th class="r">${n(tot('juros'))}</th><th class="r">${n(tot('total'))}</th><th></th></tr></table>`;
    h += '<div class="nota">Juros: taxa Selic acumulada do mes seguinte ao vencimento ate o mes anterior ao pagamento, mais 1% no mes do pagamento. Documento de controle gerado pelo LEDGR: para pagamento com codigo de barras, emitir o DARF numerado no Sicalc com os mesmos valores e conferir antes de pagar.</div>';
    rows.forEach((r, i) => {
      if (i % 2 === 0) h += '<div class="pg"></div>';
      h += `<div class="darf"><div class="esq">
        <div class="cab"><div class="brasao">REP.<br>FED.<br>BRASIL</div><div class="t">MINISTERIO DA FAZENDA<br>SECRETARIA ESPECIAL DA RECEITA FEDERAL DO BRASIL<br><b>Documento de Arrecadacao de Receitas Federais</b></div><div class="sig">DARF</div></div>
        <div class="c01">01 NOME / TELEFONE<div class="v">${esc(e.legal_name)}${fone ? '<br>' + fone : ''}</div></div>
        <div class="obs"><b>${esc(r.descricao)}</b><br>Selic acumulada: ${n(r.selic_pct)}%<br>${multaTxt(r.multa_modo)}${r.pag ? '<br>Valores calculados para pagamento em ' + r.pag : ''}</div>
        <div class="aviso">Documento de controle gerado pelo LEDGR. Para pagamento com codigo de barras, emitir o DARF numerado no Sicalc.</div>
      </div><div class="dir">
        <div class="f"><div class="n">02</div><div class="l">PERIODO DE APURACAO</div><div class="v">${r.pa}</div></div>
        <div class="f"><div class="n">03</div><div class="l">NUMERO DO CPF OU CNPJ</div><div class="v">${cnpj}</div></div>
        <div class="f"><div class="n">04</div><div class="l">CODIGO DA RECEITA</div><div class="v">${r.codigo}</div></div>
        <div class="f"><div class="n">05</div><div class="l">NUMERO DE REFERENCIA</div><div class="v">${esc(r.numero_referencia ?? '')}</div></div>
        <div class="f"><div class="n">06</div><div class="l">DATA DE VENCIMENTO</div><div class="v">${r.venc}</div></div>
        <div class="f"><div class="n">07</div><div class="l">VALOR DO PRINCIPAL</div><div class="v">${n(r.principal)}</div></div>
        <div class="f"><div class="n">08</div><div class="l">VALOR DA MULTA</div><div class="v">${n(r.multa)}</div></div>
        <div class="f"><div class="n">09</div><div class="l">VALOR DOS JUROS E/OU ENCARGOS DL 1.025/69</div><div class="v">${n(r.juros)}</div></div>
        <div class="f"><div class="n">10</div><div class="l">VALOR TOTAL</div><div class="v">${n(r.total)}</div></div>
        <div class="aut">11 AUTENTICACAO BANCARIA (somente nas 1a e 2a vias)</div>
      </div></div>`;
    });
    h += '</body></html>';
    return { html: h };
  }

  async pdf(companyId: string, ids: string[]): Promise<Buffer> {
    const { html } = await this.html(companyId, ids);
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      return Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
    } finally {
      await browser.close();
    }
  }
}
