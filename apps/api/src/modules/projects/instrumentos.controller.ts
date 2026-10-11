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
import { ModuleRef } from '@nestjs/core';
import { RelatoriosController } from './relatorios.controller';
import { ClicksignService } from '../signatures/clicksign.service';
import { ClicksignV3Service } from '../signatures/clicksign-v3.service';
import { SignatureValidatorService } from '../signatures/signature-validator.service';

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
// Instrumentos usam a ClickSign API 3.0 por padrao; CLICKSIGN_INSTRUMENTOS_API=v1 volta para a 1.9 (legada).
const USA_V3 = () => (process.env.CLICKSIGN_INSTRUMENTOS_API || 'v3').toLowerCase() !== 'v1';
const UPLOAD = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function erroInstr(e: any): string {
  const bruto = String(e?.meta?.message || e?.message || 'Falha ao gravar.');
  if (/row-level security/i.test(bruto)) return 'Seu perfil nao permite esta acao.';
  if (/proj_instr_dep_ativa_uq/.test(bruto)) return 'Esta dependencia ja existe.';
  const m = bruto.match(/Message: `(?:ERROR:\s*)?([^`]+)`/) || bruto.match(/ERROR:\s*([^\n`]+)/);
  return (m ? m[1] : bruto).slice(0, 300);
}
const txt = (v: any, max: number): string | null => { const s = String(v ?? '').trim(); return s ? s.slice(0, max) : null; };
const extensao = (nome: string) => (String(nome || '').split('.').pop() || '').toLowerCase();

@Controller('projects-instrumentos')
@UseGuards(JwtAuthGuard, ProjEscopoGuard)
@SkipCompanyCheck()
export class InstrumentosController {
  constructor(
    private readonly db: ProjDbService,
    private readonly clicksign: ClicksignService,
    private readonly clicksign3: ClicksignV3Service,
    private readonly validador: SignatureValidatorService,
    private readonly moduleRef: ModuleRef,
  ) {}

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

  private lerArquivo(chave: string, sha: string): Buffer {
    const caminho = path.join(this.dirArquivos(), ...chave.split('/'));
    if (!fs.existsSync(caminho)) throw new NotFoundException('Arquivo nao encontrado no armazenamento.');
    const buf = fs.readFileSync(caminho);
    if (crypto.createHash('sha256').update(buf).digest('hex') !== String(sha).trim()) {
      throw new ConflictException('Integridade violada: o arquivo armazenado difere do registrado.');
    }
    return buf;
  }

  // Validacao heuristica do validador do LEDGR: identifica signatarios e emissoras pelo nome;
  // nao verifica a cadeia de confianca nem a integridade criptografica (registrado no proprio resultado).
  private async validarESalvar(tx: any, instrumentoId: string, versaoId: string, buf: Buffer, sha: string) {
    let r: any;
    try { r = await this.validador.validateSignedPdf(buf); }
    catch (e: any) { r = { valid: false, signatures: [], errors: [String(e?.message || e)] }; }
    const resumo = {
      valido: !!r.valid,
      assinaturas: (r.signatures || []).map((s: any) => ({
        nome: s.signerName, documento: s.signerCpf || null, emissor: s.issuer, tipo: s.certificateType,
        confianca: s.trustLevel, validoDe: s.validFrom, validoAte: s.validTo,
      })),
      erros: r.errors || [],
      metodo: 'Heuristico: identifica o emissor pelo nome; nao verifica a cadeia de confianca nem a integridade criptografica. Confirmar no validador oficial (ITI/AMA).',
    };
    await tx.$queryRaw`
      INSERT INTO proj_instrumento_validacoes (instrumento_id, versao_id, valido, qtd_assinaturas, sha256, resultado)
      VALUES (${instrumentoId}::uuid, ${versaoId}::uuid, ${resumo.valido}, ${resumo.assinaturas.length}::int, ${sha}::text, ${JSON.stringify(resumo)}::jsonb)
      RETURNING id`;
    return resumo;
  }

  // Pede a ClickSign que envie (ou reenvie) o e-mail a cada signatario que ainda nao assinou.
  private async notificarPendentes(docKey: string, mensagem: string): Promise<{ enviados: string[]; falhas: string[] }> {
    const enviados: string[] = [];
    const falhas: string[] = [];
    let st: any;
    try { st = await this.clicksign.getDocumentStatus(docKey); }
    catch (e: any) { return { enviados, falhas: ['consulta: ' + String(e?.message || e).slice(0, 150)] }; }
    for (const s of st?.document?.signers || []) {
      if (s?.signature || !s?.request_signature_key) continue;
      try { await this.clicksign.notifySigner(s.request_signature_key, mensagem); enviados.push(String(s.email)); }
      catch (e: any) { falhas.push(String(s.email) + ': ' + String(e?.message || e).slice(0, 150)); }
    }
    return { enviados, falhas };
  }

