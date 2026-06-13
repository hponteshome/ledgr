// ============================================================
// LEDGR — src/modules/finance/finance.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { IntegrationService } from './integration.service';
import { AgendaService } from './agenda.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { ProvisaoController } from './provisao.controller';
import { ProvisaoService } from './provisao.service';
import { FechamentoController } from './fechamento.controller';
import { ObrigacoesController } from './obrigacoes.controller';
import { ObrigacoesService } from './obrigacoes.service';
import { FechamentoService } from './fechamento.service';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountsReceivableService } from './accounts-receivable.service';
import { CashflowController } from './cashflow.controller';
import { CashflowService } from './cashflow.service';
import { PettyCashController } from './petty-cash.controller';
import { PettyCashService } from './petty-cash.service';
import { AccountsPayableController } from './accounts-payable.controller';
import { AccountsPayableService } from './accounts-payable.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController, ProvisaoController, FechamentoController, ObrigacoesController, AccountsReceivableController, CashflowController, PettyCashController, AccountsPayableController],
  providers: [FinanceService, IntegrationService, AgendaService, ProvisaoService, FechamentoService, ObrigacoesService, AccountsReceivableService, CashflowService, PettyCashService, AccountsPayableService],
  exports: [FinanceService, AgendaService, IntegrationService, ProvisaoService, FechamentoService, ObrigacoesService, AccountsReceivableService],
})
export class FinanceModule {}

// ============================================================
// LEDGR — src/app.module.ts  (apenas o trecho a adicionar)
// ============================================================
// import { FinanceModule } from './modules/finance/finance.module';
//
// @Module({
//   imports: [
//     ...
//     FinanceModule,   // <-- adicionar aqui
//   ],
// })

