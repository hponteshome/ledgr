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
import { TrctPdfService } from './services/trct-pdf.service';
import { RescisaoService } from './services/rescisao.service';
import { EsocialTransmissionService } from './services/esocial-transmission.service';
import { CertificatesModule } from '../../core/certificates/certificates.module';
import { BancoHorasService } from './services/banco-horas.service';
import { FeriasService } from './services/ferias.service';
import { FeriasController } from './ferias.controller';
import { RecessoController } from './recesso.controller';
import { RecessoService } from './services/recesso.service';
import { DecimoTerceiroController } from './decimo-terceiro.controller';
import { DecimoTerceiroService } from './services/decimo-terceiro.service';
import { RaisController } from './rais.controller';
import { RaisService } from './services/rais.service';
import { DctfWebController } from './dctfweb.controller';
import { DctfWebService } from './services/dctfweb.service';
@Module({
  imports: [PrismaModule, CertificatesModule],
  controllers: [ProLaboreController, InformeController, EmployeeController, HrController, FolhaController, RescisaoController, FeriasController, RecessoController, DecimoTerceiroController, RaisController, DctfWebController],
  providers: [ProLaboreService, GuiasService, InformeService, InformePdfService, EmployeePdfParserService, EmployeeService, EsocialS2200Service, EsocialEventsService, FolhaService, RescisaoService, TrctPdfService, EsocialTransmissionService, BancoHorasService, FeriasService, RecessoService, DecimoTerceiroService, RaisService, DctfWebService],
  exports: [ProLaboreService, GuiasService, InformeService, EmployeeService, EsocialS2200Service, EsocialEventsService, FolhaService, RescisaoService, TrctPdfService, EsocialTransmissionService, BancoHorasService, FeriasService],
})
export class HrModule {}
