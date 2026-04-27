// src/core/certificates/crypto.service.ts
//
// Responsabilidade única: criptografar / descriptografar chaves privadas
// com AES-256-GCM usando a LEDGR_MASTER_KEY do ambiente.
//
// Formato gravado no banco:
//   base64(iv) : base64(authTag) : base64(ciphertext)
//
// NUNCA logar, retornar em API ou gravar em texto plano o plaintext.

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGO     = 'aes-256-gcm';
const IV_BYTES = 12;   // 96 bits — recomendado para GCM
const TAG_BYTES = 16;  // 128 bits — padrão GCM

@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly masterKey: Buffer;

  constructor() {
    const raw = process.env.LEDGR_MASTER_KEY;
    if (!raw || raw.length !== 64) {
      throw new InternalServerErrorException(
        'LEDGR_MASTER_KEY ausente ou inválida. ' +
        'Gere com: openssl rand -hex 32  (deve ter 64 caracteres hex)',
      );
    }
    this.masterKey = Buffer.from(raw, 'hex');
  }

  // ── Cifra texto plano → string armazenável ──────────────────
  encrypt(plaintext: string): string {
    const iv         = crypto.randomBytes(IV_BYTES);
    const cipher     = crypto.createCipheriv(ALGO, this.masterKey, iv, { authTagLength: TAG_BYTES });
    const encrypted  = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag    = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  // ── Decifra string armazenada → texto plano ─────────────────
  decrypt(stored: string): string {
    const parts = stored.split(':');
    if (parts.length !== 3) {
      throw new InternalServerErrorException('Formato de chave criptografada inválido');
    }
    const [ivB64, tagB64, ctB64] = parts;
    const iv         = Buffer.from(ivB64,  'base64');
    const authTag    = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(ctB64,  'base64');

    const decipher = crypto.createDecipheriv(ALGO, this.masterKey, iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'Falha ao descriptografar chave: autenticação GCM inválida. ' +
        'A LEDGR_MASTER_KEY pode ter sido alterada.',
      );
    }
  }

  // ── SHA-256 de buffer (para fingerprint de certificados) ────
  sha256Hex(data: Buffer | string): string {
    return crypto
      .createHash('sha256')
      .update(typeof data === 'string' ? Buffer.from(data, 'utf8') : data)
      .digest('hex');
  }

  // ── SHA-256 de texto para hash de conteúdo de documento ────
  sha256Text(text: string): string {
    return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
  }
}
