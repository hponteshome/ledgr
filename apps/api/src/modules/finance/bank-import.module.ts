import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
// ============================================================
// LEDGR — apps/api/src/modules/finance/bank-import.module.ts
// FIX: Remove MulterModule — storage definido direto no interceptor
// ============================================================
import { Module } from '@nestjs/common';
import { BankImportController } from './bank-import.controller';
import { BankImportService } from './bank-import.service';
import { BankParserService } from './parsers/bank-parser.service';
import { SuggestionService } from './suggestion.service';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [SidebarPermissionsModule, PrismaModule],
  controllers: [BankImportController, BankAccountsController],
  providers: [BankImportService, BankParserService, SuggestionService, BankAccountsService],
  exports: [BankImportService, SuggestionService, BankAccountsService],
})
export class BankImportModule {}