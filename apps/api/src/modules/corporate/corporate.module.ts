// apps/api/src/modules/corporate/corporate.module.ts
import { Module } from '@nestjs/common';
import { ShareholdersController } from './shareholders/shareholders.controller';
import { ShareholdersService } from './shareholders/shareholders.service';
import { TransfersController } from './transfers/transfers.controller';
import { TransfersService } from './transfers/transfers.service';
import { CorporatePdfService } from './pdf/corporate-pdf.service';
import { CorporatePdfController } from './pdf/corporate-pdf.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ShareholdersController, TransfersController, CorporatePdfController],
  providers: [ShareholdersService, TransfersService, CorporatePdfService, PrismaService],
  exports: [ShareholdersService, TransfersService],



})
export class CorporateModule {}