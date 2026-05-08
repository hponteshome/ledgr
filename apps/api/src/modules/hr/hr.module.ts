// apps/api/src/modules/hr/hr.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProLaboreController } from './pro-labore.controller';
import { ProLaboreService } from './services/pro-labore.service';
import { GuiasService } from './services/guias.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProLaboreController],
  providers: [ProLaboreService, GuiasService],
  exports: [ProLaboreService, GuiasService],
})
export class HrModule {}

