// apps/api/src/modules/signatures/clicksign-v3.service.ts
// ClickSign API 3.0 (envelopes) - usada pelos Instrumentos do plano (11/10/2026). Fluxo validado no sandbox:
// envelope -> documento -> signatarios -> requisitos (agree/sign + provide_evidence/email) -> PATCH running -> notificar.
// Quem assinou: eventos "sign" do documento. PDF assinado: links.files.signed. Cancelar: PATCH do DOCUMENTO com status canceled
// (o envelope so aceita draft/running e acompanha o documento).
import { Injectable, BadRequestException } from '@nestjs/common';

const BASE = () => process.env.CLICKSIGN_BASE_URL ?? 'https://sandbox.clicksign.com';
const TOKEN = () => process.env.CLICKSIGN_ACCESS_TOKEN ?? '';
const TIPO = 'application/vnd.api+json';

@Injectable()
export class ClicksignV3Service {
  private async req(metodo: string, caminho: string, corpo?: any): Promise<any> {
    const res = await fetch(`${BASE()}/api/v3${caminho}`, {
      method: metodo,
      headers: { Authorization: TOKEN(), Accept: TIPO, 'Content-Type': TIPO },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const txt = await res.text();
    let json: any = null;
    try { json = txt ? JSON.parse(txt) : null; } catch { json = null; }
    if (!res.ok) {
      const det = (json?.errors || []).map((e: any) => e?.detail).filter(Boolean).join('; ');
      console.error(`[ClickSign v3] ${metodo} ${caminho} -> ${res.status}: ${det || (json ? JSON.stringify(json).slice(0, 300) : 'resposta nao JSON')}`);
      throw new BadRequestException(`ClickSign API 3.0 error: ${res.status} ${det || (json ? '' : 'rota inexistente')}`.trim());
    }
    return json;
  }

  async criarEnvio(p: { nome: string; arquivo: string; pdf: Buffer; prazo: Date; mensagem: string;
                        signatarios: { chave: string; nome: string; email: string }[] }) {
    const env = await this.req('POST', '/envelopes', { data: { type: 'envelopes',
      attributes: { name: p.nome, deadline_at: p.prazo.toISOString(), locale: 'pt-BR', auto_close: true } } });
    const envelopeId: string = env.data.id;
    let documentoId: string | null = null;
    try {
      const doc = await this.req('POST', `/envelopes/${envelopeId}/documents`, { data: { type: 'documents',
        attributes: { filename: p.arquivo, content_base64: `data:application/pdf;base64,${p.pdf.toString('base64')}` } } });
      documentoId = doc.data.id;
      const signatarios: Record<string, string> = {};
      for (const s of p.signatarios) {
        const r = await this.req('POST', `/envelopes/${envelopeId}/signers`, { data: { type: 'signers', attributes: { name: s.nome, email: s.email } } });
        signatarios[s.chave] = r.data.id;
        const rel = { document: { data: { type: 'documents', id: documentoId } }, signer: { data: { type: 'signers', id: r.data.id } } };
        await this.req('POST', `/envelopes/${envelopeId}/requirements`, { data: { type: 'requirements', attributes: { action: 'agree', role: 'sign' }, relationships: rel } });
        await this.req('POST', `/envelopes/${envelopeId}/requirements`, { data: { type: 'requirements', attributes: { action: 'provide_evidence', auth: 'email' }, relationships: rel } });
      }
      await this.req('PATCH', `/envelopes/${envelopeId}`, { data: { id: envelopeId, type: 'envelopes', attributes: { status: 'running' } } });
      await this.req('POST', `/envelopes/${envelopeId}/notifications`, { data: { type: 'notifications', attributes: { message: p.mensagem } } });
      return { envelopeId, documentoId: documentoId as string, signatarios };
    } catch (e) {
      if (documentoId) await this.cancelar(envelopeId, documentoId).catch(() => undefined);
      throw e;
    }
  }

  // Devolve a situacao no mesmo formato da API 1.9 ({ document: { status, signers[].signature, downloads.signed_file_url } }),
  // para o fluxo dos instrumentos tratar as duas versoes do mesmo jeito.
  async consultarComoV1(envelopeId: string, documentoId: string): Promise<any> {
    const [env, doc, sig, ev] = await Promise.all([
      this.req('GET', `/envelopes/${envelopeId}`),
      this.req('GET', `/envelopes/${envelopeId}/documents/${documentoId}`),
      this.req('GET', `/envelopes/${envelopeId}/signers?page%5Bsize%5D=50`),
      this.req('GET', `/envelopes/${envelopeId}/documents/${documentoId}/events?page%5Bsize%5D=50`),
    ]);
    const assinou = new Map<string, string>();
    for (const e of ev?.data || []) {
      if (e?.attributes?.name !== 'sign') continue;
      const em = String(e?.attributes?.data?.signer?.email || '').toLowerCase();
      if (em && !assinou.has(em)) assinou.set(em, String(e?.attributes?.created || ''));
    }
    const dst = doc?.data?.attributes?.status;
    const status = dst === 'closed' || dst === 'canceled' ? dst : (env?.data?.attributes?.status || dst || null);
    return { document: {
      status,
      deadline_at: env?.data?.attributes?.deadline_at ?? null,
      finished_at: dst === 'closed' ? (doc?.data?.attributes?.modified ?? null) : null,
      signers: (sig?.data || []).map((s: any) => {
        const em = String(s?.attributes?.email || '').toLowerCase();
        const at = assinou.get(em);
        return { email: s?.attributes?.email, name: s?.attributes?.name, signature: at ? { signed_at: at } : null };
      }),
      events: [],
      downloads: { signed_file_url: doc?.data?.links?.files?.signed ?? null },
    } };
  }

  async notificarTodos(envelopeId: string, mensagem: string): Promise<{ enviados: string[]; falhas: string[] }> {
    const r = await this.req('POST', `/envelopes/${envelopeId}/notifications`, { data: { type: 'notifications', attributes: { message: mensagem } } });
    const sig = await this.req('GET', `/envelopes/${envelopeId}/signers?page%5Bsize%5D=50`).catch(() => null);
    const email = new Map<string, string>();
    for (const s of sig?.data || []) email.set(String(s.id), String(s?.attributes?.email || s.id));
    const enviados: string[] = [];
    const falhas: string[] = [];
    for (const x of r?.data?.attributes?.summary || []) (x?.notified ? enviados : falhas).push(email.get(String(x?.signer_id)) || String(x?.signer_id));
    return { enviados, falhas };
  }

  async cancelar(envelopeId: string, documentoId: string): Promise<void> {
    await this.req('PATCH', `/envelopes/${envelopeId}/documents/${documentoId}`, { data: { id: documentoId, type: 'documents', attributes: { status: 'canceled' } } });
  }
}
