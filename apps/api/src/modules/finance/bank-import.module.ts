import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
import { FixedIncomeModule } from '../accounting/fixed-income/fixed-income.module'; // EXTINV-01
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
import { AccountingModule } from '../accounting/accounting.module'; // EXTBB-10A: JournalEntryService
import { BankReconciliationController } from './bank-reconciliation.controller'; // EXTBB-10A
import { BankReconciliationService } from './bank-reconciliation.service'; // EXTBB-10A

@Module({
  imports: [FixedIncomeModule, SidebarPermissionsModule, PrismaModule, AccountingModule], // EXTBB-10A: a Contabil nao importa o Financeiro (sem ciclo)
  controllers: [BankImportController, BankAccountsController, BankReconciliationController],
  providers: [BankImportService, BankParserService, SuggestionService, BankAccountsService, BankReconciliationService],
  exports: [BankImportService, SuggestionService, BankAccountsService],
})
export class BankImportModule {}