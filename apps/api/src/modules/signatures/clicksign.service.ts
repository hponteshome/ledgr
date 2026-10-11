// apps/api/src/modules/signatures/clicksign.service.ts
// Arquivo de documentos assinando pela ClickSign API 3.0 (envelopes) - 11/10/2026.
// A API 1.9 foi removida do LEDGR nesta data; o HTTP da ClickSign fica todo no ClicksignV3Service.
// Document.digitalSignature guarda "cs3:<envelopeId>:<documentoId>".
// A situacao vem SEMPRE da API: o webhook so dispara a releitura, nunca e fonte de verdade.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClicksignV3Service } from './clicksign-v3.service';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const PREFIXO = 'cs3:';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RefClicksign = { envelopeId: string; documentoId: string };

@Injectable()
export class ClicksignService {
  constructor(private prisma: PrismaService, private cs3: ClicksignV3Service) {}

  static lerRef(ref?: string | null): RefClicksign | null {
    if (!ref || !ref.startsWith(PREFIXO)) return null;
    const [envelopeId, documentoId] = ref.slice(PREFIXO.length).split(':');
    return envelopeId && documentoId ? { envelopeId, documentoId } : null;
  }

  static ehPdf(b?: Buffer | null): boolean {
    return !!b && b.length > 5 && b.subarray(0, 5).toString('latin1') === '%PDF-';
  }

