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

  async sendNewRegistrationNotification(to: string, dados: { fullName: string; email: string; document: string; pendingFlags: string }) {
    try {
      const flagLabel: Record<string, string> = {
        OK: 'CPF conferido — sem divergencias',
        CPF_NAO_ENCONTRADO: 'ATENCAO: CPF nao encontrado na base de Pessoas',
        DIVERGENCIA_NOME: 'ATENCAO: Nome divergente do cadastro de Pessoas',
      };
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'LEDGR — Nova solicitacao de cadastro pendente',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #1D4ED8;">Nova solicitacao de acesso</h2>
            <p>Um novo usuario solicitou acesso ao sistema e aguarda sua aprovacao.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:4px 0;color:#6B7280;">Nome:</td><td style="padding:4px 0;font-weight:600;">${dados.fullName}</td></tr>
              <tr><td style="padding:4px 0;color:#6B7280;">E-mail:</td><td style="padding:4px 0;">${dados.email}</td></tr>
              <tr><td style="padding:4px 0;color:#6B7280;">CPF:</td><td style="padding:4px 0;">${dados.document}</td></tr>
              <tr><td style="padding:4px 0;color:#6B7280;">Status:</td><td style="padding:4px 0;">${flagLabel[dados.pendingFlags] ?? dados.pendingFlags}</td></tr>
            </table>
            <p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/usuarios/pendentes" style="display:inline-block;padding:12px 24px;background:#2563EB;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
                Analisar solicitacao
              </a>
            </p>
          </div>
        `,
      });
      this.logger.log(`Notificacao de novo cadastro enviada para ${to}`);
    } catch (err: any) {
      this.logger.error(`Falha ao enviar notificacao de novo cadastro para ${to}: ${err.message}`);
      // Nao propaga o erro - falha de e-mail nao deve bloquear o cadastro do usuario
    }
  }
}