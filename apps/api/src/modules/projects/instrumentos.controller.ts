// apps/api/src/modules/projects/instrumentos.controller.ts
// Instrumentos do plano (10/10/2026): contratos, termos e aditivos com ciclo de vida, versoes por SHA-256 e trilha
// de eventos encadeada por hash (gravada pelo banco, nao pela API). Master opera; perfil REVISOR (acao 'revisar')
// le, comenta e envia versoes REVISAO com o instrumento Em revisao (o banco recusa qualquer outra escrita do Revisor).
// Etapa 2 (10/10/2026): envio e download de versoes, registro com comprovante, partes, valores, dependencias e
// encerramento de itens com motivo. Arquivos fora de pasta publica, enderecados por hash (instrumentos/<id>/<sha256>).
import {
  Controller, Get, Post, Param, Body, Req, Res, UseGuards, UseInterceptors, UploadedFile,
  NotFoundException, BadRequestException, ConflictException, HttpException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';
import { SkipCompanyCheck, isMasterAdmin } from '../../multi-company/company.interceptor';
import { ProjEscopoGuard, ProjAcao } from './proj-escopo.guard';
import { UUID_RE } from './concessoes.service';
import { ProjDbService } from './proj-db.service';

const SITUACOES = ['RASCUNHO', 'EM_REVISAO', 'APROVADO', 'EM_ASSINATURA', 'ASSINADO', 'REGISTRADO', 'VIGENTE', 'SUBSTITUIDO', 'ENCERRADO'];
const TIPOS_VERSAO = ['MINUTA', 'REVISAO', 'FINAL', 'ASSINADA'];
const EXT_VERSAO = ['docx', 'doc', 'odt', 'pdf'];
const EXT_COMPROVANTE = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
const PAPEIS = ['PARTE', 'FIADOR', 'INTERVENIENTE', 'CIENCIA', 'TESTEMUNHA'];
const JURISDICOES = ['BR', 'PT', 'OUTRA'];
const FORMAS = ['CLICKSIGN', 'ICP_BRASIL', 'QUALIFICADA_EU', 'MANUSCRITA', 'A_DEFINIR'];
const MOEDAS = ['BRL', 'EUR', 'USD'];
const ORIGENS = ['ANEXO_I', 'ANEXO_V', 'CONFISSAO', 'PLANILHA_NEI', 'SIMULADOR', 'MANUAL'];
const EXIGE = ['APROVADO', 'ASSINADO', 'REGISTRADO', 'VIGENTE'];
const COLECOES: Record<string, string> = {
  versoes: 'proj_instrumento_versoes', partes: 'proj_instrumento_partes', registros: 'proj_instrumento_registros',
  valores: 'proj_instrumento_valores', dependencias: 'proj_instrumento_dependencias',
};
const UPLOAD = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function erroInstr(e: any): string {
  const bruto = String(e?.meta?.message || e?.message || 'Falha ao gravar.');
  if (/row-level security/i.test(bruto)) return 'Seu perfil nao permite esta acao.';
  if (/proj_instr_dep_ativa_uq/.test(bruto)) return 'Esta dependencia ja existe.';
  const m = bruto.match(/ERROR:\s*([^\n`]+)/);
  return (m ? m[1] : bruto).slice(0, 300);
}
const txt = (v: any, max: number): string | null => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const extensao = (nome: string) => (String(nome || '').split('.').pop() || '').toLowerCase();

@Controller('projects-instrumentos')
@UseGuards(JwtAuthGuard, ProjEscopoGuard)
@SkipCompanyCheck()
export class InstrumentosController {
  constructor(private readonly db: ProjDbService) {}

  private ids(...xs: string[]) {
    for (const x of xs) if (!UUID_RE.test(String(x || ''))) throw new NotFoundException('Registro nao encontrado.');
  }

  private async executar<T>(req: any, fn: (tx: any) => Promise<T>): Promise<T> {
    try { return await this.db.comoUsuario(req.user.id, fn); }
    catch (e: any) { if (e instanceof HttpException) throw e; throw new BadRequestException(erroInstr(e)); }
  }

  private async instrumento(tx: any, projetoId: string, instrumentoId: string) {
    const r: any[] = await tx.$queryRaw`SELECT id, situacao FROM proj_instrumentos WHERE id = ${instrumentoId}::uuid AND projeto_id = ${projetoId}::uuid`;
    if (!r.length) throw new NotFoundException('Registro nao encontrado.');
    return r[0];
  }

  private dirArquivos(): string {
    return process.env.PROJ_STORAGE_DIR || path.join(process.cwd(), 'storage', 'projetos');
  }

  // grava pelo hash (escrita atomica; o mesmo conteudo nunca e regravado nem sobrescrito)
  private guardar(instrumentoId: string, buf: Buffer): { sha: string; chave: string } {
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const chave = 'instrumentos/' + instrumentoId + '/' + sha;
    const destino = path.join(this.dirArquivos(), ...chave.split('/'));
    if (!fs.existsSync(destino)) {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      const tmp = destino + '.tmp-' + process.pid + '-' + Date.now();
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, destino);
    }
    return { sha, chave };
  }

  private entregar(res: Response, chave: string, sha: string, nome: string, mime: string | null) {
    const caminho = path.join(this.dirArquivos(), ...chave.split('/'));
    if (!fs.existsSync(caminho)) throw new NotFoundException('Arquivo nao encontrado no armazenamento.');
    const buf = fs.readFileSync(caminho);
    if (crypto.createHash('sha256').update(buf).digest('hex') !== String(sha).trim()) {
      throw new ConflictException('Integridade violada: o arquivo armazenado difere do registrado.');
    }
    res.setHeader('Content-Type', mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`);
    res.setHeader('X-Documento-Sha256', String(sha).trim());
    res.send(buf);
  }

  @Get('projetos/:projetoId/instrumentos')
  @ProjAcao('revisar')
  async listar(@Param('projetoId') projetoId: string, @Req() req: any) {
    this.ids(projetoId);
    return this.executar(req, async (tx: any) => {
      const itens: any[] = await tx.$queryRaw`
        SELECT i.id, i.codigo, i.ordem, i.titulo, i.item_planilha AS "itemPlanilha", i.tipo, i.lei,
               i.requer_assinatura AS "requerAssinatura", i.requer_registro AS "requerRegistro",
               i.orgao_registro_previsto AS "orgaoRegistro", i.referencia_minuta AS "referenciaMinuta",
               i.situacao, i.situacao_em AS "situacaoEm", i.versao_aprovada_id AS "versaoAprovadaId",
               proj_instr_pendencias(i.id) AS pendencias,
               (SELECT count(*)::int FROM proj_instrumento_versoes v WHERE v.instrumento_id = i.id AND v.cancelado_em IS NULL) AS versoes,
               (SELECT count(*)::int FROM proj_instrumento_partes p WHERE p.instrumento_id = i.id AND p.cancelado_em IS NULL) AS partes,
               (SELECT max(e.criado_em) FROM proj_instrumento_eventos e WHERE e.instrumento_id = i.id) AS "ultimoEvento"
        FROM proj_instrumentos i WHERE i.projeto_id = ${projetoId}::uuid ORDER BY i.ordem, i.codigo`;
      const deps: any[] = await tx.$queryRaw`
        SELECT d.instrumento_id AS "instrumentoId", d2.id AS "dependeDeId", d2.codigo, d2.situacao, d.exige_situacao AS "exigeSituacao",
               (proj_instr_rank(d2.situacao) >= proj_instr_rank(d.exige_situacao)) AS atendida
        FROM proj_instrumento_dependencias d
        JOIN proj_instrumentos d2 ON d2.id = d.depende_de_id
        JOIN proj_instrumentos i ON i.id = d.instrumento_id
        WHERE i.projeto_id = ${projetoId}::uuid AND d.cancelado_em IS NULL ORDER BY d2.ordem`;
      return {
        podeOperar: isMasterAdmin(req.user),
        itens: itens.map((x) => ({ ...x, dependencias: deps.filter((d) => d.instrumentoId === x.id) })),
      };
    });
  }

  @Get('projetos/:projetoId/instrumentos/:instrumentoId')
  @ProjAcao('revisar')
  async detalhe(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    return this.executar(req, async (tx: any) => {
      const inst: any[] = await tx.$queryRaw`
        SELECT i.id, i.codigo, i.ordem, i.titulo, i.item_planilha AS "itemPlanilha", i.tipo, i.lei,
               i.requer_assinatura AS "requerAssinatura", i.requer_registro AS "requerRegistro",
               i.orgao_registro_previsto AS "orgaoRegistro", i.referencia_minuta AS "referenciaMinuta",
               i.situacao, i.situacao_em AS "situacaoEm", i.versao_aprovada_id AS "versaoAprovadaId",
               i.substituido_por_id AS "substituidoPorId", proj_instr_pendencias(i.id) AS pendencias
        FROM proj_instrumentos i WHERE i.id = ${instrumentoId}::uuid AND i.projeto_id = ${projetoId}::uuid`;
      if (!inst.length) throw new NotFoundException('Registro nao encontrado.');
      const versoes = await tx.$queryRaw`
        SELECT v.id, v.numero, v.tipo, v.versao_base_id AS "versaoBaseId", v.arquivo_nome AS "arquivoNome", v.mime, v.tamanho,
               v.sha256, v.comentario, v.criado_em AS "criadoEm", u.email AS "criadoPor",
               v.cancelado_em AS "canceladoEm", v.motivo_cancelamento AS "motivoCancelamento"
        FROM proj_instrumento_versoes v LEFT JOIN users u ON u.id = v.criado_por_id
        WHERE v.instrumento_id = ${instrumentoId}::uuid ORDER BY v.numero`;
      const partes = await tx.$queryRaw`
        SELECT p.id, p.ordem, p.nome, p.papel, p.documento, p.email, p.jurisdicao, p.forma_assinatura AS "formaAssinatura",
               p.observacao, p.cancelado_em AS "canceladoEm", p.motivo_cancelamento AS "motivoCancelamento"
        FROM proj_instrumento_partes p WHERE p.instrumento_id = ${instrumentoId}::uuid
        ORDER BY (p.cancelado_em IS NOT NULL), p.ordem`;
      const dependencias = await tx.$queryRaw`
        SELECT d.id, d.exige_situacao AS "exigeSituacao", d.justificativa, d2.id AS "dependeDeId", d2.codigo, d2.titulo, d2.situacao,
               (proj_instr_rank(d2.situacao) >= proj_instr_rank(d.exige_situacao)) AS atendida
        FROM proj_instrumento_dependencias d JOIN proj_instrumentos d2 ON d2.id = d.depende_de_id
        WHERE d.instrumento_id = ${instrumentoId}::uuid AND d.cancelado_em IS NULL ORDER BY d2.ordem`;
      const dependentes = await tx.$queryRaw`
        SELECT d.id, d.exige_situacao AS "exigeSituacao", d2.id AS "instrumentoId", d2.codigo, d2.titulo, d2.situacao
        FROM proj_instrumento_dependencias d JOIN proj_instrumentos d2 ON d2.id = d.instrumento_id
        WHERE d.depende_de_id = ${instrumentoId}::uuid AND d.cancelado_em IS NULL ORDER BY d2.ordem`;
      const registros = await tx.$queryRaw`
        SELECT r.id, r.orgao, r.protocolo, r.data_registro AS "dataRegistro", r.arquivo_nome AS "arquivoNome", r.sha256,
               r.observacao, r.criado_em AS "criadoEm", r.cancelado_em AS "canceladoEm", r.motivo_cancelamento AS "motivoCancelamento"
        FROM proj_instrumento_registros r WHERE r.instrumento_id = ${instrumentoId}::uuid ORDER BY r.criado_em`;
      const valores = await tx.$queryRaw`
        SELECT x.id, x.rotulo, x.marcador, x.valor::text AS valor, x.moeda, x.origem, x.origem_ref AS "origemRef",
               x.apurado_em AS "apuradoEm", x.congelado_em AS "congeladoEm", x.congelado_versao_id AS "congeladoVersaoId",
               x.cancelado_em AS "canceladoEm", x.motivo_cancelamento AS "motivoCancelamento"
        FROM proj_instrumento_valores x WHERE x.instrumento_id = ${instrumentoId}::uuid ORDER BY x.criado_em`;
      const eventos = await tx.$queryRaw`
        SELECT e.seq, e.tipo, e.de_situacao AS "de", e.para_situacao AS "para", e.ref_id AS "refId", e.detalhe, e.motivo,
               e.criado_em AS "criadoEm", u.email AS "por", e.hash, e.hash_anterior AS "hashAnterior"
        FROM proj_instrumento_eventos e LEFT JOIN users u ON u.id = e.criado_por_id
        WHERE e.instrumento_id = ${instrumentoId}::uuid ORDER BY e.seq`;
      const ver: any[] = await tx.$queryRaw`
        SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT ev_ok)::int AS falhas
        FROM proj_instrumento_verificar(${instrumentoId}::uuid)`;
      return {
        podeOperar: isMasterAdmin(req.user),
        instrumento: inst[0], versoes, partes, dependencias, dependentes, registros, valores, eventos,
        trilha: { eventos: ver[0]?.total ?? 0, integra: (ver[0]?.falhas ?? 1) === 0 },
      };
    });
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/transitar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async transitar(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const para = String(body?.para || '');
    if (!SITUACOES.includes(para)) throw new BadRequestException('Situacao de destino invalida.');
    const motivo = txt(body?.motivo, 2000);
    const versaoId = body?.versaoAprovadaId ? String(body.versaoAprovadaId) : null;
    const substitutoId = body?.substitutoId ? String(body.substitutoId) : null;
    if (versaoId && !UUID_RE.test(versaoId)) throw new BadRequestException('Versao invalida.');
    if (substitutoId && !UUID_RE.test(substitutoId)) throw new BadRequestException('Instrumento substituto invalido.');
    return this.executar(req, async (tx: any) => {
      const x: any[] = await tx.$queryRaw`
        UPDATE proj_instrumentos SET situacao = ${para}::varchar, motivo_ultima_transicao = ${motivo}::text,
          versao_aprovada_id = CASE WHEN ${para}::varchar = 'APROVADO' AND situacao = 'EM_REVISAO' THEN ${versaoId}::uuid ELSE versao_aprovada_id END,
          substituido_por_id = CASE WHEN ${para}::varchar = 'SUBSTITUIDO' THEN ${substitutoId}::uuid ELSE substituido_por_id END
        WHERE id = ${instrumentoId}::uuid AND projeto_id = ${projetoId}::uuid AND situacao <> ${para}::varchar
        RETURNING id, situacao`;
      if (!x.length) throw new NotFoundException('Instrumento nao encontrado ou ja nesta situacao.');
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_SITUACAO', targetId: instrumentoId,
        after: { projetoId, para, motivo, versaoId, substitutoId } } });
      return { ok: true, situacao: x[0].situacao };
    });
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/comentar')
  @ProjAcao('revisar')
  async comentar(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const texto = String(body?.texto || '').trim();
    if (texto.length < 3 || texto.length > 4000) throw new BadRequestException('Comentario deve ter de 3 a 4000 caracteres.');
    return this.executar(req, async (tx: any) => {
      const r: any[] = await tx.$queryRaw`
        INSERT INTO proj_instrumento_eventos (projeto_id, instrumento_id, seq, tipo, detalhe, criado_em, hash_anterior, hash)
        SELECT i.projeto_id, i.id, 1, 'COMENTARIO', jsonb_build_object('texto', ${texto}::text), NULL, NULL, NULL
        FROM proj_instrumentos i WHERE i.id = ${instrumentoId}::uuid AND i.projeto_id = ${projetoId}::uuid
          AND i.situacao NOT IN ('SUBSTITUIDO', 'ENCERRADO')
        RETURNING seq`;
      if (!r.length) throw new NotFoundException('Instrumento nao encontrado ou encerrado.');
      return { ok: true, seq: r[0].seq };
    });
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/versoes')
  @ProjAcao('revisar')
  @UseInterceptors(UPLOAD)
  async enviarVersao(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string,
                     @UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    if (!file || !file.buffer?.length) throw new BadRequestException('Arquivo nao enviado.');
    const master = isMasterAdmin(req.user);
    const tipo = master ? String(body?.tipo || '') : 'REVISAO';
    if (!TIPOS_VERSAO.includes(tipo)) throw new BadRequestException('Tipo de versao invalido.');
    const ext = extensao(file.originalname);
    if (!EXT_VERSAO.includes(ext)) throw new BadRequestException('Formato nao aceito. Use Word (DOCX/DOC), ODT ou PDF.');
    if (tipo === 'ASSINADA' && ext !== 'pdf') throw new BadRequestException('A versao assinada deve ser PDF.');
    const baseId = body?.versaoBaseId ? String(body.versaoBaseId) : null;
    if (baseId && !UUID_RE.test(baseId)) throw new BadRequestException('Versao base invalida.');
    const comentario = txt(body?.comentario, 4000);
    if (!master && (!comentario || comentario.length < 5)) throw new BadRequestException('Descreva a revisao no comentario (minimo 5 caracteres).');
    const nome = file.originalname.slice(0, 250);
    const mime = (file.mimetype || '').slice(0, 120) || null;
    return this.executar(req, async (tx: any) => {
      await this.instrumento(tx, projetoId, instrumentoId);
      if (baseId) {
        const b: any[] = await tx.$queryRaw`SELECT 1 FROM proj_instrumento_versoes WHERE id = ${baseId}::uuid AND instrumento_id = ${instrumentoId}::uuid`;
        if (!b.length) throw new BadRequestException('A versao base nao pertence a este instrumento.');
      }
      const g = this.guardar(instrumentoId, file.buffer);
      const v: any[] = await tx.$queryRaw`
        INSERT INTO proj_instrumento_versoes (instrumento_id, numero, tipo, versao_base_id, arquivo_nome, mime, tamanho, sha256, chave_armazenamento, comentario, criado_por_id)
        VALUES (${instrumentoId}::uuid, 1, ${tipo}::varchar, ${baseId}::uuid, ${nome}::varchar, ${mime}::varchar, ${file.size}::int,
                ${g.sha}::text, ${g.chave}::varchar, ${comentario}::text, ${req.user.id}::uuid)
        RETURNING id, numero`;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_VERSAO_ENVIADA', targetId: v[0].id,
        after: { projetoId, instrumentoId, numero: v[0].numero, tipo, arquivo: nome, sha256: g.sha, tamanho: file.size } } });
      return { ok: true, id: v[0].id, numero: v[0].numero, sha256: g.sha };
    });
  }

  @Get('projetos/:projetoId/instrumentos/:instrumentoId/versoes/:versaoId/arquivo')
  @ProjAcao('revisar')
  async baixarVersao(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string,
                     @Param('versaoId') versaoId: string, @Req() req: any, @Res() res: Response) {
    this.ids(projetoId, instrumentoId, versaoId);
    const v: any = await this.executar(req, async (tx: any) => {
      const r: any[] = await tx.$queryRaw`
        SELECT v.id, v.numero, v.arquivo_nome AS nome, v.mime, v.sha256, v.chave_armazenamento AS chave
        FROM proj_instrumento_versoes v JOIN proj_instrumentos i ON i.id = v.instrumento_id
        WHERE v.id = ${versaoId}::uuid AND i.id = ${instrumentoId}::uuid AND i.projeto_id = ${projetoId}::uuid`;
      if (!r.length) return null;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_VERSAO_BAIXADA', targetId: versaoId,
        after: { projetoId, instrumentoId, numero: r[0].numero, arquivo: r[0].nome } } });
      return r[0];
    });
    if (!v) throw new NotFoundException('Registro nao encontrado.');
    this.entregar(res, v.chave, v.sha256, v.nome, v.mime);
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/registros')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  @UseInterceptors(UPLOAD)
  async registrar(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string,
                  @UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const orgao = txt(body?.orgao, 160);
    if (!orgao || orgao.length < 3) throw new BadRequestException('Informe o orgao (minimo 3 caracteres).');
    const data = String(body?.dataRegistro || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || isNaN(new Date(data + 'T00:00:00Z').getTime())) throw new BadRequestException('Data do registro invalida.');
    const protocolo = txt(body?.protocolo, 80);
    const obs = txt(body?.observacao, 2000);
    const temArq = !!file?.buffer?.length;
    if (temArq && !EXT_COMPROVANTE.includes(extensao(file.originalname))) throw new BadRequestException('Comprovante: use PDF ou imagem.');
    return this.executar(req, async (tx: any) => {
      await this.instrumento(tx, projetoId, instrumentoId);
      let nome: string | null = null, mime: string | null = null, tamanho: number | null = null, sha: string | null = null, chave: string | null = null;
      if (temArq) {
        const g = this.guardar(instrumentoId, file.buffer);
        nome = file.originalname.slice(0, 250); mime = (file.mimetype || '').slice(0, 120) || null; tamanho = file.size; sha = g.sha; chave = g.chave;
      }
      const r: any[] = await tx.$queryRaw`
        INSERT INTO proj_instrumento_registros (instrumento_id, orgao, protocolo, data_registro, arquivo_nome, mime, tamanho, sha256, chave_armazenamento, observacao, criado_por_id)
        VALUES (${instrumentoId}::uuid, ${orgao}::varchar, ${protocolo}::varchar, ${data}::date, ${nome}::varchar, ${mime}::varchar, ${tamanho}::int,
                ${sha}::text, ${chave}::varchar, ${obs}::text, ${req.user.id}::uuid)
        RETURNING id`;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_REGISTRO', targetId: r[0].id,
        after: { projetoId, instrumentoId, orgao, protocolo, data, sha256: sha } } });
      return { ok: true, id: r[0].id };
    });
  }

  @Get('projetos/:projetoId/instrumentos/:instrumentoId/registros/:registroId/comprovante')
  @ProjAcao('revisar')
  async baixarComprovante(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string,
                          @Param('registroId') registroId: string, @Req() req: any, @Res() res: Response) {
    this.ids(projetoId, instrumentoId, registroId);
    const r: any = await this.executar(req, async (tx: any) => {
      const x: any[] = await tx.$queryRaw`
        SELECT r.id, r.arquivo_nome AS nome, r.mime, r.sha256, r.chave_armazenamento AS chave
        FROM proj_instrumento_registros r JOIN proj_instrumentos i ON i.id = r.instrumento_id
        WHERE r.id = ${registroId}::uuid AND i.id = ${instrumentoId}::uuid AND i.projeto_id = ${projetoId}::uuid AND r.chave_armazenamento IS NOT NULL`;
      if (!x.length) return null;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_COMPROVANTE_BAIXADO', targetId: registroId,
        after: { projetoId, instrumentoId, arquivo: x[0].nome } } });
      return x[0];
    });
    if (!r) throw new NotFoundException('Comprovante nao encontrado.');
    this.entregar(res, r.chave, r.sha256, r.nome, r.mime);
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/partes')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async incluirParte(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const nome = txt(body?.nome, 200);
    if (!nome || nome.length < 2) throw new BadRequestException('Informe o nome da parte.');
    const papel = String(body?.papel || '');
    if (!PAPEIS.includes(papel)) throw new BadRequestException('Papel invalido.');
    const jur = body?.jurisdicao ? String(body.jurisdicao) : null;
    if (jur && !JURISDICOES.includes(jur)) throw new BadRequestException('Jurisdicao invalida.');
    const forma = String(body?.formaAssinatura || 'A_DEFINIR');
    if (!FORMAS.includes(forma)) throw new BadRequestException('Forma de assinatura invalida.');
    const documento = body?.documento ? (String(body.documento).replace(/[^0-9A-Za-z]/g, '').slice(0, 30) || null) : null;
    const email = txt(body?.email, 200);
    const obs = txt(body?.observacao, 2000);
    return this.executar(req, async (tx: any) => {
      await this.instrumento(tx, projetoId, instrumentoId);
      const r: any[] = await tx.$queryRaw`
        INSERT INTO proj_instrumento_partes (instrumento_id, ordem, nome, papel, documento, email, jurisdicao, forma_assinatura, observacao, criado_por_id)
        VALUES (${instrumentoId}::uuid,
                (SELECT COALESCE(MAX(p.ordem), 0) + 1 FROM proj_instrumento_partes p WHERE p.instrumento_id = ${instrumentoId}::uuid),
                ${nome}::varchar, ${papel}::varchar, ${documento}::varchar, ${email}::varchar, ${jur}::varchar, ${forma}::varchar, ${obs}::text, ${req.user.id}::uuid)
        RETURNING id`;
      return { ok: true, id: r[0].id };
    });
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/valores')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async incluirValor(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const rotulo = txt(body?.rotulo, 160);
    if (!rotulo || rotulo.length < 3) throw new BadRequestException('Informe o rotulo do valor.');
    const valor = Number(body?.valor);
    if (!isFinite(valor)) throw new BadRequestException('Valor invalido.');
    const moeda = String(body?.moeda || 'BRL');
    if (!MOEDAS.includes(moeda)) throw new BadRequestException('Moeda invalida.');
    const origem = String(body?.origem || '');
    if (!ORIGENS.includes(origem)) throw new BadRequestException('Origem invalida.');
    const marcador = txt(body?.marcador, 80);
    let ref: string | null = null;
    if (body?.origemRef && typeof body.origemRef === 'object') {
      ref = JSON.stringify(body.origemRef);
      if (ref.length > 4000) throw new BadRequestException('Referencia da origem muito longa.');
    }
    return this.executar(req, async (tx: any) => {
      await this.instrumento(tx, projetoId, instrumentoId);
      const r: any[] = await tx.$queryRaw`
        INSERT INTO proj_instrumento_valores (instrumento_id, rotulo, marcador, valor, moeda, origem, origem_ref, criado_por_id)
        VALUES (${instrumentoId}::uuid, ${rotulo}::varchar, ${marcador}::varchar, ${valor}::numeric, ${moeda}::char(3), ${origem}::varchar,
                ${ref}::jsonb, ${req.user.id}::uuid)
        RETURNING id`;
      return { ok: true, id: r[0].id };
    });
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/dependencias')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async incluirDependencia(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const dep = String(body?.dependeDeId || '');
    if (!UUID_RE.test(dep)) throw new BadRequestException('Instrumento de dependencia invalido.');
    if (dep === instrumentoId) throw new BadRequestException('Um instrumento nao pode depender de si mesmo.');
    const exige = String(body?.exigeSituacao || 'ASSINADO');
    if (!EXIGE.includes(exige)) throw new BadRequestException('Situacao exigida invalida.');
    const just = txt(body?.justificativa, 1000);
    return this.executar(req, async (tx: any) => {
      await this.instrumento(tx, projetoId, instrumentoId);
      const r: any[] = await tx.$queryRaw`
        INSERT INTO proj_instrumento_dependencias (instrumento_id, depende_de_id, exige_situacao, justificativa, criado_por_id)
        SELECT ${instrumentoId}::uuid, d.id, ${exige}::varchar, ${just}::text, ${req.user.id}::uuid
        FROM proj_instrumentos d WHERE d.id = ${dep}::uuid AND d.projeto_id = ${projetoId}::uuid
        RETURNING id`;
      if (!r.length) throw new NotFoundException('Instrumento de dependencia nao encontrado neste projeto.');
      return { ok: true, id: r[0].id };
    });
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/:colecao/:itemId/encerrar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async encerrarItem(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string,
                     @Param('colecao') colecao: string, @Param('itemId') itemId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId, itemId);
    const tabela = COLECOES[colecao];
    if (!tabela) throw new NotFoundException('Registro nao encontrado.');
    const motivo = txt(body?.motivo, 2000) || '';
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo de 10 caracteres).');
    return this.executar(req, async (tx: any) => {
      const r: any[] = await tx.$queryRawUnsafe(
        `UPDATE ${tabela} t SET cancelado_em = CURRENT_TIMESTAMP, cancelado_por_id = $1::uuid, motivo_cancelamento = $2
           FROM proj_instrumentos i
          WHERE t.id = $3::uuid AND t.instrumento_id = i.id AND i.id = $4::uuid AND i.projeto_id = $5::uuid AND t.cancelado_em IS NULL
          RETURNING t.id`,
        req.user.id, motivo, itemId, instrumentoId, projetoId);
      if (!r.length) throw new NotFoundException('Registro nao encontrado ou ja encerrado.');
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_ITEM_ENCERRADO', targetId: itemId,
        after: { projetoId, instrumentoId, colecao, motivo } } });
      return { ok: true };
    });
  }
}
