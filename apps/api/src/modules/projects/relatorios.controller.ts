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
      return {
        meta,
        totais: { vinculados: fmt(totVinc), aplicacoes: fmt(totApl), devolucoes: fmt(totDev), saldoContratual: fmt(totVinc - totDev), intercompanyEsperado: fmt(totVinc - totApl - totDev) },
        novosCreditos: { quantidade: novos.length, total: fmt(novos.reduce((s, c) => s + cent(c.valor), 0)) },
        aplicacoesPorNatureza: [...nat.values()].sort((a, b) => b.centavos - a.centavos).map(({ centavos, ...n }) => ({ ...n, total: fmt(centavos) })),
        documentos: { vigentes: docs.length, porTipo: [...dt.entries()].map(([nome, quantidade]) => ({ nome, quantidade })).sort((a, b) => b.quantidade - a.quantidade) },
        pendencias: pend.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'CRITICA' ? -1 : 1)),
      };
    });
  }

  // -- Kit do Investidor (Etapa 2, 05/10/2026) - so o Master ---------------------------------------------
  // Premissas da versao vigente (entradas) + calculos do LEDGR (reexpressao, cota senior, waterfall, cenarios)
  // + realizado da Operacao Ancora (creditos vinculados e devolucoes). Codigo de conferencia = SHA-256 do conteudo.
  private montarKit(userId: string, projetoId: string) {
    return this.db.comoUsuario(userId, async (tx) => {
      const proj = await tx.projProjeto.findFirst({ where: { id: projetoId, canceladoEm: null }, select: { codigo: true, nome: true } });
      if (!proj) throw new NotFoundException('Projeto nao encontrado.');
      const versao = await tx.projPremissaVersao.findFirst({ where: { projetoId, canceladoEm: null }, orderBy: { numero: 'desc' }, select: { id: true, numero: true, dataBase: true, arquivoOrigem: true, arquivoSha256: true } });
      if (!versao) throw new BadRequestException('Nenhuma versao de premissas carregada para o projeto.');
      const ops = await tx.projOperacao.findMany({ where: { projetoId, canceladoEm: null }, select: { id: true, codigo: true, nome: true } });
      const opCod = new Map(ops.map((o) => [o.id, o.codigo]));
      const prem = await tx.projPremissa.findMany({ where: { versaoId: versao.id }, orderBy: { ordem: 'asc' } });
      const P = new Map<string, any>();
      prem.forEach((p) => P.set((p.operacaoId ? opCod.get(p.operacaoId) + ':' : '') + p.codigo, p));
      const n = (k: string) => { const p = P.get(k); if (!p || p.valorNum === null) throw new BadRequestException(`Premissa ausente: ${k}`); return Number(p.valorNum); };
      const t = (k: string): string | null => P.get(k)?.valorTexto ?? null;
      const dt = (k: string): string | null => (P.get(k)?.valorData ? (P.get(k).valorData as Date).toISOString().slice(0, 10) : null);
      const fator = prem.filter((p) => p.grupo === 'REEXPRESSAO' && p.codigo.startsWith('IPCA_')).reduce((f, p) => f * (1 + Number(p.valorNum)), 1);
      const rx = (k: string) => n(k) * fator;
      const receitas = rx('RECEITAS'); const despesas = rx('DESPESAS'); const resultado = receitas + despesas; const exposicao = rx('EXPOSICAO_MAXIMA');
      const precoCota = rx('VALOR_MEDIO_COTA'); const cotas = n('COTAS');
      const bp = {
        vgv: rx('VGV'), receitas, despesas, resultado, vpl: rx('VPL_6'), exposicaoMaxima: exposicao, margem: resultado / receitas, roe: resultado / Math.abs(exposicao),
        tirMensal: n('TIR_MENSAL'), tirAnual: Math.pow(1 + n('TIR_MENSAL'), 12) - 1, precoCota, valorParcela: rx('VALOR_MEDIO_PARCELA'), valorM2: rx('VALOR_MEDIO_AREA_PRIVATIVA'),
        cotas, uh: n('UH'), velocidade: n('VELOCIDADE_VENDA'), parcelas: n('PARCELAS'), taxaVpl: n('TAXA_VPL'), fatorIpca: fator, dataBase: t('DATA_BASE_REEXPRESSAO'),
      };
      const cenarios = [['ESTRESSE', 'Estresse'], ['CONSERVADOR', 'Conservador'], ['BASE', 'Base'], ['UPSIDE', 'Upside'], ['UPSIDE_MAIS', 'Upside +']].map(([c, nome]) => {
        const rr = receitas * (1 + n(`SENS_${c}_RECEITA`)); const dd = despesas * (1 + n(`SENS_${c}_DESPESA`));
        return { nome, varReceita: n(`SENS_${c}_RECEITA`), varDespesa: n(`SENS_${c}_DESPESA`), receitas: rr, despesas: dd, resultado: rr + dd, margem: (rr + dd) / rr };
      });
      const anc = ops.find((o) => o.codigo === 'ANCORA');
      const meta = n('ANCORA:META_COTA_SENIOR');
      let ancora: any = null;
      if (anc) {
        const vincs = await tx.projCreditoVinculo.findMany({ where: { canceladoEm: null, situacao: 'VINCULADO', credito: { operacaoId: anc.id, canceladoEm: null } }, select: { credito: { select: { dataCredito: true, valor: true } } } });
        const devs = await tx.projAplicacao.findMany({ where: { operacaoId: anc.id, canceladoEm: null, natureza: { tipo: 'DEVOLUCAO' } }, select: { dataAplicacao: true, valor: true } });
        const ev = [...vincs.map((x) => ({ data: x.credito.dataCredito.toISOString().slice(0, 10), c: Math.round(Number(x.credito.valor) * 100) })),
          ...devs.map((x) => ({ data: x.dataAplicacao.toISOString().slice(0, 10), c: -Math.round(Number(x.valor) * 100) }))].sort((a, b) => a.data.localeCompare(b.data));
        const metaC = Math.round(meta * 100);
        let s = 0; let concluida: string | null = null;
        for (const e of ev) { s += e.c; if (!concluida && s >= metaC) concluida = e.data; }
        const aportesAte = (iso: string) => ev.filter((e) => e.data <= iso && e.c > 0).reduce((x, e) => x + e.c, 0) / 100;
        const inf = await tx.projSaldoInformado.findFirst({ where: { operacaoId: anc.id, canceladoEm: null, tipo: 'CONTA_INDIVIDUAL' }, orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }], select: { dataReferencia: true, valor: true } });
        let difConc: number | null = null;
        if (inf) { const lim = inf.dataReferencia.toISOString().slice(0, 10); difConc = (ev.filter((e) => e.data <= lim).reduce((x, e) => x + e.c, 0) - Math.round(Number(inf.valor) * 100)) / 100; }
        ancora = {
          inicio: t('ANCORA:INICIO_OPERACAO'), primeiroAporte: ev.find((e) => e.c > 0)?.data ?? null, meta, saldo: s / 100, percentual: metaC ? s / metaC : 0,
          falta: Math.max(0, (metaC - s) / 100), concluidaEm: concluida, aportesAte31out2025: aportesAte('2025-10-31'), aportesAte31dez2025: aportesAte('2025-12-31'),
          emConciliacao: difConc !== null && Math.abs(difConc) >= 0.01, diferencaConciliacao: difConc,
        };
      }
      const cotasEq = meta / precoCota; const elegivel = resultado * (1 - cotasEq / cotas);
      const cotaSenior = { valor: meta, cotasEquivalentes: cotasEq, percentualCotas: cotasEq / cotas, vgvRemanescente: bp.vgv - meta, resultadoElegivel: elegivel };
      const passivo = n('REAL:PASSIVO_REFERENCIA');
      const faixasP = [1, 2, 3, 4].map((i) => ({ faixa: i, pct: n(`REAL:FAIXA_${i}_PCT`), ateMoic: i < 4 ? n(`REAL:FAIXA_${i}_ATE_MOIC`) : null }));
      let resto = elegivel; let acum = 0; let ant = 0; const faixas: any[] = [];
      for (const f of faixasP) {
        const alvo = f.ateMoic === null ? Infinity : (f.ateMoic - ant) * passivo;
        const consumo = alvo === Infinity ? resto : Math.min(resto, alvo / f.pct);
        const rec = consumo * f.pct; acum += rec; resto -= consumo;
        faixas.push({ ...f, deMoic: ant, deValor: ant * passivo, ateValor: f.ateMoic === null ? null : f.ateMoic * passivo, recebimento: rec, consumo, acumulado: acum, moic: acum / passivo });
        ant = f.ateMoic ?? ant;
      }
      const waterfall = { passivo, faixas, recebimentoTotal: acum, moic: acum / passivo, ganho: acum - passivo, residualProjeto: elegivel - acum, participacaoEfetiva: acum / elegivel,
        realizado: { distribuido: 0, faixaVigente: 1, moic: 0 } };
      const contrato = { passivo, dataAssuncao: dt('REAL:DATA_ASSUNCAO_PASSIVO'), inicioEstruturacao: t('REAL:INICIO_ESTRUTURACAO'), inicioParticipacao: t('REAL:INICIO_PARTICIPACAO') };
      const opReal = ops.find((o) => o.codigo === 'REAL');
      const parts = opReal ? await tx.projParticipacao.findMany({ where: { operacaoId: opReal.id, canceladoEm: null }, select: { companyId: true, papel: { select: { nome: true } }, contraparte: { select: { nome: true, pais: true } } } }) : [];
      const cids = parts.map((p) => p.companyId).filter((x): x is string => !!x);
      const emps = new Map((cids.length ? await tx.company.findMany({ where: { id: { in: cids } }, select: { id: true, legalName: true } }) : []).map((c) => [c.id, c.legalName]));
      const participantes = parts.map((p) => ({ papel: p.papel.nome, nome: (p.companyId && emps.get(p.companyId)) || p.contraparte?.nome || '-', pais: p.contraparte?.pais ?? 'BR' }));
      const dados = { projeto: proj.nome, versao: { numero: versao.numero, dataBase: versao.dataBase.toISOString().slice(0, 10), arquivo: versao.arquivoOrigem, sha256: versao.arquivoSha256 },
        bp, cenarios, ancora, cotaSenior, waterfall, contrato, participantes };
      const hash = crypto.createHash('sha256').update(JSON.stringify(dados)).digest('hex');
      return { ...dados, hash, emitidoEm: new Date().toISOString() };
    });
  }

  @Get('projetos/:projetoId/kit-investidor')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  kitInvestidor(@Param('projetoId') projetoId: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.montarKit(req.user.id, projetoId);
  }

  @Get('projetos/:projetoId/kit-investidor/pdf')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async kitInvestidorPdf(@Param('projetoId') projetoId: string, @Req() req: any, @Res() res: Response) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const k: any = await this.montarKit(req.user.id, projetoId);
    await this.db.comoUsuario(req.user.id, (tx) => tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_KIT_INVESTIDOR_EMITIDO', targetId: projetoId, after: { projetoId, versaoPremissas: k.versao.numero, hash: k.hash } } }));
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(this.htmlKit(k), { waitUntil: 'load' });
      const pdf = Buffer.from(await page.pdf({
        format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '16mm', left: '12mm', right: '12mm' }, displayHeaderFooter: true, headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-size:7px;width:100%;padding:0 12mm;color:#667085;display:flex;justify-content:space-between;font-family:Arial"><span>Kit do Investidor · premissas v${k.versao.numero} · código de conferência (SHA-256): ${k.hash}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
      }));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="kit-investidor-${new Date().toISOString().slice(0, 10)}.pdf"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(pdf);
    } finally { await browser.close(); }
  }

  private htmlKit(k: any): string {
    const mi = (v: number) => 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mi';
    const pc = (v: number, d = 2) => (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
    const nf = (v: number, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const tag = (o: string) => `<span class="tag ${o === 'LEDGR' ? 'lg' : o === 'BP' ? 'bp' : 'ct'}">${o === 'LEDGR' ? 'Apurado no LEDGR' : o === 'BP' ? 'Premissa do BP v' + k.versao.numero : 'Parâmetro contratual'}</span>`;
    const card = (rot: string, val: string, o: string) => `<div class="card"><span>${esc(rot)}</span><strong>${val}</strong>${tag(o)}</div>`;
    const a = k.ancora || {};
    const conc = a.emConciliacao ? ` <span class="warnc">em conciliação (diferença de ${brl(a.diferencaConciliacao)})</span>` : '';
    const faixas = k.waterfall.faixas.map((f: any) => `<tr><td><b>${['I', 'II', 'III', 'IV'][f.faixa - 1]}</b></td><td>${f.ateValor === null ? 'Acima de ' + mi(f.deValor) + ' (&gt;' + nf(f.deMoic, 2) + 'x)' : (f.deValor ? mi(f.deValor) + ' → ' : 'Até ') + mi(f.ateValor) + ' (' + nf(f.ateMoic, 2) + 'x)'}</td><td class="num"><b>${pc(f.pct, 0)}</b></td><td class="num">${pc(1 - f.pct, 0)}</td><td class="num">${mi(f.recebimento)}</td><td class="num">${nf(f.moic, 2)}x</td></tr>`).join('');
    const cen = k.cenarios.map((c: any) => `<tr><td>${esc(c.nome)}</td><td class="num">${pc(c.varReceita, 0)}</td><td class="num">${pc(c.varDespesa, 0)}</td><td class="num">${mi(c.resultado)}</td><td class="num">${pc(c.margem, 1)}</td></tr>`).join('');
    const parts = k.participantes.map((p: any) => `<tr><td><b>${esc(p.nome)}</b>${p.pais && p.pais !== 'BR' ? ' (' + esc(p.pais) + ')' : ''}</td><td>${esc(p.papel)}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#152033;font-size:10.5px;margin:0}
      .page{page-break-after:always;padding:6px 4px}.page:last-child{page-break-after:auto}
      .cover{background:linear-gradient(135deg,#0f2747,#173f6d);color:#fff;padding:60px 40px;min-height:240mm;box-sizing:border-box}
      .eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:9px;font-weight:700;color:#1f5f99}.cover .eyebrow{color:#dfe8f4}
      h1{font-size:34px;margin:10px 0 14px}h2{font-size:20px;color:#0f2747;margin:2px 0 10px}h3{font-size:13px;color:#0f2747;margin:12px 0 6px}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}
      .card{border:1px solid #d8dee8;border-radius:6px;padding:10px}.card span{font-size:8px;color:#667085;text-transform:uppercase;letter-spacing:.06em}
      .card strong{display:block;font-size:17px;color:#0f2747;margin:4px 0}
      table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#0f2747;color:#fff;text-align:left;padding:6px;font-size:9px}
      td{border-bottom:1px solid #d8dee8;padding:6px;vertical-align:top}.num{text-align:right;white-space:nowrap}
      .note{background:#f7f9fc;border-left:3px solid #1f5f99;padding:9px 12px;margin:10px 0;color:#344054}.warn{background:#fff8e8;border-left-color:#9a6a14}
      .tag{display:inline-block;font-size:7.5px;font-weight:700;border-radius:999px;padding:1px 6px;margin-top:2px}
      .tag.lg{background:#e8f5ee;color:#1a4a3a}.tag.bp{background:#eaf2fb;color:#1f5f99}.tag.ct{background:#fff3df;color:#9a6a14}
      .warnc{color:#9a6a14;font-weight:700}.ev{padding:0 0 10px 16px;border-left:2px solid #cad4e2;margin-left:4px}.ev b{color:#0f2747}.ev small{display:block;color:#667085}
      .bar{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin:6px 0}.bar i{display:block;height:100%;background:#236a57}
    </style></head><body>
    <section class="page cover"><div class="eyebrow">${esc(k.projeto)} · material executivo</div><h1>Kit do Investidor</h1>
      <p style="font-size:15px;max-width:620px">Visão executiva do projeto, evolução da Operação Âncora e estrutura econômica do Investidor Estratégico.</p>
      <p style="margin-top:40px">Premissas do BP versão ${k.versao.numero}, reexpressas a ${esc(k.bp.dataBase || '')} · Emitido em ${new Date(k.emitidoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
      <p style="opacity:.75;font-size:9.5px;max-width:620px">Material informativo e confidencial. As projeções não constituem garantia de retorno e devem ser lidas em conjunto com os instrumentos contratuais, que prevalecem em caso de divergência.</p></section>
    <section class="page"><div class="eyebrow">01 · OnePage do Projeto</div><h2>Escala econômica e assimetria de capital</h2>
      <div class="grid">${card('VGV reexpresso', mi(k.bp.vgv), 'BP')}${card('Receitas projetadas', mi(k.bp.receitas), 'BP')}${card('Resultado projetado', mi(k.bp.resultado), 'BP')}${card('Exposição máxima', mi(Math.abs(k.bp.exposicaoMaxima)), 'BP')}</div>
      <div class="two"><div><h3>Configuração econômica ${tag('BP')}</h3><table>
        <tr><td>Total de U.H.</td><td class="num"><b>${nf(k.bp.uh)}</b></td></tr><tr><td>Cotas econômicas do BP</td><td class="num"><b>${nf(k.bp.cotas)}</b></td></tr>
        <tr><td>Preço-base médio por cota</td><td class="num"><b>${brl(k.bp.precoCota)}</b></td></tr><tr><td>Prazo de venda</td><td class="num"><b>${nf(k.bp.velocidade)} meses</b></td></tr>
        <tr><td>Margem resultado / receita</td><td class="num"><b>${pc(k.bp.margem)}</b></td></tr></table></div>
        <div><h3>Indicadores de referência</h3><table>
        <tr><td>TIR do BP ${tag('BP')}</td><td class="num"><b>${pc(k.bp.tirMensal)} a.m. / ${pc(k.bp.tirAnual)} a.a.</b></td></tr>
        <tr><td>Resultado / exposição máxima ${tag('BP')}</td><td class="num"><b>${nf(k.bp.roe, 2)}x</b></td></tr>
        <tr><td>VPL comparável a ${pc(k.bp.taxaVpl, 0)} a.a. ${tag('BP')}</td><td class="num"><b>${mi(k.bp.vpl)}</b></td></tr>
        <tr><td>Passivo de referência assumido ${tag('CT')}</td><td class="num"><b>${mi(k.contrato.passivo)}</b></td></tr>
        <tr><td>Início da participação ${tag('CT')}</td><td class="num"><b>${esc(k.contrato.inicioParticipacao || '-')}</b></td></tr></table></div></div>
      <div class="note">O VPL a ${pc(k.bp.taxaVpl, 0)} a.a. é referência comparável ao estudo original (2018), reexpresso pelo IPCA acumulado (fator ${nf(k.bp.fatorIpca, 4)}); não é um valuation de mercado atual.</div></section>
    <section class="page"><div class="eyebrow">02 · Cronograma e andamento</div><h2>Da Operação Âncora à participação econômica</h2>
      <div class="ev"><b>${esc(a.inicio || 'ago/2024')} · Início da Operação Âncora</b> ${tag('LEDGR')}<small>Primeiro aporte do Cliente Âncora em ${a.primeiroAporte ? a.primeiroAporte.split('-').reverse().join('/') : '-'}, comprovado no extrato da recebedora.</small></div>
      <div class="ev"><b>Até 31/10/2025 · ${brl(a.aportesAte31out2025 || 0)} aportados</b> ${tag('LEDGR')}<small>Soma exata dos créditos vinculados à Conta Individual, com prova bancária.</small></div>
      <div class="ev"><b>${k.contrato.dataAssuncao ? k.contrato.dataAssuncao.split('-').reverse().join('/') : '31/10/2025'} · Assunção do passivo de referência de ${mi(k.contrato.passivo)}</b> ${tag('CT')}<small>Marco da exposição econômica do Investidor Estratégico; sem recebimento de cotas.</small></div>
      <div class="ev"><b>Até 31/12/2025 · ${brl(a.aportesAte31dez2025 || 0)} aportados</b> ${tag('LEDGR')}${conc}</div>
      <div class="ev"><b>Cota sênior · ${pc(a.percentual || 0, 1)} de ${brl(k.cotaSenior.valor)}</b> ${tag('LEDGR')}<div class="bar"><i style="width:${Math.min(100, (a.percentual || 0) * 100).toFixed(1)}%"></i></div>
        <small>${a.concluidaEm ? 'Meta atingida em ' + a.concluidaEm.split('-').reverse().join('/') + '.' : 'Saldo líquido de ' + brl(a.saldo || 0) + '; faltam ' + brl(a.falta || 0) + ' para a conclusão da Operação Âncora.'}</small></div>
      <div class="ev"><b>${esc(k.contrato.inicioEstruturacao || '-')} · Início da Estruturação</b> ${tag('CT')}<small>Preparação comercial, financeira e operacional; sem apuração de participação.</small></div>
      <div class="ev"><b>Início da participação: ${esc(k.contrato.inicioParticipacao || '-')}</b> ${tag('CT')}<small>A data formalizada delimita a base elegível da waterfall.</small></div>
      <div class="note warn"><b>Segregação:</b> a Operação Âncora (cota sênior de ${brl(k.cotaSenior.valor)}) permanece segregada da base econômica do Investidor Estratégico; ela é excluída pro-rata do resultado elegível (${nf(k.cotaSenior.cotasEquivalentes, 2)} cotas equivalentes, ${pc(k.cotaSenior.percentualCotas)} do estoque).</div></section>
    <section class="page"><div class="eyebrow">03 e 04 · Tese e estrutura</div><h2>Participação econômica vinculada ao caixa distribuível</h2>
      <div class="grid">${card('Escala (VGV)', mi(k.bp.vgv), 'BP')}${card('Capital (passivo)', mi(k.contrato.passivo), 'CT')}${card('Margem projetada', pc(k.bp.margem, 1), 'BP')}${card('Resultado elegível', mi(k.cotaSenior.resultadoElegivel), 'BP')}</div>
      <h3>Participantes da operação ${tag('LEDGR')}</h3><table><tr><th>Participante</th><th>Papel</th></tr>${parts}<tr><td><b>Cliente Âncora</b></td><td>Operação Âncora (cota sênior), segregada da base econômica</td></tr></table>
      <div class="note"><b>Importante:</b> o Investidor Estratégico não recebe cotas, unidades, frações ideais, posse ou poderes de gestão; sua posição é econômica e contratual. A gestão estratégica, comercial, operacional e imobiliária permanece com a desenvolvedora.</div></section>
    <section class="page"><div class="eyebrow">05 · Waterfall econômico</div><h2>Participação progressiva sobre o Caixa Distribuível Elegível</h2>
      <table><tr><th>Faixa</th><th>Retorno acumulado do investidor</th><th class="num">Investidor</th><th class="num">Desenvolvedora</th><th class="num">Recebimento indicativo</th><th class="num">MOIC acumulado</th></tr>${faixas}</table>
      <div class="two"><div class="card"><span>Caso-base indicativo</span><strong>${mi(k.waterfall.recebimentoTotal)} · ${nf(k.waterfall.moic, 2)}x</strong>${tag('BP')}<p>Sobre o resultado elegível de ${mi(k.cotaSenior.resultadoElegivel)}; participação efetiva de ${pc(k.waterfall.participacaoEfetiva, 1)}.</p></div>
        <div class="card"><span>Realizado</span><strong>${brl(k.waterfall.realizado.distribuido)} · Faixa ${['I', 'II', 'III', 'IV'][k.waterfall.realizado.faixaVigente - 1]}</strong>${tag('LEDGR')}<p>A apuração do CDE começa com a participação; até lá não há distribuição.</p></div></div>
      <div class="note"><b>CDE:</b> receitas efetivamente recebidas menos tributos, comissões, custos, despesas, investimentos, obrigações, passivos, perdas e reservas necessárias ao projeto. VGV ou vendas contratadas, isoladamente, não equivalem a caixa distribuível.</div></section>
    <section class="page"><div class="eyebrow">06 · Premissas e acompanhamento</div><h2>Sensibilidade e disciplina do modelo</h2>
      <h3>Sensibilidade indicativa do resultado ${tag('BP')}</h3><table><tr><th>Cenário</th><th class="num">Receita</th><th class="num">Despesas</th><th class="num">Resultado</th><th class="num">Margem</th></tr>${cen}</table>
      <div class="note warn">As projeções vêm do BP original de 2018, reexpresso pelo IPCA; não representam garantia de rentabilidade ou de prazo. O BP precisa ser atualizado com o fluxo mensal realizado a partir do início da participação, para TIR, MOIC e payback efetivos do investidor.</div>
      <p style="font-size:8.5px;color:#667085">Fonte das premissas: ${esc(k.versao.arquivo || '-')} (SHA-256 ${esc((k.versao.sha256 || '').slice(0, 16))}…). Documento executivo; em caso de divergência, prevalecem os instrumentos jurídicos assinados.</p></section>
    </body></html>`;
  }
}


