// apps/api/src/modules/hr/hr.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProLaboreController } from './pro-labore.controller';
import { ProLaboreService } from './services/pro-labore.service';
import { GuiasService } from './services/guias.service';
import { InformeController } from './informe.controller';
import { InformeService } from './informe.service';
import { InformePdfService } from './informe-pdf.service';
import { EmployeeController } from './employee.controller';
import { EmployeePdfParserService } from './services/employee-pdf-parser.service';
import { EmployeeService } from './services/employee.service';
import { HrController } from './hr.controller';
import { FolhaController } from './folha.controller';
import { FolhaService } from './services/folha.service';
import { EsocialS2200Service } from './services/esocial-s2200.service';
import { EsocialEventsService } from './services/esocial-events.service';
import { RescisaoController } from './rescisao.controller';
import { RescisaoService } from './services/rescisao.service';
@Module({
  imports: [PrismaModule],
  controllers: [ProLaboreController, InformeController, EmployeeController, HrController, FolhaController, RescisaoController],
  providers: [ProLaboreService, GuiasService, InformeService, InformePdfService, EmployeePdfParserService, EmployeeService, EsocialS2200Service, EsocialEventsService, FolhaService, RescisaoService],
  exports: [ProLaboreService, GuiasService, InformeService, EmployeeService, EsocialS2200Service, EsocialEventsService, FolhaService, RescisaoService],
})
export class HrModule {}
