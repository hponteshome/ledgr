// apps/api/src/modules/projects/concessoes.service.ts
// Fase 1.2a (03/10/2026): concessoes de acesso ao dominio Projetos.
//  Concessao = usuario x escopo (projeto inteiro ou uma operacao) x perfil (acoes) x nivel de visibilidade.
//  Validade opcional (valido_de / valido_ate); revogacao por cancelamento com motivo; AuditLog em tudo.
//  A concessao NAO cria vinculo UserCompany: EMPRESA_COMPLETA so vale com o vinculo concedido a parte.
// Fase 1.2b (03/10/2026): todas as consultas via ProjDbService.comoUsuario (RLS no banco).
import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjDbService } from './proj-db.service';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NIVEIS = ['OPERACAO', 'EMPRESA_PROJETO', 'EMPRESA_COMPLETA'];

export interface ResolucaoEscopo {
  temEscopo: boolean;
  acoes: Set<string>;
  niveis: Set<string>;
  operacoesPermitidas: Set<string> | null; // null = projeto inteiro
}

@Injectable()
export class ConcessoesService {
  constructor(private readonly db: ProjDbService) {}

  private ativas(tx: Prisma.TransactionClient, userId: string) {
    const agora = new Date();
    return tx.projConcessao.findMany({
      where: { userId, canceladoEm: null, validoDe: { lte: agora }, OR: [{ validoAte: null }, { validoAte: { gt: agora } }] },
      select: { projetoId: true, operacaoId: true, nivel: true, perfil: { select: { acoes: true, ativo: true } } },
    });
  }

  projetosVisiveis(userId: string): Promise<string[]> {
    return this.db.comoUsuario(userId, async (tx) => {
      const lista = await this.ativas(tx, userId);
      return [...new Set(lista.filter((c) => c.perfil.ativo).map((c) => c.projetoId))];
    });
  }

  async resolver(userId: string | undefined, alvo: { projetoId?: string; operacaoId?: string }): Promise<ResolucaoEscopo> {
    const vazio: ResolucaoEscopo = { temEscopo: false, acoes: new Set(), niveis: new Set(), operacoesPermitidas: new Set() };
    if (!userId || !UUID_RE.test(userId)) return vazio;
    return this.db.comoUsuario(userId, async (tx) => {
      let projetoId = alvo.projetoId;
      const operacaoId = alvo.operacaoId;
      if (operacaoId) {
        if (!UUID_RE.test(operacaoId)) return vazio;
        const op = await tx.projOperacao.findFirst({ where: { id: operacaoId, canceladoEm: null }, select: { projetoId: true } });
        if (!op) return vazio;
        projetoId = op.projetoId;
      }
      if (!projetoId || !UUID_RE.test(projetoId)) return vazio;
      const lista = (await this.ativas(tx, userId)).filter(
        (c) => c.perfil.ativo && c.projetoId === projetoId && (!operacaoId || c.operacaoId === null || c.operacaoId === operacaoId),
      );
      if (!lista.length) return vazio;
      const acoes = new Set<string>();
      const niveis = new Set<string>();
      const ops = new Set<string>();
      let todas = false;
      for (const c of lista) {
        c.perfil.acoes.forEach((a) => acoes.add(a));
        niveis.add(c.nivel);
        if (c.operacaoId === null) todas = true;
        else ops.add(c.operacaoId);
      }
      return { temEscopo: true, acoes, niveis, operacoesPermitidas: todas ? null : ops };
    });
  }

  listar(adminId: string, projetoId: string) {
    return this.db.comoUsuario(adminId, async (tx) => {
      const lista = await tx.projConcessao.findMany({
        where: { projetoId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true, userId: true, operacaoId: true, nivel: true, validoDe: true, validoAte: true, observacao: true,
          criadoEm: true, canceladoEm: true, motivoCancelamento: true,
          perfil: { select: { codigo: true, nome: true } }, operacao: { select: { codigo: true, nome: true } },
        },
      });
      const usuarios = await tx.user.findMany({
        where: { id: { in: [...new Set(lista.map((c) => c.userId))] } },
        select: { id: true, email: true, fullName: true },
      });
      const mapa = new Map(usuarios.map((u) => [u.id, u]));
      return lista.map((c) => ({ ...c, usuario: mapa.get(c.userId) ?? null }));
    });
  }

  async conceder(adminId: string, dto: any) {
    const { userId, projetoId, operacaoId, perfilCodigo, nivel, validoAte, observacao } = dto || {};
    if (!UUID_RE.test(userId || '') || !UUID_RE.test(projetoId || '')) throw new BadRequestException('Informe userId e projetoId validos.');
    if (operacaoId && !UUID_RE.test(operacaoId)) throw new BadRequestException('operacaoId invalido.');
    const ate = validoAte ? new Date(validoAte) : null;
    if (ate && isNaN(ate.getTime())) throw new BadRequestException('Data de validade invalida.');
    try {
      return await this.db.comoUsuario(adminId, async (tx) => {
        const projeto = await tx.projProjeto.findFirst({ where: { id: projetoId, canceladoEm: null }, select: { id: true } });
        if (!projeto) throw new NotFoundException('Projeto nao encontrado.');
        if (operacaoId) {
          const op = await tx.projOperacao.findFirst({ where: { id: operacaoId, projetoId, canceladoEm: null }, select: { id: true } });
          if (!op) throw new NotFoundException('Operacao nao encontrada neste projeto.');
        }
        const perfil = await tx.projPerfil.findFirst({ where: { codigo: String(perfilCodigo || ''), ativo: true } });
        if (!perfil) throw new BadRequestException('Perfil de projeto invalido.');
        const nivelFinal = nivel || perfil.nivelPadrao;
        if (!NIVEIS.includes(nivelFinal)) throw new BadRequestException('Nivel de visibilidade invalido.');
        const usuario = await tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } });
        if (!usuario) throw new NotFoundException('Usuario nao encontrado.');
        const c = await tx.projConcessao.create({
          data: { userId, projetoId, operacaoId: operacaoId || null, perfilId: perfil.id, nivel: nivelFinal, validoAte: ate, observacao: observacao || null, criadoPorId: adminId },
        });
        await tx.auditLog.create({
          data: {
            actorId: adminId, action: 'PROJ_CONCESSAO_CRIADA', targetId: c.id,
            after: { userId, projetoId, operacaoId: operacaoId || null, perfil: perfil.codigo, nivel: nivelFinal, validoAte: ate ? ate.toISOString() : null },
          },
        });
        return c;
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Ja existe concessao ativa deste usuario para este escopo. Revogue a atual antes.');
      throw e;
    }
  }

  revogar(adminId: string, concessaoId: string, motivo: string) {
    if (!UUID_RE.test(concessaoId || '')) throw new NotFoundException('Concessao nao encontrada.');
    const m = String(motivo || '').trim();
    if (m.length < 5) throw new BadRequestException('Informe o motivo da revogacao (minimo 5 caracteres).');
    return this.db.comoUsuario(adminId, async (tx) => {
      const c = await tx.projConcessao.findFirst({ where: { id: concessaoId, canceladoEm: null }, select: { id: true } });
      if (!c) throw new NotFoundException('Concessao ativa nao encontrada.');
      const r = await tx.projConcessao.update({
        where: { id: concessaoId },
        data: { canceladoEm: new Date(), canceladoPorId: adminId, motivoCancelamento: m, atualizadoPorId: adminId },
      });
      await tx.auditLog.create({ data: { actorId: adminId, action: 'PROJ_CONCESSAO_REVOGADA', targetId: concessaoId, after: { motivo: m } } });
      return r;
    });
  }
}
