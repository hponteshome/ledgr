// apps/api/src/modules/projects/juridico.controller.ts
// Juridico RM (30/10/2026): processos, remessas (protocolos Citius), indice de documentos, arquivos protocolados
// (imutaveis, enderecados por SHA-256 em juridico/<sha256>) e prazos. Regras no banco (20261030_proj_juridico.sql):
// leitura para quem tem 'ver' ou 'revisar' no projeto (RLS); escrita so Master; arquivo so e encerrado, com motivo.
import {
  Controller, Get, Post, Param, Body, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile,
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

const SIT_DOC = ['JUNTO', 'SUBSTITUIDO', 'SEM_EFEITO', 'A_JUNTAR'];
const SIT_PRAZO = ['ABERTO', 'CUMPRIDO', 'DISPENSADO'];
const UPLOAD = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

function erroJur(e: any): string {
  const bruto = String(e?.meta?.message || e?.message || 'Falha ao gravar.');
  if (/row-level security/i.test(bruto)) return 'Seu perfil nao permite esta acao.';
  if (/proj_jur_arquivos_uq/.test(bruto)) return 'Este arquivo ja esta registrado neste documento e nesta remessa.';
  if (/proj_jur_documentos_processo_id_numero_sub_key/.test(bruto)) return 'Ja existe documento com este numero.';
  const m = bruto.match(/Message: `(?:ERROR:\s*)?([^`]+)`/) || bruto.match(/ERROR:\s*([^\n`]+)/);
  return (m ? m[1] : bruto).slice(0, 300);
}
const txt = (v: any, max: number): string | null => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const dataIso = (v: any): string | null => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return s;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  throw new BadRequestException('Data invalida (use dd/mm/aaaa).');
};

@Controller('projects-juridico')
@UseGuards(JwtAuthGuard, ProjEscopoGuard)
@SkipCompanyCheck()
export class JuridicoController {
  constructor(private readonly db: ProjDbService) {}

  private ids(...xs: string[]) {
    for (const x of xs) if (!UUID_RE.test(String(x || ''))) throw new NotFoundException('Registro nao encontrado.');
  }

  private async executar<T>(req: any, fn: (tx: any) => Promise<T>): Promise<T> {
    try { return await this.db.comoUsuario(req.user.id, fn); }
    catch (e: any) { if (e instanceof HttpException) throw e; throw new BadRequestException(erroJur(e)); }
  }

  private dirArquivos(): string {
    return process.env.PROJ_STORAGE_DIR || path.join(process.cwd(), 'storage', 'projetos');
  }

