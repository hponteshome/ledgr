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
import { FechamentoService } from './fechamento.service';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountsReceivableService } from './accounts-receivable.service';
import { CashflowController } from './cashflow.controller';
import { CashflowService } from './cashflow.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController, ProvisaoController, FechamentoController, AccountsReceivableController, CashflowController],
  providers: [FinanceService, IntegrationService, AgendaService, ProvisaoService, FechamentoService, AccountsReceivableService, CashflowService],
  exports: [FinanceService, AgendaService, IntegrationService, ProvisaoService, FechamentoService, AccountsReceivableService],
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
