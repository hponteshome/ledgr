// apps/api/src/modules/sped/ecf/ecf.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { EcfController } from './controllers/ecf.controller';
import { EcfParserService } from './services/ecf-parser.service';
import { EcfValidatorService } from './services/ecf-validator.service';
import { EcfImporterService } from './services/ecf-importer.service';
import { EcfExporterService } from './services/ecf-exporter.service';
import { EcfPreValidateService } from './services/ecf-pre-validate.service';

@Module({
  imports: [PrismaModule],
  controllers: [EcfController],
  providers: [EcfParserService, EcfValidatorService, EcfImporterService, EcfExporterService, EcfPreValidateService],
  exports: [EcfParserService, EcfExporterService],
})
export class EcfModule {}
