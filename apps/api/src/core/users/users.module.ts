import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { SidebarPermissionsModule } from '../../modules/sidebar-permissions/sidebar-permissions.module';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    SidebarPermissionsModule,
  ],
  controllers: [
    UsersController,
    ProfilesController
  ],
  providers: [UsersService, ProfilesService, SidebarResourceGuard],
  exports: [UsersService],
})
export class UsersModule {}
