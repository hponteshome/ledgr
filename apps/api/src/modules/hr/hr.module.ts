// apps/api/src/modules/hr/hr.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProLaboreController } from './pro-labore.controller';
import { ProLaboreService } from './services/pro-labore.service';
import { GuiasService } from './services/guias.service';
import { InformeController } from './informe.controller';
import { InformeService } from './informe.service';
import { InformePdfService } from './informe-pdf.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProLaboreController, InformeController],
  providers: [ProLaboreService, GuiasService, InformeService, InformePdfService],
  exports: [ProLaboreService, GuiasService, InformeService],
})
export class HrModule {}