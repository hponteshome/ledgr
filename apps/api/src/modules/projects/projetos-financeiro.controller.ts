// apps/api/src/modules/projects/projetos-financeiro.controller.ts
// Fase 1.8 revista (03/10/2026): TRIAGEM DO EXTRATO NO LEDGR, pelo Financeiro da empresa recebedora.
//  - escopo da EMPRESA ATIVA: sem @SkipCompanyCheck, o CompanyInterceptor exige x-company-id e o vinculo UserCompany
//  - o extrato completo so aparece aqui, no LEDGR; o projeto recebe apenas o que for ENCAMINHADO
//  - encaminhar: cria o credito (origem EXTRATO) ja comprovado pela entrada, com o vinculo PENDENTE (decisao do projeto)
//  - nao pertence: a entrada sai da triagem, com motivo (reversivel)
//  - acoes so Master por enquanto (as politicas de RLS de gravacao do dominio sao so Master)
import { Controller, Get, Post, Param, Body, Req, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjDbService } from './proj-db.service';
import { UUID_RE } from './concessoes.service';

function mascarar(doc?: string | null): string | null {
  if (!doc) return null;
  if (doc.length === 11) return '***.' + doc.slice(3, 6) + '.' + doc.slice(6, 9) + '-**';
  if (doc.length === 14) return doc.slice(0, 2) + '.' + doc.slice(2, 5) + '.' + doc.slice(5, 8) + '/' + doc.slice(8, 12) + '-' + doc.slice(12);
  return '***';
}

@Controller('projects-financeiro')
@UseGuards(JwtAuthGuard)
export class ProjetosFinanceiroController {
  constructor(private readonly prisma: PrismaService, private readonly db: ProjDbService) {}

  private empresa(req: any): string {
    const id = req.companyId;
    if (!id || !UUID_RE.test(id)) throw new BadRequestException('Selecione a empresa no LEDGR.');
    return id;
  }

