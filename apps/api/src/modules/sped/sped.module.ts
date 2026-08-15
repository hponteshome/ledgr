// ============================================================
// LEDGR — apps/api/src/modules/sped/sped.module.ts
// FIX: Adiciona EcfController e serviços ECF ao módulo
// ============================================================
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';

// ECD
import { EcdParserService } from './ecd/services/ecd-parser.service';
import { EcdImporterService } from './ecd/services/ecd-importer.service';
import { EcdExporterService } from './ecd/services/ecd-exporter.service';
import { EcdPreValidateService } from './ecd/services/ecd-pre-validate.service';
import { AccountingViewsService } from './visoes/accounting-views.service';
import { AccountingViewsController } from './visoes/accounting-views.controller';
import { EcdValidatorService } from './ecd/services/ecd-validator.service';
import { EcdController } from './ecd/controllers/ecd.controller';
import { EcdViewerService } from './ecd/services/ecd-viewer.service';
import { EcdViewerController } from './ecd/controllers/ecd-viewer.controller';


// EFD
import { EfdModule } from './efd/efd.module';
// ECF
import { EcfModule } from './ecf/ecf.module';

@Module({
  imports: [
    PrismaModule,
    EfdModule,
    EcfModule,
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  ],
  controllers: [
    AccountingViewsController,
    EcdController,
    EcdViewerController,
  ],
  providers: [
    PrismaService,
    // ECD
    EcdParserService,
    EcdImporterService,
    EcdViewerService,
    EcdExporterService,
    EcdPreValidateService,
    AccountingViewsService,
    EcdValidatorService,
  ],
  exports: [
    EcdParserService,
    EcdExporterService,
    EcdPreValidateService,
    AccountingViewsService,
    EcfModule,
  ],
})
export class SpedModule {}