  // grava pelo hash (escrita atomica; o mesmo conteudo nunca e regravado nem sobrescrito)
  private guardar(buf: Buffer): { sha: string; chave: string } {
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const chave = 'juridico/' + sha;
    const destino = path.join(this.dirArquivos(), ...chave.split('/'));
    if (!fs.existsSync(destino)) {
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      const tmp = destino + '.tmp-' + process.pid + '-' + Date.now();
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, destino);
    }
    return { sha, chave };
  }

  private lerArquivo(chave: string, sha: string): Buffer {
    const caminho = path.join(this.dirArquivos(), ...chave.split('/'));
    if (!fs.existsSync(caminho)) throw new NotFoundException('Arquivo nao encontrado no armazenamento.');
    const buf = fs.readFileSync(caminho);
    if (crypto.createHash('sha256').update(buf).digest('hex') !== String(sha).trim()) {
      throw new ConflictException('Integridade violada: o arquivo armazenado difere do registrado.');
    }
    return buf;
  }

  private entregar(res: Response, buf: Buffer, sha: string, nome: string, mime: string | null, inline: boolean) {
    res.setHeader('Content-Type', mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nome)}`);
    res.setHeader('X-Documento-Sha256', String(sha).trim());
    res.setHeader('Access-Control-Expose-Headers', 'X-Documento-Sha256, Content-Disposition');
    res.send(buf);
  }

  private async processo(tx: any, projetoId: string, processoId: string) {
    const r: any[] = await tx.$queryRaw`
      SELECT id, codigo, numero FROM proj_jur_processos
      WHERE id = ${processoId}::uuid AND projeto_id = ${projetoId}::uuid AND cancelado_em IS NULL`;
    if (!r.length) throw new NotFoundException('Registro nao encontrado.');
    return r[0];
  }

  // ---------------------------------------------------------------- leitura (RLS: 'ver' ou 'revisar')
  @Get('projetos/:projetoId/processos')
  @ProjAcao('autenticado')
  async processos(@Param('projetoId') projetoId: string, @Req() req: any) {
    this.ids(projetoId);
    return this.executar(req, async (tx: any) => {
      const itens: any[] = await tx.$queryRaw`
        SELECT p.id, p.codigo, p.numero, p.tribunal, p.juizo, p.natureza,
               (SELECT count(*)::int FROM proj_jur_remessas r WHERE r.processo_id = p.id AND r.cancelado_em IS NULL) AS remessas,
               (SELECT count(*)::int FROM proj_jur_documentos d WHERE d.processo_id = p.id AND d.cancelado_em IS NULL) AS documentos,
               (SELECT count(*)::int FROM proj_jur_prazos z WHERE z.processo_id = p.id AND z.situacao = 'ABERTO') AS "prazosAbertos"
        FROM proj_jur_processos p
        WHERE p.projeto_id = ${projetoId}::uuid AND p.cancelado_em IS NULL ORDER BY p.codigo`;
      return { podeOperar: isMasterAdmin(req.user), itens };
    });
  }

  @Get('projetos/:projetoId/processos/:processoId')
  @ProjAcao('autenticado')
  async detalhe(@Param('projetoId') projetoId: string, @Param('processoId') processoId: string, @Req() req: any) {
    this.ids(projetoId, processoId);
    return this.executar(req, async (tx: any) => {
      const p: any[] = await tx.$queryRaw`
        SELECT id, codigo, numero, tribunal, juizo, natureza, partes, mandatarios, observacao
        FROM proj_jur_processos WHERE id = ${processoId}::uuid AND projeto_id = ${projetoId}::uuid AND cancelado_em IS NULL`;
      if (!p.length) throw new NotFoundException('Registro nao encontrado.');
      const remessas: any[] = await tx.$queryRaw`
        SELECT r.id, r.ordem, r.data_protocolo::text AS "dataProtocolo", r.ref_citius AS "refCitius", r.situacao, r.descricao,
               r.comprovativo_nome AS "comprovativoNome", trim(r.comprovativo_sha256) AS "comprovativoSha256",
               (SELECT count(*)::int FROM proj_jur_arquivos a WHERE a.remessa_id = r.id AND a.cancelado_em IS NULL) AS arquivos
        FROM proj_jur_remessas r WHERE r.processo_id = ${processoId}::uuid AND r.cancelado_em IS NULL ORDER BY r.ordem`;
      const documentos: any[] = await tx.$queryRaw`
        SELECT d.id, d.numero, d.sub, d.ordem::float AS ordem, d.titulo, d.situacao, d.situacao_motivo AS "situacaoMotivo",
               d.prazo::text AS prazo, d.observacao, d.atualizado_em AS "atualizadoEm"
        FROM proj_jur_documentos d WHERE d.processo_id = ${processoId}::uuid AND d.cancelado_em IS NULL ORDER BY d.ordem, d.numero, d.sub`;
      const arquivos: any[] = await tx.$queryRaw`
        SELECT a.id, a.documento_id AS "documentoId", a.remessa_id AS "remessaId", r.ordem AS "remessaOrdem",
               r.data_protocolo::text AS "remessaData", r.ref_citius AS "remessaRef", a.posicao_citius AS "posicaoCitius",
               a.versao, a.arquivo_nome AS "arquivoNome", a.nome_origem AS "nomeOrigem", a.mime, a.tamanho,
               trim(a.sha256) AS sha256, a.substitui_arquivo_id AS "substituiArquivoId", a.observacao,
               a.criado_em AS "criadoEm", a.cancelado_em AS "canceladoEm", a.motivo_cancelamento AS "motivoCancelamento"
        FROM proj_jur_arquivos a JOIN proj_jur_remessas r ON r.id = a.remessa_id
        JOIN proj_jur_documentos d ON d.id = a.documento_id
        WHERE d.processo_id = ${processoId}::uuid ORDER BY r.ordem, a.criado_em, a.versao`;
      const prazos: any[] = await tx.$queryRaw`
        SELECT z.id, z.descricao, z.data_limite::text AS "dataLimite", z.situacao, z.cumprido_remessa_id AS "cumpridoRemessaId",
               z.observacao, (z.data_limite - CURRENT_DATE)::int AS "diasRestantes"
        FROM proj_jur_prazos z WHERE z.processo_id = ${processoId}::uuid ORDER BY z.data_limite, z.descricao`;
      return {
        podeOperar: isMasterAdmin(req.user),
        processo: p[0], remessas, prazos,
        documentos: documentos.map((d) => ({ ...d, arquivos: arquivos.filter((a) => a.documentoId === d.id) })),
      };
    });
  }

  @Get('projetos/:projetoId/arquivos/:arquivoId')
  @ProjAcao('autenticado')
  async arquivo(@Param('projetoId') projetoId: string, @Param('arquivoId') arquivoId: string,
                @Query('inline') inline: string, @Req() req: any, @Res() res: Response) {
    this.ids(projetoId, arquivoId);
    const a: any = await this.executar(req, async (tx: any) => {
      const r: any[] = await tx.$queryRaw`
        SELECT a.id, a.arquivo_nome AS nome, a.mime, trim(a.sha256) AS sha256, a.chave_armazenamento AS chave, d.numero, d.sub
        FROM proj_jur_arquivos a JOIN proj_jur_documentos d ON d.id = a.documento_id
        JOIN proj_jur_processos p ON p.id = d.processo_id
        WHERE a.id = ${arquivoId}::uuid AND p.projeto_id = ${projetoId}::uuid`;
      if (!r.length) return null;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_JUR_ARQUIVO_ABERTO', targetId: arquivoId,
        after: { projetoId, documento: `${r[0].numero}${r[0].sub ? '.' + r[0].sub : ''}`, arquivo: r[0].nome, inline: inline === '1' } } });
      return r[0];
    });
    if (!a) throw new NotFoundException('Registro nao encontrado.');
    this.entregar(res, this.lerArquivo(a.chave, a.sha256), a.sha256, a.nome, a.mime, inline === '1');
  }

  @Get('projetos/:projetoId/remessas/:remessaId/comprovativo')
  @ProjAcao('autenticado')
  async comprovativo(@Param('projetoId') projetoId: string, @Param('remessaId') remessaId: string,
                     @Query('inline') inline: string, @Req() req: any, @Res() res: Response) {
    this.ids(projetoId, remessaId);
    const r: any = await this.executar(req, async (tx: any) => {
      const x: any[] = await tx.$queryRaw`
        SELECT r.comprovativo_nome AS nome, r.comprovativo_mime AS mime, trim(r.comprovativo_sha256) AS sha256, r.comprovativo_chave AS chave
        FROM proj_jur_remessas r JOIN proj_jur_processos p ON p.id = r.processo_id
        WHERE r.id = ${remessaId}::uuid AND p.projeto_id = ${projetoId}::uuid AND r.comprovativo_chave IS NOT NULL`;
      return x[0] || null;
    });
    if (!r) throw new NotFoundException('Comprovativo nao informado.');
    this.entregar(res, this.lerArquivo(r.chave, r.sha256), r.sha256, r.nome, r.mime, inline === '1');
  }

  // Dossie: zip com os arquivos protocolados por remessa, manifesto (SHA-256 de cada arquivo) e LEIA-ME.
  @Get('projetos/:projetoId/processos/:processoId/dossie')
  @ProjAcao('autenticado')
  async dossie(@Param('projetoId') projetoId: string, @Param('processoId') processoId: string, @Req() req: any, @Res() res: Response) {
    this.ids(projetoId, processoId);
    const d: any = await this.detalhe(projetoId, processoId, req);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JSZip = require('jszip');
    const zip = new JSZip();
    const geradoEm = new Date().toISOString();
    const limpa = (s: any) => String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90);
    const chaves: any = await this.executar(req, async (tx: any) => tx.$queryRaw`
      SELECT a.id, a.chave_armazenamento AS chave FROM proj_jur_arquivos a JOIN proj_jur_documentos d ON d.id = a.documento_id
      WHERE d.processo_id = ${processoId}::uuid AND a.cancelado_em IS NULL`);
    const chave: Record<string, string> = {};
    for (const c of chaves) chave[c.id] = c.chave;
    const itens: any[] = [];
    for (const doc of d.documentos) {
      for (const a of doc.arquivos.filter((x: any) => !x.canceladoEm)) {
        const pasta = `${String(a.remessaOrdem).padStart(2, '0')} - ${a.remessaData} - ${a.remessaRef || 'ref pendente'}`;
        const caminho = `${pasta}/${limpa(doc.numero + (doc.sub ? '.' + doc.sub : ''))} - ${limpa(a.arquivoNome)}`;
        const item: any = { caminho, documento: doc.numero + (doc.sub ? '.' + doc.sub : ''), situacaoDocumento: doc.situacao,
          posicaoCitius: a.posicaoCitius, sha256: a.sha256, situacao: 'OK' };
        try { zip.file(caminho, this.lerArquivo(chave[a.id], a.sha256)); }
        catch (e: any) { item.situacao = /Integridade/.test(String(e?.message)) ? 'INTEGRIDADE_VIOLADA' : 'ARQUIVO_AUSENTE'; }
        itens.push(item);
      }
    }
    const manifesto = { tipo: 'LEDGR - Dossie do processo (Juridico RM)', geradoEm, processo: d.processo,
      remessas: d.remessas, prazos: d.prazos, arquivos: itens };
    const json = JSON.stringify(manifesto, null, 2);
    const shaMan = crypto.createHash('sha256').update(json, 'utf8').digest('hex');
    const L = [`DOSSIE DO PROCESSO ${d.processo.numero}`, `Gerado em: ${geradoEm} (UTC)`, `SHA-256 do manifesto.json: ${shaMan}`, ''];
    for (const r of d.remessas) L.push(`Remessa ${r.ordem}: ${r.dataProtocolo} - ref. ${r.refCitius || 'pendente'} - ${r.descricao}`);
    L.push('');
    for (const i of itens) L.push(`[${i.situacao}] ${i.caminho}  sha256=${i.sha256}`);
    zip.file('manifesto.json', json);
    zip.file('manifesto.sha256', `${shaMan}  manifesto.json\n`);
    zip.file('manifesto.txt', L.join('\r\n'));
    zip.file('LEIA-ME.txt', [
      'COMO CONFERIR ESTE DOSSIE', '',
      '1. O SHA-256 de manifesto.json deve ser igual ao de manifesto.sha256.',
      '   Windows: Get-FileHash manifesto.json -Algorithm SHA256',
      '2. O SHA-256 de cada PDF deve ser igual ao informado em manifesto.txt; para os arquivos de 23/10/2026, igual ao',
      '   dos comprovativos do Citius (refs. 58007275 e 58008395).', '',
    ].join('\r\n'));
    const buf: Buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await this.executar(req, async (tx: any) => tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_JUR_DOSSIE_GERADO', targetId: processoId,
      after: { projetoId, manifestoSha256: shaMan, arquivos: itens.length, problemas: itens.filter((i) => i.situacao !== 'OK').length } } }));
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="dossie-${limpa(d.processo.codigo)}-${geradoEm.slice(0, 10)}.zip"`);
    res.setHeader('X-Manifesto-Sha256', shaMan);
    res.setHeader('Access-Control-Expose-Headers', 'X-Manifesto-Sha256, Content-Disposition');
    res.send(buf);
  }

  // ---------------------------------------------------------------- escrita (so Master)
  @Post('projetos/:projetoId/processos/:processoId/documentos')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async criarDocumento(@Param('projetoId') projetoId: string, @Param('processoId') processoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, processoId);
    const numero = txt(body?.numero, 30); const titulo = txt(body?.titulo, 300);
    const situacao = String(body?.situacao || 'JUNTO');
    if (!numero || !titulo) throw new BadRequestException('Informe numero e titulo.');
    if (!SIT_DOC.includes(situacao)) throw new BadRequestException('Situacao invalida.');
    const sub = txt(body?.sub, 10) || '';
    const ordem = Number(body?.ordem);
    if (!Number.isFinite(ordem)) throw new BadRequestException('Ordem invalida.');
    const prazo = dataIso(body?.prazo);
    return this.executar(req, async (tx: any) => {
      await this.processo(tx, projetoId, processoId);
      const r: any[] = await tx.$queryRaw`
        INSERT INTO proj_jur_documentos (processo_id, numero, sub, ordem, titulo, situacao, situacao_motivo, prazo, observacao, criado_por_id)
        VALUES (${processoId}::uuid, ${numero}::varchar, ${sub}::varchar, ${ordem}::numeric, ${titulo}::varchar, ${situacao}::varchar,
                ${txt(body?.motivo, 2000)}::text, ${prazo}::date, ${txt(body?.observacao, 4000)}::text, ${req.user.id}::uuid)
        RETURNING id`;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_JUR_DOCUMENTO_CRIADO', targetId: r[0].id,
        after: { projetoId, processoId, numero, sub, titulo, situacao } } });
      return { ok: true, id: r[0].id };
    });
  }

  @Post('projetos/:projetoId/documentos/:documentoId/situacao')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async situacaoDocumento(@Param('projetoId') projetoId: string, @Param('documentoId') documentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, documentoId);
    const situacao = String(body?.situacao || '');
    const motivo = txt(body?.motivo, 2000);
    if (!SIT_DOC.includes(situacao)) throw new BadRequestException('Situacao invalida.');
    if (!motivo || motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres).');
    const prazo = body?.prazo !== undefined ? dataIso(body.prazo) : undefined;
    return this.executar(req, async (tx: any) => {
      const ant: any[] = await tx.$queryRaw`
        SELECT d.situacao, d.prazo::text AS prazo FROM proj_jur_documentos d JOIN proj_jur_processos p ON p.id = d.processo_id
        WHERE d.id = ${documentoId}::uuid AND p.projeto_id = ${projetoId}::uuid AND d.cancelado_em IS NULL`;
      if (!ant.length) throw new NotFoundException('Registro nao encontrado.');
      if (prazo !== undefined) {
        await tx.$executeRaw`UPDATE proj_jur_documentos SET situacao = ${situacao}::varchar, situacao_motivo = ${motivo}::text, prazo = ${prazo}::date WHERE id = ${documentoId}::uuid`;
      } else {
        await tx.$executeRaw`UPDATE proj_jur_documentos SET situacao = ${situacao}::varchar, situacao_motivo = ${motivo}::text WHERE id = ${documentoId}::uuid`;
      }
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_JUR_DOCUMENTO_SITUACAO', targetId: documentoId,
        after: { projetoId, antes: ant[0], situacao, motivo, prazo } } });
      return { ok: true };
    });
  }

  @Post('projetos/:projetoId/documentos/:documentoId/arquivos')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  @UseInterceptors(UPLOAD)
  async enviarArquivo(@Param('projetoId') projetoId: string, @Param('documentoId') documentoId: string,
                      @UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, documentoId);
    if (!file || !file.buffer?.length) throw new BadRequestException('Arquivo nao enviado.');
    const remessaId = String(body?.remessaId || '');
    if (!UUID_RE.test(remessaId)) throw new BadRequestException('Informe a remessa.');
    const substitui = body?.substituiArquivoId ? String(body.substituiArquivoId) : null;
    if (substitui && !UUID_RE.test(substitui)) throw new BadRequestException('Arquivo substituido invalido.');
    const shaEsperado = txt(body?.sha256Esperado, 64);
    const nome = file.originalname.slice(0, 250);
    const mime = (file.mimetype || '').slice(0, 120) || null;
    return this.executar(req, async (tx: any) => {
      const ok: any[] = await tx.$queryRaw`
        SELECT d.id FROM proj_jur_documentos d JOIN proj_jur_processos p ON p.id = d.processo_id
        JOIN proj_jur_remessas r ON r.processo_id = p.id AND r.id = ${remessaId}::uuid AND r.cancelado_em IS NULL
        WHERE d.id = ${documentoId}::uuid AND p.projeto_id = ${projetoId}::uuid AND d.cancelado_em IS NULL`;
      if (!ok.length) throw new BadRequestException('Documento ou remessa nao pertence a este processo.');
      const g = this.guardar(file.buffer);
      if (shaEsperado && !g.sha.toLowerCase().startsWith(shaEsperado.toLowerCase())) {
        throw new ConflictException(`SHA-256 diferente do esperado (${shaEsperado}): ${g.sha}`);
      }
      const v: any[] = await tx.$queryRaw`
        SELECT COALESCE(max(versao), 0) + 1 AS n FROM proj_jur_arquivos WHERE documento_id = ${documentoId}::uuid`;
      const r: any[] = await tx.$queryRaw`
        INSERT INTO proj_jur_arquivos (documento_id, remessa_id, posicao_citius, versao, arquivo_nome, nome_origem, mime, tamanho, sha256,
                                       chave_armazenamento, substitui_arquivo_id, observacao, criado_por_id)
        VALUES (${documentoId}::uuid, ${remessaId}::uuid, ${txt(body?.posicaoCitius, 60)}::varchar, ${Number(v[0].n)}::int, ${nome}::varchar,
                ${txt(body?.nomeOrigem, 400)}::varchar, ${mime}::varchar, ${file.size}::int, ${g.sha}::text, ${g.chave}::varchar,
                ${substitui}::uuid, ${txt(body?.observacao, 4000)}::text, ${req.user.id}::uuid)
        RETURNING id, versao`;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_JUR_ARQUIVO_REGISTRADO', targetId: r[0].id,
        after: { projetoId, documentoId, remessaId, versao: r[0].versao, arquivo: nome, sha256: g.sha, tamanho: file.size } } });
      return { ok: true, id: r[0].id, versao: r[0].versao, sha256: g.sha };
    });
  }

  @Post('projetos/:projetoId/arquivos/:arquivoId/encerrar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async encerrarArquivo(@Param('projetoId') projetoId: string, @Param('arquivoId') arquivoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, arquivoId);
    const motivo = txt(body?.motivo, 2000);
    if (!motivo || motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo 10 caracteres).');
    return this.executar(req, async (tx: any) => {
      const n: number = await tx.$executeRaw`
        UPDATE proj_jur_arquivos a SET cancelado_em = clock_timestamp(), cancelado_por_id = ${req.user.id}::uuid, motivo_cancelamento = ${motivo}::text
        FROM proj_jur_documentos d, proj_jur_processos p
        WHERE a.id = ${arquivoId}::uuid AND d.id = a.documento_id AND p.id = d.processo_id AND p.projeto_id = ${projetoId}::uuid AND a.cancelado_em IS NULL`;
      if (!n) throw new NotFoundException('Arquivo nao encontrado ou ja encerrado.');
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_JUR_ARQUIVO_ENCERRADO', targetId: arquivoId, after: { projetoId, motivo } } });
      return { ok: true };
    });
  }

  @Post('projetos/:projetoId/remessas/:remessaId/referencia')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  @UseInterceptors(UPLOAD)
  async referenciaRemessa(@Param('projetoId') projetoId: string, @Param('remessaId') remessaId: string,
                          @UploadedFile() file: Express.Multer.File, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, remessaId);
    const ref = txt(body?.refCitius, 30);
    if (!ref && !file) throw new BadRequestException('Informe a referencia Citius ou o comprovativo.');
    if (ref && !/^\d{6,12}$/.test(ref)) throw new BadRequestException('Referencia Citius invalida (so numeros).');
    return this.executar(req, async (tx: any) => {
      const r: any[] = await tx.$queryRaw`
        SELECT r.id, r.ref_citius AS ref FROM proj_jur_remessas r JOIN proj_jur_processos p ON p.id = r.processo_id
        WHERE r.id = ${remessaId}::uuid AND p.projeto_id = ${projetoId}::uuid AND r.cancelado_em IS NULL`;
      if (!r.length) throw new NotFoundException('Registro nao encontrado.');
      if (ref) {
        await tx.$executeRaw`UPDATE proj_jur_remessas SET ref_citius = ${ref}::varchar, situacao = 'PROTOCOLADA' WHERE id = ${remessaId}::uuid`;
      }
      let sha: string | null = null;
      if (file?.buffer?.length) {
        const g = this.guardar(file.buffer); sha = g.sha;
        await tx.$executeRaw`
          UPDATE proj_jur_remessas SET comprovativo_nome = ${file.originalname.slice(0, 250)}::varchar, comprovativo_mime = ${(file.mimetype || '').slice(0, 120) || null}::varchar,
                 comprovativo_tamanho = ${file.size}::int, comprovativo_sha256 = ${g.sha}::text, comprovativo_chave = ${g.chave}::varchar
          WHERE id = ${remessaId}::uuid`;
      }
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_JUR_REMESSA_COMPLETADA', targetId: remessaId,
        after: { projetoId, refAnterior: r[0].ref, refCitius: ref, comprovativoSha256: sha } } });
      return { ok: true };
    });
  }

  @Post('projetos/:projetoId/prazos/:prazoId')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async atualizarPrazo(@Param('projetoId') projetoId: string, @Param('prazoId') prazoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, prazoId);
    const situacao = String(body?.situacao || '');
    if (!SIT_PRAZO.includes(situacao)) throw new BadRequestException('Situacao invalida.');
    const remessaId = body?.remessaId ? String(body.remessaId) : null;
    if (remessaId && !UUID_RE.test(remessaId)) throw new BadRequestException('Remessa invalida.');
    const obs = txt(body?.observacao, 4000);
    return this.executar(req, async (tx: any) => {
      const n: number = await tx.$executeRaw`
        UPDATE proj_jur_prazos z SET situacao = ${situacao}::varchar, cumprido_remessa_id = ${remessaId}::uuid,
               observacao = COALESCE(${obs}::text, z.observacao), atualizado_em = clock_timestamp()
        FROM proj_jur_processos p WHERE z.id = ${prazoId}::uuid AND p.id = z.processo_id AND p.projeto_id = ${projetoId}::uuid`;
      if (!n) throw new NotFoundException('Registro nao encontrado.');
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_JUR_PRAZO_ATUALIZADO', targetId: prazoId,
        after: { projetoId, situacao, remessaId, observacao: obs } } });
      return { ok: true };
    });
  }
}
