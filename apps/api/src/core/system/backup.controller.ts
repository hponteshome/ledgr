// D:\Projetos\Ledgr\apps\api\src\core\system\Backup.controller.ts
import { Controller, Get, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { BackupService } from './backup.service';
import { Response } from 'express';

@Controller('system/backup') // <--- Isso define a rota automaticamente
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get('export')
  async export(@Res() res: Response) {
    try {
      const backup = await this.backupService.exportFullBackup();
      return res.status(HttpStatus.OK).json(backup);
    } catch (error) {
      return res.status(500).json({ error: 'Erro ao exportar' });
    }
  }

  @Post('restore-emergency')
  async restore(@Body() body: any, @Res() res: Response) {
    const { masterKey, backupData } = body;
    
    if (masterKey !== process.env.BACKUP_MASTER_KEY) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Key inválida' });
    }

    try {
      await this.backupService.restoreFullBackup(backupData);
      return res.status(HttpStatus.OK).json({ message: 'Restauração concluída!' });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
 @Get('export')
async handleExport(@Res() res: Response) { // Mude de 'export' para 'handleExport'
  try {
    const backup = await this.backupService.exportFullBackup();
    return res.status(HttpStatus.OK).json(backup);
  } catch (error: any) {
    console.error('Falha na Exportação:', error);
    return res.status(500).json({ error: error.message });
  }
}
}