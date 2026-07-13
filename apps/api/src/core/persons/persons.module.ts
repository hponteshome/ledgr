// apps/api/src/core/persons/persons.module.ts
import { Module } from '@nestjs/common';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SidebarPermissionsModule } from '../../modules/sidebar-permissions/sidebar-permissions.module';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';

@Module({
  imports: [PrismaModule, SidebarPermissionsModule],
  controllers: [PersonsController],
  providers: [PersonsService, SidebarResourceGuard],
  exports: [PersonsService],
})
export class PersonsModule {}
