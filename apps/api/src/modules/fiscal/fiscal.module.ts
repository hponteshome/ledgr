import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../prisma/prisma.module';
import { FiscalController } from './fiscal.controller';
import { NfseSpParserService } from './services/nfse-sp-parser.service';
import { NfseImportService } from './services/nfse-import.service';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [FiscalController],
  providers:   [NfseSpParserService, NfseImportService],
  exports:     [NfseImportService],
})
export class FiscalModule {}
