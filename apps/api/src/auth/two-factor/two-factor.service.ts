// apps/api/src/auth/two-factor/two-factor.service.ts
// Seguranca 0A.6 (03/10/2026): autenticacao em dois fatores (TOTP, RFC 6238).
//  - segredo TOTP cifrado no banco (AES-256-GCM, chave TWO_FACTOR_ENC_KEY)
//  - tokens intermediarios (desafio, configuracao, dispositivo confiavel) assinados com
//    JWT_2FA_SECRET, chave DIFERENTE da do token de acesso: o JwtStrategy nunca os aceita
//  - codigo errado conta no mesmo bloqueio de 5 tentativas do login
//  - 10 codigos de recuperacao de uso unico, guardados como hash
//  - dispositivo confiavel por TWO_FACTOR_TRUST_HOURS; revogado ao incrementar twoFactorTrustVersion
//  - obrigatoriedade por TWO_FACTOR_OBRIGATORIO (desligada ate a Fase 0B)
import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';

authenticator.options = { window: 1 };
const EMISSOR = 'LEDGR';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function exigirEnv(nome: string, minimo: number): string {
  const v = process.env[nome];
  if (!v || v.length < minimo) {
    throw new Error(`${nome} ausente ou fraco (minimo ${minimo} caracteres). Configure o .env da API.`);
  }
  return v;
}