  // ---------------------------------------------------------------- Etapa 4a: fontes de valor do LEDGR
  // Reaproveita o calculo da tela Anexo V (PEPS, data de corte, reconciliacao): os numeros dos instrumentos batem com os relatorios.
  private async calcularFontes(projetoId: string, req: any): Promise<any[]> {
    const rel = this.moduleRef.get(RelatoriosController, { strict: false });
    const av: any = await rel.anexoV(projetoId, '', req);
    const base: any = await this.executar(req, async (tx: any) => {
      const cred: any[] = await tx.$queryRaw`
        SELECT c.id, c.numero_ordem AS n, c.valor::text AS valor, c.data_credito::text AS data
        FROM proj_creditos c JOIN proj_operacoes o ON o.id = c.operacao_id
        WHERE o.projeto_id = ${projetoId}::uuid AND o.codigo = 'ANCORA' AND o.cancelado_em IS NULL AND c.cancelado_em IS NULL
        ORDER BY c.data_credito, c.numero_ordem`;
      const itens: any[] = await tx.$queryRaw`
        SELECT i.id, i.ordem, i.valor_face::text AS valor FROM proj_anexo_v_itens i JOIN proj_operacoes o ON o.id = i.operacao_id
        WHERE o.projeto_id = ${projetoId}::uuid ORDER BY i.ordem`;
      return { cred, itens };
    });
    const cent = (v: any) => Math.round(Number(v || 0) * 100);
    const reais = (c: number) => Math.round(c) / 100;
    const contrato = String(av.contrato || '2025-10-31');
    const apl: any[] = av.aplicacoes || [];
    const conf = apl.filter((a: any) => a.situacao === 'CONFIRMADO' && !a.fora && a.itemId);
    const antesNao = conf.filter((a: any) => String(a.data) <= contrato && (a.consta || 'Não') === 'Não');
    const pos = conf.filter((a: any) => String(a.data) > contrato);
    const posF5 = pos.filter((a: any) => cent(a.ancora) > 0);
    const naoConf = apl.filter((a: any) => a.situacao !== 'CONFIRMADO').length;
    const aviso = naoConf ? `${naoConf} aplicacao(oes) ainda sugerida(s) ou pendente(s) no Anexo V ficaram de fora` : null;
    return [
      { codigo: 'ANEXO_I_CREDITOS', origem: 'ANEXO_I', rotulo: 'Créditos vigentes da Operação Âncora (aportes reconhecidos à VAL)',
        criterio: 'Soma dos creditos nao cancelados da operacao ANCORA', qtd: base.cred.length, aviso: null,
        valor: reais(base.cred.reduce((s: number, x: any) => s + cent(x.valor), 0)),
        ref: { creditos: base.cred.map((x: any) => x.id), numeros: base.cred.map((x: any) => x.n), ultimaData: base.cred.length ? base.cred[base.cred.length - 1].data : null } },
      { codigo: 'ANEXO_V_FACE', origem: 'ANEXO_V', rotulo: 'Valor de face do Anexo V (confissão de 31/10/2025)',
        criterio: 'Soma do valor de face dos itens do Anexo V', qtd: base.itens.length, aviso: null,
        valor: reais(base.itens.reduce((s: number, x: any) => s + cent(x.valor), 0)), ref: { itens: base.itens.map((x: any) => x.id) } },
      { codigo: 'ANEXO_V_ANTES_NAO', origem: 'ANEXO_V', rotulo: 'Pagamentos até 31/10/2025 fora da reconciliação (crédito da F5 sobre a Sunrise)',
        criterio: 'Aplicacoes confirmadas no Anexo V ate 31/10/2025 com Consta da reconciliacao = Nao', qtd: antesNao.length, aviso,
        valor: reais(antesNao.reduce((s: number, a: any) => s + cent(a.valor), 0)), ref: { aplicacoes: antesNao.map((a: any) => a.id), corte: contrato } },
      { codigo: 'ANEXO_V_POS_F5', origem: 'ANEXO_V', rotulo: 'Pagamentos do Anexo V após 31/10/2025 com recursos da VAL via F5 (parte desembolsada)',
        criterio: 'Parcela de origem VAL (PEPS) das aplicacoes confirmadas no Anexo V apos 31/10/2025', qtd: posF5.length, aviso,
        valor: reais(posF5.reduce((s: number, a: any) => s + cent(a.ancora), 0)), ref: { aplicacoes: posF5.map((a: any) => a.id), corte: contrato } },
      { codigo: 'ANEXO_V_POS_TOTAL', origem: 'ANEXO_V', rotulo: 'Pagamentos do Anexo V após 31/10/2025 (todas as origens)',
        criterio: 'Total das aplicacoes confirmadas no Anexo V apos 31/10/2025', qtd: pos.length, aviso,
        valor: reais(pos.reduce((s: number, a: any) => s + cent(a.valor), 0)), ref: { aplicacoes: pos.map((a: any) => a.id), corte: contrato } },
    ];
  }

