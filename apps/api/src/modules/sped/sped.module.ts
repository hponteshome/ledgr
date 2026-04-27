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
import { EcdValidatorService } from './ecd/services/ecd-validator.service';
import { EcdController } from './ecd/controllers/ecd.controller';
import { EcdViewerService } from './ecd/services/ecd-viewer.service';
import { EcdViewerController } from './ecd/controllers/ecd-viewer.controller';


// ECF
import { EcfParserService } from './ecf/services/ecf-parser.service';
import { EcfValidatorService } from './ecf/services/ecf-validator.service';
import { EcfImporterService } from './ecf/services/ecf-importer.service';
import { EcfController } from './ecf/controllers/ecf.controller';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  ],
  controllers: [
    EcdController,    
    EcfController,   // ← ADICIONADO
    EcdViewerController,

  ],
  providers: [
    PrismaService,
    // ECD
    EcdParserService,
    EcdImporterService,
    EcdViewerService,
    EcdExporterService,
    EcdValidatorService,

    // ECF
    EcfParserService,   // ← ADICIONADO
    EcfValidatorService, // ← ADICIONADO
    EcfImporterService,  // ← ADICIONADO
  ],
  exports: [
    EcdParserService,
    EcdExporterService,
    EcfParserService,   // ← ADICIONADO
  ],
})
export class SpedModule {}