@Injectable()
export class TwoFactorService {
  private readonly chave = Buffer.from(exigirEnv('TWO_FACTOR_ENC_KEY', 64).slice(0, 64), 'hex');
  private readonly segredoJwt = exigirEnv('JWT_2FA_SECRET', 64);
  private readonly obrigatorio = process.env.TWO_FACTOR_OBRIGATORIO === 'true';
  private readonly horasConfianca = Number(process.env.TWO_FACTOR_TRUST_HOURS || 24);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  // ---------- login ----------
  async avaliarLogin(user: any, trustToken?: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, isTwoFactorActive: true, twoFactorTrustVersion: true },
    });
    if (!u) throw new UnauthorizedException();
    if (u.isTwoFactorActive) {
      if (trustToken && this.confiavel(trustToken, u.id, u.twoFactorTrustVersion)) {
        return this.auth.login({ id: u.id, email: u.email });
      }
      return { requires2fa: true, challengeToken: this.emitir(u.id, '2fa', '5m') };
    }
    if (this.obrigatorio) {
      return { requires2faSetup: true, setupToken: this.emitir(u.id, '2fa-setup', '10m') };
    }
    return this.auth.login({ id: u.id, email: u.email });
  }

  async verificarLogin(challengeToken: string, codigo: string, confiar: boolean) {
    const p = this.ler(challengeToken, '2fa');
    await this.conferirCodigo(p.sub, codigo);
    return this.concluir(p.sub, confiar);
  }

  // ---------- configuracao antes do login (obrigatoriedade ligada) ----------
  async setupPreLogin(setupToken: string) {
    const p = this.ler(setupToken, '2fa-setup');
    return this.iniciarSetup(p.sub);
  }

  async ativarPreLogin(setupToken: string, codigo: string, confiar: boolean) {
    const p = this.ler(setupToken, '2fa-setup');
    const codigos = await this.ativar(p.sub, codigo);
    return this.concluir(p.sub, confiar, { recoveryCodes: codigos });
  }

  // ---------- configuracao pelo usuario logado ----------
  async iniciarSetup(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, isTwoFactorActive: true } });
    if (!u) throw new UnauthorizedException();
    if (u.isTwoFactorActive) throw new BadRequestException('2FA ja esta ativo para este usuario.');
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: this.cifrar(secret) } });
    const otpauthUrl = authenticator.keyuri(u.email, EMISSOR, secret);
    return { otpauthUrl, qrDataUrl: await QRCode.toDataURL(otpauthUrl), secret };
  }

  async ativar(userId: string, codigo: string): Promise<string[]> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { twoFactorSecret: true, isTwoFactorActive: true } });
    if (!u || !u.twoFactorSecret) throw new BadRequestException('Inicie a configuracao do 2FA antes de ativar.');
    if (u.isTwoFactorActive) throw new BadRequestException('2FA ja esta ativo para este usuario.');
    const limpo = (codigo || '').replace(/\s/g, '');
    if (!authenticator.verify({ token: limpo, secret: this.decifrar(u.twoFactorSecret) })) {
      throw new UnauthorizedException('Codigo de verificacao invalido.');
    }
    const { codigos, hashes } = await this.novosCodigos();
    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorActive: true, twoFactorEnabledAt: new Date(), twoFactorRecoveryCodes: hashes, failedAttempts: 0 },
    });
    await this.prisma.auditLog.create({ data: { actorId: userId, action: '2FA_ENABLED', targetId: userId } });
    return codigos;
  }

  async regenerarCodigos(userId: string, codigo: string): Promise<string[]> {
    await this.conferirCodigo(userId, codigo);
    const { codigos, hashes } = await this.novosCodigos();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorRecoveryCodes: hashes } });
    await this.prisma.auditLog.create({ data: { actorId: userId, action: '2FA_RECOVERY_REGENERATED', targetId: userId } });
    return codigos;
  }

  async status(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isTwoFactorActive: true, twoFactorEnabledAt: true, twoFactorRecoveryCodes: true },
    });
    if (!u) throw new UnauthorizedException();
    return {
      ativo: u.isTwoFactorActive,
      ativadoEm: u.twoFactorEnabledAt,
      codigosRestantes: u.twoFactorRecoveryCodes.length,
      obrigatorio: this.obrigatorio,
      horasConfianca: this.horasConfianca,
    };
  }

  // Master: reinicia o 2FA de um usuario (celular perdido) e revoga dispositivos confiaveis
  async resetar(adminId: string, userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!u) throw new BadRequestException('Usuario nao encontrado.');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null, isTwoFactorActive: false, twoFactorEnabledAt: null,
        twoFactorRecoveryCodes: [], twoFactorTrustVersion: { increment: 1 },
      },
    });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: '2FA_RESET', targetId: userId } });
    return { reset: true };
  }

  // ---------- internos ----------
  private async conferirCodigo(userId: string, codigo: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorSecret: true, isTwoFactorActive: true, twoFactorRecoveryCodes: true,
        failedAttempts: true, blockedUntil: true, isActive: true, status: true, deletedAt: true,
      },
    });
    if (!u || u.deletedAt || !u.isActive || u.status !== 'active' || !u.isTwoFactorActive || !u.twoFactorSecret) {
      throw new UnauthorizedException();
    }
    const agora = new Date();
    if (u.blockedUntil && u.blockedUntil > agora) {
      throw new ForbiddenException('Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente mais tarde.');
    }
    const limpo = (codigo || '').replace(/\s/g, '');
    let ok = false;
    if (/^\d{6}$/.test(limpo)) {
      ok = authenticator.verify({ token: limpo, secret: this.decifrar(u.twoFactorSecret) });
    } else if (limpo.length >= 8) {
      const norm = limpo.toUpperCase().replace(/-/g, '');
      for (let i = 0; i < u.twoFactorRecoveryCodes.length; i++) {
        if (await bcrypt.compare(norm, u.twoFactorRecoveryCodes[i])) {
          const restantes = u.twoFactorRecoveryCodes.filter((_: string, j: number) => j !== i);
          await this.prisma.user.update({ where: { id: userId }, data: { twoFactorRecoveryCodes: restantes } });
          await this.prisma.auditLog.create({
            data: { actorId: userId, action: '2FA_RECOVERY_USED', targetId: userId, after: { restantes: restantes.length } },
          });
          ok = true;
          break;
        }
      }
    }
    if (!ok) {
      const tentativas = (u.failedAttempts ?? 0) + 1;
      const bloquear = tentativas >= 5;
      const ate = bloquear ? new Date(agora.getTime() + 15 * 60000) : null;
      await this.prisma.user.update({
        where: { id: userId },
        data: bloquear ? { failedAttempts: 0, blockedUntil: ate } : { failedAttempts: tentativas },
      });
      if (bloquear) {
        await this.prisma.auditLog.create({
          data: { actorId: userId, action: 'LOGIN_BLOCKED', targetId: userId, after: { motivo: '2FA', blockedUntil: ate!.toISOString() } },
        });
      }
      throw new UnauthorizedException('Codigo de verificacao invalido.');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { failedAttempts: 0 } });
  }

  private async concluir(userId: string, confiar: boolean, extra: Record<string, any> = {}) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, twoFactorTrustVersion: true } });
    if (!u) throw new UnauthorizedException();
    const r: any = await this.auth.login({ id: u.id, email: u.email });
    if (confiar) {
      r.trustToken = this.emitir(u.id, 'trust', `${this.horasConfianca}h`, { v: u.twoFactorTrustVersion });
    }
    return { ...r, ...extra };
  }

  private confiavel(token: string, userId: string, versao: number): boolean {
    try {
      const p: any = this.jwt.verify(token, { secret: this.segredoJwt });
      return p?.purpose === 'trust' && p.sub === userId && p.v === versao;
    } catch {
      return false;
    }
  }

  private emitir(sub: string, purpose: string, expiresIn: string, extra: Record<string, any> = {}) {
    return this.jwt.sign({ sub, purpose, ...extra }, { secret: this.segredoJwt, expiresIn: expiresIn as any });
  }

  private ler(token: string, purpose: string): any {
    try {
      const p: any = this.jwt.verify(token || '', { secret: this.segredoJwt });
      if (p?.purpose !== purpose || !p?.sub) throw new Error('finalidade');
      return p;
    } catch {
      throw new UnauthorizedException('Sessao de verificacao invalida ou expirada. Faca login novamente.');
    }
  }

  private cifrar(texto: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.chave, iv);
    const enc = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
    return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
  }

  private decifrar(payload: string): string {
    const [v, iv, tag, enc] = payload.split(':');
    if (v !== 'v1') throw new Error('Formato de segredo 2FA desconhecido.');
    const d = createDecipheriv('aes-256-gcm', this.chave, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
  }

  private async novosCodigos() {
    const codigos: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const c = Array.from(randomBytes(8)).map((x) => ALFABETO[x % ALFABETO.length]).join('');
      codigos.push(c.slice(0, 4) + '-' + c.slice(4));
      hashes.push(await bcrypt.hash(c, 10));
    }
    return { codigos, hashes };
  }
}
