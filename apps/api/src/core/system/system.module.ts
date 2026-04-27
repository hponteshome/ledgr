import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemController } from './system.controller';
import { ExportDataService } from './export-data.service';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  controllers: [
    SystemController, 
    //BackupController
  ],
  providers: [
    PrismaService,
    ExportDataService, 
    //BackupService
  ],
  exports: [
    ExportDataService, 
    //BackupService
  ],
})
export class SystemModule {}