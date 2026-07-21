// apps/api/src/mail/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPasswordReset(to: string, resetLink: string) {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'LEDGR — Recuperação de senha',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1D4ED8;">Recuperação de senha</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta LEDGR.</p>
            <p>
              <a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
                Redefinir minha senha
              </a>
            </p>
            <p style="color:#6B7280;font-size:13px;">Este link expira em 1 hora. Se você não solicitou essa alteração, ignore este e-mail — sua senha continua a mesma.</p>
          </div>
        `,
      });
      this.logger.log(`E-mail de recuperação enviado para ${to}`);
    } catch (err: any) {
      this.logger.error(`Falha ao enviar e-mail de recuperação para ${to}: ${err.message}`);
      throw err;
    }
  }
}