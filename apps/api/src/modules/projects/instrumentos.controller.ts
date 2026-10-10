// apps/api/src/modules/projects/instrumentos.controller.ts
// Instrumentos do plano (10/10/2026): contratos, termos e aditivos com ciclo de vida, versoes por SHA-256 e trilha
// de eventos encadeada por hash (gravada pelo banco, nao pela API). Master opera; perfil REVISOR (acao 'revisar')
// le, comenta e - na Etapa 2 - envia versoes revisadas com o instrumento Em revisao.
import { Controller, Get, Post, Param, Body, Req, UseGuards, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';
import { SkipCompanyCheck, isMasterAdmin } from '../../multi-company/company.interceptor';
import { ProjEscopoGuard, ProjAcao } from './proj-escopo.guard';
import { UUID_RE } from './concessoes.service';
import { ProjDbService } from './proj-db.service';

const SITUACOES = ['RASCUNHO', 'EM_REVISAO', 'APROVADO', 'EM_ASSINATURA', 'ASSINADO', 'REGISTRADO', 'VIGENTE', 'SUBSTITUIDO', 'ENCERRADO'];

function erroInstr(e: any): string {
  const bruto = String(e?.meta?.message || e?.message || 'Falha ao gravar.');
  if (/row-level security/i.test(bruto)) return 'Seu perfil nao permite esta acao.';
  const m = bruto.match(/ERROR:\s*([^\n`]+)/);
  return (m ? m[1] : bruto).slice(0, 300);
}

@Controller('projects-instrumentos')
@UseGuards(JwtAuthGuard, ProjEscopoGuard)
@SkipCompanyCheck()
export class InstrumentosController {
  constructor(private readonly db: ProjDbService) {}

  private ids(...xs: string[]) {
    for (const x of xs) if (!UUID_RE.test(String(x || ''))) throw new NotFoundException('Registro nao encontrado.');
  }

  @Get('projetos/:projetoId/instrumentos')
  @ProjAcao('revisar')
  async listar(@Param('projetoId') projetoId: string, @Req() req: any) {
    this.ids(projetoId);
    return this.db.comoUsuario(req.user.id, async (tx: any) => {
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
    return this.db.comoUsuario(req.user.id, async (tx: any) => {
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
    const motivo = String(body?.motivo || '').trim() || null;
    const versaoId = body?.versaoAprovadaId ? String(body.versaoAprovadaId) : null;
    const substitutoId = body?.substitutoId ? String(body.substitutoId) : null;
    if (versaoId && !UUID_RE.test(versaoId)) throw new BadRequestException('Versao invalida.');
    if (substitutoId && !UUID_RE.test(substitutoId)) throw new BadRequestException('Instrumento substituto invalido.');
    let r: any[] = [];
    try {
      r = await this.db.comoUsuario(req.user.id, async (tx: any) => {
        const x: any[] = await tx.$queryRaw`
          UPDATE proj_instrumentos SET situacao = ${para}::varchar, motivo_ultima_transicao = ${motivo}::text,
            versao_aprovada_id = CASE WHEN ${para}::varchar = 'APROVADO' AND situacao = 'EM_REVISAO' THEN ${versaoId}::uuid ELSE versao_aprovada_id END,
            substituido_por_id = CASE WHEN ${para}::varchar = 'SUBSTITUIDO' THEN ${substitutoId}::uuid ELSE substituido_por_id END
          WHERE id = ${instrumentoId}::uuid AND projeto_id = ${projetoId}::uuid AND situacao <> ${para}::varchar
          RETURNING id, situacao`;
        if (x.length) await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_SITUACAO', targetId: instrumentoId,
          after: { projetoId, para, motivo, versaoId, substitutoId } } });
        return x;
      });
    } catch (e: any) { throw new BadRequestException(erroInstr(e)); }
    if (!r.length) throw new NotFoundException('Instrumento nao encontrado ou ja nesta situacao.');
    return { ok: true, situacao: r[0].situacao };
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/comentar')
  @ProjAcao('revisar')
  async comentar(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const texto = String(body?.texto || '').trim();
    if (texto.length < 3 || texto.length > 4000) throw new BadRequestException('Comentario deve ter de 3 a 4000 caracteres.');
    let r: any[] = [];
    try {
      r = await this.db.comoUsuario(req.user.id, async (tx: any) => tx.$queryRaw`
        INSERT INTO proj_instrumento_eventos (projeto_id, instrumento_id, seq, tipo, detalhe, criado_em, hash_anterior, hash)
        SELECT i.projeto_id, i.id, 1, 'COMENTARIO', jsonb_build_object('texto', ${texto}::text), NULL, NULL, NULL
        FROM proj_instrumentos i WHERE i.id = ${instrumentoId}::uuid AND i.projeto_id = ${projetoId}::uuid
          AND i.situacao NOT IN ('SUBSTITUIDO', 'ENCERRADO')
        RETURNING seq`);
    } catch (e: any) { throw new BadRequestException(erroInstr(e)); }
    if (!r.length) throw new NotFoundException('Instrumento nao encontrado ou encerrado.');
    return { ok: true, seq: r[0].seq };
  }
}