  // ---------------------------------------------------------------- Etapa 4b: dados completos de um instrumento (dossie)
  private async coletar(tx: any, instrumentoId: string) {
    const inst: any[] = await tx.$queryRaw`
      SELECT i.id, i.codigo, i.ordem, i.titulo, i.item_planilha AS "itemPlanilha", i.tipo, i.lei, i.requer_assinatura AS "requerAssinatura",
             i.requer_registro AS "requerRegistro", i.orgao_registro_previsto AS "orgaoRegistro", i.situacao, i.situacao_em AS "situacaoEm",
             i.versao_aprovada_id AS "versaoAprovadaId", i.substituido_por_id AS "substituidoPorId", proj_instr_pendencias(i.id) AS pendencias
      FROM proj_instrumentos i WHERE i.id = ${instrumentoId}::uuid`;
    const versoes = await tx.$queryRaw`
      SELECT v.id, v.numero, v.tipo, v.arquivo_nome AS "arquivoNome", v.tamanho, trim(v.sha256) AS sha256, v.chave_armazenamento AS chave,
             v.comentario, v.criado_em AS "criadoEm", u.email AS "criadoPor", v.cancelado_em AS "canceladoEm", v.motivo_cancelamento AS "motivoCancelamento"
      FROM proj_instrumento_versoes v LEFT JOIN users u ON u.id = v.criado_por_id WHERE v.instrumento_id = ${instrumentoId}::uuid ORDER BY v.numero`;
    const partes = await tx.$queryRaw`
      SELECT nome, papel, documento, jurisdicao, forma_assinatura AS "formaAssinatura", cancelado_em AS "canceladoEm"
      FROM proj_instrumento_partes WHERE instrumento_id = ${instrumentoId}::uuid ORDER BY ordem`;
    const dependencias = await tx.$queryRaw`
      SELECT d2.codigo, d.exige_situacao AS "exigeSituacao", d2.situacao, d.justificativa
      FROM proj_instrumento_dependencias d JOIN proj_instrumentos d2 ON d2.id = d.depende_de_id
      WHERE d.instrumento_id = ${instrumentoId}::uuid AND d.cancelado_em IS NULL ORDER BY d2.ordem`;
    const registros = await tx.$queryRaw`
      SELECT r.id, r.orgao, r.protocolo, r.data_registro::text AS "dataRegistro", r.arquivo_nome AS "arquivoNome", trim(r.sha256) AS sha256,
             r.chave_armazenamento AS chave, r.observacao, r.cancelado_em AS "canceladoEm"
      FROM proj_instrumento_registros r WHERE r.instrumento_id = ${instrumentoId}::uuid ORDER BY r.criado_em`;
    const valores = await tx.$queryRaw`
      SELECT rotulo, marcador, valor::text AS valor, moeda, origem, origem_ref AS "origemRef", apurado_em AS "apuradoEm",
             congelado_em AS "congeladoEm", congelado_versao_id AS "congeladoVersaoId", cancelado_em AS "canceladoEm"
      FROM proj_instrumento_valores WHERE instrumento_id = ${instrumentoId}::uuid ORDER BY criado_em`;
    const envios = await tx.$queryRaw`
      SELECT e.canal, e.chave_externa AS chave, e.situacao, e.criado_em AS "criadoEm", e.concluido_em AS "concluidoEm", e.motivo_cancelamento AS "motivoCancelamento",
             COALESCE((SELECT jsonb_agg(jsonb_build_object('parte', p.nome, 'signatario', a.evidencia->>'signatario', 'email', a.email,
                        'situacao', a.situacao, 'assinadoEm', (a.assinado_em AT TIME ZONE 'UTC')) ORDER BY a.ordem)
                       FROM proj_instrumento_assinaturas a JOIN proj_instrumento_partes p ON p.id = a.parte_id WHERE a.envio_id = e.id), '[]'::jsonb) AS assinaturas
      FROM proj_instrumento_envios e WHERE e.instrumento_id = ${instrumentoId}::uuid ORDER BY e.criado_em`;
    const validacoes = await tx.$queryRaw`
      SELECT v.numero AS "versaoNumero", x.valido, x.qtd_assinaturas AS qtd, trim(x.sha256) AS sha256, x.resultado, x.criado_em AS "criadoEm"
      FROM proj_instrumento_validacoes x JOIN proj_instrumento_versoes v ON v.id = x.versao_id
      WHERE x.instrumento_id = ${instrumentoId}::uuid ORDER BY x.criado_em`;
    const eventos = await tx.$queryRaw`
      SELECT e.seq, e.tipo, e.de_situacao AS de, e.para_situacao AS para, e.ref_id AS "refId", e.detalhe, e.detalhe::text AS "detalheTexto",
             e.motivo, to_char(e.criado_em, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS "criadoEmTxt", e.criado_por_id AS "criadoPorId", u.email AS por,
             e.hash_anterior AS "hashAnterior", e.hash
      FROM proj_instrumento_eventos e LEFT JOIN users u ON u.id = e.criado_por_id
      WHERE e.instrumento_id = ${instrumentoId}::uuid ORDER BY e.seq`;
    const ver: any[] = await tx.$queryRaw`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT ev_ok)::int AS falhas FROM proj_instrumento_verificar(${instrumentoId}::uuid)`;
    return { instrumento: inst[0], versoes, partes, dependencias, registros, valores, envios, validacoes, eventos,
             trilha: { eventos: ver[0]?.total ?? 0, integra: (ver[0]?.falhas ?? 1) === 0 } };
  }

