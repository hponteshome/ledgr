// D:\Projetos\Ledgr\apps\api\src\core\system\Backup.controller.ts
import { Controller, Get, Post, Body, Res, HttpStatus, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import * as crypto from 'crypto';
import { Req, ForbiddenException } from '@nestjs/common';

@Controller('system/backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @UseGuards(JwtAuthGuard)
  @Get('export')
  async handleExport(@Req() req: any, @Res() res: Response) {
    const isMasterAdmin = (req.user?.profile?.permissions as any)?.all === true;
    if (!isMasterAdmin) {
      return res.status(HttpStatus.FORBIDDEN).json({ error: 'Apenas Master Admin pode exportar o backup completo.' });
    }
    try {
      const backup = await this.backupService.exportFullBackup();
      return res.status(HttpStatus.OK).json(backup);
    } catch (error: any) {
      console.error('Falha na Exportacao:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  // Rota de emergencia: sem JWT de proposito (restaurar mesmo com o login fora do ar).
  // Seguranca 0A (04/10/2026): so da PROPRIA MAQUINA; chave obrigatoria com >= 32 caracteres; comparacao em tempo
  // constante; toda tentativa vai para o log; nenhum detalhe interno na resposta. Antes, sem BACKUP_MASTER_KEY carregada,
  // uma requisicao sem chave passava (undefined !== undefined e falso).
  @Post('restore-emergency')
  @SkipCompanyCheck() // sem usuario (sem JWT de proposito): a protecao e a da propria rota (local + chave)
  async restore(@Req() req: any, @Body() body: any, @Res() res: Response) {
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
    const chave = String(process.env.BACKUP_MASTER_KEY || '');
    const enviada = String(body?.masterKey || '');
    const ok = chave.length >= 32 && enviada.length === chave.length && crypto.timingSafeEqual(Buffer.from(enviada), Buffer.from(chave));
    if (!local || !ok) {
      console.warn(`[Backup] restauracao de emergencia RECUSADA (ip=${ip}, local=${local}, chave_configurada=${chave.length >= 32})`);
      return res.status(HttpStatus.FORBIDDEN).json({ error: 'Restauracao de emergencia recusada.' });
    }
    console.warn(`[Backup] restauracao de emergencia AUTORIZADA (ip=${ip})`);
    try {
      await this.backupService.restoreFullBackup(body.backupData);
      return res.status(HttpStatus.OK).json({ message: 'Restauracao concluida!' });
    } catch (error: any) {
      console.error('[Backup] falha na restauracao de emergencia:', error);
      return res.status(500).json({ error: 'Falha na restauracao. Consulte o log do servidor.' });
    }
  }
}
