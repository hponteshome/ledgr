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
  @ProjAcao('ver')
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
}
