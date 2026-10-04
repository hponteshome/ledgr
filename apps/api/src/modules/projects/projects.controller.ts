// apps/api/src/modules/projects/projects.controller.ts
// Fase 1.2a (03/10/2026): primeiras rotas do dominio Projetos (Recife Ocean).
// Autorizacao por concessao (ProjEscopoGuard), nao pela empresa ativa (@SkipCompanyCheck na classe).
// Administracao de concessoes: so Master (bussola 5.3).
// Fase 1.2b (03/10/2026): consultas via ProjDbService.comoUsuario - o banco aplica o RLS das tabelas proj_*
// como segunda barreira (defesa em profundidade sobre o guard).
// Fase 1.6 / D8 / 1.6b (03/10/2026): creditos, resumo, participacoes com nome da empresa e vinculo do credito
// a Conta Individual (alterar ou desvincular: so Master, com motivo; historico imutavel no banco).
import { Controller, Get, Post, Param, Body, Req, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';
import { SkipCompanyCheck, isMasterAdmin } from '../../multi-company/company.interceptor';
import { ProjEscopoGuard, ProjAcao } from './proj-escopo.guard';
import { ConcessoesService, UUID_RE } from './concessoes.service';
import { ProjDbService } from './proj-db.service';

// LGPD (Fase 1.6): CPF sai mascarado; CNPJ (dado publico de empresa) sai formatado por completo.
function mascararDocumento(doc?: string | null): string | null {
  if (!doc) return null;
  if (doc.length === 11) return '***.' + doc.slice(3, 6) + '.' + doc.slice(6, 9) + '-**';
  if (doc.length === 14) return doc.slice(0, 2) + '.' + doc.slice(2, 5) + '.' + doc.slice(5, 8) + '/' + doc.slice(8, 12) + '-' + doc.slice(12);
  return '***';
}

@Controller('projects')
@UseGuards(JwtAuthGuard, ProjEscopoGuard)
@SkipCompanyCheck()
export class ProjectsController {
  constructor(private readonly db: ProjDbService, private readonly concessoes: ConcessoesService) {}

  @Get()
  @ProjAcao('autenticado')
  async listar(@Req() req: any) {
    const ids = isMasterAdmin(req.user) ? undefined : await this.concessoes.projetosVisiveis(req.user.id);
    return this.db.comoUsuario(req.user.id, (tx) =>
      tx.projProjeto.findMany({
        where: { canceladoEm: null, ...(ids ? { id: { in: ids } } : {}) },
        select: { id: true, codigo: true, nome: true, status: true },
        orderBy: { nome: 'asc' },
      }),
    );
  }

  @Post('concessoes')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  conceder(@Body() body: any, @Req() req: any) {
    return this.concessoes.conceder(req.user.id, body);
  }

  @Post('concessoes/:concessaoId/revogar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  revogar(@Param('concessaoId') concessaoId: string, @Body() body: any, @Req() req: any) {
    return this.concessoes.revogar(req.user.id, concessaoId, body?.motivo);
  }

  @Get('operacoes/:operacaoId/participacoes')
  @ProjAcao('ver')
  participacoes(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const lista = await tx.projParticipacao.findMany({
        where: { operacaoId, canceladoEm: null },
        orderBy: { criadoEm: 'asc' },
        select: {
          id: true, companyId: true, observacao: true, vigenciaInicio: true, vigenciaFim: true,
          papel: { select: { codigo: true, nome: true } },
          contraparte: { select: { id: true, nome: true, tipoPessoa: true } },
        },
      });
      // D8: nome da empresa do grupo junto (o dominio le o nucleo; o nucleo nao conhece o dominio)
      const ids = [...new Set(lista.map((p) => p.companyId).filter((x): x is string => !!x))];
      const empresas = ids.length
        ? await tx.company.findMany({ where: { id: { in: ids } }, select: { id: true, legalName: true, tradeName: true } })
        : [];
      const nomes = new Map(empresas.map((e) => [e.id, e.tradeName && e.tradeName.trim().length > 1 ? e.tradeName : e.legalName]));
      return lista.map((p) => ({ ...p, empresaNome: p.companyId ? nomes.get(p.companyId) ?? null : null }));
    });
  }

  @Get('operacoes/:operacaoId/creditos')
  @ProjAcao('ver')
  async creditos(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const lista = await this.db.comoUsuario(req.user.id, (tx) =>
      tx.projCredito.findMany({
        where: { operacaoId, canceladoEm: null },
        orderBy: [{ dataCredito: 'asc' }, { numeroOrdem: 'asc' }],
        select: {
          id: true, numeroOrdem: true, dataCredito: true, valor: true, remetenteNomeExtrato: true,
          referenciaBancaria: true, origem: true, identificacaoPendente: true, observacao: true,
          remetente: { select: { id: true, nome: true, tipoPessoa: true, documento: true } },
          provas: { where: { canceladoEm: null }, select: { criterio: true, bankTransactionId: true } },
          vinculos: {
            where: { canceladoEm: null },
            select: { situacao: true, motivo: true, criadoEm: true, adquirente: { select: { id: true, nome: true } } },
          },
        },
      }),
    );
    // Fase 1.7: prova bancaria - dados da transacao do extrato (dominio le o nucleo)
    const txIds = lista.flatMap((c) => c.provas.map((p) => p.bankTransactionId));
    const txs = txIds.length
      ? await this.db.comoUsuario(req.user.id, (tx) => tx.bankTransaction.findMany({ where: { id: { in: txIds } }, select: { id: true, transactionDate: true, description: true, amount: true } }))
      : [];
    const txMapa = new Map(txs.map((t) => [t.id, t]));
    return lista.map(({ vinculos, remetente, provas, ...c }) => ({
      ...c,
      remetente: remetente
        ? { id: remetente.id, nome: remetente.nome, tipoPessoa: remetente.tipoPessoa, documentoMascarado: mascararDocumento(remetente.documento) }
        : null,
      vinculoAtual: vinculos[0] ?? null,
      provaAtual: (() => {
        const p = provas[0];
        if (!p) return null;
        const t = txMapa.get(p.bankTransactionId);
        return { criterio: p.criterio, transacao: t ? { data: t.transactionDate, descricao: t.description, valor: t.amount } : null };
      })(),
    }));
  }

  @Get('operacoes/:operacaoId/creditos/:creditoId/vinculos')
  @ProjAcao('ver')
  historicoVinculos(@Param('operacaoId') operacaoId: string, @Param('creditoId') creditoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(creditoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const c = await tx.projCredito.findFirst({ where: { id: creditoId, operacaoId, canceladoEm: null }, select: { id: true } });
      if (!c) throw new NotFoundException('Registro nao encontrado.');
      return tx.projCreditoVinculo.findMany({
        where: { creditoId },
        orderBy: { criadoEm: 'desc' },
        select: { id: true, situacao: true, motivo: true, criadoEm: true, canceladoEm: true, motivoCancelamento: true, adquirente: { select: { id: true, nome: true } } },
      });
    });
  }

  @Post('operacoes/:operacaoId/creditos/:creditoId/vinculo')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  async alterarVinculo(@Param('operacaoId') operacaoId: string, @Param('creditoId') creditoId: string, @Body() body: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(creditoId)) throw new NotFoundException('Registro nao encontrado.');
    const acao = String(body?.acao || '');
    const motivo = String(body?.motivo || '').trim();
    const adquirenteId = body?.adquirenteId ? String(body.adquirenteId) : null;
    if (!['VINCULAR', 'DESVINCULAR', 'RETIFICAR'].includes(acao)) throw new BadRequestException('Acao invalida (VINCULAR, DESVINCULAR ou RETIFICAR).');
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    if (acao === 'VINCULAR' && (!adquirenteId || !UUID_RE.test(adquirenteId))) throw new BadRequestException('Informe o Adquirente.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const credito = await tx.projCredito.findFirst({ where: { id: creditoId, operacaoId, canceladoEm: null }, select: { id: true, numeroOrdem: true } });
      if (!credito) throw new NotFoundException('Credito nao encontrado nesta operacao.');
      if (acao === 'VINCULAR') {
        const adq = await tx.projParticipacao.findFirst({
          where: { operacaoId, contraparteId: adquirenteId, canceladoEm: null, papel: { codigo: 'ADQUIRENTE' } },
          select: { id: true },
        });
        if (!adq) throw new BadRequestException('O titular precisa ser Adquirente desta operacao.');
      }
      const atual = await tx.projCreditoVinculo.findFirst({ where: { creditoId, canceladoEm: null }, select: { id: true, situacao: true, adquirenteId: true } });
      if (acao === 'RETIFICAR') {
        // Fase 1.8: retifica so o motivo - encerra o vigente e recria com a mesma situacao e o mesmo titular
        if (!atual) throw new BadRequestException('Nao ha vinculo vigente para retificar.');
        await tx.projCreditoVinculo.update({ where: { id: atual.id }, data: { canceladoEm: new Date(), canceladoPorId: req.user.id, motivoCancelamento: 'Retificacao do motivo: ' + motivo } });
        const ret = await tx.projCreditoVinculo.create({ data: { creditoId, situacao: atual.situacao, adquirenteId: atual.adquirenteId, motivo, criadoPorId: req.user.id } });
        await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_CREDITO_VINCULO_ALTERADO', targetId: creditoId, after: { numeroOrdem: credito.numeroOrdem, motivo, retificacao: true, situacao: atual.situacao, adquirenteId: atual.adquirenteId } } });
        return ret;
      }
      if (atual && acao === 'VINCULAR' && atual.situacao === 'VINCULADO' && atual.adquirenteId === adquirenteId) throw new BadRequestException('O credito ja esta vinculado a este Adquirente.');
      if (atual && acao === 'DESVINCULAR' && atual.situacao === 'DESVINCULADO') throw new BadRequestException('O credito ja esta desvinculado.');
      if (atual) {
        await tx.projCreditoVinculo.update({ where: { id: atual.id }, data: { canceladoEm: new Date(), canceladoPorId: req.user.id, motivoCancelamento: motivo } });
      }
      const novo = await tx.projCreditoVinculo.create({
        data: { creditoId, situacao: acao === 'VINCULAR' ? 'VINCULADO' : 'DESVINCULADO', adquirenteId: acao === 'VINCULAR' ? adquirenteId : null, motivo, criadoPorId: req.user.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.user.id, action: 'PROJ_CREDITO_VINCULO_ALTERADO', targetId: creditoId,
          after: {
            numeroOrdem: credito.numeroOrdem, motivo,
            antes: atual ? { situacao: atual.situacao, adquirenteId: atual.adquirenteId } : null,
            depois: { situacao: novo.situacao, adquirenteId: novo.adquirenteId },
          },
        },
      });
      return novo;
    });
  }

  @Get('operacoes/:operacaoId/resumo')
  @ProjAcao('ver')
  async resumo(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const r = await this.db.comoUsuario(req.user.id, async (tx) => {
      const op = await tx.projOperacao.findFirst({
        where: { id: operacaoId, canceladoEm: null },
        select: { codigo: true, nome: true, dataBase: true, valorControle: true },
      });
      if (!op) return null;
      const base = { operacaoId, canceladoEm: null };
      const geral = await tx.projCredito.aggregate({ where: base, _count: { _all: true }, _sum: { valor: true } });
      const ateBase = op.dataBase
        ? await tx.projCredito.aggregate({ where: { ...base, dataCredito: { lte: op.dataBase } }, _count: { _all: true }, _sum: { valor: true } })
        : null;
      const pendentes = await tx.projCredito.count({ where: { ...base, identificacaoPendente: true } });
      const vinc = await tx.projCreditoVinculo.findMany({
        where: { canceladoEm: null, credito: { operacaoId, canceladoEm: null } },
        select: { situacao: true, adquirente: { select: { id: true, nome: true } }, credito: { select: { valor: true } } },
      });
      const provas = await tx.projCreditoProva.count({ where: { canceladoEm: null, credito: { operacaoId, canceladoEm: null } } });
      const semVinc = await tx.projCredito.aggregate({ where: { ...base, vinculos: { none: { canceladoEm: null } } }, _sum: { valor: true } });
      return { op, geral, ateBase, pendentes, vinc, provas, semVinc };
    });
    if (!r) throw new NotFoundException('Registro nao encontrado.');
    const zero = new Prisma.Decimal(0);
    const totalGeral = r.geral._sum.valor ?? zero;
    const totalBase = r.ateBase?._sum.valor ?? zero;
    const controle = r.op.valorControle;
    const contas = new Map<string, { adquirenteId: string; nome: string; quantidade: number; total: Prisma.Decimal }>();
    let desvQtd = 0;
    let desvTotal = new Prisma.Decimal(0);
    for (const v of r.vinc) {
      if (v.situacao === 'VINCULADO' && v.adquirente) {
        const c = contas.get(v.adquirente.id) || { adquirenteId: v.adquirente.id, nome: v.adquirente.nome, quantidade: 0, total: new Prisma.Decimal(0) };
        c.quantidade += 1;
        c.total = c.total.plus(v.credito.valor);
        contas.set(v.adquirente.id, c);
      } else {
        desvQtd += 1;
        desvTotal = desvTotal.plus(v.credito.valor);
      }
    }
    return {
      operacao: { codigo: r.op.codigo, nome: r.op.nome, dataBase: r.op.dataBase },
      quantidadeCreditos: r.geral._count._all,
      totalGeral: totalGeral.toFixed(2),
      quantidadeAteDataBase: r.ateBase?._count._all ?? 0,
      totalAteDataBase: totalBase.toFixed(2),
      valorControle: controle ? controle.toFixed(2) : null,
      diferencaControle: controle ? totalBase.minus(controle).toFixed(2) : null,
      conferido: controle ? totalBase.equals(controle) : null,
      pendentesIdentificacao: r.pendentes,
      contasIndividuais: [...contas.values()].map((c) => ({ adquirenteId: c.adquirenteId, nome: c.nome, quantidade: c.quantidade, total: c.total.toFixed(2) })),
      desvinculados: { quantidade: desvQtd, total: desvTotal.toFixed(2) },
      semVinculo: r.geral._count._all - r.vinc.length,
      semVinculoTotal: (r.semVinc._sum.valor ?? zero).toFixed(2),
      comProvaBancaria: r.provas,
      semProvaBancaria: r.geral._count._all - r.provas,
    };
  }

  // -- Pendencias do projeto (Fase 1.8 revista, 03/10/2026) ---------------------------------
  // SO assuntos do projeto: creditos aguardando decisao de vinculo e remetentes nao identificados.
  // O extrato completo NUNCA aparece no espaco do projeto: a triagem e do Financeiro, no LEDGR (projects-financeiro).
  @Get('operacoes/:operacaoId/pendencias')
  @ProjAcao('ver')
  pendencias(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const base = { operacaoId, canceladoEm: null };
      const sel = {
        id: true, numeroOrdem: true, dataCredito: true, valor: true, origem: true, remetenteNomeExtrato: true,
        referenciaBancaria: true, identificacaoPendente: true, remetente: { select: { id: true, nome: true, tipoPessoa: true } },
      };
      const aguardandoVinculo = await tx.projCredito.findMany({ where: { ...base, vinculos: { none: { canceladoEm: null } } }, orderBy: { numeroOrdem: 'asc' }, select: sel });
      const remetentesNaoIdentificados = await tx.projCredito.findMany({ where: { ...base, identificacaoPendente: true }, orderBy: { numeroOrdem: 'asc' }, select: sel });
      return { aguardandoVinculo, remetentesNaoIdentificados };
    });
  }

  @Get('perfis')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  perfis(@Req() req: any) {
    return this.db.comoUsuario(req.user.id, (tx) =>
      tx.projPerfil.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: { codigo: true, nome: true, descricao: true, acoes: true, nivelPadrao: true },
      }),
    );
  }

  @Get(':projetoId/concessoes')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  listarConcessoes(@Param('projetoId') projetoId: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.concessoes.listar(req.user.id, projetoId);
  }

  @Get(':projetoId')
  @ProjAcao('ver')
  async detalhe(@Param('projetoId') projetoId: string, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const p = await this.db.comoUsuario(req.user.id, (tx) =>
      tx.projProjeto.findFirst({
        where: { id: projetoId, canceladoEm: null },
        select: {
          id: true, codigo: true, nome: true, descricao: true, status: true,
          operacoes: {
            where: { canceladoEm: null },
            select: { id: true, codigo: true, nome: true, tipo: true, status: true, dataBase: true, valorControle: true },
            orderBy: { criadoEm: 'asc' },
          },
        },
      }),
    );
    if (!p) throw new NotFoundException('Registro nao encontrado.');
    const permitidas: Set<string> | null | undefined = req.projConcessao?.operacoesPermitidas;
    if (permitidas) p.operacoes = p.operacoes.filter((o) => permitidas.has(o.id));
    return p;
  }
}
