// apps/api/src/modules/dimob/dimob.module.ts
// LEDGR - DIMOB (18/11/2026)
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { DimobController } from './dimob.controller';
import { DimobService } from './dimob.service';

@Module({
  imports: [PrismaModule, SidebarPermissionsModule],
  controllers: [DimobController],
  providers: [DimobService, SidebarResourceGuard],
})
export class DimobModule {}
