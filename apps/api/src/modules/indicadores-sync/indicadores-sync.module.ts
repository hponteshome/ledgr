// apps/api/src/modules/indicadores-sync/indicadores-sync.module.ts
// CRIADO 23/11/2026 (IND-AUTO-01)
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
import { IndicadoresSyncController } from './indicadores-sync.controller';
import { IndicadoresSyncService } from './indicadores-sync.service';

@Module({
  imports: [PrismaModule, SidebarPermissionsModule],
  controllers: [IndicadoresSyncController],
  providers: [IndicadoresSyncService],
  exports: [IndicadoresSyncService],
})
export class IndicadoresSyncModule {}
