// apps/api/src/modules/projects/cadastros.controller.ts
// Fase 1.4-1.5 (04/10/2026): cadastros do dominio Projetos pela tela - projeto, operacao, contrapartes, participacoes e
// identificacao do remetente de credito. Tudo so Master, com AuditLog de antes/depois. Escopo pelo ProjEscopoGuard
// (:projetoId / :operacaoId) e RLS no banco (ProjDbService.comoUsuario).
//  - data-base e valor de controle da operacao so mudam com motivo (a conferencia do Painel depende deles)
//  - documento (CPF/CNPJ) validado pelos digitos; uma vez gravado, nao muda pela tela (so pode ser preenchido)
//  - encerrar participacao: travas para Adquirente com creditos vinculados e Remetente com creditos na operacao
import { Controller, Get, Post, Param, Body, Req, UseGuards, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { ProjEscopoGuard, ProjAcao } from './proj-escopo.guard';
import { UUID_RE } from './concessoes.service';
import { ProjDbService } from './proj-db.service';

const STATUS_PROJETO = ['ATIVO', 'SUSPENSO', 'ENCERRADO'];
const STATUS_OPERACAO = ['ATIVA', 'SUSPENSA', 'ENCERRADA'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cpfValido(c: string): boolean {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  for (const n of [9, 10]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[n])) return false;
  }
  return true;
}
function cnpjValido(c: string): boolean {
  if (!/^\d{14}$/.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, ...w1];
  for (const [w, n] of [[w1, 12], [w2, 13]] as [number[], number][]) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * w[i];
    const r = s % 11;
    if ((r < 2 ? 0 : 11 - r) !== Number(c[n])) return false;
  }
  return true;
}
function mascarar(doc?: string | null): string | null {
  if (!doc) return null;
  if (doc.length === 11) return '***.' + doc.slice(3, 6) + '.' + doc.slice(6, 9) + '-**';
  if (doc.length === 14) return doc.slice(0, 2) + '.' + doc.slice(2, 5) + '.' + doc.slice(5, 8) + '/' + doc.slice(8, 12) + '-' + doc.slice(12);
  return '***';
}
function texto(v: any, max = 500): string | null {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s ? s.slice(0, max) : null;
}
function validarDocumento(tipoPessoa: string, documento: string | null): void {
  if (!documento) return;
  if (tipoPessoa === 'PF' && !cpfValido(documento)) throw new BadRequestException('CPF invalido (confira os digitos).');
  if (tipoPessoa === 'PJ' && !cnpjValido(documento)) throw new BadRequestException('CNPJ invalido (confira os digitos).');
}

@Controller('projects-cadastros')
@UseGuards(JwtAuthGuard, ProjEscopoGuard)
@SkipCompanyCheck()
export class CadastrosController {
  constructor(private readonly db: ProjDbService) {}

