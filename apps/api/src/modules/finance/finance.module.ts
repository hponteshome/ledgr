// ============================================================
// LEDGR — src/modules/finance/finance.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { IntegrationService } from './integration.service';
import { AgendaService } from './agenda.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController],
  providers: [FinanceService, IntegrationService, AgendaService],
  exports: [FinanceService, AgendaService, IntegrationService],
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