  static nomeSeguro(t?: string | null): string {
    const n = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ._-]/g, '_').replace(/\s+/g, ' ').trim().replace(/\.pdf$/i, '').trim().slice(0, 80);
    return n || 'documento';
  }

  // ---- Enviar ----
  async createSignatureRequest(params: {
    documentId: string; companyId: string; pdfBuffer: Buffer; filename: string;
    signers: Array<{ id: string; name: string; email: string; cpf?: string; phone?: string; order: number; auth?: string }>;
    deadline?: Date; userId?: string | null;
  }): Promise<{ documentKey: string; envelopeId: string; documentoId: string }> {
    if (!ClicksignService.ehPdf(params.pdfBuffer)) throw new BadRequestException('O documento nao tem um PDF valido para enviar a ClickSign.');
    const doc = await this.prisma.document.findUnique({ where: { id: params.documentId }, include: { signers: true } });
    if (!doc) throw new NotFoundException('Documento nao encontrado');
    if (doc.status === 'AGUARDANDO_ASSINATURA' && ClicksignService.lerRef(doc.digitalSignature)) {
      throw new BadRequestException('Este documento ja tem um envio ativo na ClickSign. Use "Atualizar" para ver a situacao.');
    }
    const lista = [...(params.signers || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!lista.length) throw new BadRequestException('Inclua ao menos um signatario.');
    const vistos = new Set<string>();
    for (const s of lista) {
      if (!doc.signers.some((x) => x.id === s.id)) throw new BadRequestException('Signatario nao pertence a este documento.');
      const email = String(s.email || '').trim().toLowerCase();
      if (!EMAIL.test(email)) throw new BadRequestException(`E-mail invalido para ${s.name || 'signatario'}.`);
      if (vistos.has(email)) throw new BadRequestException(`E-mail repetido: ${email}. Cada signatario precisa de um e-mail proprio.`);
      vistos.add(email);
      if (String(s.name || '').trim().split(/\s+/).length < 2) throw new BadRequestException(`Informe nome e sobrenome de "${s.name}" - a ClickSign exige.`);
    }
    const prazo = params.deadline && !isNaN(+params.deadline) ? params.deadline : new Date(Date.now() + 30 * 86400000);
    if (+prazo < Date.now() + 3600000) throw new BadRequestException('O prazo precisa ser futuro.');
    const titulo = String(doc.title || 'Documento').slice(0, 180);
    const r = await this.cs3.criarEnvio({
      nome: titulo, arquivo: params.filename, pdf: params.pdfBuffer, prazo,
      mensagem: `Por favor, assine: ${titulo}`.slice(0, 200),
      signatarios: lista.map((s) => ({ chave: s.id, nome: String(s.name).trim(), email: String(s.email).trim().toLowerCase() })),
    });
    const ref = `${PREFIXO}${r.envelopeId}:${r.documentoId}`;
    try {
      await this.prisma.$transaction([
        ...lista.map((s) => this.prisma.documentSigner.update({
          where: { id: s.id }, data: { email: String(s.email).trim().toLowerCase(), notifiedAt: new Date() } })),
        this.prisma.document.update({ where: { id: params.documentId }, data: { status: 'AGUARDANDO_ASSINATURA', digitalSignature: ref } }),
        this.prisma.auditLog.create({ data: {
          actorId: params.userId ?? null, action: 'CLICKSIGN_REQUEST_CREATED', targetId: params.documentId,
          after: { api: 'v3', envelopeId: r.envelopeId, documentoId: r.documentoId, signatarios: lista.length,
                   pdfSha256: crypto.createHash('sha256').update(params.pdfBuffer).digest('hex'), prazo: prazo.toISOString() },
        } }),
      ]);
    } catch (e) {
      await this.cs3.cancelar(r.envelopeId, r.documentoId).catch(() => undefined);
      throw e;
    }
    return { documentKey: r.envelopeId, envelopeId: r.envelopeId, documentoId: r.documentoId };
  }

  // ---- Atualizar (le a ClickSign e grava assinaturas novas e a conclusao) ----
  async sincronizar(documentId: string, actorId?: string | null) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId }, include: { signers: true, signatures: true } });
    if (!doc) throw new NotFoundException('Documento nao encontrado');
    const ref = ClicksignService.lerRef(doc.digitalSignature);
    if (!ref) return { status: 'not_sent' };
    const st: any = (await this.cs3.consultarComoV1(ref.envelopeId, ref.documentoId))?.document || {};
    const assinou = new Map<string, string>();
    for (const s of st.signers || []) if (s?.signature?.signed_at) assinou.set(String(s.email || '').toLowerCase(), String(s.signature.signed_at));

    const novos: string[] = [];
    for (const s of doc.signers) {
      const at = assinou.get(String(s.email || '').toLowerCase());
      if (!at || s.status === 'ASSINADO') continue;
      const quando = isNaN(+new Date(at)) ? new Date() : new Date(at);
      const ops: any[] = [this.prisma.documentSigner.update({ where: { id: s.id }, data: { status: 'ASSINADO' } })];
      if (!doc.signatures.some((x) => x.signerId === s.id && x.status === 'ASSINADO')) {
        ops.push(this.prisma.documentSignature.create({ data: {
          documentId: doc.id, signerId: s.id, method: 'CLICKSIGN', status: 'ASSINADO',
          signerName: s.name, signerCpf: s.cpf, signerEmail: s.email, signerRole: s.role,
          documentHash: doc.contentHash ?? null, signatureFormat: 'CLICKSIGN_V3',
          certificateData: { provedor: 'ClickSign API 3.0', envelopeId: ref.envelopeId, documentoId: ref.documentoId },
          signedAt: quando,
        } }));
      }
      ops.push(this.prisma.auditLog.create({ data: {
        actorId: actorId ?? null, action: 'CLICKSIGN_SIGNER_SIGNED', targetId: doc.id,
        after: { signatario: s.name, email: s.email, assinadoEm: quando.toISOString(), envelopeId: ref.envelopeId },
      } }));
      await this.prisma.$transaction(ops);
      novos.push(s.name);
    }

    let pdfAssinado: string | null = null;
    if (st.status === 'closed' && doc.status !== 'ASSINADO') {
      const pdf = await this.baixarUrl(st.downloads?.signed_file_url);
      const sha = crypto.createHash('sha256').update(pdf).digest('hex');
      const dir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const nome = `${sha.slice(0, 16)}_assinado_${ClicksignService.nomeSeguro(doc.title).replace(/ /g, '_')}.pdf`;
      fs.writeFileSync(path.join(dir, nome), pdf);
      pdfAssinado = '/uploads/' + nome;
      await this.prisma.$transaction([
        this.prisma.document.update({ where: { id: doc.id }, data: { status: 'ASSINADO', pdfUrl: pdfAssinado } }),
        this.prisma.auditLog.create({ data: {
          actorId: actorId ?? null, action: 'DOCUMENT_FULLY_SIGNED', targetId: doc.id,
          after: { api: 'v3', envelopeId: ref.envelopeId, documentoId: ref.documentoId, pdfAssinado, pdfSha256: sha, bytes: pdf.length },
        } }),
      ]);
    }
    return {
      status: st.status ?? null, prazo: st.deadline_at ?? null,
      signatarios: (st.signers || []).map((s: any) => ({ nome: s.name, email: s.email, assinadoEm: s?.signature?.signed_at ?? null })),
      novasAssinaturas: novos, concluido: st.status === 'closed', pdfAssinado,
    };
  }

  // ---- PDF assinado: copia local (guardada na conclusao) ou link temporario da ClickSign ----
  async baixarPdfAssinado(documentId: string): Promise<{ pdf: Buffer; nome: string }> {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Documento nao encontrado');
    const nome = `${ClicksignService.nomeSeguro(doc.title)} - assinado.pdf`;
    if (doc.status === 'ASSINADO' && doc.pdfUrl?.startsWith('/uploads/')) {
      const raiz = path.resolve(process.cwd(), 'uploads');
      const alvo = path.resolve(raiz, doc.pdfUrl.slice('/uploads/'.length));
      if (alvo.startsWith(raiz + path.sep) && fs.existsSync(alvo)) {
        const buf = fs.readFileSync(alvo);
        if (ClicksignService.ehPdf(buf)) return { pdf: buf, nome };
      }
    }
    const ref = ClicksignService.lerRef(doc.digitalSignature);
    if (!ref) throw new NotFoundException('Documento nao enviado a ClickSign.');
    const st: any = (await this.cs3.consultarComoV1(ref.envelopeId, ref.documentoId))?.document;
    if (st?.status !== 'closed') throw new NotFoundException('O documento ainda nao foi assinado por todos.');
    return { pdf: await this.baixarUrl(st.downloads?.signed_file_url), nome };
  }

  private async baixarUrl(url?: string | null): Promise<Buffer> {
    if (!url) throw new NotFoundException('PDF assinado ainda nao disponivel na ClickSign.');
    const res = await fetch(url);
    if (!res.ok) throw new NotFoundException(`Falha ao baixar o PDF assinado (${res.status}).`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!ClicksignService.ehPdf(buf)) throw new BadRequestException('O arquivo baixado da ClickSign nao e um PDF.');
    return buf;
  }

  // ---- Webhook: so localiza o documento pelos IDs do aviso e rele tudo pela API ----
  async processWebhook(payload: any): Promise<{ sincronizados: number }> {
    const ids = new Set<string>();
    const coletar = (v: any, prof: number) => {
      if (prof > 6 || v == null) return;
      if (typeof v === 'string') { if (UUID.test(v)) ids.add(v.toLowerCase()); return; }
      if (Array.isArray(v)) { for (const x of v.slice(0, 50)) coletar(x, prof + 1); return; }
      if (typeof v === 'object') for (const k of Object.keys(v).slice(0, 50)) coletar(v[k], prof + 1);
    };
    coletar(payload, 0);
    if (!ids.size) return { sincronizados: 0 };
    const docs = await this.prisma.document.findMany({
      where: { digitalSignature: { startsWith: PREFIXO }, status: 'AGUARDANDO_ASSINATURA' },
      select: { id: true, digitalSignature: true },
    });
    let n = 0;
    for (const d of docs) {
      const ref = ClicksignService.lerRef(d.digitalSignature);
      if (!ref || !(ids.has(ref.envelopeId.toLowerCase()) || ids.has(ref.documentoId.toLowerCase()))) continue;
      try { await this.sincronizar(d.id, null); n++; }
      catch (e: any) { console.error('[ClickSign Webhook] falha ao sincronizar', d.id, String(e?.message || e).slice(0, 200)); }
    }
    return { sincronizados: n };
  }
}
