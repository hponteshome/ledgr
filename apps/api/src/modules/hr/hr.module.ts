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

@Module({
  imports: [PrismaModule],
  controllers: [ProLaboreController, InformeController, EmployeeController],
  providers: [ProLaboreService, GuiasService, InformeService, InformePdfService, EmployeePdfParserService, EmployeeService],
  exports: [ProLaboreService, GuiasService, InformeService, EmployeeService],
})
export class HrModule {}