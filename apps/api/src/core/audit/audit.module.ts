import { SidebarPermissionsModule } from '../../modules/sidebar-permissions/sidebar-permissions.module';
import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [SidebarPermissionsModule, PrismaModule],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}