  @Get('papeis')
  @ProjAcao('autenticado')
  papeis(@Req() req: any) {
    return this.db.comoUsuario(req.user.id, (tx) =>
      tx.projPapel.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { codigo: true, nome: true, aplicaA: true } }),
    );
  }

  @Get('empresas')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado') // decisao do MasterOnlyGuard do metodo (403 consistente)
  empresas(@Req() req: any) {
    return this.db.comoUsuario(req.user.id, (tx) =>
      tx.company.findMany({ orderBy: { legalName: 'asc' }, select: { id: true, legalName: true, tradeName: true } }),
    );
  }

  @Post('projetos/:projetoId')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  editarProjeto(@Param('projetoId') projetoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(projetoId)) throw new NotFoundException('Registro nao encontrado.');
    const nome = texto(b?.nome, 200);
    const status = String(b?.status || '');
    if (!nome || nome.length < 3) throw new BadRequestException('Informe o nome do projeto (minimo 3 caracteres).');
    if (!STATUS_PROJETO.includes(status)) throw new BadRequestException('Situacao invalida.');
    const descricao = texto(b?.descricao, 2000);
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const p = await tx.projProjeto.findFirst({ where: { id: projetoId, canceladoEm: null }, select: { nome: true, descricao: true, status: true } });
      if (!p) throw new NotFoundException('Projeto nao encontrado.');
      await tx.projProjeto.update({ where: { id: projetoId }, data: { nome, descricao, status, atualizadoPorId: req.user.id } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_PROJETO_EDITADO', targetId: projetoId, after: { antes: p, depois: { nome, descricao, status } } } });
      return { id: projetoId };
    });
  }

  @Post('operacoes/:operacaoId')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  editarOperacao(@Param('operacaoId') operacaoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const nome = texto(b?.nome, 200);
    const status = String(b?.status || '');
    if (!nome || nome.length < 3) throw new BadRequestException('Informe o nome da operacao (minimo 3 caracteres).');
    if (!STATUS_OPERACAO.includes(status)) throw new BadRequestException('Situacao invalida.');
    const descricao = texto(b?.descricao, 2000);
    const dataBase = b?.dataBase ? new Date(String(b.dataBase).slice(0, 10) + 'T00:00:00Z') : null;
    if (dataBase && isNaN(dataBase.getTime())) throw new BadRequestException('Data-base invalida.');
    let valorControle: Prisma.Decimal | null = null;
    if (b?.valorControle !== undefined && b?.valorControle !== null && String(b.valorControle).trim() !== '') {
      valorControle = new Prisma.Decimal(String(b.valorControle).replace(/\./g, '').replace(',', '.').trim() || '0');
      if (valorControle.isNaN() || valorControle.lte(0)) throw new BadRequestException('Valor de controle invalido.');
    }
    const motivo = String(b?.motivo || '').trim();
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const op = await tx.projOperacao.findFirst({
        where: { id: operacaoId, canceladoEm: null },
        select: { nome: true, descricao: true, status: true, dataBase: true, valorControle: true },
      });
      if (!op) throw new NotFoundException('Operacao nao encontrada.');
      const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
      const antesValor = op.valorControle ? op.valorControle.toFixed(2) : null;
      const depoisValor = valorControle ? valorControle.toFixed(2) : null;
      const critico = iso(op.dataBase) !== iso(dataBase) || antesValor !== depoisValor;
      if (critico && motivo.length < 10) throw new BadRequestException('Alterar data-base ou valor de controle exige motivo (minimo 10 caracteres).');
      await tx.projOperacao.update({ where: { id: operacaoId }, data: { nome, descricao, status, dataBase, valorControle, atualizadoPorId: req.user.id } });
      await tx.auditLog.create({
        data: {
          actorId: req.user.id, action: 'PROJ_OPERACAO_EDITADA', targetId: operacaoId,
          after: {
            antes: { nome: op.nome, descricao: op.descricao, status: op.status, dataBase: iso(op.dataBase), valorControle: antesValor },
            depois: { nome, descricao, status, dataBase: iso(dataBase), valorControle: depoisValor },
            motivo: motivo || null,
          },
        },
      });
      return { id: operacaoId };
    });
  }

  @Get('operacoes/:operacaoId/contrapartes/:contraparteId')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  contraparte(@Param('operacaoId') operacaoId: string, @Param('contraparteId') contraparteId: string, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(contraparteId)) throw new NotFoundException('Registro nao encontrado.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const part = await tx.projParticipacao.findFirst({ where: { operacaoId, contraparteId, canceladoEm: null }, select: { id: true } });
      if (!part) throw new NotFoundException('Contraparte nao participa desta operacao.');
      const c = await tx.projContraparte.findFirst({
        where: { id: contraparteId, canceladoEm: null },
        select: { id: true, tipoPessoa: true, documento: true, nome: true, email: true, telefone: true, observacoes: true },
      });
      if (!c) throw new NotFoundException('Contraparte nao encontrada.');
      const { documento, ...resto } = c;
      return { ...resto, temDocumento: !!documento, documentoMascarado: mascarar(documento) };
    });
  }

  @Post('operacoes/:operacaoId/contrapartes')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async criarContraparte(@Param('operacaoId') operacaoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const tipoPessoa = String(b?.tipoPessoa || '');
    if (!['PF', 'PJ'].includes(tipoPessoa)) throw new BadRequestException('Informe se e pessoa fisica (PF) ou juridica (PJ).');
    const documento = String(b?.documento || '').replace(/\D/g, '') || null;
    validarDocumento(tipoPessoa, documento);
    const nome = texto(b?.nome, 200);
    if (!nome || nome.length < 3) throw new BadRequestException('Informe o nome (minimo 3 caracteres).');
    const email = texto(b?.email, 200);
    if (email && !EMAIL_RE.test(email)) throw new BadRequestException('E-mail invalido.');
    const papelCodigo = String(b?.papelCodigo || '');
    try {
      return await this.db.comoUsuario(req.user.id, async (tx) => {
        const op = await tx.projOperacao.findFirst({ where: { id: operacaoId, canceladoEm: null }, select: { id: true } });
        if (!op) throw new NotFoundException('Operacao nao encontrada.');
        const papel = await tx.projPapel.findFirst({ where: { codigo: papelCodigo, ativo: true }, select: { id: true, aplicaA: true } });
        if (!papel || papel.aplicaA === 'EMPRESA') throw new BadRequestException('Papel invalido para contraparte.');
        if (documento) {
          const existente = await tx.projContraparte.findFirst({ where: { documento, canceladoEm: null }, select: { nome: true } });
          if (existente) throw new ConflictException(`Ja existe contraparte com este documento (${existente.nome}). Use "Contraparte ja cadastrada".`);
        }
        const c = await tx.projContraparte.create({
          data: { tipoPessoa, documento, nome, email, telefone: texto(b?.telefone, 20), observacoes: texto(b?.observacoes, 2000), criadoPorId: req.user.id },
          select: { id: true },
        });
        await tx.projParticipacao.create({ data: { operacaoId, papelId: papel.id, contraparteId: c.id, observacao: texto(b?.observacao, 500), criadoPorId: req.user.id } });
        await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_CONTRAPARTE_CRIADA', targetId: c.id, after: { operacaoId, nome, tipoPessoa, documento: mascarar(documento), papel: papelCodigo } } });
        return { id: c.id };
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Ja existe contraparte com este documento.');
      throw e;
    }
  }

  @Post('operacoes/:operacaoId/contrapartes/:contraparteId')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  editarContraparte(@Param('operacaoId') operacaoId: string, @Param('contraparteId') contraparteId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(contraparteId)) throw new NotFoundException('Registro nao encontrado.');
    const nome = texto(b?.nome, 200);
    if (!nome || nome.length < 3) throw new BadRequestException('Informe o nome (minimo 3 caracteres).');
    const email = texto(b?.email, 200);
    if (email && !EMAIL_RE.test(email)) throw new BadRequestException('E-mail invalido.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const part = await tx.projParticipacao.findFirst({ where: { operacaoId, contraparteId, canceladoEm: null }, select: { id: true } });
      if (!part) throw new NotFoundException('Contraparte nao participa desta operacao.');
      const c = await tx.projContraparte.findFirst({
        where: { id: contraparteId, canceladoEm: null },
        select: { tipoPessoa: true, documento: true, nome: true, email: true, telefone: true, observacoes: true },
      });
      if (!c) throw new NotFoundException('Contraparte nao encontrada.');
      const data: any = { nome, email, telefone: texto(b?.telefone, 20), observacoes: texto(b?.observacoes, 2000), atualizadoPorId: req.user.id };
      const novoDoc = String(b?.documento || '').replace(/\D/g, '') || null;
      if (novoDoc) {
        if (c.documento && novoDoc !== c.documento) throw new BadRequestException('O documento ja cadastrado nao pode ser alterado pela tela.');
        if (!c.documento) {
          const tipoPessoa = String(b?.tipoPessoa || c.tipoPessoa || '');
          if (!['PF', 'PJ'].includes(tipoPessoa)) throw new BadRequestException('Informe se e pessoa fisica (PF) ou juridica (PJ).');
          validarDocumento(tipoPessoa, novoDoc);
          const existente = await tx.projContraparte.findFirst({ where: { documento: novoDoc, canceladoEm: null, NOT: { id: contraparteId } }, select: { nome: true } });
          if (existente) throw new ConflictException(`Ja existe contraparte com este documento (${existente.nome}).`);
          data.documento = novoDoc;
          data.tipoPessoa = tipoPessoa;
        }
      }
      await tx.projContraparte.update({ where: { id: contraparteId }, data });
      await tx.auditLog.create({
        data: {
          actorId: req.user.id, action: 'PROJ_CONTRAPARTE_EDITADA', targetId: contraparteId,
          after: {
            operacaoId,
            antes: { nome: c.nome, email: c.email, telefone: c.telefone, documento: mascarar(c.documento) },
            depois: { nome, email: data.email, telefone: data.telefone, documento: mascarar(data.documento ?? c.documento) },
          },
        },
      });
      return { id: contraparteId };
    });
  }

  @Post('operacoes/:operacaoId/participacoes')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async adicionarParticipacao(@Param('operacaoId') operacaoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const companyId = b?.companyId ? String(b.companyId) : null;
    const contraparteId = b?.contraparteId ? String(b.contraparteId) : null;
    if (!!companyId === !!contraparteId) throw new BadRequestException('Informe uma empresa do grupo OU uma contraparte.');
    if ((companyId && !UUID_RE.test(companyId)) || (contraparteId && !UUID_RE.test(contraparteId))) throw new BadRequestException('Identificador invalido.');
    const papelCodigo = String(b?.papelCodigo || '');
    try {
      return await this.db.comoUsuario(req.user.id, async (tx) => {
        const op = await tx.projOperacao.findFirst({ where: { id: operacaoId, canceladoEm: null }, select: { id: true } });
        if (!op) throw new NotFoundException('Operacao nao encontrada.');
        const papel = await tx.projPapel.findFirst({ where: { codigo: papelCodigo, ativo: true }, select: { id: true, aplicaA: true } });
        if (!papel) throw new BadRequestException('Papel invalido.');
        if (companyId && papel.aplicaA === 'CONTRAPARTE') throw new BadRequestException('Este papel e so para contrapartes.');
        if (contraparteId && papel.aplicaA === 'EMPRESA') throw new BadRequestException('Este papel e so para empresas do grupo.');
        if (companyId && !(await tx.company.findFirst({ where: { id: companyId }, select: { id: true } }))) throw new BadRequestException('Empresa nao encontrada.');
        if (contraparteId && !(await tx.projContraparte.findFirst({ where: { id: contraparteId, canceladoEm: null }, select: { id: true } }))) throw new BadRequestException('Contraparte nao encontrada.');
        const p = await tx.projParticipacao.create({
          data: { operacaoId, papelId: papel.id, companyId, contraparteId, observacao: texto(b?.observacao, 500), criadoPorId: req.user.id },
          select: { id: true },
        });
        await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_PARTICIPACAO_CRIADA', targetId: p.id, after: { operacaoId, papel: papelCodigo, companyId, contraparteId } } });
        return { id: p.id };
      });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Este participante ja tem este papel nesta operacao.');
      throw e;
    }
  }

  @Post('operacoes/:operacaoId/participacoes/:participacaoId/encerrar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  encerrarParticipacao(@Param('operacaoId') operacaoId: string, @Param('participacaoId') participacaoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(participacaoId)) throw new NotFoundException('Registro nao encontrado.');
    const motivo = String(b?.motivo || '').trim();
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres). Ele fica na trilha de auditoria.');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const p = await tx.projParticipacao.findFirst({
        where: { id: participacaoId, operacaoId, canceladoEm: null },
        select: { id: true, companyId: true, contraparteId: true, papel: { select: { codigo: true } } },
      });
      if (!p) throw new NotFoundException('Participacao vigente nao encontrada.');
      if (p.papel.codigo === 'ADQUIRENTE' && p.contraparteId) {
        const n = await tx.projCreditoVinculo.count({ where: { canceladoEm: null, situacao: 'VINCULADO', adquirenteId: p.contraparteId, credito: { operacaoId, canceladoEm: null } } });
        if (n > 0) throw new BadRequestException(`Ha ${n} credito(s) vinculado(s) a Conta Individual deste Adquirente. Altere os vinculos antes.`);
      }
      if (p.papel.codigo === 'REMETENTE' && p.contraparteId) {
        const n = await tx.projCredito.count({ where: { operacaoId, canceladoEm: null, remetenteId: p.contraparteId } });
        if (n > 0) throw new BadRequestException(`Ha ${n} credito(s) deste remetente na operacao.`);
      }
      await tx.projParticipacao.update({ where: { id: p.id }, data: { canceladoEm: new Date(), canceladoPorId: req.user.id, motivoCancelamento: motivo } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_PARTICIPACAO_ENCERRADA', targetId: p.id, after: { operacaoId, papel: p.papel.codigo, companyId: p.companyId, contraparteId: p.contraparteId, motivo } } });
      return { id: p.id };
    });
  }

  @Post('operacoes/:operacaoId/creditos/:creditoId/remetente')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  identificarRemetente(@Param('operacaoId') operacaoId: string, @Param('creditoId') creditoId: string, @Body() b: any, @Req() req: any) {
    if (!UUID_RE.test(operacaoId) || !UUID_RE.test(creditoId)) throw new NotFoundException('Registro nao encontrado.');
    const contraparteId = String(b?.contraparteId || '');
    if (!UUID_RE.test(contraparteId)) throw new BadRequestException('Informe a contraparte.');
    const motivo = String(b?.motivo || '').trim();
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo/fonte da identificacao (minimo 10 caracteres).');
    return this.db.comoUsuario(req.user.id, async (tx) => {
      const c = await tx.projCredito.findFirst({ where: { id: creditoId, operacaoId, canceladoEm: null }, select: { id: true, numeroOrdem: true, identificacaoPendente: true, remetenteId: true } });
      if (!c) throw new NotFoundException('Credito nao encontrado nesta operacao.');
      if (!c.identificacaoPendente) throw new BadRequestException('Este credito ja tem remetente identificado.');
      const ct = await tx.projContraparte.findFirst({ where: { id: contraparteId, canceladoEm: null }, select: { id: true, nome: true } });
      if (!ct) throw new BadRequestException('Contraparte nao encontrada.');
      const papel = await tx.projPapel.findFirst({ where: { codigo: 'REMETENTE' }, select: { id: true } });
      if (papel && !(await tx.projParticipacao.findFirst({ where: { operacaoId, contraparteId, papelId: papel.id, canceladoEm: null }, select: { id: true } }))) {
        await tx.projParticipacao.create({ data: { operacaoId, papelId: papel.id, contraparteId, observacao: 'Remetente identificado pela tela', criadoPorId: req.user.id } });
      }
      await tx.projCredito.update({ where: { id: creditoId }, data: { remetenteId: contraparteId, identificacaoPendente: false, atualizadoPorId: req.user.id } });
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_CREDITO_REMETENTE_IDENTIFICADO', targetId: creditoId, after: { operacaoId, numeroOrdem: c.numeroOrdem, contraparteId, remetente: ct.nome, motivo } } });
      return { id: creditoId };
    });
  }
}
