// ============================================================
// LEDGR — apps/api/src/modules/finance/bank-import.module.ts
// FIX: Remove MulterModule — storage definido direto no interceptor
// ============================================================
import { Module } from '@nestjs/common';
import { BankImportController } from './bank-import.controller';
import { BankImportService } from './bank-import.service';
import { BankParserService } from './parsers/bank-parser.service';
import { SuggestionService } from './suggestion.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BankImportController],
  providers: [BankImportService, BankParserService, SuggestionService],
  exports: [BankImportService, SuggestionService],
})
export class BankImportModule {}