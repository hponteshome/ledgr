import { Module } from '@nestjs/common';
import { SidebarPermissionsService } from './sidebar-permissions.service';
import { SidebarPermissionsController } from './sidebar-permissions.controller';
import { PrismaModule } from '@prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SidebarPermissionsController],
  providers: [SidebarPermissionsService],
  exports: [SidebarPermissionsService],
})
export class SidebarPermissionsModule {}
