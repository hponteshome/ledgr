import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../prisma/prisma.module';
import { FiscalController } from './fiscal.controller';
import { NfseSpParserService } from './services/nfse-sp-parser.service';
import { NfseImportService } from './services/nfse-import.service';
import { NfeParserService } from './services/nfe-parser.service';
import { NfeImportService } from './services/nfe-import.service';

@Module({
  imports: [PrismaModule, MulterModule.register({ limits: { fileSize: 10*1024*1024 } })],
  controllers: [FiscalController],
  providers:   [NfseSpParserService, NfseImportService, NfeParserService, NfeImportService],
  exports:     [NfseImportService, NfeImportService],
})
export class FiscalModule {}
