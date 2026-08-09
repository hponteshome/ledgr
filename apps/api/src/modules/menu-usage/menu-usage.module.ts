// apps/api/src/modules/menu-usage/menu-usage.module.ts
import { Module } from '@nestjs/common';
import { MenuUsageService } from './menu-usage.service';
import { MenuUsageController } from './menu-usage.controller';
import { PrismaModule } from '@prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MenuUsageController],
  providers: [MenuUsageService],
  exports: [MenuUsageService],
})
export class MenuUsageModule {}
