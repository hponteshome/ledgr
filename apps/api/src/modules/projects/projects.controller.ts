// apps/api/src/modules/projects/projects.controller.ts
// Fase 1.2a (03/10/2026): primeiras rotas do dominio Projetos (Recife Ocean).
// Autorizacao por concessao (ProjEscopoGuard), nao pela empresa ativa (@SkipCompanyCheck na classe).
// Administracao de concessoes: so Master (bussola 5.3).
// Fase 1.2b (03/10/2026): consultas via ProjDbService.comoUsuario - o banco aplica o RLS das tabelas proj_*
// como segunda barreira (defesa em profundidade sobre o guard).
// Fase 1.6 / D8 / 1.6b (03/10/2026): creditos, resumo, participacoes com nome da empresa e vinculo do credito
// a Conta Individual (alterar ou desvincular: so Master, com motivo; historico imutavel no banco).
import { Controller, Get, Post, Param, Body, Req, Res, UseGuards, UseInterceptors, UploadedFile, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
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
      const devs = await tx.projAplicacao.aggregate({ where: { operacaoId, canceladoEm: null, natureza: { tipo: 'DEVOLUCAO' } }, _count: { _all: true }, _sum: { valor: true } });
      const apls = await tx.projAplicacao.aggregate({ where: { operacaoId, canceladoEm: null, natureza: { tipo: 'APLICACAO' } }, _count: { _all: true }, _sum: { valor: true } });
      const informado = await tx.projSaldoInformado.findFirst({ where: { operacaoId, canceladoEm: null, tipo: 'CONTA_INDIVIDUAL' }, orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }], select: { dataReferencia: true, valor: true, fonte: true } });
      return { op, geral, ateBase, pendentes, vinc, provas, semVinc, devs, apls, informado };
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
      // Fase 1.11 parte B: Conta Individual liquida (devolucoes ao Adquirente reduzem o saldo contratual)
      aplicacoes: { quantidade: r.apls._count._all, total: (r.apls._sum.valor ?? zero).toFixed(2) },
      devolucoesAdquirente: { quantidade: r.devs._count._all, total: (r.devs._sum.valor ?? zero).toFixed(2) },
      saldoContratual: [...contas.values()].reduce((s, c) => s.plus(c.total), new Prisma.Decimal(0)).minus(r.devs._sum.valor ?? zero).toFixed(2),
      saldoInformado: r.informado ? { data: r.informado.dataReferencia, valor: r.informado.valor.toFixed(2), fonte: r.informado.fonte } : null,
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

  // -- Documentos do projeto (Fase 1.10, 04/10/2026) ----------------------------------------------
  // Arquivos FORA de pasta publica (PROJ_STORAGE_DIR), enderecados pelo SHA-256 do conteudo; download so autenticado,
  // com conferencia de integridade e registro no AuditLog. Registros imutaveis: nova versao ou cancelamento com motivo.
  private dirArquivos(): string {
    return process.env.PROJ_STORAGE_DIR || path.join(process.cwd(), 'storage', 'projetos');
  }

  @Get('documento-tipos')
  @ProjAcao('autenticado')
  documentoTipos(@Req() req: any) {
    return this.db.comoUsuario(req.user.id, (tx) =>
      tx.projDocumentoTipo.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { codigo: true, nome: true } }),
    );
  }

  @Get('operacoes/:operacaoId/documentos')
  @ProjAcao('ver')
  documentos(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const docs = await tx.projDocumento.findMany({
        where: { operacaoId },
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true, titulo: true, descricao: true, dataDocumento: true, creditoId: true, contraparteId: true, arquivoNome: true,
          mime: true, tamanho: true, sha256: true, versao: true, documentoOrigemId: true, criadoEm: true, canceladoEm: true,
          motivoCancelamento: true, tipo: { select: { codigo: true, nome: true } },
        },
      });
      const credIds = [...new Set(docs.map((d) => d.creditoId).filter((x): x is string => !!x))];
      const ctIds = [...new Set(docs.map((d) => d.contraparteId).filter((x): x is string => !!x))];
      const creds = credIds.length ? await tx.projCredito.findMany({ where: { id: { in: credIds } }, select: { id: true, numeroOrdem: true } }) : [];
      const cts = ctIds.length ? await tx.projContraparte.findMany({ where: { id: { in: ctIds } }, select: { id: true, nome: true } }) : [];
      const mc = new Map(creds.map((c) => [c.id, c.numeroOrdem]));
      const mt = new Map(cts.map((c) => [c.id, c.nome]));
      return docs.map((d) => ({
        ...d,
        creditoNumero: d.creditoId ? mc.get(d.creditoId) ?? null : null,
        contraparteNome: d.contraparteId ? mt.get(d.contraparteId) ?? null : null,
      }));
    });
  }

  @Post('operacoes/:operacaoId/documentos')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  async enviarDocumento(@Param('operacaoId') operacaoId: string, @UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    if (!file || !file.buffer?.length) throw new BadRequestException('Arquivo nao enviado.');
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
      throw new BadRequestException('Formato nao aceito. Use PDF, imagem (PNG, JPG, WEBP), Word ou Excel.');
    }
    const titulo = String(body?.titulo || '').trim();
    if (titulo.length < 3) throw new BadRequestException('Informe o titulo do documento.');
    const tipoCodigo = String(body?.tipoCodigo || '');
    const creditoId = body?.creditoId ? String(body.creditoId) : null;
    const contraparteId = body?.contraparteId ? String(body.contraparteId) : null;
    const substituiId = body?.substituiDocumentoId ? String(body.substituiDocumentoId) : null;
    for (const id of [creditoId, contraparteId, substituiId]) if (id && !UUID_RE.test(id)) throw new BadRequestException('Identificador invalido.');
    if (creditoId && contraparteId) throw new BadRequestException('Vincule o documento a um credito OU a uma contraparte.');
    const motivoVersao = String(body?.motivoVersao || '').trim();
    if (substituiId && motivoVersao.length < 10) throw new BadRequestException('Informe o motivo da nova versao (minimo 10 caracteres).');
    const dataDoc = body?.dataDocumento ? new Date(String(body.dataDocumento) + 'T00:00:00') : null;
    if (dataDoc && isNaN(dataDoc.getTime())) throw new BadRequestException('Data do documento invalida.');
    const sha = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const chave = operacaoId + '/' + sha;
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const op = await tx.projOperacao.findFirst({ where: { id: operacaoId, canceladoEm: null }, select: { id: true } });
      if (!op) throw new NotFoundException('Operacao nao encontrada.');
      const tipo = await tx.projDocumentoTipo.findFirst({ where: { codigo: tipoCodigo, ativo: true }, select: { id: true } });
      if (!tipo) throw new BadRequestException('Tipo de documento invalido.');
      if (creditoId && !(await tx.projCredito.findFirst({ where: { id: creditoId, operacaoId, canceladoEm: null }, select: { id: true } }))) {
        throw new BadRequestException('Credito nao encontrado nesta operacao.');
      }
      if (contraparteId && !(await tx.projParticipacao.findFirst({ where: { operacaoId, contraparteId, canceladoEm: null }, select: { id: true } }))) {
        throw new BadRequestException('Contraparte nao participa desta operacao.');
      }
      let versao = 1;
      let origemId: string | null = null;
      if (substituiId) {
        const ant = await tx.projDocumento.findFirst({ where: { id: substituiId, operacaoId, canceladoEm: null }, select: { id: true, versao: true, documentoOrigemId: true } });
        if (!ant) throw new BadRequestException('Documento a substituir nao encontrado (ou ja cancelado).');
        versao = ant.versao + 1;
        origemId = ant.documentoOrigemId ?? ant.id;
        await tx.projDocumento.update({ where: { id: ant.id }, data: { canceladoEm: new Date(), canceladoPorId: req.user.id, motivoCancelamento: `Substituido pela versao ${versao}: ${motivoVersao}` } });
      }
      // grava o arquivo pelo hash (escrita atomica; o mesmo conteudo nunca e regravado nem sobrescrito)
      const destino = path.join(this.dirArquivos(), operacaoId, sha);
      if (!fs.existsSync(destino)) {
        fs.mkdirSync(path.dirname(destino), { recursive: true });
        const tmp = destino + '.tmp-' + process.pid + '-' + Date.now();
        fs.writeFileSync(tmp, file.buffer);
        fs.renameSync(tmp, destino);
      }
      const doc = await tx.projDocumento.create({
        data: {
          operacaoId, tipoId: tipo.id, titulo, descricao: body?.descricao ? String(body.descricao).trim() || null : null, dataDocumento: dataDoc,
          creditoId, contraparteId, arquivoNome: file.originalname.slice(0, 250), mime: (file.mimetype || '').slice(0, 120), tamanho: file.size,
          sha256: sha, chaveArmazenamento: chave, versao, documentoOrigemId: origemId, criadoPorId: req.user.id,
        },
      });
      await tx.auditLog.create({
        data: { actorId: req.user.id, action: 'PROJ_DOCUMENTO_ENVIADO', targetId: doc.id, after: { operacaoId, titulo, tipo: tipoCodigo, sha256: sha, tamanho: file.size, versao, creditoId, contraparteId } },
      });
      return { id: doc.id, versao, sha256: sha };
    });
  }

  @Get('operacoes/:operacaoId/documentos/:documentoId/arquivo')
  @ProjAcao('ver')
  async baixarDocumento(@Param('operacaoId') operacaoId: string, @Param('documentoId') documentoId: string, @Req() req: any, @Res() res: Response) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(documentoId)) throw new NotFoundException('Registro nao encontrado.');
    const d = await this.db.comoUsuario(req.user.id, async (tx) => {
      const doc = await tx.projDocumento.findFirst({ where: { id: documentoId, operacaoId }, select: { id: true, titulo: true, arquivoNome: true, mime: true, sha256: true, chaveArmazenamento: true } });
      if (!doc) return null;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_DOCUMENTO_BAIXADO', targetId: doc.id, after: { operacaoId, titulo: doc.titulo } } });
      return doc;
    });
    if (!d) throw new NotFoundException('Registro nao encontrado.');
    const caminho = path.join(this.dirArquivos(), ...d.chaveArmazenamento.split('/'));
    if (!fs.existsSync(caminho)) throw new NotFoundException('Arquivo nao encontrado no armazenamento.');
    const buf = fs.readFileSync(caminho);
    if (crypto.createHash('sha256').update(buf).digest('hex') !== d.sha256) {
      throw new ConflictException('Integridade violada: o arquivo armazenado difere do registrado.');
    }
    res.setHeader('Content-Type', d.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(d.arquivoNome)}`);
    res.setHeader('X-Documento-Sha256', d.sha256);
    res.send(buf);
  }

  @Post('operacoes/:operacaoId/documentos/:documentoId/cancelar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  cancelarDocumento(@Param('operacaoId') operacaoId: string, @Param('documentoId') documentoId: string, @Body() body: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(documentoId)) throw new NotFoundException('Registro nao encontrado.');
    const motivo = String(body?.motivo || '').trim();
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const doc = await tx.projDocumento.findFirst({ where: { id: documentoId, operacaoId, canceladoEm: null }, select: { id: true, titulo: true } });
      if (!doc) throw new NotFoundException('Documento vigente nao encontrado.');
      const r = await tx.projDocumento.update({ where: { id: doc.id }, data: { canceladoEm: new Date(), canceladoPorId: req.user.id, motivoCancelamento: motivo } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_DOCUMENTO_CANCELADO', targetId: doc.id, after: { operacaoId, titulo: doc.titulo, motivo } } });
      return { id: r.id };
    });
  }

  // -- Aplicacoes de recursos (Fase 1.11 parte A, 04/10/2026) -----------------------------------------------
  // So o que o Financeiro classificou no LEDGR como da operacao (aplicacoes e devolucoes), com a prova no extrato.
  @Get('operacoes/:operacaoId/aplicacoes')
  @ProjAcao('ver')
  aplicacoes(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const lista = await tx.projAplicacao.findMany({
        where: { operacaoId, canceladoEm: null },
        orderBy: { dataAplicacao: 'asc' },
        select: { id: true, dataAplicacao: true, valor: true, descricao: true, motivo: true, bankTransactionId: true, beneficiarioId: true, creditoId: true, natureza: { select: { codigo: true, nome: true, tipo: true } } },
      });
      const ben = [...new Set(lista.map((a) => a.beneficiarioId).filter((x): x is string => !!x))];
      const cre = [...new Set(lista.map((a) => a.creditoId).filter((x): x is string => !!x))];
      const txs = [...new Set(lista.map((a) => a.bankTransactionId))];
      const mb = new Map((ben.length ? await tx.projContraparte.findMany({ where: { id: { in: ben } }, select: { id: true, nome: true } }) : []).map((c) => [c.id, c.nome]));
      const mc = new Map((cre.length ? await tx.projCredito.findMany({ where: { id: { in: cre } }, select: { id: true, numeroOrdem: true } }) : []).map((c) => [c.id, c.numeroOrdem]));
      const mt = new Map((txs.length ? await tx.bankTransaction.findMany({ where: { id: { in: txs } }, select: { id: true, description: true } }) : []).map((t) => [t.id, t.description]));
      return lista.map(({ bankTransactionId, beneficiarioId, creditoId, ...a }) => ({
        ...a, lancamento: mt.get(bankTransactionId) || null,
        beneficiario: beneficiarioId ? mb.get(beneficiarioId) ?? null : null,
        creditoNumero: creditoId ? mc.get(creditoId) ?? null : null,
      }));
    });
  }

  @Post('operacoes/:operacaoId/aplicacoes/:aplicacaoId/encerrar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  encerrarAplicacao(@Param('operacaoId') operacaoId: string, @Param('aplicacaoId') aplicacaoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(aplicacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const motivo = String(b?.motivo || '').trim();
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const ap = await tx.projAplicacao.findFirst({ where: { id: aplicacaoId, operacaoId, canceladoEm: null }, select: { id: true, valor: true, natureza: { select: { codigo: true } } } });
      if (!ap) throw new NotFoundException('Aplicacao vigente nao encontrada.');
      await tx.projAplicacao.update({ where: { id: ap.id }, data: { canceladoEm: new Date(), canceladoPorId: req.user.id, motivoCancelamento: motivo } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_APLICACAO_ENCERRADA', targetId: ap.id, after: { operacaoId, natureza: ap.natureza.codigo, valor: ap.valor.toFixed(2), motivo } } });
      return { id: ap.id };
    });
  }

  // -- Saldos informados e Intercompany (Fase 1.11 parte B, 04/10/2026) -------------------------------------
  // Saldos informados = referencia externa (contabilidade, auditoria) so para conferencia; nunca entram no calculo.
  @Get('operacoes/:operacaoId/saldos-informados')
  @ProjAcao('ver')
  saldosInformados(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, (tx) =>
      tx.projSaldoInformado.findMany({
        where: { operacaoId, canceladoEm: null },
        orderBy: [{ dataReferencia: 'desc' }, { criadoEm: 'desc' }],
        select: { id: true, tipo: true, dataReferencia: true, valor: true, contaContabil: true, fonte: true, criadoEm: true },
      }),
    );
  }

  @Post('operacoes/:operacaoId/saldos-informados')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  registrarSaldoInformado(@Param('operacaoId') operacaoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const tipo = String(b?.tipo || '');
    if (!['CONTA_INDIVIDUAL', 'INTERCOMPANY_RECEBEDORA', 'INTERCOMPANY_BENEFICIARIA', 'PASSIVOS_EMPREENDIMENTO'].includes(tipo)) throw new BadRequestException('Tipo de saldo invalido.');
    const data = b?.dataReferencia ? new Date(String(b.dataReferencia).slice(0, 10) + 'T00:00:00Z') : null;
    if (!data || isNaN(data.getTime())) throw new BadRequestException('Informe a data de referencia.');
    let bruto = String(b?.valor ?? '').trim().replace(/\s|R\$/g, '');
    if (bruto.includes(',')) bruto = bruto.replace(/\./g, '').replace(',', '.');
    const valor = new Prisma.Decimal(bruto || 'NaN');
    if (valor.isNaN()) throw new BadRequestException('Valor invalido.');
    const fonte = String(b?.fonte || '').trim();
    if (fonte.length < 10) throw new BadRequestException('Informe a fonte (minimo 10 caracteres). Ex.: balancete de 12/2025 da contabilidade.');
    const contaContabil = b?.contaContabil ? String(b.contaContabil).trim().slice(0, 40) || null : null;
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const op = await tx.projOperacao.findFirst({ where: { id: operacaoId, canceladoEm: null }, select: { id: true } });
      if (!op) throw new NotFoundException('Operacao nao encontrada.');
      const s = await tx.projSaldoInformado.create({ data: { operacaoId, tipo, dataReferencia: data, valor, contaContabil, fonte, criadoPorId: req.user.id }, select: { id: true } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_SALDO_INFORMADO_REGISTRADO', targetId: s.id, after: { operacaoId, tipo, data: data.toISOString().slice(0, 10), valor: valor.toFixed(2), contaContabil, fonte } } });
      return s;
    });
  }

  @Post('operacoes/:operacaoId/saldos-informados/:saldoId/encerrar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  encerrarSaldoInformado(@Param('operacaoId') operacaoId: string, @Param('saldoId') saldoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(saldoId)) throw new NotFoundException('Registro nao encontrado.');
    const motivo = String(b?.motivo || '').trim();
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres).');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const s = await tx.projSaldoInformado.findFirst({ where: { id: saldoId, operacaoId, canceladoEm: null }, select: { id: true } });
      if (!s) throw new NotFoundException('Saldo informado vigente nao encontrado.');
      await tx.projSaldoInformado.update({ where: { id: s.id }, data: { canceladoEm: new Date(), canceladoPorId: req.user.id, motivoCancelamento: motivo } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_SALDO_INFORMADO_ENCERRADO', targetId: s.id, after: { operacaoId, motivo } } });
      return { id: s.id };
    });
  }

  // Intercompany: recebedora deve a beneficiaria = creditos VINCULADOS - aplicacoes por conta - devolucoes ao Adquirente.
  // Mes a mes, com o saldo acumulado e os saldos informados das contas espelho (ultimo de cada mes).
  @Get('operacoes/:operacaoId/intercompany')
  @ProjAcao('ver')
  intercompany(@Param('operacaoId') operacaoId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const vinc = await tx.projCreditoVinculo.findMany({
        where: { canceladoEm: null, situacao: 'VINCULADO', credito: { operacaoId, canceladoEm: null } },
        select: { credito: { select: { dataCredito: true, valor: true } } },
      });
      const apls = await tx.projAplicacao.findMany({ where: { operacaoId, canceladoEm: null }, select: { dataAplicacao: true, valor: true, natureza: { select: { tipo: true } } } });
      const infs = await tx.projSaldoInformado.findMany({
        where: { operacaoId, canceladoEm: null, tipo: { in: ['INTERCOMPANY_RECEBEDORA', 'INTERCOMPANY_BENEFICIARIA'] } },
        orderBy: [{ dataReferencia: 'asc' }, { criadoEm: 'asc' }],
        select: { tipo: true, dataReferencia: true, valor: true },
      });
      const pend = await tx.projCredito.aggregate({ where: { operacaoId, canceladoEm: null, vinculos: { none: { canceladoEm: null } } }, _count: { _all: true }, _sum: { valor: true } });
      type Mes = { entradas: number; aplicacoes: number; devolucoes: number; recebedora?: number; beneficiaria?: number };
      const meses = new Map<string, Mes>();
      const chave = (d: Date) => d.toISOString().slice(0, 7);
      const mes = (k: string) => { const x = meses.get(k) || { entradas: 0, aplicacoes: 0, devolucoes: 0 }; meses.set(k, x); return x; };
      const cent = (v: any) => Math.round(Number(v) * 100);
      const fmt = (c: number) => (c / 100).toFixed(2);
      vinc.forEach((v) => { mes(chave(v.credito.dataCredito)).entradas += cent(v.credito.valor); });
      apls.forEach((a) => { const x = mes(chave(a.dataAplicacao)); if (a.natureza.tipo === 'DEVOLUCAO') x.devolucoes += cent(a.valor); else x.aplicacoes += cent(a.valor); });
      infs.forEach((i) => { const x = mes(chave(i.dataReferencia)); if (i.tipo === 'INTERCOMPANY_RECEBEDORA') x.recebedora = cent(i.valor); else x.beneficiaria = cent(i.valor); });
      const chaves = [...meses.keys()].sort();
      const out: any[] = [];
      if (chaves.length) {
        let [a, m] = chaves[0].split('-').map(Number);
        const [af, mf] = chaves[chaves.length - 1].split('-').map(Number);
        let acum = 0;
        while (a < af || (a === af && m <= mf)) {
          const k = `${a}-${String(m).padStart(2, '0')}`;
          const x = meses.get(k) || { entradas: 0, aplicacoes: 0, devolucoes: 0 };
          const saldoMes = x.entradas - x.aplicacoes - x.devolucoes;
          acum += saldoMes;
          out.push({
            mes: k, entradas: fmt(x.entradas), aplicacoes: fmt(x.aplicacoes), devolucoes: fmt(x.devolucoes), saldoMes: fmt(saldoMes), saldoAcumulado: fmt(acum),
            informadoRecebedora: x.recebedora !== undefined ? fmt(x.recebedora) : null, diferencaRecebedora: x.recebedora !== undefined ? fmt(acum - x.recebedora) : null,
            informadoBeneficiaria: x.beneficiaria !== undefined ? fmt(x.beneficiaria) : null, diferencaBeneficiaria: x.beneficiaria !== undefined ? fmt(acum - x.beneficiaria) : null,
          });
          m += 1; if (m > 12) { m = 1; a += 1; }
        }
      }
      return { meses: out, pendentesDecisao: { quantidade: pend._count._all, total: (pend._sum.valor ?? new Prisma.Decimal(0)).toFixed(2) } };
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
