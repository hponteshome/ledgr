// D:\Projetos\Ledgr\apps\api\src\core\system\Backup.controller.ts
import { Controller, Get, Post, Body, Res, HttpStatus, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
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

  // Rota de emergencia: protegida por masterKey (env var), nao por JWT -
  // proposital, para permitir restauracao mesmo se o login estiver fora do ar.
  @Post('restore-emergency')
  async restore(@Body() body: any, @Res() res: Response) {
    const { masterKey, backupData } = body;

    if (masterKey !== process.env.BACKUP_MASTER_KEY) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Key invalida' });
    }

    try {
      await this.backupService.restoreFullBackup(backupData);
      return res.status(HttpStatus.OK).json({ message: 'Restauracao concluida!' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}
