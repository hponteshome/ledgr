// apps/api/src/modules/locacao/rental-contracts.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RentalContractsController } from './rental-contracts.controller';
import { RentalContractsService } from './rental-contracts.service';

@Module({
  imports: [PrismaModule, SidebarPermissionsModule],
  controllers: [RentalContractsController],
  providers: [RentalContractsService, SidebarResourceGuard],
})
export class RentalContractsModule {}