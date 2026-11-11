import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
// apps/api/src/modules/darfs/darfs.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DarfsController } from './darfs.controller';
import { DarfsService } from './darfs.service';

@Module({
  imports: [SidebarPermissionsModule, PrismaModule],
  controllers: [DarfsController],
  providers: [DarfsService],
})
export class DarfsModule {}
