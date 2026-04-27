// apps/api/src/modules/signatures/govbr.service.ts
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

// ── Cache seguro em memória para sessions OAuth (TTL 10min) ──────────────────
interface OAuthSession {
  codeVerifier: string;    // criptografado em memória
  documentId: string;
  signerId: string;
  createdAt: number;
  ipAddress: string;
  used: boolean;           // one-time use — previne replay attacks
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutos
const MAX_SESSIONS_PER_IP = 5;         // rate limiting por IP
const SESSION_KEY = crypto.randomBytes(32); // chave efêmera — gerada no boot, nunca persiste

@Injectable()
export class GovBrService {
  // Map em memória — em produção substituir por Redis
  private sessions = new Map<string, OAuthSession>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {
    // Limpeza automática de sessions expiradas a cada 2 minutos
    this.cleanupInterval = setInterval(() => this.cleanExpiredSessions(), 2 * 60 * 1000);
  }

  // ── Criptografia em memória do codeVerifier ────────────────────────────────
  private encryptVerifier(verifier: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', SESSION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(verifier, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decryptVerifier(encrypted: string): string {
    const [ivHex, tagHex, encHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', SESSION_KEY, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc).toString('utf8') + decipher.final('utf8');
  }

  // ── Limpeza de sessions expiradas ─────────────────────────────────────────
  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.createdAt > SESSION_TTL_MS || session.used) {
        this.sessions.delete(key);
      }
    }
  }

  // ── Rate limiting por IP ───────────────────────────────────────────────────
  private checkRateLimit(ipAddress: string) {
    const activeSessions = Array.from(this.sessions.values()).filter(
      s => s.ipAddress === ipAddress && !s.used && Date.now() - s.createdAt < SESSION_TTL_MS
    );
    if (activeSessions.length >= MAX_SESSIONS_PER_IP) {
      throw new ForbiddenException('Muitas solicitações de assinatura pendentes. Aguarde e tente novamente.');
    }
  }

  // ── PKCE helpers ──────────────────────────────────────────────────────────
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  // ── Gerar URL de autorização com PKCE ─────────────────────────────────────
  generateAuthUrl(documentId: string, signerId: string, ipAddress: string): { url: string; sessionId: string } {
    this.checkRateLimit(ipAddress);

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // sessionId opaco — nunca contém dados sensíveis
    const sessionId = crypto.randomBytes(32).toString('base64url');
    const state = Buffer.from(JSON.stringify({ sessionId })).toString('base64url');
    const nonce = crypto.randomBytes(16).toString('hex');

    // Armazenar session com codeVerifier criptografado
    this.sessions.set(sessionId, {
      codeVerifier: this.encryptVerifier(codeVerifier),
      documentId,
      signerId,
      createdAt: Date.now(),
      ipAddress,
      used: false,
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.GOVBR_CLIENT_ID ?? '',
      scope: 'openid profile govbr_confiabilidades',
      redirect_uri: process.env.GOVBR_REDIRECT_URI ?? '',
      nonce,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    const baseUrl = process.env.GOVBR_AUTH_URL ?? 'https://sso.staging.acesso.gov.br/authorize';
    return { url: `${baseUrl}?${params.toString()}`, sessionId };
  }

  // ── Trocar code por token (com PKCE) ──────────────────────────────────────
  private async exchangeCode(code: string, codeVerifier: string): Promise<any> {
    const credentials = Buffer.from(
      `${process.env.GOVBR_CLIENT_ID ?? ''}:${process.env.GOVBR_CLIENT_SECRET ?? ''}`
    ).toString('base64');

    const tokenUrl = process.env.GOVBR_TOKEN_URL ?? 'https://sso.staging.acesso.gov.br/token';
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.GOVBR_REDIRECT_URI ?? '',
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!res.ok) {
      // Log interno sem expor detalhes ao cliente
      console.error(`[GovBr] Token exchange failed: ${res.status}`);
      throw new BadRequestException('Falha na autenticação gov.br. Tente novamente.');
    }
    return res.json();
  }

  // ── Buscar dados do usuário ────────────────────────────────────────────────
  private async getUserInfo(accessToken: string): Promise<any> {
    const userinfoUrl = process.env.GOVBR_USERINFO_URL ?? 'https://sso.staging.acesso.gov.br/userinfo';
    const res = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new BadRequestException('Erro ao obter dados de autenticação.');
    return res.json();
  }

  // ── Processar callback ─────────────────────────────────────────────────────
  async processCallback(code: string, state: string, ipAddress: string) {
    // Validar state
    let sessionId: string;
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString());
      sessionId = parsed.sessionId;
    } catch {
      throw new BadRequestException('Parâmetro state inválido.');
    }

    // Buscar e validar session
    const session = this.sessions.get(sessionId);
    if (!session) throw new BadRequestException('Sessão expirada ou inválida. Inicie o processo novamente.');
    if (session.used) throw new ForbiddenException('Esta sessão já foi utilizada.');
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      this.sessions.delete(sessionId);
      throw new BadRequestException('Sessão expirada. Inicie o processo novamente.');
    }

    // Marcar como usada IMEDIATAMENTE — previne replay attack
    session.used = true;
    this.sessions.set(sessionId, session);

    // Descriptografar codeVerifier
    const codeVerifier = this.decryptVerifier(session.codeVerifier);
    const { documentId, signerId } = session;

    // Trocar code por token
    const tokenData = await this.exchangeCode(code, codeVerifier);
    const userInfo = await this.getUserInfo(tokenData.access_token);

    // Extrair dados — nunca logar CPF ou token completo
    const cpf = userInfo.sub?.replace(/\D/g, '') ?? '';
    const name = userInfo.name ?? userInfo.preferred_username ?? '';
    const govbrLevel = Array.isArray(userInfo.govbr_confiabilidades) && userInfo.govbr_confiabilidades.length > 0
      ? userInfo.govbr_confiabilidades[0] : 'bronze';

    const signer = await this.prisma.documentSigner.findFirst({
      where: { id: signerId, documentId },
    });
    if (!signer) throw new BadRequestException('Signatário não encontrado.');

    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    const documentHash = crypto.createHash('sha256')
      .update(doc?.content ?? doc?.pdfUrl ?? documentId)
      .digest('hex');

    // Hash do access_token — nunca armazenar token bruto
    const tokenHash = crypto.createHash('sha256').update(tokenData.access_token).digest('hex');

    return this.prisma.$transaction(async (tx) => {
      await tx.documentSignature.create({
        data: {
          documentId,
          signerId,
          method: 'GOVBR',
          status: 'ASSINADO',
          signerName: name || signer.name,
          signerCpf: cpf || signer.cpf,
          signerEmail: userInfo.email || signer.email,
          signerRole: signer.role,
          documentHash,
          signatureHash: tokenHash,  // hash do token, não o token bruto
          govbrTransactionId: userInfo.sub,
          govbrAccountLevel: govbrLevel,
          ipAddress,
          signedAt: new Date(),
        },
      });

      await tx.documentSigner.update({
        where: { id: signerId },
        data: { status: 'ASSINADO' },
      });

      // Log de auditoria
      await tx.auditLog.create({
        data: {
          action: 'DOCUMENT_SIGNED_GOVBR',
          targetId: documentId,
          after: { signerName: name, govbrLevel, documentId },
          ip: ipAddress,
        },
      });

      const allSigners = await tx.documentSigner.findMany({ where: { documentId } });
      if (allSigners.every(s => s.status === 'ASSINADO')) {
        await tx.document.update({
          where: { id: documentId },
          data: { status: 'ASSINADO' },
        });
      }

      // Limpar session da memória
      this.sessions.delete(sessionId);

      return {
        success: true,
        documentId,
        redirectUrl: `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/app/documents/signatures`,
      };
    });
  }
}
