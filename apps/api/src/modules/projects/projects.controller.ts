// apps/api/src/modules/projects/projects.controller.ts
// Fase 1.2a (03/10/2026): primeiras rotas do dominio Projetos (Recife Ocean).
// Autorizacao por concessao (ProjEscopoGuard), nao pela empresa ativa (@SkipCompanyCheck na classe).
// Administracao de concessoes: so Master (bussola 5.3).
// Fase 1.2b (03/10/2026): consultas via ProjDbService.comoUsuario - o banco aplica o RLS das tabelas proj_*
// como segunda barreira (defesa em profundidade sobre o guard).
import { Controller, Get, Post, Param, Body, Req, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';
import { SkipCompanyCheck, isMasterAdmin } from '../../multi-company/company.interceptor';
import { ProjEscopoGuard, ProjAcao } from './proj-escopo.guard';
import { ConcessoesService, UUID_RE } from './concessoes.service';
import { ProjDbService } from './proj-db.service';

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
