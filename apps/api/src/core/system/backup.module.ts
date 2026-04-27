// D:\Projetos\Ledgr\apps\api\src\core\system\backup.module.ts
import { Module } from '@nestjs/common';
import { BackupController } from './Backup.controller';
import { BackupService } from './backup.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BackupController],
  providers: [BackupService],
})
export class BackupModule {}