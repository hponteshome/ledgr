import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../prisma/prisma.module';
import { CertificatesModule } from '../../core/certificates/certificates.module';
import { FiscalController } from './fiscal.controller';
import { NfseSpParserService } from './services/nfse-sp-parser.service';
import { NfseImportService } from './services/nfse-import.service';
import { NfeParserService } from './services/nfe-parser.service';
import { NfeImportService } from './services/nfe-import.service';
import { NfseNacionalService } from './services/nfse-nacional.service';
import { NfseSpConsultaService } from './services/nfse-sp-consulta.service';

@Module({
  imports: [
    PrismaModule,
    CertificatesModule,
    MulterModule.register({ limits: { fileSize: 10*1024*1024 } }),
  ],
  controllers: [FiscalController],
  providers: [
    NfseSpParserService, NfseImportService,
    NfeParserService,    NfeImportService,
    NfseNacionalService, NfseSpConsultaService,
  ],
  exports: [NfseImportService, NfeImportService, NfseNacionalService, NfseSpConsultaService],
})
export class FiscalModule {}
