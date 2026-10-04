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
}
