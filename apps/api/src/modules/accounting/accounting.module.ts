// /apps/api/src/modules/accounting/accounting.module.ts

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '@prisma/prisma.module';
import { SpedModule } from '../sped/sped.module';
import { PrismaService } from '@prisma/prisma.service';

// Controllers
import { AccountingController }        from './controllers/accounting.controller';
import { AccountingConfigController }  from './controllers/accounting-config.controller';
import { AccountingConfigService }     from './services/accounting-config.service';
import { BalancesController }           from './controllers/balances.controller';
import { TrialBalanceController }       from './controllers/trial-balance.controller';
import { BalanceImportController }      from './controllers/balance-import.controller';
import { ChartOfAccountsController }    from './controllers/chart-of-accounts.controller';
import { JournalEntryController }       from './controllers/journal-entry.controller';
import { AccountingMaskController }     from './controllers/accounting-mask.controller';
import { AccountingImportController }   from './controllers/accounting-import.controller';
import { BalanceComparisonController }  from './controllers/balance-comparison.controller';
import { IobImportController }          from './controllers/iob-import.controller';
import { MatrizImportController }       from './controllers/matriz-import.controller';
import { MatrizMasterAccountController } from './controllers/matriz-master-account.controller';
import { ChartImporterController }   from './controllers/chart-importer.controller';
import { JournalImporterController } from './controllers/journal-importer.controller';
import { EncerramentoExercicioController } from './controllers/encerramento-exercicio.controller';
import { TabelaComparativaController } from './controllers/tabela-comparativa.controller';
import { AberturaController } from './controllers/abertura.controller';
import { DeParaSugestaoController } from './controllers/de-para-sugestao.controller';
import { EcdMovimentacaoController } from './controllers/ecd-movimentacao.controller';
import { EcdLancamentosImportController } from './controllers/ecd-lancamentos-import.controller';

// Services
import { AccountingService }        from './services/accounting.service';
import { BalancesService }          from './services/balances.service';
import { BalanceComparisonService } from './services/balance-comparison.service';
import { TrialBalanceService }      from './services/trial-balance.service';
import { BalanceImportService }     from './services/balance-import.service';
import { BankImportService }        from './services/bank-import.service';
import { ChartOfAccountsService }   from './services/chart-of-accounts.service';
import { JournalEntryService }      from './services/journal-entry.service';
import { AccountingMaskService }    from './services/accounting-mask.service';
import { MatrizImportService }      from './services/matriz-import.service';
import { MatrizMasterAccountService } from './services/matriz-master-account.service';
import { MatrizPlanoParserService }  from './services/matriz-plano-parser.service';
import { ChartImporterService }       from './services/chart-importer.service';
import { JournalImporterService }    from './services/journal-importer.service';
import { EncerramentoExercicioService } from './services/encerramento-exercicio.service';
import { TabelaComparativaService } from './services/tabela-comparativa.service';
import { AberturaService } from './services/abertura.service';
import { DeParaSugestaoService } from './services/de-para-sugestao.service';
import { EcdMovimentacaoService } from './services/ecd-movimentacao.service';
import { EcdLancamentosImportService } from './services/ecd-lancamentos-import.service';
import { IobLotdParserService }     from './services/iob-lotd-parser.service';
import { FixedIncomeModule } from './fixed-income/fixed-income.module';
import { CdiModule } from './cdi/cdi.module';
import { IobLotdImportService }     from './services/iob-lotd-import.service';
import { SidebarPermissionsModule } from '../sidebar-permissions/sidebar-permissions.module';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';

@Module({
  imports: [
    PrismaModule,
    SpedModule,
    FixedIncomeModule,
    CdiModule,
    MulterModule.register({ limits: { fileSize: 50 * 1024 * 1024 } }),
    SidebarPermissionsModule,
  ],
  controllers: [
    AccountingConfigController,
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
    MatrizImportController,
    MatrizMasterAccountController,
    ChartImporterController,
    JournalImporterController,
    EncerramentoExercicioController,
    TabelaComparativaController,
    AberturaController,
    DeParaSugestaoController,
    EcdMovimentacaoController,
    EcdLancamentosImportController,
  ],
  providers: [
    AccountingConfigService,
    PrismaService,
    AccountingService,
    BalancesService,
    BalanceComparisonService,
    TrialBalanceService,
    BalanceImportService,
    BankImportService,
    ChartOfAccountsService,
    JournalEntryService,
    AccountingMaskService,
    MatrizImportService,
    MatrizMasterAccountService,
    ChartImporterService,
    JournalImporterService,
    EncerramentoExercicioService,
    TabelaComparativaService,
    AberturaService,
    DeParaSugestaoService,
    EcdMovimentacaoService,
    EcdLancamentosImportService,
    MatrizPlanoParserService,
    IobLotdParserService,
    IobLotdImportService,
    SidebarResourceGuard,
  ],
  exports: [
    AccountingService,
    ChartOfAccountsService,
    JournalEntryService,
    TrialBalanceService,
  ],
})
export class AccountingModule {}







