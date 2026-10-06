import { Post as PostC, Body as BodyC } from '@nestjs/common';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';
// apps/api/src/modules/projects/relatorios.controller.ts
// Pacote de auditoria (04/10/2026):
//  A. Demonstrativo da Conta Individual - posicao em uma data: creditos vinculados e devolucoes ao Adquirente, com prova
//     bancaria e saldo corrente; conferencia com o ultimo saldo informado; PDF (puppeteer, como o DARF) ou dados para Excel.
//     Codigo de conferencia = SHA-256 do conteudo; toda emissao vai para o AuditLog com o codigo.
//  B. Historico da operacao - trilha do AuditLog SO de entidades do projeto (decisoes sobre movimentos que nao pertencem
//     ou sao transferencias internas ficam de fora: o projeto nunca ve o extrato que nao e dele).
import { Controller, Get, Param, Query, Req, Res, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { ProjEscopoGuard, ProjAcao } from './proj-escopo.guard';
import { UUID_RE } from './concessoes.service';
import { ProjDbService } from './proj-db.service';

const ROTULOS: Record<string, string> = {
  PROJ_PROJETO_EDITADO: 'Projeto editado',
  PROJ_OPERACAO_EDITADA: 'Operação editada',
  PROJ_CONTRAPARTE_CRIADA: 'Contraparte cadastrada',
  PROJ_CONTRAPARTE_EDITADA: 'Contraparte editada',
  PROJ_PARTICIPACAO_CRIADA: 'Participação adicionada',
  PROJ_PARTICIPACAO_ENCERRADA: 'Participação encerrada',
  PROJ_CREDITO_REMETENTE_IDENTIFICADO: 'Remetente identificado',
  PROJ_APLICACAO_REGISTRADA: 'Aplicação registrada',
  PROJ_APLICACAO_ENCERRADA: 'Aplicação encerrada',
  PROJ_SALDO_INFORMADO_REGISTRADO: 'Saldo informado registrado',
  PROJ_SALDO_INFORMADO_ENCERRADO: 'Saldo informado encerrado',
  PROJ_DOCUMENTO_BAIXADO: 'Documento baixado',
  PROJ_DEMONSTRATIVO_EMITIDO: 'Demonstrativo emitido',
};
const OCULTAS = new Set(['PROJ_EXTRATO_MOVIMENTO_DECIDIDO', 'PROJ_EXTRATO_DECISAO_ENCERRADA', 'PROJ_EXTRATO_SAIDA_DECIDIDA', 'PROJ_EXTRATO_NAO_PERTENCE']);
const humanizar = (a: string) => { const s = a.replace(/^PROJ_/, '').replace(/_/g, ' ').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const brl = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso?: string | null) => { if (!iso) return '-'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
function mascarar(doc?: string | null): string | null {
  if (!doc) return null;
  if (doc.length === 11) return '***.' + doc.slice(3, 6) + '.' + doc.slice(6, 9) + '-**';
  if (doc.length === 14) return doc.slice(0, 2) + '.' + doc.slice(2, 5) + '.' + doc.slice(5, 8) + '/' + doc.slice(8, 12) + '-' + doc.slice(12);
  return '***';
}

@Controller('projects-relatorios')
@UseGuards(JwtAuthGuard, ProjEscopoGuard)
@SkipCompanyCheck()
export class RelatoriosController {
  constructor(private readonly db: ProjDbService) {}

  private limite(ate?: string): Date {
    if (!ate) { const h = new Date(); return new Date(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())); }
    const d = new Date(String(ate).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(d.getTime())) throw new BadRequestException('Data de posicao invalida.');
    return d;
  }

  private montar(userId: string, operacaoId: string, ate: Date) {
    return this.db.comoUsuario(userId, async (tx) => {
      const op = await tx.projOperacao.findFirst({ where: { id: operacaoId, canceladoEm: null }, select: { codigo: true, nome: true, dataBase: true, projeto: { select: { nome: true } } } });
      if (!op) throw new NotFoundException('Operacao nao encontrada.');
      const vincs = await tx.projCreditoVinculo.findMany({
        where: { canceladoEm: null, credito: { operacaoId, canceladoEm: null, dataCredito: { lte: ate } } },
        select: { situacao: true, adquirenteId: true, credito: { select: { id: true, numeroOrdem: true, dataCredito: true, valor: true, remetenteNomeExtrato: true, remetente: { select: { nome: true, documento: true } } } } },
      });
      const vinculados = vincs.filter((v) => v.situacao === 'VINCULADO');
      const desvinculados = vincs.filter((v) => v.situacao === 'DESVINCULADO');
      const credIds = vinculados.map((v) => v.credito.id);
      const provas = credIds.length ? await tx.projCreditoProva.findMany({ where: { creditoId: { in: credIds }, canceladoEm: null }, select: { creditoId: true, bankTransactionId: true } }) : [];
      const devs = await tx.projAplicacao.findMany({
        where: { operacaoId, canceladoEm: null, dataAplicacao: { lte: ate }, natureza: { tipo: 'DEVOLUCAO' } },
        select: { dataAplicacao: true, valor: true, beneficiarioId: true, creditoId: true, bankTransactionId: true },
      });
      const txIds = [...new Set([...provas.map((p) => p.bankTransactionId), ...devs.map((d) => d.bankTransactionId)])];
      const txs = new Map((txIds.length ? await tx.bankTransaction.findMany({ where: { id: { in: txIds } }, select: { id: true, transactionDate: true, description: true } }) : []).map((t) => [t.id, t]));
      const pessoaIds = [...new Set([...vinculados.map((v) => v.adquirenteId), ...devs.map((d) => d.beneficiarioId)].filter((x): x is string => !!x))];
      const pessoas = new Map((pessoaIds.length ? await tx.projContraparte.findMany({ where: { id: { in: pessoaIds } }, select: { id: true, nome: true } }) : []).map((c) => [c.id, c.nome]));
      const devCred = [...new Set(devs.map((d) => d.creditoId).filter((x): x is string => !!x))];
      const numeros = new Map((devCred.length ? await tx.projCredito.findMany({ where: { id: { in: devCred } }, select: { id: true, numeroOrdem: true } }) : []).map((c) => [c.id, c.numeroOrdem]));
      const provaDe = new Map(provas.map((p) => [p.creditoId, p.bankTransactionId]));
      const cent = (v: any) => Math.round(Number(v) * 100);
      const brutas = [
        ...vinculados.map((v) => {
          const t = txs.get(provaDe.get(v.credito.id) || '');
          return {
            data: iso(v.credito.dataCredito) as string, tipo: 'CREDITO', numero: v.credito.numeroOrdem ?? null,
            contraparte: v.credito.remetente?.nome || v.credito.remetenteNomeExtrato || 'Remetente não identificado',
            documento: mascarar(v.credito.remetente?.documento), centavos: cent(v.credito.valor), creditoRef: null as number | null,
            prova: t ? t.description : null, provaData: t ? iso(t.transactionDate) : null,
          };
        }),
        ...devs.map((d) => {
          const t = txs.get(d.bankTransactionId);
          return {
            data: iso(d.dataAplicacao) as string, tipo: 'DEVOLUCAO', numero: null as number | null,
            contraparte: (d.beneficiarioId && pessoas.get(d.beneficiarioId)) || '-', documento: null as string | null, centavos: -cent(d.valor),
            creditoRef: d.creditoId ? numeros.get(d.creditoId) ?? null : null, prova: t ? t.description : null, provaData: t ? iso(t.transactionDate) : null,
          };
        }),
      ].sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === b.tipo ? 0 : a.tipo === 'CREDITO' ? -1 : 1) || (a.numero ?? 0) - (b.numero ?? 0));
      let saldo = 0;
      const linhas = brutas.map(({ centavos, ...l }) => { saldo += centavos; return { ...l, valor: (centavos / 100).toFixed(2), saldo: (saldo / 100).toFixed(2) }; });
      const creditos = brutas.filter((l) => l.tipo === 'CREDITO');
      const devolucoes = brutas.filter((l) => l.tipo === 'DEVOLUCAO');
      const pend = await tx.projCredito.aggregate({ where: { operacaoId, canceladoEm: null, dataCredito: { lte: ate }, vinculos: { none: { canceladoEm: null } } }, _count: { _all: true }, _sum: { valor: true } });
      const inf = await tx.projSaldoInformado.findFirst({
        where: { operacaoId, canceladoEm: null, tipo: 'CONTA_INDIVIDUAL', dataReferencia: { lte: ate } },
        orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }], select: { dataReferencia: true, valor: true, fonte: true },
      });
      const dados = {
        projeto: op.projeto.nome,
        operacao: { codigo: op.codigo, nome: op.nome, dataBase: iso(op.dataBase) },
        posicaoEm: iso(ate) as string,
        adquirentes: [...new Set(vinculados.map((v) => (v.adquirenteId && pessoas.get(v.adquirenteId)) || '-'))],
        linhas,
        totais: {
          qtdCreditos: creditos.length, creditos: (creditos.reduce((s, l) => s + l.centavos, 0) / 100).toFixed(2),
          qtdDevolucoes: devolucoes.length, devolucoes: (-devolucoes.reduce((s, l) => s + l.centavos, 0) / 100).toFixed(2),
          saldo: (saldo / 100).toFixed(2),
        },
        saldoInformado: inf ? { data: iso(inf.dataReferencia), valor: inf.valor.toFixed(2), fonte: inf.fonte } : null,
        diferenca: inf ? ((saldo - cent(inf.valor)) / 100).toFixed(2) : null,
        desvinculados: desvinculados.map((v) => ({ numero: v.credito.numeroOrdem ?? null, data: iso(v.credito.dataCredito), valor: v.credito.valor.toFixed(2) }))
          .sort((a, b) => String(a.data).localeCompare(String(b.data))),
        pendentes: { quantidade: pend._count._all, total: (pend._sum.valor ? pend._sum.valor.toFixed(2) : '0.00') },
      };
      const hash = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
      return { ...dados, hash, emitidoEm: new Date().toISOString() };
    });
  }

  private registrar(userId: string, operacaoId: string, d: any, formato: string) {
    return this.db.comoUsuario(userId, (tx) =>
      tx.auditLog.create({ data: { actorId: userId, action: 'PROJ_DEMONSTRATIVO_EMITIDO', targetId: operacaoId, after: { operacaoId, formato, posicaoEm: d.posicaoEm, hash: d.hash, linhas: d.linhas.length, saldo: d.totais.saldo } } }),
    );
  }

  @Get('operacoes/:operacaoId/demonstrativo')
  @ProjAcao('ver')
  async demonstrativo(@Param('operacaoId') operacaoId: string, @Query('ate') ate: string, @Query('registrar') registrar: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const d = await this.montar(req.user.id, operacaoId, this.limite(ate));
    if (registrar === 'XLSX') await this.registrar(req.user.id, operacaoId, d, 'XLSX');
    return d;
  }

  @Get('operacoes/:operacaoId/demonstrativo/pdf')
  @ProjAcao('ver')
  async demonstrativoPdf(@Param('operacaoId') operacaoId: string, @Query('ate') ate: string, @Req() req: any, @Res() res: Response) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const d = await this.montar(req.user.id, operacaoId, this.limite(ate));
    await this.registrar(req.user.id, operacaoId, d, 'PDF');
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(this.html(d), { waitUntil: 'load' });
      const pdf = Buffer.from(await page.pdf({
        format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '18mm', left: '12mm', right: '12mm' },
        displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-size:7px;width:100%;padding:0 12mm;color:#6B7280;display:flex;justify-content:space-between;font-family:Arial"><span>Código de conferência (SHA-256): ${d.hash}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
      }));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="demonstrativo-conta-individual-${d.posicaoEm}.pdf"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(pdf);
    } finally {
      await browser.close();
    }
  }

  private html(d: any): string {
    const linhas = d.linhas.map((l: any) => `<tr>
      <td>${dataBR(l.data)}</td>
      <td>${l.tipo === 'CREDITO' ? `Crédito nº ${esc(l.numero ?? '-')}` : `Devolução${l.creditoRef ? ` (crédito nº ${esc(l.creditoRef)})` : ''}`}</td>
      <td>${esc(l.contraparte)}${l.documento ? `<div class="sub">${esc(l.documento)}</div>` : ''}</td>
      <td>${l.prova ? `${dataBR(l.provaData)} · ${esc(l.prova)}` : '<span class="alerta">sem prova bancária</span>'}</td>
      <td class="num ${Number(l.valor) < 0 ? 'neg' : ''}">${brl(l.valor)}</td>
      <td class="num">${brl(l.saldo)}</td></tr>`).join('');
    const inf = d.saldoInformado
      ? `<tr><td>Saldo informado em ${dataBR(d.saldoInformado.data)}<div class="sub">${esc(d.saldoInformado.fonte)}</div></td><td class="num">${brl(d.saldoInformado.valor)}</td></tr>
         <tr><td><b>Diferença (calculado − informado)</b></td><td class="num ${Math.abs(Number(d.diferenca)) < 0.005 ? 'ok' : 'neg'}"><b>${brl(d.diferenca)}</b></td></tr>`
      : '<tr><td colspan="2" class="sub">Nenhum saldo informado até a data de posição.</td></tr>';
    const desv = d.desvinculados.length
      ? `<p class="nota"><b>Créditos fora da Conta Individual</b> (permanecem registrados como fato bancário): ${d.desvinculados.map((x: any) => `nº ${esc(x.numero ?? '-')} de ${dataBR(x.data)}, ${brl(x.valor)}`).join('; ')}.</p>` : '';
    const pend = d.pendentes.quantidade
      ? `<p class="nota alerta"><b>${d.pendentes.quantidade} crédito(s)</b>, somando ${brl(d.pendentes.total)}, aguardam decisão de vínculo e não estão neste demonstrativo.</p>` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5px; color: #111827; }
      h1 { font-size: 15px; margin: 0 0 2px; color: #134E4A; } .cab { border-bottom: 2px solid #134E4A; padding-bottom: 8px; margin-bottom: 10px; }
      .sub { font-size: 8px; color: #6B7280; } table { width: 100%; border-collapse: collapse; }
      th { background: #F0FDFA; color: #134E4A; text-align: left; font-size: 8px; text-transform: uppercase; padding: 5px; border-bottom: 1px solid #99F6E4; }
      td { padding: 4px 5px; border-bottom: 0.5px solid #E5E7EB; vertical-align: top; } tr { page-break-inside: avoid; }
      .num { text-align: right; white-space: nowrap; } .neg { color: #A32D2D; } .ok { color: #166534; } .alerta { color: #B45309; }
      .resumo { width: 55%; margin: 12px 0 0 auto; } .resumo td { font-size: 10px; } .nota { font-size: 9px; margin: 8px 0 0; }
    </style></head><body>
      <div class="cab">
        <h1>Demonstrativo da Conta Individual</h1>
        <div>${esc(d.projeto)} · ${esc(d.operacao.nome)} (${esc(d.operacao.codigo)})${d.operacao.dataBase ? ` · data-base ${dataBR(d.operacao.dataBase)}` : ''}</div>
        <div>Adquirente: <b>${esc(d.adquirentes.join(', ') || '-')}</b> · Posição em <b>${dataBR(d.posicaoEm)}</b> · Emitido em ${new Date(d.emitidoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>
      </div>
      <table><thead><tr><th>Data</th><th>Movimento</th><th>Remetente / devolvido a</th><th>Prova bancária (extrato)</th><th class="num">Valor</th><th class="num">Saldo</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="6" class="sub">Sem movimentos até a data de posição.</td></tr>'}</tbody></table>
      <table class="resumo"><tbody>
        <tr><td>Créditos vinculados (${d.totais.qtdCreditos})</td><td class="num">${brl(d.totais.creditos)}</td></tr>
        <tr><td>(−) Devoluções ao Adquirente (${d.totais.qtdDevolucoes})</td><td class="num">${brl(d.totais.devolucoes)}</td></tr>
        <tr><td><b>(=) Saldo contratual</b></td><td class="num"><b>${brl(d.totais.saldo)}</b></td></tr>
        ${inf}
      </tbody></table>
      ${desv}${pend}
      <p class="nota sub">Créditos comprovados por lançamento no extrato da recebedora; devoluções comprovadas pela saída correspondente. O código de conferência no rodapé identifica este conteúdo: qualquer alteração produz um código diferente.</p>
    </body></html>`;
  }

  @Get('operacoes/:operacaoId/historico')
  @ProjAcao('exportar') // trilha: Administrador, Contabilidade, Financeiro e Auditoria (Consulta, Juridico, Gestao e Aprovador nao)
  historico(@Param('operacaoId') operacaoId: string, @Query('de') de: string, @Query('ate') ate: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const op = await tx.projOperacao.findFirst({ where: { id: operacaoId }, select: { id: true, projetoId: true } });
      if (!op) throw new NotFoundException('Operacao nao encontrada.');
      const cre = await tx.projCredito.findMany({ where: { operacaoId }, select: { id: true } });
      const credIds = cre.map((c) => c.id);
      const vin = credIds.length ? await tx.projCreditoVinculo.findMany({ where: { creditoId: { in: credIds } }, select: { id: true } }) : [];
      const pro = credIds.length ? await tx.projCreditoProva.findMany({ where: { creditoId: { in: credIds } }, select: { id: true } }) : [];
      const apl = await tx.projAplicacao.findMany({ where: { operacaoId }, select: { id: true } });
      const par = await tx.projParticipacao.findMany({ where: { operacaoId }, select: { id: true, contraparteId: true } });
      const sal = await tx.projSaldoInformado.findMany({ where: { operacaoId }, select: { id: true } });
      const con = await tx.projConcessao.findMany({ where: { OR: [{ operacaoId }, { projetoId: op.projetoId }] }, select: { id: true } });
      const ids = new Set<string>([operacaoId, op.projetoId, ...credIds]);
      [vin, pro, apl, par, sal, con].forEach((lista) => lista.forEach((x: any) => ids.add(x.id)));
      par.forEach((p) => { if (p.contraparteId) ids.add(p.contraparteId); });
      const where: any = { action: { startsWith: 'PROJ_' }, OR: [{ targetId: { in: [...ids] } }, { after: { path: ['operacaoId'], equals: operacaoId } }] };
      const periodo: any = {};
      if (de) periodo.gte = new Date(String(de).slice(0, 10) + 'T00:00:00-03:00');
      if (ate) periodo.lte = new Date(String(ate).slice(0, 10) + 'T23:59:59.999-03:00');
      if (de || ate) where.createdAt = periodo;
      const logs = await tx.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 3000, select: { id: true, createdAt: true, action: true, actorId: true, after: true } });
      const visiveis = logs.filter((l) => !OCULTAS.has(l.action));
      const atores = [...new Set(visiveis.map((l) => l.actorId).filter((x): x is string => !!x))];
      const us = new Map((atores.length ? await tx.user.findMany({ where: { id: { in: atores } }, select: { id: true, fullName: true, email: true } }) : []).map((u: any) => [u.id, u.fullName || u.email]));
      return visiveis.map((l) => {
        const a: any = l.after && typeof l.after === 'object' ? { ...(l.after as any) } : {};
        const motivo = a.motivo || a.fonte || null;
        delete a.motivo; delete a.fonte; delete a.companyId;
        return { id: l.id, quando: l.createdAt, acao: l.action, rotulo: ROTULOS[l.action] || humanizar(l.action), usuario: (l.actorId && us.get(l.actorId)) || '-', motivo, detalhes: a };
      });
    });
  }

  // -- Painel executivo (Fase 1.13, 04/10/2026) ------------------------------------------------------------
  // Indicadores consolidados e pendencias ordenadas por gravidade, cada uma com o destino onde se resolve.
  // Comparacoes com saldos informados sao feitas NA DATA do saldo informado (nao com a posicao de hoje).
  @Get('operacoes/:operacaoId/painel-executivo')
  @ProjAcao('ver')
  painelExecutivo(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const op = await tx.projOperacao.findFirst({ where: { id: operacaoId, canceladoEm: null }, select: { dataBase: true, valorControle: true } });
      if (!op) throw new NotFoundException('Operacao nao encontrada.');
      const creditos = await tx.projCredito.findMany({ where: { operacaoId, canceladoEm: null }, select: { id: true, dataCredito: true, valor: true, identificacaoPendente: true } });
      const ids = creditos.map((c) => c.id);
      const vincs = await tx.projCreditoVinculo.findMany({ where: { canceladoEm: null, credito: { operacaoId, canceladoEm: null } }, select: { creditoId: true, situacao: true } });
      const provas = ids.length ? await tx.projCreditoProva.findMany({ where: { canceladoEm: null, creditoId: { in: ids } }, select: { creditoId: true } }) : [];
      const apls = await tx.projAplicacao.findMany({ where: { operacaoId, canceladoEm: null }, select: { valor: true, dataAplicacao: true, creditoId: true, natureza: { select: { codigo: true, nome: true, tipo: true } } } });
      const docs = await tx.projDocumento.findMany({ where: { operacaoId, canceladoEm: null }, select: { contraparteId: true, tipo: { select: { codigo: true, nome: true } } } });
      const pessoas = await tx.projParticipacao.findMany({
        where: { operacaoId, canceladoEm: null, contraparteId: { not: null }, papel: { codigo: { in: ['ADQUIRENTE', 'INTERMEDIARIO'] } } },
        select: { contraparteId: true, contraparte: { select: { nome: true } } },
      });
      const infs = await tx.projSaldoInformado.findMany({ where: { operacaoId, canceladoEm: null }, orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }], select: { tipo: true, dataReferencia: true, valor: true } });

      const cent = (v: any) => Math.round(Number(v) * 100);
      const fmt = (c: number) => (c / 100).toFixed(2);
      const brl2 = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const dataDe = new Map(creditos.map((c) => [c.id, c.dataCredito]));
      const valorDe = new Map(creditos.map((c) => [c.id, cent(c.valor)]));
      const vinculados = vincs.filter((v) => v.situacao === 'VINCULADO').map((v) => v.creditoId);
      const comVinculo = new Set(vincs.map((v) => v.creditoId));
      const comProva = new Set(provas.map((p) => p.creditoId));
      const ate = (d: Date | null, x: Date) => !d || x.getTime() <= d.getTime();
      const vincAte = (d: Date | null) => vinculados.reduce((s, id) => s + (ate(d, dataDe.get(id) as Date) ? valorDe.get(id) || 0 : 0), 0);
      const aplAte = (d: Date | null, tipo: string) => apls.reduce((s, a) => s + (a.natureza.tipo === tipo && ate(d, a.dataAplicacao) ? cent(a.valor) : 0), 0);
      const totVinc = vincAte(null);
      const totDev = aplAte(null, 'DEVOLUCAO');
      const totApl = aplAte(null, 'APLICACAO');

      const pend: { nivel: 'CRITICA' | 'ATENCAO'; titulo: string; detalhe: string; destino: string }[] = [];
      if (op.dataBase && op.valorControle) {
        const ateBase = creditos.reduce((s, c) => s + (c.dataCredito.getTime() <= op.dataBase!.getTime() ? cent(c.valor) : 0), 0);
        const dif = ateBase - cent(op.valorControle);
        if (dif !== 0) pend.push({ nivel: 'CRITICA', titulo: 'Valor de controle não confere', detalhe: `Créditos até a data-base diferem do valor de controle em ${brl2(dif)}.`, destino: '' });
      }
      const infCI = infs.find((i) => i.tipo === 'CONTA_INDIVIDUAL');
      if (infCI) {
        const calc = vincAte(infCI.dataReferencia) - aplAte(infCI.dataReferencia, 'DEVOLUCAO');
        const dif = calc - cent(infCI.valor);
        if (dif !== 0) pend.push({ nivel: 'CRITICA', titulo: 'Conta Individual diverge do saldo informado', detalhe: `Na data do saldo informado (${infCI.dataReferencia.toISOString().slice(0, 10).split('-').reverse().join('/')}), a diferença é de ${brl2(dif)}.`, destino: 'demonstrativo' });
      }
      for (const [tipo, nome] of [['INTERCOMPANY_RECEBEDORA', 'recebedora'], ['INTERCOMPANY_BENEFICIARIA', 'beneficiária']]) {
        const inf = infs.find((i) => i.tipo === tipo);
        if (!inf) continue;
        const calc = vincAte(inf.dataReferencia) - aplAte(inf.dataReferencia, 'APLICACAO') - aplAte(inf.dataReferencia, 'DEVOLUCAO');
        const dif = calc - cent(inf.valor);
        if (dif !== 0) pend.push({ nivel: 'CRITICA', titulo: `Intercompany diverge do saldo informado (${nome})`, detalhe: `Na data do saldo informado, a diferença é de ${brl2(dif)}.`, destino: 'intercompany' });
      }
      const semProva = creditos.filter((c) => !comProva.has(c.id));
      if (semProva.length) pend.push({ nivel: 'CRITICA', titulo: 'Créditos sem prova bancária', detalhe: `${semProva.length} crédito(s), ${brl2(semProva.reduce((s, c) => s + cent(c.valor), 0))}.`, destino: 'creditos' });
      const semDecisao = creditos.filter((c) => !comVinculo.has(c.id));
      if (semDecisao.length) pend.push({ nivel: 'ATENCAO', titulo: 'Créditos aguardando decisão de vínculo', detalhe: `${semDecisao.length} crédito(s), ${brl2(semDecisao.reduce((s, c) => s + cent(c.valor), 0))}.`, destino: 'pendencias' });
      const semRemetente = creditos.filter((c) => c.identificacaoPendente);
      if (semRemetente.length) pend.push({ nivel: 'ATENCAO', titulo: 'Remetentes não identificados', detalhe: `${semRemetente.length} crédito(s), ${brl2(semRemetente.reduce((s, c) => s + cent(c.valor), 0))}.`, destino: 'pendencias' });
      const devSemOrigem = apls.filter((a) => a.natureza.tipo === 'DEVOLUCAO' && !a.creditoId);
      if (devSemOrigem.length) pend.push({ nivel: 'ATENCAO', titulo: 'Devoluções sem o crédito de origem', detalhe: `${devSemOrigem.length} devolução(ões), ${brl2(devSemOrigem.reduce((s, a) => s + cent(a.valor), 0))}. Informar a origem fortalece o demonstrativo.`, destino: 'aplicacoes' });
      if (!docs.some((d) => d.tipo.codigo === 'TERMO')) pend.push({ nivel: 'ATENCAO', titulo: 'Operação sem o Termo', detalhe: 'Nenhum documento vigente do tipo "Termo, contrato ou aditivo".', destino: 'documentos' });
      const comIdent = new Set(docs.filter((d) => d.tipo.codigo === 'IDENTIFICACAO' && d.contraparteId).map((d) => d.contraparteId as string));
      const semIdent = [...new Map(pessoas.filter((p) => p.contraparteId && !comIdent.has(p.contraparteId)).map((p) => [p.contraparteId as string, p.contraparte?.nome || '-'])).values()];
      if (semIdent.length) pend.push({ nivel: 'ATENCAO', titulo: 'Adquirente ou intermediário sem identificação', detalhe: semIdent.join(', ') + '.', destino: 'documentos' });

      const nat = new Map<string, { nome: string; tipo: string; quantidade: number; centavos: number }>();
      apls.forEach((a) => { const e = nat.get(a.natureza.codigo) || { nome: a.natureza.nome, tipo: a.natureza.tipo, quantidade: 0, centavos: 0 }; e.quantidade += 1; e.centavos += cent(a.valor); nat.set(a.natureza.codigo, e); });
      const dt = new Map<string, number>();
      docs.forEach((d) => dt.set(d.tipo.nome, (dt.get(d.tipo.nome) || 0) + 1));
      const novos = op.dataBase ? creditos.filter((c) => c.dataCredito.getTime() > op.dataBase!.getTime()) : [];
      // Kit do Investidor - Etapa 2 (05/10/2026): meta da cota senior (premissa da versao vigente; so o Master le premissas)
      const opAtual = await tx.projOperacao.findFirst({ where: { id: operacaoId }, select: { projetoId: true } });
      const vers = opAtual ? await tx.projPremissaVersao.findFirst({ where: { projetoId: opAtual.projetoId, canceladoEm: null }, orderBy: { numero: 'desc' }, select: { id: true } }) : null;
      const metaP = vers ? await tx.projPremissa.findFirst({ where: { versaoId: vers.id, operacaoId, codigo: 'META_COTA_SENIOR' }, select: { valorNum: true } }) : null;
      let meta: any = null;
      if (metaP?.valorNum) {
        const metaC = cent(metaP.valorNum);
        const ev = [...vinculados.map((id) => ({ t: (dataDe.get(id) as Date).getTime(), c: valorDe.get(id) || 0 })),
          ...apls.filter((a) => a.natureza.tipo === 'DEVOLUCAO').map((a) => ({ t: a.dataAplicacao.getTime(), c: -cent(a.valor) }))].sort((a, b) => a.t - b.t);
        let s = 0; let concl: string | null = null;
        for (const e of ev) { s += e.c; if (!concl && s >= metaC) concl = new Date(e.t).toISOString().slice(0, 10); }
        meta = { valor: fmt(metaC), saldo: fmt(s), percentual: metaC ? s / metaC : 0, falta: fmt(Math.max(0, metaC - s)), concluidaEm: concl };
      }
      // Series#1 - Etapa C2 (06/10/2026): saldos de passivos e da divida da REAL (so o Master le premissas; demais recebem null)
      const sb = opAtual ? await this.saldosSeries(tx, opAtual.projetoId, new Date().toISOString().slice(0, 10)) : null;
      const saldos = sb ? { passivos: { semEstoque: sb.passivos.estoqueC === null, saldo: sb.passivos.saldoC === null ? null : fmt(sb.passivos.saldoC), pagamentos: fmt(sb.passivos.pagamentosC), liberada: sb.passivos.liberada },
        divida: { valor: fmt(sb.dividaC), compensado: fmt(sb.compensadoC), saldo: fmt(sb.saldoDividaC) } } : null;
      return {
        meta,
        saldos,
        totais: { vinculados: fmt(totVinc), aplicacoes: fmt(totApl), devolucoes: fmt(totDev), saldoContratual: fmt(totVinc - totDev), intercompanyEsperado: fmt(totVinc - totApl - totDev) },
        novosCreditos: { quantidade: novos.length, total: fmt(novos.reduce((s, c) => s + cent(c.valor), 0)) },
        aplicacoesPorNatureza: [...nat.values()].sort((a, b) => b.centavos - a.centavos).map(({ centavos, ...n }) => ({ ...n, total: fmt(centavos) })),
        documentos: { vigentes: docs.length, porTipo: [...dt.entries()].map(([nome, quantidade]) => ({ nome, quantidade })).sort((a, b) => b.quantidade - a.quantidade) },
        pendencias: pend.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'CRITICA' ? -1 : 1)),
      };
    });
  }

  // -- Kit do Cotista (Series#1, Etapa C1, 06/10/2026) - so o Master ------------------------------------------
  // Premissas da versao vigente (BP + book) + realizado do LEDGR (quotas, captacao, passivos). Sem nomes de subscritores
  // (material para potenciais cotistas). Codigo de conferencia = SHA-256 do conteudo; emissao do PDF vai para o historico.
  private montarKitCotista(userId: string, projetoId: string) {
    return this.db.comoUsuario(userId, async (tx) => {
      const proj = await tx.projProjeto.findFirst({ where: { id: projetoId, canceladoEm: null }, select: { nome: true } });
      if (!proj) throw new NotFoundException('Projeto nao encontrado.');
      const versao = await tx.projPremissaVersao.findFirst({ where: { projetoId, canceladoEm: null }, orderBy: { numero: 'desc' }, select: { id: true, numero: true, dataBase: true, arquivoOrigem: true, arquivoSha256: true } });
      if (!versao) throw new BadRequestException('Nenhuma versao de premissas carregada para o projeto.');
      const ops = await tx.projOperacao.findMany({ where: { projetoId, canceladoEm: null }, select: { id: true, codigo: true } });
      const opCod = new Map(ops.map((o) => [o.id, o.codigo]));
      const prem = await tx.projPremissa.findMany({ where: { versaoId: versao.id }, orderBy: { ordem: 'asc' } });
      const P = new Map<string, any>();
      prem.forEach((p) => P.set((p.operacaoId ? opCod.get(p.operacaoId) + ':' : '') + p.codigo, p));
      const n = (k: string) => { const p = P.get(k); if (!p || p.valorNum === null) throw new BadRequestException(`Premissa ausente: ${k} (o kit precisa da versao 2 das premissas)`); return Number(p.valorNum); };
      const t = (k: string): string | null => P.get(k)?.valorTexto ?? null;
      const cent = (v: any) => Math.round(Number(v) * 100);
      const fator = prem.filter((p) => p.grupo === 'REEXPRESSAO' && p.codigo.startsWith('IPCA_')).reduce((f, p) => f * (1 + Number(p.valorNum)), 1);
      const rx = (k: string) => n(k) * fator;
      const receitas = rx('RECEITAS'); const despesas = rx('DESPESAS'); const resultado = receitas + despesas;
      const bp = { vgv: rx('VGV'), receitas, despesas, resultado, vpl: rx('VPL_6'), exposicaoMaxima: rx('EXPOSICAO_MAXIMA'), margem: resultado / receitas,
        tirMensal: n('TIR_MENSAL'), tirAnual: Math.pow(1 + n('TIR_MENSAL'), 12) - 1, uh: n('UH'), cotas: n('COTAS'), velocidade: n('VELOCIDADE_VENDA'), taxaVpl: n('TAXA_VPL'), fatorIpca: fator, dataBase: t('DATA_BASE_REEXPRESSAO') };
      const valorQuota = n('SERIES1_VALOR_QUOTA'); const pctCot = n('SERIES1_PCT_CDE_COTISTAS');
      let deM = 0;
      const faixas = [1, 2, 3, 4].map((i) => {
        const ate = i < 4 ? n(`SERIES1_FAIXA_${i}_ATE_MOIC`) : null;
        const f = { faixa: i, pct: n(`SERIES1_FAIXA_${i}_PCT`), deMoic: deM, ateMoic: ate, deValor: deM * valorQuota, ateValor: ate === null ? null : ate * valorQuota, multiploEsperado: n(`SERIES1_FAIXA_${i}_MULTIPLO_ESPERADO`) };
        deM = ate ?? deM; return f;
      });
      let ac = 0;
      const renda = [2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].filter((a) => P.has(`SERIES1_RENDA_${a}`)).map((a) => { const v = n(`SERIES1_RENDA_${a}`); ac += v; return { ano: a, renda: v, acumulado: ac, pctAcumulado: ac / valorQuota }; });
      const choques = [90, 75, 60].filter((c) => P.has(`SERIES1_CHOQUE_${c}`)).map((c) => ({ fluxo: c / 100, renda: n(`SERIES1_CHOQUE_${c}`), rendimento: n(`SERIES1_CHOQUE_${c}`) / valorQuota }));
      const renda12m = n('SERIES1_RENDA_12M');
      const series = { valorQuota, pctCotistas: pctCot, pctF5: n('SERIES1_PCT_CDE_F5'), pctPorQuota: pctCot * valorQuota / resultado, pctQuotaBook: P.has('SERIES1_PCT_QUOTA_BOOK') ? n('SERIES1_PCT_QUOTA_BOOK') : null,
        regra: t('SERIES1_REGRA_PCT_QUOTA'), renda12m, rendimento12m: renda12m / valorQuota, janela: [t('SERIES1_JANELA_INICIO'), t('SERIES1_JANELA_FIM')],
        primeiraDistribuicao: t('SERIES1_PRIMEIRA_DISTRIBUICAO'), periodicidade: t('SERIES1_PERIODICIDADE'), inicioParticipacao: t('SERIES1_INICIO_PARTICIPACAO'), piso: t('SERIES1_PISO_REMUNERACAO') };
      const cronograma = ['FASE_1', 'FASE_2', 'FASE_3', 'FASE_4'].filter((c) => P.has(c)).map((c) => ({ nome: P.get(c).nome as string, texto: t(c) }));
      const contrapartidaPct = n('REAL:CONTRAPARTIDA_PCT_APORTE');
      // realizado
      const anc = ops.find((o) => o.codigo === 'ANCORA'); const s1 = ops.find((o) => o.codigo === 'SERIES1');
      let aportesAncoraC = 0;
      if (anc) {
        const vincs = await tx.projCreditoVinculo.findMany({ where: { canceladoEm: null, situacao: 'VINCULADO', credito: { operacaoId: anc.id, canceladoEm: null } }, select: { credito: { select: { valor: true } } } });
        const devs = await tx.projAplicacao.findMany({ where: { operacaoId: anc.id, canceladoEm: null, natureza: { tipo: 'DEVOLUCAO' } }, select: { valor: true } });
        aportesAncoraC = vincs.reduce((s, v) => s + cent(v.credito.valor), 0) - devs.reduce((s, d) => s + cent(d.valor), 0);
      }
      const quotas = s1 ? await tx.projQuota.findMany({ where: { operacaoId: s1.id, canceladoEm: null }, orderBy: { numero: 'asc' } }) : [];
      const qd = quotas.map((q) => { const ap = q.operacaoOrigemId && anc && q.operacaoOrigemId === anc.id ? aportesAncoraC : 0; return { numero: q.numero, valor: Number(q.valor), aportado: ap / 100, integralizacao: cent(q.valor) ? Math.min(1, ap / cent(q.valor)) : 0 }; });
      const inf = s1 ? await tx.projSaldoInformado.findFirst({ where: { operacaoId: s1.id, canceladoEm: null, tipo: 'PASSIVOS_EMPREENDIMENTO' }, orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }], select: { dataReferencia: true, valor: true } }) : null;
      const desde = inf ? inf.dataReferencia : ((P.get('REAL:DIVIDA_DATA')?.valorData as Date | undefined) ?? null);
      const apls = await tx.projAplicacao.findMany({ where: { canceladoEm: null, operacaoId: { in: ops.map((o) => o.id) }, natureza: { pagaPassivo: true }, ...(desde ? { dataAplicacao: { gt: desde } } : {}) }, select: { valor: true } });
      const pagosC = apls.reduce((s, a) => s + cent(a.valor), 0);
      const passivos = { estoqueData: inf ? inf.dataReferencia.toISOString().slice(0, 10) : null, estoque: inf ? Number(inf.valor) : null, pagamentosDesde: desde ? desde.toISOString().slice(0, 10) : null,
        pagamentos: pagosC / 100, saldo: inf ? Math.max(0, cent(inf.valor) - pagosC) / 100 : null, liberada: inf ? cent(inf.valor) - pagosC <= 0 : false };
      const realizado = { quotas: qd.length, captado: qd.reduce((s, q) => s + q.aportado, 0), quotasDetalhe: qd, passivos, distribuido: 0, faixaVigente: 1 };
      const dados = { projeto: proj.nome, versao: { numero: versao.numero, dataBase: versao.dataBase.toISOString().slice(0, 10), arquivo: versao.arquivoOrigem, sha256: versao.arquivoSha256 },
        bp, series, faixas, renda, choques, cronograma, contrapartidaPct, realizado };
      const hash = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
      return { ...dados, hash, emitidoEm: new Date().toISOString() };
    });
  }

  @Get('projetos/:projetoId/kit-cotista')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  kitCotista(@Param('projetoId') projetoId: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.montarKitCotista(req.user.id, projetoId);
  }

  @Get('projetos/:projetoId/kit-cotista/pdf')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async kitCotistaPdf(@Param('projetoId') projetoId: string, @Req() req: any, @Res() res: Response) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const k: any = await this.montarKitCotista(req.user.id, projetoId);
    await this.db.comoUsuario(req.user.id, (tx) => tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_KIT_COTISTA_EMITIDO', targetId: projetoId, after: { projetoId, versaoPremissas: k.versao.numero, hash: k.hash } } }));
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(this.htmlKitCotista(k), { waitUntil: 'load' });
      const pdf = Buffer.from(await page.pdf({
        format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '16mm', left: '12mm', right: '12mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-size:7px;width:100%;padding:0 12mm;color:#667085;display:flex;justify-content:space-between;font-family:Arial"><span>Kit do Cotista · Series#1 · premissas v${k.versao.numero} · código de conferência (SHA-256): ${k.hash}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
      }));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="kit-cotista-series1-${new Date().toISOString().slice(0, 10)}.pdf"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(pdf);
    } finally { await browser.close(); }
  }

  private htmlKitCotista(k: any): string {
    const mi = (v: number) => 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mi';
    const pc = (v: number, d = 2) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
    const nf = (v: number, d = 0) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const tag = (o: string) => `<span class="tag ${o === 'LEDGR' ? 'lg' : o === 'P' ? 'bp' : 'ct'}">${o === 'LEDGR' ? 'Apurado no LEDGR' : o === 'P' ? 'Premissa v' + k.versao.numero : 'Parâmetro contratual'}</span>`;
    const card = (rot: string, val: string, o: string, sub = '') => `<div class="card"><span>${esc(rot)}</span><strong>${val}</strong>${sub ? `<em>${sub}</em>` : ''}${tag(o)}</div>`;
    const s = k.series; const r = k.realizado; const pv = r.passivos; const ROM = ['I', 'II', 'III', 'IV'];
    const faixas = k.faixas.map((f: any) => `<tr><td><b>${ROM[f.faixa - 1]}</b></td><td>${f.ateMoic === null ? 'acima de ' + nf(f.deMoic, 2) + 'x (' + brl(f.deValor) + ')' : (f.deMoic ? nf(f.deMoic, 2) + 'x a ' : 'até ') + nf(f.ateMoic, 2) + 'x (' + (f.deMoic ? brl(f.deValor) + ' a ' : 'até ') + brl(f.ateValor) + ')'}</td><td class="num"><b>${pc(f.pct, 0)}</b></td><td class="num">${nf(f.multiploEsperado, 2)}x</td></tr>`).join('');
    const renda = k.renda.map((x: any) => `<tr><td>${x.ano}</td><td class="num">${brl(x.renda)}</td><td class="num">${brl(x.acumulado)}</td><td class="num">${pc(x.pctAcumulado)}</td></tr>`).join('');
    const choques = k.choques.map((c: any) => `<tr><td>Choque de ${pc(c.fluxo, 0)} do fluxo</td><td class="num">${brl(c.renda)}</td><td class="num">${pc(c.rendimento)}</td></tr>`).join('');
    const crono = k.cronograma.map((c: any) => `<div class="ev"><b>${esc(c.nome)}</b> ${tag('P')}<small>${esc(c.texto || '')}</small></div>`).join('');
    const passivosTxt = pv.estoque === null
      ? `Estoque de passivos ainda não informado; pagamentos de passivo desde ${pv.pagamentosDesde ? pv.pagamentosDesde.split('-').reverse().join('/') : '-'}: ${brl(pv.pagamentos)}.`
      : `Estoque informado em ${pv.estoqueData.split('-').reverse().join('/')}: ${brl(pv.estoque)}; pagamentos desde então: ${brl(pv.pagamentos)}; saldo estimado: <b>${brl(pv.saldo)}</b>.`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#152033;font-size:10.5px;margin:0}
      .page{page-break-after:always;padding:6px 4px}.page:last-child{page-break-after:auto}
      .cover{background:linear-gradient(135deg,#0f2747,#173f6d);color:#fff;padding:60px 40px;min-height:240mm;box-sizing:border-box}
      .eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:9px;font-weight:700;color:#1f5f99}.cover .eyebrow{color:#dfe8f4}
      h1{font-size:34px;margin:10px 0 14px}h2{font-size:20px;color:#0f2747;margin:2px 0 10px}h3{font-size:13px;color:#0f2747;margin:12px 0 6px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
      .card{border:1px solid #d8dee8;border-radius:6px;padding:10px}.card span{font-size:8px;color:#667085;text-transform:uppercase;letter-spacing:.06em}
      .card strong{display:block;font-size:17px;color:#0f2747;margin:4px 0}.card em{display:block;font-style:normal;font-size:9px;color:#667085;margin-bottom:3px}
      table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#0f2747;color:#fff;text-align:left;padding:6px;font-size:9px}
      td{border-bottom:1px solid #d8dee8;padding:6px;vertical-align:top}.num{text-align:right;white-space:nowrap}
      .note{background:#f7f9fc;border-left:3px solid #1f5f99;padding:9px 12px;margin:10px 0;color:#344054}.warn{background:#fff8e8;border-left-color:#9a6a14}
      .tag{display:inline-block;font-size:7.5px;font-weight:700;border-radius:999px;padding:1px 6px;margin-top:2px}
      .tag.lg{background:#e8f5ee;color:#1a4a3a}.tag.bp{background:#eaf2fb;color:#1f5f99}.tag.ct{background:#fff3df;color:#9a6a14}
      .ev{padding:0 0 10px 16px;border-left:2px solid #cad4e2;margin-left:4px}.ev b{color:#0f2747}.ev small{display:block;color:#667085}
      ul{padding-left:18px}li{margin:4px 0}
    </style></head><body>
    <section class="page cover"><div class="eyebrow">${esc(k.projeto)} · Quota Series#1</div><h1>Kit do Cotista</h1>
      <p style="font-size:15px;max-width:620px">Participação econômica nos resultados do Hotel Recife, por meio de quotas sênior emitidas e geridas pela F5, Sociedade de Propósito Específico de comercialização.</p>
      <p style="margin-top:40px">Premissas versão ${k.versao.numero} · Emitido em ${new Date(k.emitidoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
      <p style="opacity:.75;font-size:9.5px;max-width:620px">Este material não constitui oferta, convite ou solicitação de investimento. Taxas, rendimentos e múltiplos são projeções sujeitas a confirmação e não constituem garantia de captação, receita, rendimento ou resultado.</p></section>
    <section class="page"><div class="eyebrow">01 · A oferta</div><h2>Quota sênior de ${brl(s.valorQuota)}</h2>
      <div class="grid">${card('Valor da quota', brl(s.valorQuota), 'CT')}${card('Participação por quota', pc(s.pctPorQuota, 4), 'P', 'do Caixa Distribuível Elegível')}${card('Renda projetada (12 meses)', brl(s.renda12m), 'P', pc(s.rendimento12m) + ' ao ano')}${card('Distribuições', esc(s.periodicidade || '-'), 'CT', 'a partir de ' + esc(s.primeiraDistribuicao || '-'))}</div>
      <table><tr><td>Tipo de valor</td><td>Quota de participação econômica: sem direito societário, sem voto, sem gestão e sem propriedade ${tag('CT')}</td></tr>
        <tr><td>Janela de subscrição</td><td>${esc(s.janela[0] || '-')} a ${esc(s.janela[1] || '-')} ${tag('CT')}</td></tr>
        <tr><td>Início da participação</td><td>${esc(s.inicioParticipacao || '-')} ${tag('CT')}</td></tr>
        <tr><td>Regra da participação por quota</td><td>${esc(s.regra || '-')}${s.pctQuotaBook ? ' (o book de referência cita ' + pc(s.pctQuotaBook, 4) + ')' : ''} ${tag('P')}</td></tr></table></section>
    <section class="page"><div class="eyebrow">02 · O empreendimento</div><h2>Base econômica do BP, reexpressa a ${esc(k.bp.dataBase || '')}</h2>
      <div class="grid">${card('VGV', mi(k.bp.vgv), 'P')}${card('Receitas', mi(k.bp.receitas), 'P')}${card('Resultado', mi(k.bp.resultado), 'P')}${card('Unidades', nf(k.bp.uh), 'P')}</div>
      <table><tr><td>Margem resultado / receita</td><td class="num"><b>${pc(k.bp.margem)}</b></td></tr><tr><td>TIR do BP</td><td class="num"><b>${pc(k.bp.tirMensal)} a.m. / ${pc(k.bp.tirAnual)} a.a.</b></td></tr>
        <tr><td>VPL comparável a ${pc(k.bp.taxaVpl, 0)} a.a.</td><td class="num"><b>${mi(k.bp.vpl)}</b></td></tr><tr><td>Prazo de venda do BP</td><td class="num"><b>${nf(k.bp.velocidade)} meses</b></td></tr></table>
      <div class="note">Valores do estudo original de 2018, reexpressos pelo IPCA acumulado (fator ${nf(k.bp.fatorIpca, 4)}). Referência comparável, não valuation de mercado.</div></section>
    <section class="page"><div class="eyebrow">03 · O modelo de renda</div><h2>Faixas progressivas sobre o capital aportado</h2>
      <p>Do Caixa Distribuível Elegível, <b>${pc(s.pctCotistas, 0)}</b> são destinados aos cotistas e <b>${pc(s.pctF5, 0)}</b> à F5 ${tag('CT')}. A parte de cada cotista segue as faixas abaixo, sobre o capital que ele aportou (valores para uma quota):</p>
      <table><tr><th>Faixa</th><th>Retorno acumulado do cotista</th><th class="num">Parte do cotista</th><th class="num">Múltiplo esperado</th></tr>${faixas}</table>
      <div class="note">Piso da remuneração: ${esc(s.piso || '-')}. ${tag('CT')}</div></section>
    <section class="page"><div class="eyebrow">04 · Subordinação</div><h2>O cotista recebe depois da quitação dos passivos</h2>
      <p>A ordem de pagamento é: operação do hotel, quitação dos passivos do empreendimento e, somente então, as distribuições aos cotistas. ${tag('CT')}</p>
      <div class="note ${pv.liberada ? '' : 'warn'}"><b>Situação atual:</b> ${pv.liberada ? 'passivos quitados; distribuições liberadas.' : 'distribuições bloqueadas até a quitação dos passivos.'} ${passivosTxt} ${tag('LEDGR')}</div>
      <p>${pc(k.contrapartidaPct, 0)} de cada aporte de investidor destinam-se à contrapartida de lucros da Real Mouchão. ${tag('CT')}</p></section>
    <section class="page"><div class="eyebrow">05 · Projeção de renda por quota</div><h2>Renda anual projetada ${tag('P')}</h2>
      <table><tr><th>Ano</th><th class="num">Renda no ano</th><th class="num">Acumulado</th><th class="num">% da quota</th></tr>${renda}</table>
      <h3>Sensibilidade a choques de fluxo ${tag('P')}</h3><table><tr><th>Cenário</th><th class="num">Renda (12 meses)</th><th class="num">Rendimento</th></tr>${choques}</table>
      <div class="note warn">Não constitui garantia de rendimento. A renda depende da performance efetiva da operação, do fechamento dos contratos em discussão e da quitação dos passivos.</div></section>
    <section class="page"><div class="eyebrow">06 · Cronograma e captação</div><h2>Andamento</h2>${crono}
      <div class="grid">${card('Quotas registradas', nf(r.quotas), 'LEDGR')}${card('Capital aportado', brl(r.captado), 'LEDGR')}${card('Distribuído', brl(r.distribuido), 'LEDGR', 'Faixa ' + ROM[r.faixaVigente - 1])}</div>
      <table><tr><th>Quota</th><th class="num">Valor</th><th class="num">Aportado</th><th class="num">Integralização</th></tr>${r.quotasDetalhe.map((q: any) => `<tr><td>nº ${q.numero}</td><td class="num">${brl(q.valor)}</td><td class="num">${brl(q.aportado)}</td><td class="num">${pc(q.integralizacao, 1)}</td></tr>`).join('')}</table>
      <p style="font-size:8.5px;color:#667085">Fontes das premissas: ${esc(k.versao.arquivo || '-')} (SHA-256 ${esc((k.versao.sha256 || '').slice(0, 16))}…). Material confidencial; em caso de divergência, prevalecem os instrumentos assinados.</p></section>
    </body></html>`;
  }

  // -- Series#1 e Divida da REAL (Etapa B, 05/10/2026) - so o Master -----------------------------------------
  // Saldo 1 (passivos da HOTELSYS): ultimo estoque informado - aplicacoes que pagam passivo depois dele. Libera os cotistas.
  // Saldo 2 (divida da REAL com a F5): valor fixo - compensacao de 10% dos aportes liquidos (inclusive Ancora). Libera a REAL.
  @Get('projetos/:projetoId/estrutura')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  estrutura(@Param('projetoId') projetoId: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const ops = await tx.projOperacao.findMany({ where: { projetoId, canceladoEm: null }, select: { id: true, codigo: true, nome: true } });
      const op = (c: string) => ops.find((o) => o.codigo === c);
      const anc = op('ANCORA'); const s1 = op('SERIES1'); const real = op('REAL');
      if (!s1 || !real) throw new BadRequestException('Estrutura da Series#1 ainda nao carregada.');
      const versao = await tx.projPremissaVersao.findFirst({ where: { projetoId, canceladoEm: null }, orderBy: { numero: 'desc' }, select: { id: true, numero: true } });
      if (!versao) throw new BadRequestException('Nenhuma versao de premissas carregada.');
      const opCod = new Map(ops.map((o) => [o.id, o.codigo]));
      const prem = await tx.projPremissa.findMany({ where: { versaoId: versao.id } });
      const P = new Map<string, any>(); prem.forEach((p) => P.set((p.operacaoId ? opCod.get(p.operacaoId) + ':' : '') + p.codigo, p));
      const n = (k: string) => { const p = P.get(k); if (!p || p.valorNum === null) throw new BadRequestException(`Premissa ausente: ${k}`); return Number(p.valorNum); };
      const t = (k: string): string | null => P.get(k)?.valorTexto ?? null;
      const cent = (v: any) => Math.round(Number(v) * 100);
      const fmt = (c: number) => (c / 100).toFixed(2);
      // aportes liquidos da Ancora, em ordem de data
      const ev: { data: string; c: number }[] = [];
      if (anc) {
        const vincs = await tx.projCreditoVinculo.findMany({ where: { canceladoEm: null, situacao: 'VINCULADO', credito: { operacaoId: anc.id, canceladoEm: null } }, select: { credito: { select: { dataCredito: true, valor: true } } } });
        const devs = await tx.projAplicacao.findMany({ where: { operacaoId: anc.id, canceladoEm: null, natureza: { tipo: 'DEVOLUCAO' } }, select: { dataAplicacao: true, valor: true } });
        vincs.forEach((x) => ev.push({ data: x.credito.dataCredito.toISOString().slice(0, 10), c: cent(x.credito.valor) }));
        devs.forEach((x) => ev.push({ data: x.dataAplicacao.toISOString().slice(0, 10), c: -cent(x.valor) }));
        ev.sort((a, b) => a.data.localeCompare(b.data));
      }
      const aportesAncora = ev.reduce((s, e) => s + e.c, 0);
      // divida da REAL (saldo 2)
      const dividaC = cent(n('REAL:DIVIDA_VALOR')); const pct = n('REAL:CONTRAPARTIDA_PCT_APORTE');
      let acum = 0; let quitadaEm: string | null = null;
      for (const e of ev) { acum += e.c; if (!quitadaEm && Math.round(acum * pct) >= dividaC) quitadaEm = e.data; }
      const compensadoC = Math.round(aportesAncora * pct);
      const divida = {
        valor: fmt(dividaC), valorEur: n('REAL:DIVIDA_VALOR_EUR'), data: P.get('REAL:DIVIDA_DATA')?.valorData ? (P.get('REAL:DIVIDA_DATA').valorData as Date).toISOString().slice(0, 10) : null,
        pctContrapartida: pct, aportesBase: fmt(aportesAncora), compensado: fmt(compensadoC), saldo: fmt(Math.max(0, dividaC - compensadoC)),
        quitadaEm, aportesNecessarios: fmt(Math.max(0, Math.ceil((dividaC - compensadoC) / pct))),
      };
      // passivos da HOTELSYS (saldo 1)
      const inf = await tx.projSaldoInformado.findFirst({ where: { operacaoId: s1.id, canceladoEm: null, tipo: 'PASSIVOS_EMPREENDIMENTO' }, orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }], select: { id: true, dataReferencia: true, valor: true, fonte: true } });
      const desde = inf ? inf.dataReferencia : (P.get('REAL:DIVIDA_DATA')?.valorData as Date | undefined) ?? null;
      const apls = await tx.projAplicacao.findMany({
        where: { canceladoEm: null, operacaoId: { in: ops.map((o) => o.id) }, natureza: { pagaPassivo: true }, ...(desde ? { dataAplicacao: { gt: desde } } : {}) },
        select: { valor: true, natureza: { select: { nome: true } } },
      });
      const porNat = new Map<string, { nome: string; quantidade: number; c: number }>();
      apls.forEach((a) => { const e = porNat.get(a.natureza.nome) || { nome: a.natureza.nome, quantidade: 0, c: 0 }; e.quantidade += 1; e.c += cent(a.valor); porNat.set(a.natureza.nome, e); });
      const pagosC = apls.reduce((s, a) => s + cent(a.valor), 0);
      const passivos = {
        estoqueInformado: inf ? { data: inf.dataReferencia.toISOString().slice(0, 10), valor: fmt(cent(inf.valor)), fonte: inf.fonte } : null,
        pagamentosDesde: desde ? desde.toISOString().slice(0, 10) : null, pagamentos: fmt(pagosC),
        porNatureza: [...porNat.values()].sort((a, b) => b.c - a.c).map((e) => ({ nome: e.nome, quantidade: e.quantidade, total: fmt(e.c) })),
        saldoEstimado: inf ? fmt(Math.max(0, cent(inf.valor) - pagosC)) : null, quitados: inf ? cent(inf.valor) - pagosC <= 0 : false,
      };
      // series e quotas
      const fator = prem.filter((p) => p.grupo === 'REEXPRESSAO' && p.codigo.startsWith('IPCA_')).reduce((f, p) => f * (1 + Number(p.valorNum)), 1);
      const resultado = (n('RECEITAS') + n('DESPESAS')) * fator;
      const valorQuota = n('SERIES1_VALOR_QUOTA');
      const quotas = await tx.projQuota.findMany({ where: { operacaoId: s1.id, canceladoEm: null }, orderBy: { numero: 'asc' } });
      const subs = quotas.length ? await tx.projContraparte.findMany({ where: { id: { in: quotas.map((q) => q.subscritorId) } }, select: { id: true, nome: true } }) : [];
      const nomes = new Map(subs.map((s) => [s.id, s.nome]));
      return {
        versaoPremissas: versao.numero, operacoes: { series1: s1.id, real: real.id, ancora: anc?.id ?? null },
        series: { valorQuota, pctPorQuota: n('SERIES1_PCT_CDE_COTISTAS') * valorQuota / resultado, pctCotistas: n('SERIES1_PCT_CDE_COTISTAS'), pctF5: n('SERIES1_PCT_CDE_F5'),
          janela: [t('SERIES1_JANELA_INICIO'), t('SERIES1_JANELA_FIM')], primeiraDistribuicao: t('SERIES1_PRIMEIRA_DISTRIBUICAO'), periodicidade: t('SERIES1_PERIODICIDADE') },
        divida, passivos, subordinacao: { liberada: passivos.quitados },
        quotas: quotas.map((q) => {
          const aportadoC = q.operacaoOrigemId && anc && q.operacaoOrigemId === anc.id ? aportesAncora : 0;
          return { numero: q.numero, subscritor: nomes.get(q.subscritorId) || '-', valor: fmt(cent(q.valor)), capitalAportado: fmt(aportadoC),
            integralizacao: cent(q.valor) ? Math.min(1, aportadoC / cent(q.valor)) : 0, dataSubscricao: q.dataSubscricao.toISOString().slice(0, 10),
            dataIngresso: q.dataIngresso.toISOString().slice(0, 10), origem: q.operacaoOrigemId ? opCod.get(q.operacaoOrigemId) ?? null : null, faixaVigente: 1, multiplo: 0 };
        }),
      };
    });
  }

  // -- Series#1, Etapa C2 (06/10/2026): saldos ate uma data, extrato por quota e demonstrativo da REAL (semestres civis) --
  private semestre(s?: string) {
    const hoje = new Date().toISOString().slice(0, 10);
    let ano: number; let sem: number;
    if (s) { if (!/^\d{4}-[12]$/.test(s)) throw new BadRequestException('Semestre invalido (use AAAA-1 ou AAAA-2).'); ano = Number(s.slice(0, 4)); sem = Number(s[5]); }
    else { ano = Number(hoje.slice(0, 4)); sem = Number(hoje.slice(5, 7)) <= 6 ? 1 : 2; }
    const ini = `${ano}-${sem === 1 ? '01-01' : '07-01'}`; const fim = `${ano}-${sem === 1 ? '06-30' : '12-31'}`;
    if (ini > hoje) throw new BadRequestException('Semestre ainda nao iniciado.');
    return { codigo: `${ano}-${sem}`, rotulo: `${sem}º semestre de ${ano}`, ini, fim, parcial: fim >= hoje, ate: fim < hoje ? fim : hoje };
  }

  // Saldos da Series#1 ate a data (inclusive): aportes liquidos (Ancora), compensacao da divida da REAL e passivos do empreendimento.
  // Retorna null quando a estrutura ou as premissas nao estao visiveis (RLS: so o Master le premissas).
  private async saldosSeries(tx: any, projetoId: string, ate: string) {
    const ops: { id: string; codigo: string }[] = await tx.projOperacao.findMany({ where: { projetoId, canceladoEm: null }, select: { id: true, codigo: true } });
    const anc = ops.find((o) => o.codigo === 'ANCORA'); const s1 = ops.find((o) => o.codigo === 'SERIES1'); const real = ops.find((o) => o.codigo === 'REAL');
    if (!s1 || !real) return null;
    const versao = await tx.projPremissaVersao.findFirst({ where: { projetoId, canceladoEm: null }, orderBy: { numero: 'desc' }, select: { id: true } });
    if (!versao) return null;
    const prem: any[] = await tx.projPremissa.findMany({ where: { versaoId: versao.id, operacaoId: real.id, codigo: { in: ['DIVIDA_VALOR', 'CONTRAPARTIDA_PCT_APORTE', 'DIVIDA_DATA', 'DIVIDA_VALOR_EUR'] } } });
    const g = (c: string) => prem.find((p) => p.codigo === c);
    if (!g('DIVIDA_VALOR') || !g('CONTRAPARTIDA_PCT_APORTE')) return null;
    const cent = (v: any) => Math.round(Number(v) * 100);
    const ateD = new Date(ate + 'T00:00:00Z');
    const eventos: { data: string; c: number }[] = [];
    if (anc) {
      const vincs: any[] = await tx.projCreditoVinculo.findMany({ where: { canceladoEm: null, situacao: 'VINCULADO', credito: { operacaoId: anc.id, canceladoEm: null, dataCredito: { lte: ateD } } }, select: { credito: { select: { dataCredito: true, valor: true } } } });
      const devs: any[] = await tx.projAplicacao.findMany({ where: { operacaoId: anc.id, canceladoEm: null, natureza: { tipo: 'DEVOLUCAO' }, dataAplicacao: { lte: ateD } }, select: { dataAplicacao: true, valor: true } });
      vincs.forEach((x) => eventos.push({ data: (x.credito.dataCredito as Date).toISOString().slice(0, 10), c: cent(x.credito.valor) }));
      devs.forEach((x) => eventos.push({ data: (x.dataAplicacao as Date).toISOString().slice(0, 10), c: -cent(x.valor) }));
      eventos.sort((a, b) => a.data.localeCompare(b.data) || b.c - a.c);
    }
    const pct = Number(g('CONTRAPARTIDA_PCT_APORTE').valorNum); const dividaC = cent(g('DIVIDA_VALOR').valorNum);
    const aportesLiqC = eventos.reduce((s, e) => s + e.c, 0);
    const compensadoC = Math.max(0, Math.round(aportesLiqC * pct));
    const inf = await tx.projSaldoInformado.findFirst({ where: { operacaoId: s1.id, canceladoEm: null, tipo: 'PASSIVOS_EMPREENDIMENTO', dataReferencia: { lte: ateD } }, orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }], select: { dataReferencia: true, valor: true, fonte: true } });
    const desde: Date | null = inf ? inf.dataReferencia : (g('DIVIDA_DATA')?.valorData ?? null);
    const apls: any[] = await tx.projAplicacao.findMany({ where: { canceladoEm: null, operacaoId: { in: ops.map((o) => o.id) }, natureza: { pagaPassivo: true }, dataAplicacao: { lte: ateD, ...(desde ? { gt: desde } : {}) } }, select: { valor: true } });
    const pagamentosC = apls.reduce((s, a) => s + cent(a.valor), 0);
    const estoqueC = inf ? cent(inf.valor) : null;
    return {
      ops: { anc, s1, real }, eventos, pct, dividaC, dividaEur: g('DIVIDA_VALOR_EUR') ? Number(g('DIVIDA_VALOR_EUR').valorNum) : null,
      dividaData: g('DIVIDA_DATA')?.valorData ? (g('DIVIDA_DATA').valorData as Date).toISOString().slice(0, 10) : null,
      aportesLiqC, compensadoC, saldoDividaC: Math.max(0, dividaC - compensadoC),
      passivos: { estoqueC, estoqueData: inf ? (inf.dataReferencia as Date).toISOString().slice(0, 10) : null, estoqueFonte: inf?.fonte ?? null, desde: desde ? desde.toISOString().slice(0, 10) : null,
        pagamentosC, saldoC: estoqueC === null ? null : Math.max(0, estoqueC - pagamentosC), liberada: estoqueC !== null && estoqueC - pagamentosC <= 0 },
    };
  }

  private montarExtratoQuota(userId: string, projetoId: string, numero: number, semestre?: string) {
    return this.db.comoUsuario(userId, async (tx) => {
      const S = this.semestre(semestre);
      const base = await this.saldosSeries(tx, projetoId, S.ate);
      if (!base) throw new BadRequestException('Estrutura da Series#1 nao carregada.');
      const q = await tx.projQuota.findFirst({ where: { operacaoId: base.ops.s1!.id, numero, canceladoEm: null } });
      if (!q) throw new NotFoundException('Quota nao encontrada.');
      const sub = await tx.projContraparte.findFirst({ where: { id: q.subscritorId }, select: { nome: true } });
      const daAncora = !!(q.operacaoOrigemId && base.ops.anc && q.operacaoOrigemId === base.ops.anc.id);
      const ev = daAncora ? base.eventos : [];
      const antes = ev.filter((e) => e.data < S.ini); const per = ev.filter((e) => e.data >= S.ini);
      const iniC = antes.reduce((s, e) => s + e.c, 0); const fimC = iniC + per.reduce((s, e) => s + e.c, 0);
      const apC = per.filter((e) => e.c > 0).reduce((s, e) => s + e.c, 0); const dvC = -per.filter((e) => e.c < 0).reduce((s, e) => s + e.c, 0);
      const valorC = Math.round(Number(q.valor) * 100);
      const dados = {
        semestre: S, quota: { numero: q.numero, valor: Number(q.valor), subscritor: sub?.nome ?? '-', dataSubscricao: q.dataSubscricao.toISOString().slice(0, 10), dataIngresso: q.dataIngresso.toISOString().slice(0, 10), origem: daAncora ? 'Operação Âncora' : null },
        saldoInicial: iniC / 100, aportes: apC / 100, devolucoes: dvC / 100, saldoFinal: fimC / 100, integralizacao: valorC ? Math.min(1, fimC / valorC) : 0,
        movimentos: per.map((e) => ({ data: e.data, tipo: e.c > 0 ? 'Aporte' : 'Devolução', valor: Math.abs(e.c) / 100 })),
        contrapartidaPeriodo: Math.round((apC - dvC) * base.pct) / 100, pctContrapartida: base.pct, faixaVigente: 1, distribuicoesPeriodo: 0, distribuicoesAcumuladas: 0,
      };
      const hash = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
      return { ...dados, hash, emitidoEm: new Date().toISOString() };
    });
  }

  private montarDemonstrativoReal(userId: string, projetoId: string, semestre?: string) {
    return this.db.comoUsuario(userId, async (tx) => {
      const S = this.semestre(semestre);
      const base = await this.saldosSeries(tx, projetoId, S.ate);
      if (!base) throw new BadRequestException('Estrutura da Series#1 nao carregada.');
      const antes = base.eventos.filter((e) => e.data < S.ini); const per = base.eventos.filter((e) => e.data >= S.ini);
      const compIniC = Math.max(0, Math.round(antes.reduce((s, e) => s + e.c, 0) * base.pct));
      const comps = per.map((e) => ({ data: e.data, tipo: e.c > 0 ? 'Aporte' : 'Devolução', base: e.c / 100, compensacao: Math.round(e.c * base.pct) / 100 }));
      const compFimC = base.compensadoC;
      const dados = {
        semestre: S, divida: { valor: base.dividaC / 100, valorEur: base.dividaEur, dataConfissao: base.dividaData, pctContrapartida: base.pct },
        compensacaoAteInicio: compIniC / 100, compensacoes: comps, compensacaoPeriodo: (compFimC - compIniC) / 100, compensacaoAcumulada: compFimC / 100,
        saldoInicial: Math.max(0, base.dividaC - compIniC) / 100, saldoFinal: base.saldoDividaC / 100, quitada: base.saldoDividaC === 0,
        aportesQueFaltam: Math.max(0, Math.ceil(base.saldoDividaC / base.pct)) / 100,
        passivos: { estoque: base.passivos.estoqueC === null ? null : base.passivos.estoqueC / 100, estoqueData: base.passivos.estoqueData, desde: base.passivos.desde,
          pagamentos: base.passivos.pagamentosC / 100, saldo: base.passivos.saldoC === null ? null : base.passivos.saldoC / 100, liberada: base.passivos.liberada },
      };
      const hash = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
      return { ...dados, hash, emitidoEm: new Date().toISOString() };
    });
  }

  private async pdfSimples(res: Response, nome: string, titulo: string, corpo: string, k: any) {
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:Arial,Helvetica,sans-serif;color:#152033;font-size:10.5px;margin:0}
        h1{font-size:18px;color:#0f2747;margin:0 0 4px}.sub{color:#667085;margin-bottom:12px}
        h3{font-size:12px;color:#0f2747;margin:14px 0 6px}
        table{width:100%;border-collapse:collapse;margin:6px 0}th{background:#0f2747;color:#fff;text-align:left;padding:6px;font-size:9px}
        td{border-bottom:1px solid #d8dee8;padding:6px}.num{text-align:right;white-space:nowrap}.tot td{font-weight:700;border-top:1.5px solid #0f2747}
        .note{background:#f7f9fc;border-left:3px solid #1f5f99;padding:8px 12px;margin:10px 0;color:#344054}.warn{background:#fff8e8;border-left-color:#9a6a14}
      </style></head><body><h1>${esc(titulo)}</h1><div class="sub">${esc(k.semestre.rotulo)} (${k.semestre.ini.split('-').reverse().join('/')} a ${k.semestre.fim.split('-').reverse().join('/')})${k.semestre.parcial ? ' · PARCIAL, apurado até ' + k.semestre.ate.split('-').reverse().join('/') : ''} · emitido em ${new Date(k.emitidoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</div>${corpo}</body></html>`, { waitUntil: 'load' });
      const pdf = Buffer.from(await page.pdf({
        format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '16mm', left: '14mm', right: '14mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-size:7px;width:100%;padding:0 14mm;color:#667085;display:flex;justify-content:space-between;font-family:Arial"><span>${esc(titulo)} · código de conferência (SHA-256): ${k.hash}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
      }));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(pdf);
    } finally { await browser.close(); }
  }

  @Get('projetos/:projetoId/extrato-quota')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  extratoQuota(@Param('projetoId') projetoId: string, @Query('numero') numero: string, @Query('semestre') semestre: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.montarExtratoQuota(req.user.id, projetoId, Number(numero) || 1, semestre || undefined);
  }

  @Get('projetos/:projetoId/extrato-quota/pdf')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async extratoQuotaPdf(@Param('projetoId') projetoId: string, @Query('numero') numero: string, @Query('semestre') semestre: string, @Req() req: any, @Res() res: Response) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const k: any = await this.montarExtratoQuota(req.user.id, projetoId, Number(numero) || 1, semestre || undefined);
    await this.db.comoUsuario(req.user.id, (tx) => tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_EXTRATO_QUOTA_EMITIDO', targetId: projetoId, after: { projetoId, quota: k.quota.numero, semestre: k.semestre.codigo, parcial: k.semestre.parcial, hash: k.hash } } }));
    const q = k.quota;
    const mov = k.movimentos.length ? k.movimentos.map((m: any) => `<tr><td>${m.data.split('-').reverse().join('/')}</td><td>${m.tipo}</td><td class="num">${m.tipo === 'Devolução' ? '-' : ''}${brl(m.valor)}</td></tr>`).join('') : '<tr><td colspan="3" style="color:#667085">Sem movimentos no período.</td></tr>';
    const corpo = `<table><tr><td>Quota</td><td><b>nº ${q.numero}</b> · ${brl(q.valor)}</td></tr><tr><td>Subscritor</td><td><b>${esc(q.subscritor)}</b></td></tr>
      <tr><td>Subscrição / ingresso na Series#1</td><td>${q.dataSubscricao.split('-').reverse().join('/')} / ${q.dataIngresso.split('-').reverse().join('/')}${q.origem ? ' · origem: ' + esc(q.origem) : ''}</td></tr></table>
      <h3>Capital aportado</h3><table><tr><td>Saldo no início do período</td><td class="num">${brl(k.saldoInicial)}</td></tr><tr><td>(+) Aportes no período</td><td class="num">${brl(k.aportes)}</td></tr>
      <tr><td>(−) Devoluções no período</td><td class="num">${brl(k.devolucoes)}</td></tr><tr class="tot"><td>(=) Saldo no fim do período</td><td class="num">${brl(k.saldoFinal)}</td></tr>
      <tr><td>Integralização da quota</td><td class="num"><b>${(k.integralizacao * 100).toFixed(1).replace('.', ',')}%</b></td></tr></table>
      <h3>Movimentos do período</h3><table><tr><th>Data</th><th>Tipo</th><th class="num">Valor</th></tr>${mov}</table>
      <h3>Distribuições</h3><table><tr><td>Faixa vigente</td><td class="num">${['I', 'II', 'III', 'IV'][k.faixaVigente - 1]}</td></tr><tr><td>Distribuições no período</td><td class="num">${brl(k.distribuicoesPeriodo)}</td></tr><tr><td>Distribuições acumuladas</td><td class="num">${brl(k.distribuicoesAcumuladas)}</td></tr></table>
      <div class="note">Dos aportes líquidos do período, ${(k.pctContrapartida * 100).toFixed(0)}% (${brl(k.contrapartidaPeriodo)}) destinam-se à contrapartida de lucros da Real Mouchão. As distribuições aos cotistas começam após a quitação dos passivos do empreendimento.</div>`;
    return this.pdfSimples(res, `extrato-quota-${q.numero}-${k.semestre.codigo}.pdf`, `Extrato da Quota nº ${q.numero} · Series#1`, corpo, k);
  }

  @Get('projetos/:projetoId/demonstrativo-real')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  demonstrativoReal(@Param('projetoId') projetoId: string, @Query('semestre') semestre: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.montarDemonstrativoReal(req.user.id, projetoId, semestre || undefined);
  }

  @Get('projetos/:projetoId/demonstrativo-real/pdf')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async demonstrativoRealPdf(@Param('projetoId') projetoId: string, @Query('semestre') semestre: string, @Req() req: any, @Res() res: Response) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const k: any = await this.montarDemonstrativoReal(req.user.id, projetoId, semestre || undefined);
    await this.db.comoUsuario(req.user.id, (tx) => tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_DEMONSTRATIVO_REAL_EMITIDO', targetId: projetoId, after: { projetoId, semestre: k.semestre.codigo, parcial: k.semestre.parcial, hash: k.hash } } }));
    const d = k.divida; const pv = k.passivos;
    const comps = k.compensacoes.length ? k.compensacoes.map((c: any) => `<tr><td>${c.data.split('-').reverse().join('/')}</td><td>${c.tipo}</td><td class="num">${brl(c.base)}</td><td class="num">${brl(c.compensacao)}</td></tr>`).join('') : '<tr><td colspan="4" style="color:#667085">Sem aportes ou devoluções no período.</td></tr>';
    const corpo = `<div class="note">Demonstrativo da participação econômica da Real Mouchão Lombo do Tejo, Sociedade Agropecuária, S.A. (cláusula 7.A.1 do termo de 31/10/2025). A participação de ${(d.pctContrapartida * 100).toFixed(0)}% de cada aporte é compensada com a dívida confessada em favor da F5 até a quitação; depois, passa a ser exigível.</div>
      <h3>Dívida confessada em favor da F5</h3><table><tr><td>Valor fixado${d.dataConfissao ? ' (' + d.dataConfissao.split('-').reverse().join('/') + ')' : ''}</td><td class="num">${brl(d.valor)}${d.valorEur ? ' (€ ' + Number(d.valorEur).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ')' : ''}</td></tr>
      <tr><td>(−) Compensação acumulada até o início do período</td><td class="num">${brl(k.compensacaoAteInicio)}</td></tr><tr><td>(=) Saldo no início do período</td><td class="num">${brl(k.saldoInicial)}</td></tr>
      <tr><td>(−) Compensação no período</td><td class="num">${brl(k.compensacaoPeriodo)}</td></tr><tr class="tot"><td>(=) Saldo no fim do período</td><td class="num">${brl(k.saldoFinal)}</td></tr>
      <tr><td>${k.quitada ? 'Dívida quitada' : 'Aportes que ainda faltam para a quitação'}</td><td class="num">${k.quitada ? '-' : brl(k.aportesQueFaltam)}</td></tr></table>
      <h3>Compensações do período</h3><table><tr><th>Data</th><th>Movimento</th><th class="num">Base</th><th class="num">Compensação</th></tr>${comps}</table>
      <h3>Passivos do empreendimento</h3><div class="note ${pv.liberada ? '' : 'warn'}">${pv.estoque === null ? 'Estoque de passivos ainda não informado; pagamentos de passivo desde ' + (pv.desde ? pv.desde.split('-').reverse().join('/') : '-') + ': ' + brl(pv.pagamentos) + '.' : 'Estoque informado em ' + pv.estoqueData.split('-').reverse().join('/') + ': ' + brl(pv.estoque) + '; pagamentos desde então: ' + brl(pv.pagamentos) + '; saldo estimado: ' + brl(pv.saldo) + '.'} ${pv.liberada ? 'Passivos quitados.' : 'As distribuições aos cotistas permanecem bloqueadas até a quitação.'}</div>`;
    return this.pdfSimples(res, `demonstrativo-real-${k.semestre.codigo}.pdf`, 'Demonstrativo da Participação Econômica · Real Mouchão', corpo, k);
  }

  // -- Fluxo contabil (06/10/2026) - so o Master: eventos numerados e lancamentos propostos por empresa, valores pela trilha --
  // Contas descritivas (o mapeamento para o plano de cada empresa vem depois, validado pelo contador). Sem gravacao no Contabil.
  @Get('projetos/:projetoId/fluxo-contabil')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  fluxoContabil(@Param('projetoId') projetoId: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const hoje = new Date().toISOString().slice(0, 10);
      const base = await this.saldosSeries(tx, projetoId, hoje);
      if (!base) throw new BadRequestException('Estrutura da Series#1 nao carregada.');
      const ops = [base.ops.anc, base.ops.s1, base.ops.real].filter((o): o is { id: string; codigo: string } => !!o);
      const cent = (v: any) => Math.round(Number(v) * 100);
      const apls = await tx.projAplicacao.findMany({ where: { canceladoEm: null, operacaoId: { in: ops.map((o) => o.id) }, natureza: { tipo: 'APLICACAO' } }, select: { valor: true, natureza: { select: { pagaPassivo: true } } } });
      const passivosC = apls.filter((a) => a.natureza.pagaPassivo).reduce((s, a) => s + cent(a.valor), 0);
      const despesasC = apls.filter((a) => !a.natureza.pagaPassivo).reduce((s, a) => s + cent(a.valor), 0);
      const pagosC = passivosC + despesasC;
      const entradasC = base.eventos.filter((e) => e.c > 0).reduce((s, e) => s + e.c, 0);
      const devolC = -base.eventos.filter((e) => e.c < 0).reduce((s, e) => s + e.c, 0);
      const liqC = entradasC - devolC;
      const encontroC = Math.min(liqC, pagosC);
      const versao = await tx.projPremissaVersao.findFirst({ where: { projetoId, canceladoEm: null }, orderBy: { numero: 'desc' }, select: { id: true } });
      const ing = versao ? await tx.projPremissa.findFirst({ where: { versaoId: versao.id, codigo: 'SERIES1_QUOTA1_INGRESSO' }, select: { valorData: true } }) : null;
      const ingresso = ing?.valorData ? (ing.valorData as Date).toISOString().slice(0, 10) : null;
      const quotaC = ingresso ? base.eventos.filter((e) => e.data <= ingresso).reduce((s, e) => s + e.c, 0) : 0;
      const ingressoOcorreu = !!ingresso && ingresso <= hoje;
      const resgates = base.eventos.map((e) => ({ data: e.data, base: e.c / 100, valor: Math.round(e.c * base.pct) / 100 }));
      const TX = 6.22;
      const v = (c: number) => c / 100;
      const L = (evento: number, empresa: string, titulo: string, debito: string, credito: string, valor: number, historico: string, extra: any = {}) => ({ evento, empresa, titulo, debito, credito, valor, historico, ...extra });
      const lanc = [
        L(1, 'F5', 'Confissão de dívida da RM', 'Recebível - Real Mouchão (ativo)', 'Obrigação de aplicação na quitação dos passivos da HOTELSYS (passivo)', v(base.dividaC),
          'Dívida confessada pela Real Mouchão em favor da F5, beneficiária direta, para quitação dos passivos da HOTELSYS (confissão de 31/10/2025).', { data: base.dividaData }),
        L(1, 'RM', 'Dívida confessada', 'Direito de participação econômica - Recife Ocean (ativo)', 'Dívida confessada - F5 (passivo)', v(base.dividaC),
          `Assunção dos passivos da HOTELSYS em troca da participação nos resultados. Em euros: € ${(base.dividaEur ?? v(base.dividaC) / TX).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (taxa histórica ${TX.toLocaleString('pt-BR')}).`, { data: base.dividaData, informativo: true }),
        L(2, 'SUNRISE', 'Termo de participação', '-', '-', 0, 'Sem lançamento na assinatura: a participação da RM é reconhecida a cada resgate (evento 7).', { data: base.dividaData, semLancamento: true }),
        L(3, 'SUNSYS', 'Aportes do Cliente Âncora', 'Bancos (ativo)', 'Valores recebidos por conta e ordem - HOTELSYS / Operação Âncora (passivo)', v(entradasC),
          'Valores recebidos do Adquirente Âncora, antecipação para futura aquisição de unidades/direitos no Recife Ocean Residences, por conta e ordem da HOTELSYS.'),
        ...(devolC ? [L(3, 'SUNSYS', 'Devoluções ao Adquirente', 'Valores recebidos por conta e ordem - HOTELSYS / Operação Âncora (passivo)', 'Bancos (ativo)', v(devolC), 'Devolução de valores ao Adquirente Âncora.')] : []),
        L(4, 'SUNSYS', 'Pagamentos por conta da HOTELSYS', 'Mútuo / conta corrente intercompany - HOTELSYS (ativo)', 'Bancos (ativo)', v(pagosC),
          'Pagamento de obrigações tributárias, trabalhistas e operacionais por conta e ordem da HOTELSYS.'),
        L(4, 'HOTELSYS', 'Baixa de passivos', 'Passivos tributários, trabalhistas e demais obrigações (passivo)', 'Mútuo / conta corrente intercompany - SUNSYS (passivo)', v(passivosC),
          'Quitação de obrigações próprias realizada pela SUNSYS (naturezas que pagam passivo).'),
        L(4, 'HOTELSYS', 'Despesas da operação', 'Despesas de manutenção da operação (resultado)', 'Mútuo / conta corrente intercompany - SUNSYS (passivo)', v(despesasC),
          'Despesas correntes (folha, contabilidade e manutenção) pagas pela SUNSYS por conta da HOTELSYS.'),
        L(5, 'SUNSYS', 'Encontro de contas', 'Valores recebidos por conta e ordem - HOTELSYS / Operação Âncora (passivo)', 'Mútuo / conta corrente intercompany - HOTELSYS (ativo)', v(encontroC),
          'Encontro de contas intercompany entre os valores recebidos por conta e ordem e os pagamentos realizados.'),
        L(5, 'HOTELSYS', 'Adiantamento do Cliente Âncora', 'Mútuo / conta corrente intercompany - SUNSYS (passivo)', 'Adiantamento de clientes - Operação Âncora (passivo)', v(liqC),
          'Reconhecimento do adiantamento recebido do Adquirente Âncora (cláusulas 2ª e 3ª do Termo).'),
        L(6, 'HOTELSYS', 'Quota nº 1 transferida à F5', 'Adiantamento de clientes - Operação Âncora (passivo)', 'Mútuo / conta corrente intercompany - F5 (passivo)', v(quotaC),
          'Ingresso da Quota nº 1 na Series#1: a obrigação com o Cliente Âncora passa à F5, emissora.', { data: ingresso, previsto: !ingressoOcorreu }),
        L(6, 'F5', 'Quota nº 1 da Series#1', 'Mútuo / conta corrente intercompany - HOTELSYS (ativo)', 'Obrigação com cotista - Quota nº 1 (passivo)', v(quotaC),
          'Assunção da obrigação com o Cliente Âncora como cotista da Quota nº 1.', { data: ingresso, previsto: !ingressoOcorreu }),
        L(7, 'SUNRISE', 'Participação da RM (resgates)', 'Participação da RM no resultado do projeto (resultado)', 'Obrigação com a RM, liquidada por compensação junto à F5 (passivo)', v(base.compensadoC),
          `${(base.pct * 100).toFixed(0)}% de cada aporte líquido, compensados com a dívida da RM.`, { validar: true }),
        L(7, 'F5', 'Resgate da dívida da RM', 'Obrigação de aplicação na quitação dos passivos da HOTELSYS (passivo)', 'Recebível - Real Mouchão (ativo)', v(base.compensadoC),
          'Compensação da participação da RM com a dívida confessada.', { validar: true }),
        L(7, 'RM', 'Resgate da dívida', 'Dívida confessada - F5 (passivo)', 'Direito de participação econômica (ativo) ± variação cambial', v(base.compensadoC),
          `Em euros à taxa histórica: € ${(v(base.compensadoC) / TX).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Variação cambial: a apurar no fechamento (BCE ou PTAX).`, { informativo: true, validar: true }),
      ];
      const S = (conta: string, c: number) => ({ conta, saldo: c / 100 });
      const quotaEfetiva = ingressoOcorreu ? quotaC : 0;
      const saldos: Record<string, any[]> = {
        F5: [S('Recebível - Real Mouchão', base.dividaC - base.compensadoC), S('Obrigação de aplicação nos passivos da HOTELSYS', base.dividaC - base.compensadoC), S('Mútuo - HOTELSYS', quotaEfetiva), S('Obrigação com cotista - Quota nº 1', quotaEfetiva)],
        SUNRISE: [S('Participação da RM no resultado (acumulada)', base.compensadoC)],
        RM: [S('Direito de participação econômica', base.dividaC - base.compensadoC), S('Dívida confessada - F5', base.dividaC - base.compensadoC)],
        SUNSYS: [S('Bancos (efeito da operação)', liqC - pagosC), S('Valores recebidos por conta e ordem - HOTELSYS', liqC - encontroC), S('Mútuo - HOTELSYS (a receber)', pagosC - encontroC)],
        HOTELSYS: [S('Passivos baixados', passivosC), S('Despesas da operação', despesasC), S('Mútuo - SUNSYS (a pagar)', pagosC - liqC), S('Adiantamento - Operação Âncora', liqC - quotaEfetiva), S('Mútuo - F5 (a pagar)', quotaEfetiva)],
      };
      const eventos = [
        { numero: 1, titulo: 'Confissão de dívida', familia: 'origem', data: base.dividaData }, { numero: 2, titulo: 'Termo de participação', familia: 'origem', data: base.dividaData },
        { numero: 3, titulo: 'Aportes do Cliente Âncora', familia: 'ancora' }, { numero: 4, titulo: 'Pagamentos por conta da HOTELSYS', familia: 'ancora' },
        { numero: 5, titulo: 'Encontro de contas', familia: 'intercompany' }, { numero: 6, titulo: 'Ingresso da Quota nº 1', familia: 'intercompany', data: ingresso, previsto: !ingressoOcorreu },
        { numero: 7, titulo: 'Resgates da dívida da RM', familia: 'resgate', quantidade: resgates.length },
      ];
      return { apuradoEm: hoje, eventos, lancamentos: lanc, saldos, resgates, taxaHistorica: TX };
    });
  }

  // -- Custodia (Etapa B, 06/10/2026) - so o Master por ora (Etapa C: Financeiro e Josi, com segregacao) -------------
  // Acesso direto as tabelas da custodia (RLS e gatilhos do banco valem integralmente). Comprovante = referencia textual
  // por enquanto (anexo do arquivo na Etapa D).
  private async custodiaBase(tx: any, projetoId: string, codigo: string) {
    if (!/^[A-Z0-9_]{1,40}$/.test(codigo)) throw new NotFoundException('Custodia nao encontrada.');
    const c: any[] = await tx.$queryRaw`SELECT c.id, c.codigo, c.nome, c.descricao, c.prazo_dias FROM proj_custodias c JOIN proj_operacoes o ON o.id = c.operacao_id
      WHERE o.projeto_id = ${projetoId}::uuid AND c.codigo = ${codigo} AND c.cancelado_em IS NULL LIMIT 1`;
    if (!c.length) throw new NotFoundException('Custodia nao encontrada.');
    return c[0];
  }

  private erroCustodia(e: any): never {
    const m = String(e?.meta?.message || e?.message || '');
    const t = m.match(/((Aloca|Lancamento|Validacao|Encerramento|Envio)[^"\n]{0,180})/);
    if (t) throw new BadRequestException(t[1].replace(/\s+$/, ''));
    throw e;
  }

  @Get('projetos/:projetoId/custodias')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  custodias(@Param('projetoId') projetoId: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, (tx: any) => tx.$queryRaw`SELECT c.codigo, c.nome FROM proj_custodias c JOIN proj_operacoes o ON o.id = c.operacao_id
      WHERE o.projeto_id = ${projetoId}::uuid AND c.cancelado_em IS NULL ORDER BY c.nome`);
  }

  @Get('projetos/:projetoId/custodias/:codigo')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  custodiaDetalhe(@Param('projetoId') projetoId: string, @Param('codigo') codigo: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx: any) => {
      const c = await this.custodiaBase(tx, projetoId, codigo);
      const lanc: any[] = await tx.$queryRaw`SELECT l.id, l.tipo, l.data, l.valor, l.situacao, l.favorecido, l.descricao, l.motivo, l.motivo_validacao, l.bank_transaction_id,
          n.nome AS natureza, bt.description AS lancamento_banco, bt.counterparty_name AS contraparte
        FROM proj_custodia_lancamentos l LEFT JOIN proj_naturezas_aplicacao n ON n.id = l.natureza_id LEFT JOIN bank_transactions bt ON bt.id = l.bank_transaction_id
        WHERE l.custodia_id = ${c.id}::uuid AND l.cancelado_em IS NULL ORDER BY l.data, l.criado_em`;
      const aloc: any[] = await tx.$queryRaw`SELECT id, origem_id, destino_id, valor, situacao, motivo, motivo_validacao FROM proj_custodia_alocacoes
        WHERE custodia_id = ${c.id}::uuid AND cancelado_em IS NULL ORDER BY criado_em`;
      const naturezas: any[] = await tx.$queryRaw`SELECT codigo, nome FROM proj_naturezas_aplicacao WHERE ativo AND tipo = 'APLICACAO' ORDER BY nome`;
      const cent = (v: any) => Math.round(Number(v) * 100);
      const hoje = new Date().toISOString().slice(0, 10);
      const soma = (campo: string, id: string, sit: string) => aloc.filter((a) => a[campo] === id && a.situacao === sit).reduce((s, a) => s + cent(a.valor), 0);
      const itens = lanc.map((l) => {
        const origem = l.tipo === 'ENVIO' || l.tipo === 'RECEBIMENTO_TERCEIRO';
        const campo = origem ? 'origem_id' : 'destino_id';
        const vC = cent(l.valor); const val = soma(campo, l.id, 'VALIDADO'); const reg = soma(campo, l.id, 'REGISTRADO');
        const data = (l.data as Date).toISOString().slice(0, 10);
        const limite = new Date(new Date(data + 'T00:00:00Z').getTime() + Number(c.prazo_dias) * 86400000).toISOString().slice(0, 10);
        const pend = l.situacao === 'RECUSADO' ? 0 : Math.max(0, vC - val - reg);
        return { id: l.id, tipo: l.tipo, data, valor: vC / 100, situacao: l.situacao, favorecido: l.favorecido, descricao: l.descricao, motivo: l.motivo,
          motivoValidacao: l.motivo_validacao, natureza: l.natureza, lancamentoBanco: l.lancamento_banco, contraparte: l.contraparte, extrato: !!l.bank_transaction_id,
          alocadoValidado: val / 100, alocadoEmAnalise: reg / 100, pendente: pend / 100, prazo: l.tipo === 'ENVIO' ? limite : null, vencido: l.tipo === 'ENVIO' && pend > 0 && limite < hoje };
      });
      const tot = (t: string, sit?: string) => itens.filter((i) => i.tipo === t && i.situacao !== 'RECUSADO' && (!sit || i.situacao === sit)).reduce((s, i) => s + cent(i.valor), 0);
      const enviado = tot('ENVIO'); const devolvido = tot('DEVOLUCAO'); const pagos = tot('PAGAMENTO_DIRETO', 'VALIDADO'); const recebidos = tot('RECEBIMENTO_TERCEIRO', 'VALIDADO');
      const rot = new Map(itens.map((i) => [i.id, `${i.tipo === 'ENVIO' ? 'Envio' : i.tipo === 'DEVOLUCAO' ? 'Devolução' : i.tipo === 'PAGAMENTO_DIRETO' ? 'Pagamento direto' : 'Recebimento de terceiro'} ${i.data.split('-').reverse().join('/')} · ${i.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`]));
      return {
        custodia: { codigo: c.codigo, nome: c.nome, descricao: c.descricao, prazoDias: Number(c.prazo_dias) },
        resumo: {
          enviado: enviado / 100, devolvido: devolvido / 100, pagosDiretos: pagos / 100, pagosDiretosEmAnalise: tot('PAGAMENTO_DIRETO', 'REGISTRADO') / 100,
          recebidosTerceiros: recebidos / 100, recebidosEmAnalise: tot('RECEBIMENTO_TERCEIRO', 'REGISTRADO') / 100, saldoEmPoder: (enviado + recebidos - devolvido - pagos) / 100,
          enviosPendentes: itens.filter((i) => i.tipo === 'ENVIO').reduce((s, i) => s + cent(i.pendente), 0) / 100, enviosVencidos: itens.filter((i) => i.vencido).length,
          devolucoesSemOrigem: itens.filter((i) => i.tipo === 'DEVOLUCAO').reduce((s, i) => s + cent(i.pendente), 0) / 100,
        },
        lancamentos: itens,
        alocacoes: aloc.map((a) => ({ id: a.id, origemId: a.origem_id, destinoId: a.destino_id, origem: rot.get(a.origem_id) || '-', destino: rot.get(a.destino_id) || '-', valor: cent(a.valor) / 100, situacao: a.situacao, motivo: a.motivo, motivoValidacao: a.motivo_validacao })),
        naturezas,
      };
    });
  }

  @PostC('projetos/:projetoId/custodias/:codigo/lancamentos')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  custodiaLancar(@Param('projetoId') projetoId: string, @Param('codigo') codigo: string, @BodyC() b: any, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const tipo = String(b?.tipo || '');
    if (!['PAGAMENTO_DIRETO', 'RECEBIMENTO_TERCEIRO'].includes(tipo)) throw new BadRequestException('Tipo invalido: pagamento direto ou recebimento de terceiro.');
    const data = String(b?.data || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new BadRequestException('Informe a data.');
    const valor = Math.round(Number(b?.valor) * 100) / 100;
    if (!(valor > 0)) throw new BadRequestException('Informe um valor positivo.');
    const motivo = String(b?.motivo || '').trim();
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres).');
    const favorecido = String(b?.favorecido || '').trim().slice(0, 200) || null;
    const comprovante = String(b?.comprovante || '').trim().slice(0, 300);
    if (comprovante.length < 3) throw new BadRequestException('Informe o comprovante (numero do DARF, recibo, processo ou documento).');
    const descricao = ('Comprovante: ' + comprovante + (b?.descricao ? ' · ' + String(b.descricao).trim().slice(0, 600) : ''));
    const alocarEm = b?.alocarEm ? String(b.alocarEm) : null;
    if (alocarEm && !UUID_RE.test(alocarEm)) throw new BadRequestException('Lancamento a alocar invalido.');
    const valorAlocado = b?.valorAlocado ? Math.round(Number(b.valorAlocado) * 100) / 100 : valor;
    return this.db.comoUsuario(req.user.id, async (tx: any) => {
      const c = await this.custodiaBase(tx, projetoId, codigo);
      let natId: string | null = null;
      if (tipo === 'PAGAMENTO_DIRETO') {
        const n: any[] = await tx.$queryRaw`SELECT id FROM proj_naturezas_aplicacao WHERE codigo = ${String(b?.naturezaCodigo || '')} AND ativo AND tipo = 'APLICACAO'`;
        if (!n.length) throw new BadRequestException('Informe a natureza do pagamento.');
        natId = n[0].id;
      }
      try {
        const ins: any[] = await tx.$queryRaw`INSERT INTO proj_custodia_lancamentos (custodia_id, tipo, data, valor, natureza_id, favorecido, descricao, motivo, criado_por_id)
          VALUES (${c.id}::uuid, ${tipo}, ${data}::date, ${valor.toFixed(2)}::numeric, ${natId}::uuid, ${favorecido}, ${descricao}, ${motivo}, ${req.user.id}::uuid) RETURNING id`;
        const id = ins[0].id as string;
        await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_CUSTODIA_LANCAMENTO_REGISTRADO', targetId: id, after: { custodia: c.codigo, tipo, data, valor: valor.toFixed(2), favorecido, comprovante, motivo } } });
        if (alocarEm) {
          const [origem, destino] = tipo === 'PAGAMENTO_DIRETO' ? [alocarEm, id] : [id, alocarEm];
          const al: any[] = await tx.$queryRaw`INSERT INTO proj_custodia_alocacoes (custodia_id, origem_id, destino_id, valor, motivo, criado_por_id)
            VALUES (${c.id}::uuid, ${origem}::uuid, ${destino}::uuid, ${valorAlocado.toFixed(2)}::numeric, ${motivo}, ${req.user.id}::uuid) RETURNING id`;
          await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_CUSTODIA_ALOCACAO_REGISTRADA', targetId: al[0].id, after: { custodia: c.codigo, origem, destino, valor: valorAlocado.toFixed(2), motivo } } });
        }
        return { id };
      } catch (e) { this.erroCustodia(e); }
    });
  }

  @PostC('projetos/:projetoId/custodias/:codigo/alocacoes')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  custodiaAlocar(@Param('projetoId') projetoId: string, @Param('codigo') codigo: string, @BodyC() b: any, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const origem = String(b?.origemId || ''); const destino = String(b?.destinoId || '');
    if (!UUID_RE.test(origem) || !UUID_RE.test(destino)) throw new BadRequestException('Informe a origem e o destino.');
    const valor = Math.round(Number(b?.valor) * 100) / 100;
    if (!(valor > 0)) throw new BadRequestException('Informe um valor positivo.');
    const motivo = String(b?.motivo || '').trim();
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres).');
    return this.db.comoUsuario(req.user.id, async (tx: any) => {
      const c = await this.custodiaBase(tx, projetoId, codigo);
      try {
        const al: any[] = await tx.$queryRaw`INSERT INTO proj_custodia_alocacoes (custodia_id, origem_id, destino_id, valor, motivo, criado_por_id)
          VALUES (${c.id}::uuid, ${origem}::uuid, ${destino}::uuid, ${valor.toFixed(2)}::numeric, ${motivo}, ${req.user.id}::uuid) RETURNING id`;
        await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_CUSTODIA_ALOCACAO_REGISTRADA', targetId: al[0].id, after: { custodia: c.codigo, origem, destino, valor: valor.toFixed(2), motivo } } });
        return { id: al[0].id };
      } catch (e) { this.erroCustodia(e); }
    });
  }

  @PostC('projetos/:projetoId/custodias/:codigo/validar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  custodiaValidar(@Param('projetoId') projetoId: string, @Param('codigo') codigo: string, @BodyC() b: any, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const alvo = String(b?.alvo || ''); const id = String(b?.id || ''); const decisao = String(b?.decisao || '');
    const motivo = String(b?.motivo || '').trim() || null;
    if (!['lancamento', 'alocacao'].includes(alvo) || !UUID_RE.test(id) || !['VALIDADO', 'RECUSADO'].includes(decisao)) throw new BadRequestException('Pedido de validacao invalido.');
    if (decisao === 'RECUSADO' && (!motivo || motivo.length < 10)) throw new BadRequestException('Informe o motivo da recusa (minimo 10 caracteres).');
    return this.db.comoUsuario(req.user.id, async (tx: any) => {
      const c = await this.custodiaBase(tx, projetoId, codigo);
      try {
        const n: number = alvo === 'lancamento'
          ? await tx.$executeRaw`UPDATE proj_custodia_lancamentos SET situacao = ${decisao}, validado_por_id = ${req.user.id}::uuid, validado_em = now(), motivo_validacao = ${motivo}
              WHERE id = ${id}::uuid AND custodia_id = ${c.id}::uuid AND cancelado_em IS NULL AND situacao = 'REGISTRADO'`
          : await tx.$executeRaw`UPDATE proj_custodia_alocacoes SET situacao = ${decisao}, validado_por_id = ${req.user.id}::uuid, validado_em = now(), motivo_validacao = ${motivo}
              WHERE id = ${id}::uuid AND custodia_id = ${c.id}::uuid AND cancelado_em IS NULL AND situacao = 'REGISTRADO'`;
        if (!n) throw new BadRequestException('Nada a validar: o registro nao existe, ja foi validado/recusado ou foi encerrado.');
        await tx.auditLog.create({ data: { actorId: req.user.id, action: decisao === 'VALIDADO' ? 'PROJ_CUSTODIA_VALIDADO' : 'PROJ_CUSTODIA_RECUSADO', targetId: id, after: { custodia: c.codigo, alvo, motivo } } });
        return { ok: true };
      } catch (e) { if (e instanceof BadRequestException) throw e; this.erroCustodia(e); }
    });
  }

  @PostC('projetos/:projetoId/custodias/:codigo/encerrar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  custodiaEncerrar(@Param('projetoId') projetoId: string, @Param('codigo') codigo: string, @BodyC() b: any, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const alvo = String(b?.alvo || ''); const id = String(b?.id || ''); const motivo = String(b?.motivo || '').trim();
    if (!['lancamento', 'alocacao'].includes(alvo) || !UUID_RE.test(id)) throw new BadRequestException('Pedido invalido.');
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres).');
    return this.db.comoUsuario(req.user.id, async (tx: any) => {
      const c = await this.custodiaBase(tx, projetoId, codigo);
      try {
        if (alvo === 'lancamento') {
          await tx.$executeRaw`UPDATE proj_custodia_alocacoes SET cancelado_em = now(), cancelado_por_id = ${req.user.id}::uuid, motivo_cancelamento = ${'Lancamento encerrado: ' + motivo}
            WHERE custodia_id = ${c.id}::uuid AND cancelado_em IS NULL AND (origem_id = ${id}::uuid OR destino_id = ${id}::uuid)`;
        }
        const n: number = alvo === 'lancamento'
          ? await tx.$executeRaw`UPDATE proj_custodia_lancamentos SET cancelado_em = now(), cancelado_por_id = ${req.user.id}::uuid, motivo_cancelamento = ${motivo}
              WHERE id = ${id}::uuid AND custodia_id = ${c.id}::uuid AND cancelado_em IS NULL AND bank_transaction_id IS NULL`
          : await tx.$executeRaw`UPDATE proj_custodia_alocacoes SET cancelado_em = now(), cancelado_por_id = ${req.user.id}::uuid, motivo_cancelamento = ${motivo}
              WHERE id = ${id}::uuid AND custodia_id = ${c.id}::uuid AND cancelado_em IS NULL`;
        if (!n) throw new BadRequestException('Nada a encerrar (envios e devolucoes do extrato so saem da custodia pela triagem).');
        await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_CUSTODIA_ENCERRADO', targetId: id, after: { custodia: c.codigo, alvo, motivo } } });
        return { ok: true };
      } catch (e) { if (e instanceof BadRequestException) throw e; this.erroCustodia(e); }
    });
  }
}