  // Ids das transacoes DA EMPRESA ja destinadas (funcao SECURITY DEFINER: nao expoe dados do projeto)
  private async destinadas(companyId: string): Promise<Set<string>> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`SELECT bank_transaction_id::text AS id FROM proj_transacoes_destinadas(${companyId}::uuid)`;
    return new Set(rows.map((r) => r.id));
  }

  @Get('entradas')
  async entradas(@Req() req: any) {
    const companyId = this.empresa(req);
    const usadas = await this.destinadas(companyId);
    const lista = await this.prisma.bankTransaction.findMany({
      where: { companyId, type: 'CREDIT' as any },
      orderBy: { transactionDate: 'asc' },
      select: { id: true, transactionDate: true, amount: true, description: true, counterpartyName: true, counterpartyDoc: true },
    });
    const livres = lista.filter((t) => !usadas.has(t.id));
    const notas = await this.anotacoes(companyId); // Fase 1.11 A2: anotacao da planilha tambem nas entradas (so apoio)
    const destinos = await this.db.comoUsuario(req.user.id, (tx) =>
      tx.projParticipacao.findMany({
        where: { companyId, canceladoEm: null, papel: { codigo: 'RECEBEDORA_FINANCEIRA' }, operacao: { canceladoEm: null } },
        select: { operacao: { select: { id: true, nome: true, projeto: { select: { nome: true } } } } },
      }),
    );
    const docs = [...new Set(livres.map((t) => t.counterpartyDoc).filter((d): d is string => !!d))];
    const conhecidas = docs.length
      ? await this.db.comoUsuario(req.user.id, (tx) => tx.projContraparte.findMany({ where: { documento: { in: docs }, canceladoEm: null }, select: { documento: true } }))
      : [];
    const conhecidos = new Set(conhecidas.map((c) => c.documento));
    return {
      destinos: destinos.map((d) => ({ operacaoId: d.operacao.id, nome: d.operacao.projeto.nome + ' · ' + d.operacao.nome })),
      entradas: livres.map((t) => ({
        id: t.id, data: t.transactionDate, valor: t.amount, lancamento: t.description,
        pagadorNome: t.counterpartyName || null, pagadorDocumento: mascarar(t.counterpartyDoc),
        remetenteConhecido: !!(t.counterpartyDoc && conhecidos.has(t.counterpartyDoc)),
        anotacao: notas.get(t.id) || null,
      })),
    };
  }

  @Post('entradas/:transacaoId/encaminhar')
  @UseGuards(MasterOnlyGuard)
  async encaminhar(@Param('transacaoId') transacaoId: string, @Body() body: any, @Req() req: any) {
    const companyId = this.empresa(req);
    const operacaoId = String(body?.operacaoId || '');
    const motivo = String(body?.motivo || '').trim();
    if (!UUID_RE.test(transacaoId) || !UUID_RE.test(operacaoId)) throw new BadRequestException('Informe a entrada e a operacao de destino.');
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    if ((await this.destinadas(companyId)).has(transacaoId)) throw new BadRequestException('Esta entrada ja foi destinada.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const t = await tx.bankTransaction.findFirst({
        where: { id: transacaoId, companyId },
        select: { id: true, companyId: true, type: true, transactionDate: true, amount: true, description: true, counterpartyName: true, counterpartyDoc: true },
      });
      if (!t || String(t.type) !== 'CREDIT') throw new NotFoundException('Entrada nao encontrada nesta empresa.');
      const receb = await tx.projParticipacao.findFirst({ where: { operacaoId, companyId, canceladoEm: null, papel: { codigo: 'RECEBEDORA_FINANCEIRA' } }, select: { id: true } });
      if (!receb) throw new BadRequestException('A empresa ativa nao e recebedora da operacao escolhida.');
      let remetenteId: string | null = null;
      const doc = t.counterpartyDoc && (t.counterpartyDoc.length === 11 || t.counterpartyDoc.length === 14) ? t.counterpartyDoc : null;
      if (doc) {
        const existente = await tx.projContraparte.findFirst({ where: { documento: doc, canceladoEm: null }, select: { id: true } });
        remetenteId = existente
          ? existente.id
          : (await tx.projContraparte.create({
              data: { tipoPessoa: doc.length === 11 ? 'PF' : 'PJ', documento: doc, nome: t.counterpartyName || 'Remetente sem nome no extrato', observacoes: 'Remetente cadastrado a partir do extrato bancario', criadoPorId: req.user.id },
              select: { id: true },
            })).id;
        const papel = await tx.projPapel.findFirst({ where: { codigo: 'REMETENTE' }, select: { id: true } });
        if (papel) {
          const part = await tx.projParticipacao.findFirst({ where: { operacaoId, contraparteId: remetenteId, papelId: papel.id, canceladoEm: null }, select: { id: true } });
          if (!part) await tx.projParticipacao.create({ data: { operacaoId, papelId: papel.id, contraparteId: remetenteId, observacao: 'Remetente de credito encaminhado pelo Financeiro', criadoPorId: req.user.id } });
        }
      }
      const ultimo = await tx.projCredito.aggregate({ where: { operacaoId }, _max: { numeroOrdem: true } });
      const credito = await tx.projCredito.create({
        data: {
          operacaoId, numeroOrdem: (ultimo._max.numeroOrdem ?? 0) + 1, dataCredito: t.transactionDate, valor: t.amount,
          remetenteId, remetenteNomeExtrato: t.counterpartyName || null, referenciaBancaria: t.description, recebedoraCompanyId: t.companyId,
          origem: 'EXTRATO', identificacaoPendente: !remetenteId, chaveIdempotencia: 'EXTRATO|' + t.id,
          observacao: remetenteId ? null : 'Extrato sem pagador identificado', criadoPorId: req.user.id,
        },
      });
      await tx.projCreditoProva.create({
        data: { creditoId: credito.id, bankTransactionId: t.id, criterio: 'MANUAL', motivo: 'Encaminhado pelo Financeiro a partir do extrato: ' + motivo, criadoPorId: req.user.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user.id, action: 'PROJ_CREDITO_ENCAMINHADO', targetId: credito.id,
          after: { companyId, operacaoId, bankTransactionId: t.id, numeroOrdem: credito.numeroOrdem, valor: t.amount.toFixed(2), motivo, vinculo: 'pendente de decisao do projeto' },
        },
      });
      return { id: credito.id, numeroOrdem: credito.numeroOrdem };
    });
  }

  @Post('entradas/:transacaoId/nao-pertence')
  @UseGuards(MasterOnlyGuard)
  async naoPertence(@Param('transacaoId') transacaoId: string, @Body() body: any, @Req() req: any) {
    const companyId = this.empresa(req);
    const motivo = String(body?.motivo || '').trim();
    if (!UUID_RE.test(transacaoId)) throw new BadRequestException('Entrada invalida.');
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    if ((await this.destinadas(companyId)).has(transacaoId)) throw new BadRequestException('Esta entrada ja foi destinada.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const t = await tx.bankTransaction.findFirst({ where: { id: transacaoId, companyId }, select: { id: true, type: true, amount: true } });
      if (!t || String(t.type) !== 'CREDIT') throw new NotFoundException('Entrada nao encontrada nesta empresa.');
      const ops = await tx.projParticipacao.findMany({ where: { companyId, canceladoEm: null, papel: { codigo: 'RECEBEDORA_FINANCEIRA' } }, select: { operacaoId: true } });
      const ids = [...new Set(ops.map((o) => o.operacaoId))];
      if (!ids.length) throw new BadRequestException('A empresa ativa nao e recebedora de nenhuma operacao de projeto.');
      for (const operacaoId of ids) {
        await tx.projExtratoDecisao.create({ data: { operacaoId, bankTransactionId: t.id, decisao: 'NAO_PERTENCE', motivo, criadoPorId: req.user.id } });
      }
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_EXTRATO_ENTRADA_DESCARTADA', targetId: t.id, after: { companyId, operacoes: ids, valor: t.amount.toFixed(2), motivo } } });
      return { ok: true };
    });
  }

  // Anotacoes da planilha do Financeiro (SO apoio; a API nao le a tabela direto, so por esta funcao da empresa ativa)
  private async anotacoes(companyId: string): Promise<Map<string, string>> {
    const rows = await this.prisma.$queryRaw<{ id: string; texto: string }[]>`SELECT bank_transaction_id::text AS id, texto FROM proj_anotacoes_da_empresa(${companyId}::uuid)`;
    return new Map(rows.map((r) => [r.id, r.texto]));
  }

  // -- Saidas (Fase 1.11 parte A, 04/10/2026) ---------------------------------------------------------
  // Triagem das saidas da empresa ativa: aplicacao por conta da beneficiaria, devolucao ao Adquirente,
  // transferencia interna (neutra) ou nao pertence. O que nao for da operacao nunca sai do LEDGR.
  @Get('saidas')
  async saidas(@Req() req: any) {
    const companyId = this.empresa(req);
    const usadas = await this.destinadas(companyId);
    const notas = await this.anotacoes(companyId);
    const lista = await this.prisma.bankTransaction.findMany({
      where: { companyId, type: 'DEBIT' as any },
      orderBy: { transactionDate: 'asc' },
      select: { id: true, transactionDate: true, amount: true, description: true, counterpartyName: true, counterpartyDoc: true },
    });
    return lista.filter((t) => !usadas.has(t.id)).map((t) => ({
      id: t.id, data: t.transactionDate, valor: t.amount, lancamento: t.description,
      favorecidoNome: t.counterpartyName || null, favorecidoDocumento: mascarar(t.counterpartyDoc), anotacao: notas.get(t.id) || null,
    }));
  }

  @Get('saidas/apoio')
  @UseGuards(MasterOnlyGuard)
  async apoioSaidas(@Req() req: any) {
    const companyId = this.empresa(req);
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const naturezas = await tx.projNaturezaAplicacao.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { codigo: true, nome: true, tipo: true } });
      const parts = await tx.projParticipacao.findMany({
        where: { companyId, canceladoEm: null, papel: { codigo: 'RECEBEDORA_FINANCEIRA' }, operacao: { canceladoEm: null } },
        select: { operacao: { select: { id: true, nome: true, projeto: { select: { nome: true } } } } },
      });
      const destinos: any[] = [];
      for (const p of parts) {
        const op = p.operacao;
        const cps = await tx.projParticipacao.findMany({
          where: { operacaoId: op.id, canceladoEm: null, contraparteId: { not: null } },
          select: { papel: { select: { nome: true } }, contraparte: { select: { id: true, nome: true } } },
        });
        const papeis = new Map<string, { nome: string; papeis: string[] }>();
        cps.forEach((c) => { if (c.contraparte) { const e = papeis.get(c.contraparte.id) || { nome: c.contraparte.nome, papeis: [] }; e.papeis.push(c.papel.nome); papeis.set(c.contraparte.id, e); } });
        const creditos = await tx.projCredito.findMany({
          where: { operacaoId: op.id, canceladoEm: null }, orderBy: { numeroOrdem: 'asc' },
          select: { id: true, numeroOrdem: true, dataCredito: true, valor: true, remetente: { select: { nome: true } } },
        });
        destinos.push({
          operacaoId: op.id, nome: op.projeto.nome + ' · ' + op.nome,
          contrapartes: [...papeis.entries()].map(([id, e]) => ({ id, nome: e.nome, papeis: e.papeis.join(', ') })).sort((a, b) => a.nome.localeCompare(b.nome)),
          creditos: creditos.map((c) => ({ id: c.id, rotulo: `Nº ${c.numeroOrdem ?? '-'} · ${c.dataCredito.toISOString().slice(0, 10)} · R$ ${c.valor.toFixed(2)} · ${c.remetente?.nome || 'sem remetente'}` })),
        });
      }
      return { naturezas, destinos };
    });
  }

  @Post('saidas/:transacaoId/aplicar')
  @UseGuards(MasterOnlyGuard)
  async aplicar(@Param('transacaoId') transacaoId: string, @Body() b: any, @Req() req: any) {
    const companyId = this.empresa(req);
    const operacaoId = String(b?.operacaoId || '');
    const naturezaCodigo = String(b?.naturezaCodigo || '');
    const motivo = String(b?.motivo || '').trim();
    const beneficiarioId = b?.beneficiarioId ? String(b.beneficiarioId) : null;
    const creditoId = b?.creditoId ? String(b.creditoId) : null;
    for (const id of [transacaoId, operacaoId]) if (!UUID_RE.test(id)) throw new BadRequestException('Informe a saida e a operacao.');
    for (const id of [beneficiarioId, creditoId]) if (id && !UUID_RE.test(id)) throw new BadRequestException('Identificador invalido.');
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    if ((await this.destinadas(companyId)).has(transacaoId)) throw new BadRequestException('Esta saida ja foi destinada.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const t = await tx.bankTransaction.findFirst({ where: { id: transacaoId, companyId }, select: { id: true, type: true, amount: true, transactionDate: true } });
      if (!t || String(t.type) !== 'DEBIT') throw new NotFoundException('Saida nao encontrada nesta empresa.');
      const receb = await tx.projParticipacao.findFirst({ where: { operacaoId, companyId, canceladoEm: null, papel: { codigo: 'RECEBEDORA_FINANCEIRA' } }, select: { id: true } });
      if (!receb) throw new BadRequestException('A empresa ativa nao e recebedora da operacao escolhida.');
      const nat = await tx.projNaturezaAplicacao.findFirst({ where: { codigo: naturezaCodigo, ativo: true }, select: { id: true, tipo: true } });
      if (!nat) throw new BadRequestException('Natureza invalida.');
      if (nat.tipo === 'DEVOLUCAO' && !beneficiarioId) throw new BadRequestException('Na devolucao, informe a quem foi devolvido (Adquirente ou intermediario).');
      if (beneficiarioId && !(await tx.projParticipacao.findFirst({ where: { operacaoId, contraparteId: beneficiarioId, canceladoEm: null }, select: { id: true } }))) {
        throw new BadRequestException('O beneficiario precisa participar da operacao.');
      }
      if (creditoId && !(await tx.projCredito.findFirst({ where: { id: creditoId, operacaoId, canceladoEm: null }, select: { id: true } }))) {
        throw new BadRequestException('Credito nao encontrado nesta operacao.');
      }
      const ap = await tx.projAplicacao.create({
        data: {
          operacaoId, bankTransactionId: t.id, naturezaId: nat.id, dataAplicacao: t.transactionDate, valor: t.amount, beneficiarioId, creditoId,
          descricao: b?.descricao ? String(b.descricao).trim().slice(0, 500) || null : null, motivo, criadoPorId: req.user.id,
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: { actorId: req.user.id, action: 'PROJ_APLICACAO_REGISTRADA', targetId: ap.id, after: { companyId, operacaoId, natureza: naturezaCodigo, valor: t.amount.toFixed(2), beneficiarioId, creditoId, motivo } },
      });
      return ap;
    });
  }

  // -- Decisoes sobre movimentos que nao vao ao projeto (Fase 1.11 A2, 04/10/2026) --------------------------
  // NAO_PERTENCE ou TRANSFERENCIA_INTERNA (neutra, com rotulo de circuito), nas saidas e nas entradas.
  @Post('saidas/:transacaoId/decidir')
  @UseGuards(MasterOnlyGuard)
  decidirSaida(@Param('transacaoId') transacaoId: string, @Body() b: any, @Req() req: any) {
    return this.registrarDecisao(req, transacaoId, 'DEBIT', b);
  }

  @Post('entradas/:transacaoId/decidir')
  @UseGuards(MasterOnlyGuard)
  decidirEntrada(@Param('transacaoId') transacaoId: string, @Body() b: any, @Req() req: any) {
    return this.registrarDecisao(req, transacaoId, 'CREDIT', b);
  }

  private async registrarDecisao(req: any, transacaoId: string, tipo: 'CREDIT' | 'DEBIT', b: any) {
    const companyId = this.empresa(req);
    const decisao = String(b?.decisao || '');
    const motivo = String(b?.motivo || '').trim();
    const circuito = b?.circuito ? String(b.circuito).trim().slice(0, 80) : '';
    if (!UUID_RE.test(transacaoId)) throw new BadRequestException('Movimento invalido.');
    if (!['NAO_PERTENCE', 'TRANSFERENCIA_INTERNA'].includes(decisao)) throw new BadRequestException('Decisao invalida.');
    if (decisao === 'TRANSFERENCIA_INTERNA' && circuito.length < 3) throw new BadRequestException('Informe o circuito da transferencia interna (ex.: Josi - protecao de bloqueios).');
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    if ((await this.destinadas(companyId)).has(transacaoId)) throw new BadRequestException('Este movimento ja foi destinado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const t = await tx.bankTransaction.findFirst({ where: { id: transacaoId, companyId }, select: { id: true, type: true, amount: true } });
      if (!t || String(t.type) !== tipo) throw new NotFoundException('Movimento nao encontrado nesta empresa.');
      const ops = await tx.projParticipacao.findMany({ where: { companyId, canceladoEm: null, papel: { codigo: 'RECEBEDORA_FINANCEIRA' } }, select: { operacaoId: true } });
      const ids = [...new Set(ops.map((o) => o.operacaoId))];
      if (!ids.length) throw new BadRequestException('A empresa ativa nao e recebedora de nenhuma operacao de projeto.');
      for (const operacaoId of ids) {
        await tx.projExtratoDecisao.create({ data: { operacaoId, bankTransactionId: t.id, decisao, circuito: decisao === 'TRANSFERENCIA_INTERNA' ? circuito : null, motivo, criadoPorId: req.user.id } });
      }
      await tx.auditLog.create({
        data: { actorId: req.user.id, action: 'PROJ_EXTRATO_MOVIMENTO_DECIDIDO', targetId: t.id, after: { companyId, tipo, decisao, circuito: circuito || null, operacoes: ids, valor: t.amount.toFixed(2), motivo } },
      });
      return { ok: true };
    });
  }

  // Circuitos neutros: transferencias internas agrupadas por rotulo; o saldo de cada circuito deve ser zero.
  @Get('circuitos')
  @UseGuards(MasterOnlyGuard)
  async circuitos(@Req() req: any) {
    const companyId = this.empresa(req);
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const decs = await tx.projExtratoDecisao.findMany({
        where: { canceladoEm: null, decisao: 'TRANSFERENCIA_INTERNA' },
        select: { bankTransactionId: true, circuito: true, motivo: true },
      });
      const ids = [...new Set(decs.map((d) => d.bankTransactionId))];
      const txs = ids.length
        ? await tx.bankTransaction.findMany({ where: { id: { in: ids }, companyId }, select: { id: true, transactionDate: true, amount: true, type: true, description: true } })
        : [];
      const mt = new Map(txs.map((t) => [t.id, t]));
      const vistos = new Set<string>();
      const grupos = new Map<string, { circuito: string; saidas: number; entradas: number; qtdSaidas: number; qtdEntradas: number; itens: any[] }>();
      for (const d of decs) {
        const t = mt.get(d.bankTransactionId);
        if (!t || vistos.has(t.id)) continue;
        vistos.add(t.id);
        const k = d.circuito || '(sem circuito)';
        const g = grupos.get(k) || { circuito: k, saidas: 0, entradas: 0, qtdSaidas: 0, qtdEntradas: 0, itens: [] };
        const centavos = Math.round(Number(t.amount) * 100);
        if (String(t.type) === 'DEBIT') { g.saidas += centavos; g.qtdSaidas += 1; } else { g.entradas += centavos; g.qtdEntradas += 1; }
        g.itens.push({ transacaoId: t.id, data: t.transactionDate, tipo: String(t.type), valor: t.amount, lancamento: t.description, motivo: d.motivo });
        grupos.set(k, g);
      }
      return [...grupos.values()]
        .map((g) => ({
          circuito: g.circuito, qtdSaidas: g.qtdSaidas, qtdEntradas: g.qtdEntradas,
          saidas: (g.saidas / 100).toFixed(2), entradas: (g.entradas / 100).toFixed(2), saldo: ((g.entradas - g.saidas) / 100).toFixed(2),
          itens: g.itens.sort((a, b) => String(a.data).localeCompare(String(b.data))),
        }))
        .sort((a, b) => a.circuito.localeCompare(b.circuito));
    });
  }

  // Desfazer: encerra (com motivo) as decisoes vigentes do movimento; ele volta a triagem.
  @Post('decisoes/:transacaoId/encerrar')
  @UseGuards(MasterOnlyGuard)
  async encerrarDecisao(@Param('transacaoId') transacaoId: string, @Body() b: any, @Req() req: any) {
    const companyId = this.empresa(req);
    const motivo = String(b?.motivo || '').trim();
    if (!UUID_RE.test(transacaoId)) throw new BadRequestException('Movimento invalido.');
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const t = await tx.bankTransaction.findFirst({ where: { id: transacaoId, companyId }, select: { id: true } });
      if (!t) throw new NotFoundException('Movimento nao encontrado nesta empresa.');
      const decs = await tx.projExtratoDecisao.findMany({ where: { bankTransactionId: t.id, canceladoEm: null }, select: { id: true, decisao: true, circuito: true } });
      if (!decs.length) throw new NotFoundException('Nao ha decisao vigente para este movimento.');
      for (const d of decs) {
        await tx.projExtratoDecisao.update({ where: { id: d.id }, data: { canceladoEm: new Date(), canceladoPorId: req.user.id, motivoCancelamento: motivo } });
      }
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_EXTRATO_DECISAO_ENCERRADA', targetId: t.id, after: { companyId, decisao: decs[0].decisao, circuito: decs[0].circuito, motivo } } });
      return { ok: true, encerradas: decs.length };
    });
  }
}

