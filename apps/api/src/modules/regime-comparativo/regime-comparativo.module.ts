import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
// apps/api/src/modules/regime-comparativo/regime-comparativo.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { RegimeComparativoController } from './regime-comparativo.controller';
import { RegimeComparativoService } from './regime-comparativo.service';

@Module({
  imports: [SidebarPermissionsModule, PrismaModule],
  controllers: [RegimeComparativoController],
  providers: [RegimeComparativoService],
})
export class RegimeComparativoModule {}
