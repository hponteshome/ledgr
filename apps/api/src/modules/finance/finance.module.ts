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

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController, ProvisaoController, FechamentoController],
  providers: [FinanceService, IntegrationService, AgendaService, ProvisaoService, FechamentoService],
  exports: [FinanceService, AgendaService, IntegrationService, ProvisaoService, FechamentoService],
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
