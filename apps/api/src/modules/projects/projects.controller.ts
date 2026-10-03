// apps/api/src/modules/projects/projects.controller.ts
// Fase 1.2a (03/10/2026): primeiras rotas do dominio Projetos (Recife Ocean).
// Autorizacao por concessao (ProjEscopoGuard), nao pela empresa ativa (@SkipCompanyCheck na classe).
// Administracao de concessoes: so Master (bussola 5.3).
// Fase 1.2b (03/10/2026): consultas via ProjDbService.comoUsuario - o banco aplica o RLS das tabelas proj_*
// como segunda barreira (defesa em profundidade sobre o guard).
import { Controller, Get, Post, Param, Body, Req, UseGuards, NotFoundException } from '@nestjs/common';
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
    return this.db.comoUsuario(req.user.id, (tx) =>
      tx.projParticipacao.findMany({
        where: { operacaoId, canceladoEm: null },
        orderBy: { criadoEm: 'asc' },
        select: {
          id: true, companyId: true, observacao: true, vigenciaInicio: true, vigenciaFim: true,
          papel: { select: { codigo: true, nome: true } },
          contraparte: { select: { id: true, nome: true, tipoPessoa: true } },
        },
      }),
    );
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
        },
      }),
    );
    return lista.map((c) => ({
      ...c,
      remetente: c.remetente
        ? { id: c.remetente.id, nome: c.remetente.nome, tipoPessoa: c.remetente.tipoPessoa, documentoMascarado: mascararDocumento(c.remetente.documento) }
        : null,
    }));
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
      return { op, geral, ateBase, pendentes };
    });
    if (!r) throw new NotFoundException('Registro nao encontrado.');
    const zero = new Prisma.Decimal(0);
    const totalGeral = r.geral._sum.valor ?? zero;
    const totalBase = r.ateBase?._sum.valor ?? zero;
    const controle = r.op.valorControle;
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
    };
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
