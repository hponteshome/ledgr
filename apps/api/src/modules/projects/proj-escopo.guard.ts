// apps/api/src/modules/projects/proj-escopo.guard.ts
// Fase 1.2a (03/10/2026): autorizacao do dominio Projetos por concessao.
//  - rotas do dominio NAO dependem da empresa ativa (x-company-id); dependem da concessao
//  - escopo resolvido pelos parametros :projetoId ou :operacaoId da rota
//  - sem concessao ativa para o escopo: 404 (nao confirma existencia); com concessao sem a acao: 403
//  - FALHA FECHADA: rota sem @ProjAcao e recusada (exceto Master)
//  - 'autenticado': so exige login (a rota filtra pelos projetos visiveis)
import { Injectable, CanActivate, ExecutionContext, NotFoundException, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isMasterAdmin } from '../../multi-company/company.interceptor';
import { ConcessoesService } from './concessoes.service';

export type ProjAcaoTipo = 'autenticado' | 'ver' | 'criar' | 'editar' | 'conciliar' | 'aprovar' | 'exportar' | 'administrar';
export const PROJ_ACAO_KEY = 'projAcao';
export const ProjAcao = (acao: ProjAcaoTipo) => SetMetadata(PROJ_ACAO_KEY, acao);

@Injectable()
export class ProjEscopoGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly concessoes: ConcessoesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const acao = this.reflector.getAllAndOverride<ProjAcaoTipo>(PROJ_ACAO_KEY, [context.getHandler(), context.getClass()]);
    if (isMasterAdmin(req.user)) return true;
    if (!acao) throw new ForbiddenException('Rota do dominio Projetos sem acao declarada.');
    if (acao === 'autenticado') return !!req.user?.id;
    const { projetoId, operacaoId } = req.params || {};
    const r = await this.concessoes.resolver(req.user?.id, { projetoId, operacaoId });
    if (!r.temEscopo) throw new NotFoundException('Registro nao encontrado.');
    if (!r.acoes.has(acao)) throw new ForbiddenException('Seu perfil neste projeto nao permite esta acao.');
    req.projConcessao = r;
    return true;
  }
}
