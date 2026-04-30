// /apps/api/src/modules/accounting/accounting.module.ts

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '@prisma/prisma.module';
import { PrismaService } from '@prisma/prisma.service';

// Controllers
import { AccountingController }        from './controllers/accounting.controller';
import { BalancesController }           from './controllers/balances.controller';
import { TrialBalanceController }       from './controllers/trial-balance.controller';
import { BalanceImportController }      from './controllers/balance-import.controller';
import { ChartOfAccountsController }    from './controllers/chart-of-accounts.controller';
import { JournalEntryController }       from './controllers/journal-entry.controller';
import { AccountingMaskController }     from './controllers/accounting-mask.controller';
import { AccountingImportController }   from './controllers/accounting-import.controller';
import { BalanceComparisonController }  from './controllers/balance-comparison.controller';
import { IobImportController }          from './controllers/iob-import.controller';

// Services
import { AccountingService }        from './services/accounting.service';
import { BalancesService }          from './services/balances.service';
import { TrialBalanceService }      from './services/trial-balance.service';
import { BalanceImportService }     from './services/balance-import.service';
import { BankImportService }        from './services/bank-import.service';
import { ChartOfAccountsService }   from './services/chart-of-accounts.service';
import { JournalEntryService }      from './services/journal-entry.service';
import { AccountingMaskService }    from './services/accounting-mask.service';
import { IobImportService }         from './services/iob-import.service';
import { IobPlanoParserService }    from './services/iob-plano-parser.service';
import { IobLotdParserService }     from './services/iob-lotd-parser.service';
import { FixedIncomeModule } from './fixed-income/fixed-income.module';
import { CdiModule } from './cdi/cdi.module';
import { IobLotdImportService }     from './services/iob-lotd-import.service';

@Module({
  imports: [
    PrismaModule,
    FixedIncomeModule,
    CdiModule,
    MulterModule.register({ limits: { fileSize: 50 * 1024 * 1024 } }),
  ],
  controllers: [
    AccountingController,
    BalancesController,
    TrialBalanceController,
    BalanceImportController,
    ChartOfAccountsController,
    JournalEntryController,
    AccountingMaskController,
    AccountingImportController,
    BalanceComparisonController,
    IobImportController,
  ],
  providers: [
    PrismaService,
    AccountingService,
    BalancesService,
    TrialBalanceService,
    BalanceImportService,
    BankImportService,
    ChartOfAccountsService,
    JournalEntryService,
    AccountingMaskService,
    IobImportService,
    IobPlanoParserService,
    IobLotdParserService,
    IobLotdImportService,
  ],
  exports: [
    AccountingService,
    ChartOfAccountsService,
    JournalEntryService,
    TrialBalanceService,
  ],
})
export class AccountingModule {}