  private async envioAtivo(tx: any, instrumentoId: string) {
    const r: any[] = await tx.$queryRaw`
      SELECT e.id, e.chave_externa AS chave, e.versao_id AS "versaoId", i.codigo, e.canal, e.documento_externo AS "documentoExterno"
      FROM proj_instrumento_envios e JOIN proj_instrumentos i ON i.id = e.instrumento_id
      WHERE e.instrumento_id = ${instrumentoId}::uuid AND e.situacao = 'ENVIADO'`;
    return r[0] || null;
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

  @Get('projetos/:projetoId/instrumentos-fontes')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async fontesValores(@Param('projetoId') projetoId: string, @Req() req: any) {
    this.ids(projetoId);
    const fontes = await this.calcularFontes(projetoId, req);
    return fontes.map(({ ref, ...x }: any) => x);
  }

  @Get('projetos/:projetoId/dossie')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async dossie(@Param('projetoId') projetoId: string, @Req() req: any, @Res() res: Response) {
    this.ids(projetoId);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const JSZip = require('jszip');
    const zip = new JSZip();
    const geradoEm = new Date().toISOString();
    const dados: any = await this.executar(req, async (tx: any) => {
      const p: any[] = await tx.$queryRaw`SELECT id, codigo, nome FROM proj_projetos WHERE id = ${projetoId}::uuid`;
      if (!p.length) throw new NotFoundException('Registro nao encontrado.');
      const ids: any[] = await tx.$queryRaw`SELECT id FROM proj_instrumentos WHERE projeto_id = ${projetoId}::uuid ORDER BY ordem, codigo`;
      const lista: any[] = [];
      for (const r of ids) lista.push(await this.coletar(tx, String(r.id)));
      const u: any[] = await tx.$queryRaw`SELECT email FROM users WHERE id = ${req.user.id}::uuid`;
      return { projeto: p[0], instrumentos: lista, por: u[0]?.email || req.user.id };
    });
    const todos: any[] = [];
    const limpa = (s: any) => String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
    const incluir = (caminho: string, chave: string | null, sha: string | null, papel: string) => {
      const item: any = { caminho, papel, sha256: sha ? String(sha).trim() : null, situacao: 'OK' };
      if (!chave || !sha) item.situacao = 'SEM_ARQUIVO';
      else {
        try { const buf = this.lerArquivo(chave, sha); zip.file(caminho, buf); item.tamanho = buf.length; }
        catch (e: any) { item.situacao = /Integridade/.test(String(e?.message)) ? 'INTEGRIDADE_VIOLADA' : 'ARQUIVO_AUSENTE'; }
      }
      todos.push(item);
      return item;
    };
    const insts = dados.instrumentos.map((d: any) => {
      const pasta = `${d.instrumento.codigo} - ${limpa(d.instrumento.titulo)}`;
      const arquivos: any[] = [];
      const aprov = d.versoes.find((v: any) => v.id === d.instrumento.versaoAprovadaId);
      if (aprov) arquivos.push(incluir(`${pasta}/aprovada v${aprov.numero} - ${limpa(aprov.arquivoNome)}`, aprov.chave, aprov.sha256, 'VERSAO_APROVADA'));
      for (const v of d.versoes.filter((x: any) => x.tipo === 'ASSINADA' && !x.canceladoEm)) {
        arquivos.push(incluir(`${pasta}/assinada v${v.numero} - ${limpa(v.arquivoNome)}`, v.chave, v.sha256, 'VERSAO_ASSINADA'));
      }
      for (const r of d.registros.filter((x: any) => !x.canceladoEm && x.chave)) {
        arquivos.push(incluir(`${pasta}/registro - ${limpa(r.orgao)} - ${limpa(r.arquivoNome)}`, r.chave, r.sha256, 'COMPROVANTE_REGISTRO'));
      }
      const trilha = d.eventos.map((e: any) => `#${e.seq} ${e.criadoEmTxt} UTC ${e.tipo}${e.de || e.para ? ` ${e.de || '-'} -> ${e.para || '-'}` : ''}`
        + `${e.motivo ? ` | motivo: ${e.motivo}` : ''} | por ${e.por || e.criadoPorId || '-'} | hash ${e.hash}`).join('\r\n');
      zip.file(`${pasta}/trilha.txt`, trilha + '\r\n');
      return { ...d, versoes: d.versoes.map(({ chave, ...v }: any) => v), registros: d.registros.map(({ chave, ...r }: any) => r), arquivos };
    });
    const manifesto = {
      tipo: 'LEDGR - Dossie de auditoria dos instrumentos do plano', geradoEm, geradoPor: dados.por, projeto: dados.projeto,
      formulaHashTrilha: "hash = sha256(UTF-8 de concat_ws('|', instrumento_id, seq, tipo, de_situacao ou '', para_situacao ou '', ref_id ou '', detalheTexto ou '', motivo ou '', criadoEmTxt, criado_por_id ou '', hash_anterior)); o primeiro evento usa 64 zeros como hash_anterior",
      instrumentos: insts,
    };
    const json = JSON.stringify(manifesto, null, 2);
    const shaMan = crypto.createHash('sha256').update(json, 'utf8').digest('hex');
    const L: string[] = ['DOSSIE DE AUDITORIA - INSTRUMENTOS DO PLANO', `Projeto: ${dados.projeto.codigo} - ${dados.projeto.nome}`,
      `Gerado em: ${geradoEm} (UTC) por ${dados.por}`, `SHA-256 do manifesto.json: ${shaMan}`, ''];
    for (const d of insts) {
      L.push(`${d.instrumento.codigo} - ${d.instrumento.titulo}`);
      L.push(`  Situacao: ${d.instrumento.situacao} | Trilha: ${d.trilha.integra ? 'integra' : 'VIOLADA'} (${d.trilha.eventos} eventos)`);
      for (const v of d.valores.filter((x: any) => !x.canceladoEm)) L.push(`  Valor: ${v.rotulo} = ${v.moeda} ${v.valor}${v.congeladoEm ? ' (congelado na aprovacao)' : ''}`);
      for (const e of d.envios) L.push(`  Assinatura ${e.canal} ${e.chave}: ${e.situacao}`);
      for (const a of d.arquivos) L.push(`  Arquivo [${a.situacao}] ${a.caminho}  sha256=${a.sha256 || '-'}`);
      L.push('');
    }
    const leiame = [
      'COMO CONFERIR ESTE DOSSIE',
      '',
      '1. Integridade do manifesto: o SHA-256 de manifesto.json deve ser igual ao de manifesto.sha256 e ao registrado no LEDGR.',
      '   Windows: Get-FileHash manifesto.json -Algorithm SHA256   (ou: certutil -hashfile manifesto.json SHA256)',
      '2. Integridade dos arquivos: o SHA-256 de cada arquivo deve ser igual ao informado em manifesto.txt / manifesto.json.',
      '3. Trilha de cada instrumento: cada evento traz hash e hash_anterior. Recalcule com a formula em formulaHashTrilha',
      '   (manifesto.json) usando os campos do proprio evento; o hash_anterior de cada evento e o hash do evento anterior.',
      '   Qualquer alteracao em um evento muda o hash dele e quebra a corrente a partir dali.',
      '4. Validacoes de assinatura: o validador do LEDGR identifica signatarios e emissoras pelo certificado, mas nao verifica',
      '   a cadeia de confianca nem a integridade criptografica. Confirme os PDFs assinados no validador oficial',
      '   (ITI - validar.iti.gov.br no Brasil; AMA em Portugal). Em PDFs da ClickSign, o certificado ICP e o selo da plataforma;',
      '   quem assinou consta do log anexado ao PDF.',
      '',
    ].join('\r\n');
    zip.file('manifesto.json', json);
    zip.file('manifesto.sha256', `${shaMan}  manifesto.json\n`);
    zip.file('manifesto.txt', L.join('\r\n'));
    zip.file('LEIA-ME.txt', leiame);
    const buf: Buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const shaZip = crypto.createHash('sha256').update(buf).digest('hex');
    await this.executar(req, async (tx: any) => tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_DOSSIE_GERADO', targetId: projetoId,
      after: { manifestoSha256: shaMan, zipSha256: shaZip, instrumentos: insts.length, arquivos: todos.length,
               problemas: todos.filter((a) => a.situacao === 'ARQUIVO_AUSENTE' || a.situacao === 'INTEGRIDADE_VIOLADA').length } } }));
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="dossie-instrumentos-${geradoEm.slice(0, 10)}.zip"`);
    res.setHeader('X-Manifesto-Sha256', shaMan);
    res.setHeader('Access-Control-Expose-Headers', 'X-Manifesto-Sha256, Content-Disposition');
    res.send(buf);
  }

  // Etapa 2b: cabecalho minimo do projeto para quem tem a acao 'revisar' (o Revisor nao tem 'ver').
  @Get('projetos/:projetoId/acesso')
  @ProjAcao('revisar')
  async acesso(@Param('projetoId') projetoId: string, @Req() req: any) {
    this.ids(projetoId);
    return this.executar(req, async (tx: any) => {
      const p: any[] = await tx.$queryRaw`SELECT id, codigo, nome FROM proj_projetos WHERE id = ${projetoId}::uuid AND cancelado_em IS NULL`;
      if (!p.length) throw new NotFoundException('Registro nao encontrado.');
      return { projeto: p[0], revisor: true, podeOperar: isMasterAdmin(req.user) };
    });
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
      const envios = await tx.$queryRaw`
        SELECT e.id, e.canal, e.chave_externa AS chave, e.situacao, e.prazo, e.criado_em AS "criadoEm", e.concluido_em AS "concluidoEm",
               e.ultima_consulta_em AS "ultimaConsulta", e.ultima_resposta->>'status' AS "statusExterno",
               e.cancelado_em AS "canceladoEm", e.motivo_cancelamento AS "motivoCancelamento", v.numero AS "versaoNumero",
               COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'nome', p.nome, 'email', a.email, 'signatario', a.evidencia->>'signatario', 'situacao', a.situacao,
                          'assinadoEm', (a.assinado_em AT TIME ZONE 'UTC')) ORDER BY a.ordem)
                         FROM proj_instrumento_assinaturas a JOIN proj_instrumento_partes p ON p.id = a.parte_id
                         WHERE a.envio_id = e.id), '[]'::jsonb) AS assinaturas
        FROM proj_instrumento_envios e JOIN proj_instrumento_versoes v ON v.id = e.versao_id
        WHERE e.instrumento_id = ${instrumentoId}::uuid ORDER BY e.criado_em DESC`;
      const validacoes = await tx.$queryRaw`
        SELECT x.id, x.versao_id AS "versaoId", v.numero AS "versaoNumero", x.valido, x.qtd_assinaturas AS qtd, x.sha256,
               x.resultado, x.criado_em AS "criadoEm"
        FROM proj_instrumento_validacoes x JOIN proj_instrumento_versoes v ON v.id = x.versao_id
        WHERE x.instrumento_id = ${instrumentoId}::uuid ORDER BY x.criado_em DESC`;
      const ver: any[] = await tx.$queryRaw`
        SELECT count(*)::int AS total, count(*) FILTER (WHERE NOT ev_ok)::int AS falhas
        FROM proj_instrumento_verificar(${instrumentoId}::uuid)`;
      return {
        podeOperar: isMasterAdmin(req.user),
        instrumento: inst[0], versoes, partes, dependencias, dependentes, registros, valores, eventos, envios, validacoes,
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
      const validacao = tipo === 'ASSINADA' ? await this.validarESalvar(tx, instrumentoId, v[0].id, file.buffer, g.sha) : null;
      return { ok: true, id: v[0].id, numero: v[0].numero, sha256: g.sha, validacao };
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
    if (body?.fonte) {
      const fontes = await this.calcularFontes(projetoId, req);
      const fo = fontes.find((x: any) => x.codigo === String(body.fonte));
      if (!fo) throw new BadRequestException('Fonte de valor desconhecida.');
      const rot = txt(body?.rotulo, 160) || String(fo.rotulo).slice(0, 160);
      const marc = txt(body?.marcador, 80);
      const refF = JSON.stringify({ fonte: fo.codigo, criterio: fo.criterio, qtd: fo.qtd, aviso: fo.aviso, calculadoEm: new Date().toISOString(), ...fo.ref });
      return this.executar(req, async (tx: any) => {
        await this.instrumento(tx, projetoId, instrumentoId);
        const r: any[] = await tx.$queryRaw`
          INSERT INTO proj_instrumento_valores (instrumento_id, rotulo, marcador, valor, moeda, origem, origem_ref, criado_por_id)
          VALUES (${instrumentoId}::uuid, ${rot}::varchar, ${marc}::varchar, ${fo.valor}::numeric, 'BRL', ${fo.origem}::varchar, ${refF}::jsonb, ${req.user.id}::uuid)
          RETURNING id`;
        return { ok: true, id: r[0].id, valor: fo.valor };
      });
    }
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

  // ---------------------------------------------------------------- Etapa 3: assinatura
  @Post('projetos/:projetoId/instrumentos/:instrumentoId/assinatura/clicksign')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async enviarClicksign(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const prazoDias = Math.min(90, Math.max(1, Number(body?.prazoDias) || 30));
    const lista: any[] = Array.isArray(body?.signatarios) ? body.signatarios : [];
    if (!lista.length || lista.length > 20) throw new BadRequestException('Escolha de 1 a 20 partes para assinar pela ClickSign.');
    const emails: Record<string, string> = {};
    const nomes: Record<string, string> = {};
    for (const s of lista) {
      const pid = String(s?.parteId || ''); const em = String(s?.email || '').trim().toLowerCase();
      if (!UUID_RE.test(pid)) throw new BadRequestException('Parte invalida.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new BadRequestException('E-mail invalido: ' + em);
      emails[pid] = em;
      const nm = String(s?.nome || '').trim().replace(/\s+/g, ' ');
      if (nm.split(' ').filter(Boolean).length < 2) throw new BadRequestException('Informe o nome completo (nome e sobrenome) de quem assina: ' + (nm || em));
      nomes[pid] = nm.slice(0, 200);
    }
    const ids = Object.keys(emails);
    const prep: any = await this.executar(req, async (tx: any) => {
      const i: any[] = await tx.$queryRaw`
        SELECT i.id, i.codigo, i.titulo, i.situacao, v.id AS "versaoId", v.arquivo_nome AS nome, v.sha256, v.chave_armazenamento AS chave
        FROM proj_instrumentos i LEFT JOIN proj_instrumento_versoes v ON v.id = i.versao_aprovada_id
        WHERE i.id = ${instrumentoId}::uuid AND i.projeto_id = ${projetoId}::uuid`;
      if (!i.length) throw new NotFoundException('Registro nao encontrado.');
      if (i[0].situacao !== 'EM_ASSINATURA') throw new BadRequestException('O instrumento precisa estar Em assinatura.');
      if (!i[0].versaoId) throw new BadRequestException('Instrumento sem versao aprovada.');
      if (extensao(i[0].nome) !== 'pdf') throw new BadRequestException('A ClickSign so aceita PDF. Cancele a assinatura, reabra a revisao, envie o PDF como Final e aprove.');
      if (await this.envioAtivo(tx, instrumentoId)) throw new BadRequestException('Ja existe um envio ativo. Atualize ou cancele antes de enviar outro.');
      const conc: any[] = await tx.$queryRaw`SELECT 1 FROM proj_instrumento_envios WHERE instrumento_id = ${instrumentoId}::uuid AND versao_id = ${i[0].versaoId}::uuid AND situacao = 'CONCLUIDO'`;
      if (conc.length) throw new BadRequestException('Esta versao ja foi assinada pela ClickSign: use Marcar como assinado.');
      const partes: any[] = await tx.$queryRaw`
        SELECT id, nome, documento, ordem FROM proj_instrumento_partes
        WHERE instrumento_id = ${instrumentoId}::uuid AND cancelado_em IS NULL AND id = ANY(${ids}::uuid[]) ORDER BY ordem`;
      if (partes.length !== ids.length) throw new BadRequestException('Parte invalida ou encerrada.');
      return { inst: i[0], partes };
    });
    const buf = this.lerArquivo(prep.inst.chave, prep.inst.sha256);
    const prazo = new Date(Date.now() + prazoDias * 86400000);
    const arquivo = (`${prep.inst.codigo} - ${prep.inst.titulo}`).replace(/[\\/:*?"<>|]/g, '-').slice(0, 120) + '.pdf';
    let docKey = '';
    let docExterno: string | null = null;
    const v3 = USA_V3();
    const canal = v3 ? 'CLICKSIGN_V3' : 'CLICKSIGN';
    const listas: any[] = [];
    const desfazer = async () => {
      if (!docKey) return;
      if (v3) { if (docExterno) await this.clicksign3.cancelar(docKey, docExterno).catch(() => undefined); }
      else await this.clicksign.cancelDocument(docKey).catch(() => undefined);
    };
    if (v3) {
      try {
        const r3 = await this.clicksign3.criarEnvio({
          nome: (`${prep.inst.codigo} - ${prep.inst.titulo}`).slice(0, 200), arquivo, pdf: buf, prazo,
          mensagem: (`Por favor, assine: ${prep.inst.codigo} - ${prep.inst.titulo}`).slice(0, 200),
          signatarios: prep.partes.map((p: any) => ({ chave: p.id, nome: nomes[p.id], email: emails[p.id] })),
        });
        docKey = r3.envelopeId;
        docExterno = r3.documentoId;
        for (const p of prep.partes) listas.push({ parteId: p.id, nome: nomes[p.id], email: emails[p.id], ordem: p.ordem, signerKey: r3.signatarios[p.id], listKey: null });
      } catch (e: any) {
        throw new BadRequestException('A ClickSign recusou o envio: ' + String(e?.message || e).slice(0, 300));
      }
    } else
    try {
      docKey = await this.clicksign.uploadDocument(buf, arquivo, prazo);
      for (const p of prep.partes) {
        const d = String(p.documento || '').replace(/\D/g, '');
        const cpf = d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : undefined;
        const signerKey = await this.clicksign.addSigner({ name: nomes[p.id], email: emails[p.id], cpf, auth: 'email' });
        const listKey = await this.clicksign.addSignerToDocument(docKey, signerKey, 1);
        listas.push({ parteId: p.id, nome: nomes[p.id], email: emails[p.id], ordem: p.ordem, signerKey, listKey });
      }
    } catch (e: any) {
      if (docKey) await this.clicksign.cancelDocument(docKey).catch(() => undefined);
      throw new BadRequestException('A ClickSign recusou o envio: ' + String(e?.message || e).slice(0, 200));
    }
    try {
      return await this.executar(req, async (tx: any) => {
        const e: any[] = await tx.$queryRaw`
          INSERT INTO proj_instrumento_envios (instrumento_id, versao_id, canal, chave_externa, documento_externo, prazo, criado_por_id)
          VALUES (${instrumentoId}::uuid, ${prep.inst.versaoId}::uuid, ${canal}::varchar, ${docKey}::varchar, ${docExterno}::varchar, ${prazo}::timestamp, ${req.user.id}::uuid)
          RETURNING id`;
        for (const l of listas) {
          await tx.$queryRaw`
            INSERT INTO proj_instrumento_assinaturas (envio_id, parte_id, email, ordem, chave_signatario, chave_lista, evidencia)
            VALUES (${e[0].id}::uuid, ${l.parteId}::uuid, ${l.email}::varchar, ${l.ordem}::int, ${l.signerKey}::varchar, ${l.listKey}::varchar,
                    ${JSON.stringify({ signatario: l.nome })}::jsonb)
            RETURNING id`;
        }
        await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_ENVIADO_CLICKSIGN', targetId: e[0].id,
          after: { projetoId, instrumentoId, documento: docKey, signatarios: listas.map((l) => ({ nome: l.nome, email: l.email })), prazo } } });
        const notif = v3 ? { enviados: listas.map((l: any) => l.email), falhas: [] as string[] } : await this.notificarPendentes(docKey, (`Por favor, assine: ${prep.inst.codigo} - ${prep.inst.titulo}`).slice(0, 200));
        return { ok: true, envioId: e[0].id, documento: docKey, signatarios: listas.length, notificados: notif.enviados, falhas: notif.falhas };
      });
    } catch (err) {
      await desfazer();
      throw err;
    }
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/assinatura/atualizar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async atualizarClicksign(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const env: any = await this.executar(req, async (tx: any) => {
      await this.instrumento(tx, projetoId, instrumentoId);
      const e = await this.envioAtivo(tx, instrumentoId);
      if (!e) throw new NotFoundException('Nenhum envio ativo para este instrumento.');
      return e;
    });
    let st: any;
    try { st = env.canal === 'CLICKSIGN_V3' ? await this.clicksign3.consultarComoV1(env.chave, env.documentoExterno) : await this.clicksign.getDocumentStatus(env.chave); }
    catch (e: any) { throw new BadRequestException('Falha ao consultar a ClickSign: ' + String(e?.message || e).slice(0, 200)); }
    const doc = st?.document || {};
    const assinados = new Map<string, string>();
    for (const s of doc.signers || []) {
      const em = String(s?.email || '').toLowerCase();
      const at = s?.signature?.signed_at || s?.signed_at || (s?.status === 'signed' ? (s?.updated_at || new Date().toISOString()) : null);
      if (em && at) assinados.set(em, String(at));
    }
    for (const ev of doc.events || []) {
      if (ev?.name !== 'sign') continue;
      const em = String(ev?.data?.signer?.email || ev?.signer?.email || '').toLowerCase();
      if (em && !assinados.has(em)) assinados.set(em, String(ev?.occurred_at || ev?.at || new Date().toISOString()));
    }
    const fechado = doc.status === 'closed';
    let pdf: Buffer | null = null;
    if (fechado) {
      // API v1: o PDF assinado vem em document.downloads.signed_file_url (link temporario); o /download fica como reserva
      const url = doc?.downloads?.signed_file_url;
      if (url) { try { const rr = await fetch(url); if (rr.ok) pdf = Buffer.from(await rr.arrayBuffer()); } catch { pdf = null; } }
      if (!pdf) { try { pdf = await this.clicksign.downloadSignedPdf(env.chave); } catch { pdf = null; } }
      if (pdf && pdf.subarray(0, 5).toString('latin1') !== '%PDF-') pdf = null;
    }
    const resposta = {
      status: doc.status ?? null, deadline_at: doc.deadline_at ?? null, finished_at: doc.finished_at ?? null,
      temPdfAssinado: !!doc?.downloads?.signed_file_url,
      signers: (doc.signers || []).map((s: any) => ({ email: s?.email, name: s?.name, signed: assinados.has(String(s?.email || '').toLowerCase()),
        signed_at: s?.signature?.signed_at ?? s?.signed_at ?? null })),
    };
    return this.executar(req, async (tx: any) => {
      const pend: any[] = await tx.$queryRaw`
        SELECT a.id, lower(a.email) AS email FROM proj_instrumento_assinaturas a WHERE a.envio_id = ${env.id}::uuid AND a.situacao = 'PENDENTE'`;
      let novas = 0;
      for (const a of pend) {
        const at = assinados.get(a.email);
        if (!at) continue;
        const d = new Date(at);
        await tx.$queryRaw`
          UPDATE proj_instrumento_assinaturas SET situacao = 'ASSINADO', assinado_em = ${isNaN(d.getTime()) ? new Date() : d}::timestamp,
            evidencia = COALESCE(evidencia, '{}'::jsonb) || ${JSON.stringify({ fonte: 'ClickSign', documento: env.chave, assinadoEm: at })}::jsonb
          WHERE id = ${a.id}::uuid RETURNING id`;
        novas++;
      }
      await tx.$queryRaw`
        UPDATE proj_instrumento_envios SET ultima_consulta_em = CURRENT_TIMESTAMP, ultima_resposta = ${JSON.stringify(resposta)}::jsonb
        WHERE id = ${env.id}::uuid RETURNING id`;
      let versao: any = null;
      let validacao: any = null;
      if (fechado && pdf && pdf.length) {
        const g = this.guardar(instrumentoId, pdf);
        const nome = `${env.codigo} - assinado ClickSign.pdf`;
        const coment = `PDF assinado baixado da ClickSign (documento ${env.chave})`;
        const v: any[] = await tx.$queryRaw`
          INSERT INTO proj_instrumento_versoes (instrumento_id, numero, tipo, versao_base_id, arquivo_nome, mime, tamanho, sha256, chave_armazenamento, comentario, criado_por_id)
          VALUES (${instrumentoId}::uuid, 1, 'ASSINADA', ${env.versaoId}::uuid, ${nome}::varchar, 'application/pdf', ${pdf.length}::int,
                  ${g.sha}::text, ${g.chave}::varchar, ${coment}::text, ${req.user.id}::uuid)
          RETURNING id, numero`;
        versao = v[0];
        validacao = await this.validarESalvar(tx, instrumentoId, v[0].id, pdf, g.sha);
        await tx.$queryRaw`
          UPDATE proj_instrumento_envios SET situacao = 'CONCLUIDO', concluido_em = CURRENT_TIMESTAMP, versao_assinada_id = ${v[0].id}::uuid
          WHERE id = ${env.id}::uuid RETURNING id`;
      }
      return { ok: true, status: doc.status ?? null, novasAssinaturas: novas, concluido: !!versao, versao, validacao,
               aviso: fechado && !versao ? 'A ClickSign fechou o documento, mas o PDF assinado ainda nao esta disponivel. Tente de novo em instantes.' : null };
    });
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/assinatura/reenviar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async reenviarClicksign(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const env: any = await this.executar(req, async (tx: any) => {
      await this.instrumento(tx, projetoId, instrumentoId);
      const e = await this.envioAtivo(tx, instrumentoId);
      if (!e) throw new NotFoundException('Nenhum envio ativo para este instrumento.');
      return e;
    });
    const r = env.canal === 'CLICKSIGN_V3'
      ? await this.clicksign3.notificarTodos(env.chave, `Lembrete: assine o documento ${env.codigo}.`).catch((e: any) => ({ enviados: [] as string[], falhas: [String(e?.message || e).slice(0, 150)] }))
      : await this.notificarPendentes(env.chave, `Lembrete: assine o documento ${env.codigo}.`);
    await this.executar(req, async (tx: any) => tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_ENVIO_LEMBRETE',
      targetId: env.id, after: { projetoId, instrumentoId, documento: env.chave, enviados: r.enviados, falhas: r.falhas } } }));
    return { ok: true, ...r };
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/assinatura/cancelar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async cancelarClicksign(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string, @Body() body: any, @Req() req: any) {
    this.ids(projetoId, instrumentoId);
    const motivo = txt(body?.motivo, 2000) || '';
    if (motivo.length < 10) throw new BadRequestException('Informe o motivo (minimo de 10 caracteres).');
    const env: any = await this.executar(req, async (tx: any) => {
      await this.instrumento(tx, projetoId, instrumentoId);
      const e = await this.envioAtivo(tx, instrumentoId);
      if (!e) throw new NotFoundException('Nenhum envio ativo para este instrumento.');
      return e;
    });
    let aviso: string | null = null;
    try { if (env.canal === 'CLICKSIGN_V3') await this.clicksign3.cancelar(env.chave, env.documentoExterno); else await this.clicksign.cancelDocument(env.chave); }
    catch { aviso = 'A ClickSign nao confirmou o cancelamento: cancele tambem pelo painel da ClickSign.'; }
    return this.executar(req, async (tx: any) => {
      await tx.$queryRaw`
        UPDATE proj_instrumento_envios SET situacao = 'CANCELADO', cancelado_em = CURRENT_TIMESTAMP, cancelado_por_id = ${req.user.id}::uuid,
          motivo_cancelamento = ${motivo}::text
        WHERE id = ${env.id}::uuid AND situacao = 'ENVIADO' RETURNING id`;
      await tx.auditLog.create({ data: { actorId: req.user.id, action: 'PROJ_INSTRUMENTO_ENVIO_CANCELADO', targetId: env.id,
        after: { projetoId, instrumentoId, documento: env.chave, motivo, aviso } } });
      return { ok: true, aviso };
    });
  }

  @Post('projetos/:projetoId/instrumentos/:instrumentoId/versoes/:versaoId/validar')
  @UseGuards(MasterOnlyGuard)
  @ProjAcao('autenticado')
  async validarVersao(@Param('projetoId') projetoId: string, @Param('instrumentoId') instrumentoId: string,
                      @Param('versaoId') versaoId: string, @Req() req: any) {
    this.ids(projetoId, instrumentoId, versaoId);
    return this.executar(req, async (tx: any) => {
      const r: any[] = await tx.$queryRaw`
        SELECT v.id, v.tipo, v.arquivo_nome AS nome, v.sha256, v.chave_armazenamento AS chave
        FROM proj_instrumento_versoes v JOIN proj_instrumentos i ON i.id = v.instrumento_id
        WHERE v.id = ${versaoId}::uuid AND i.id = ${instrumentoId}::uuid AND i.projeto_id = ${projetoId}::uuid`;
      if (!r.length) throw new NotFoundException('Registro nao encontrado.');
      if (extensao(r[0].nome) !== 'pdf') throw new BadRequestException('So PDFs podem ser validados.');
      const buf = this.lerArquivo(r[0].chave, r[0].sha256);
      return this.validarESalvar(tx, instrumentoId, r[0].id, buf, String(r[0].sha256).trim());
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
