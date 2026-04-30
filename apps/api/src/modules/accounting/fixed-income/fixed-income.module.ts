// apps/api/src/modules/accounting/fixed-income/fixed-income.module.ts

import { Module } from '@nestjs/common';
import { FixedIncomeService } from './fixed-income.service';
import { FixedIncomeController } from './fixed-income.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FixedIncomeController],
  providers: [FixedIncomeService],
  exports: [FixedIncomeService],
})
export class FixedIncomeModule {}

// =============================================================================
// INTEGRAÇÃO — passos para ativar o módulo
// =============================================================================

/*
1. Adicionar ao schema.prisma os models de schema-additions.prisma
   (FixedIncomeInvestment, FixedIncomeMonthlyRate, FixedIncomeEvent)

2. Adicionar relation na Company:
   fixedIncomeInvestments FixedIncomeInvestment[]

3. Rodar migration:
   cd apps/api
   npx prisma migrate dev --name add_fixed_income_module

4. Registrar no AccountingModule (ou AppModule):
   imports: [..., FixedIncomeModule]

5. Adicionar rota no frontend routes/index.tsx:
   {
     path: '/app/accounting/investimentos/renda-fixa',
     element: <CdbProjecaoPage />,
   }

6. Adicionar no SideBar.tsx (abaixo de "Balancete"):
   {
     label: 'Renda Fixa',
     path: '/app/accounting/investimentos/renda-fixa',
     icon: '◈',
   }

7. Endpoints disponíveis:
   GET    /accounting/fixed-income                    → listar investimentos
   POST   /accounting/fixed-income                    → criar investimento
   GET    /accounting/fixed-income/:id                → detalhe + histórico
   DELETE /accounting/fixed-income/:id                → soft delete
   POST   /accounting/fixed-income/:id/monthly-update → atualização mensal CDI real
   POST   /accounting/fixed-income/bulk-update         → atualização em lote (todos ativos)
   POST   /accounting/fixed-income/:id/redeem         → registrar resgate
   GET    /accounting/fixed-income/:id/projection     → projeção com dados reais + proj
   POST   /accounting/fixed-income/simulate           → simulação sem persistência

8. Para o IRRF como antecipação de IRPJ/CSLL (Lucro Real):
   - Criar conta contábil "IRRF sobre aplicações a recuperar" (Ativo Circulante)
   - Vincular no campo irrfAccountId do investimento
   - Na competência do resgate, estornar o saldo de IRRF e registrar o efetivo

9. Atualização mensal automatizada (opcional — cron):
   Criar um CronService que rode todo dia 1 do mês:
   POST /accounting/fixed-income/bulk-update
   { competence: "YYYY-MM", indexerRate: <CDI_DO_MES>, generateJournalEntry: true }
*/

// =============================================================================
// NOTA FISCAL / IRPJ — Tratamento Lucro Real
// =============================================================================
/*
Receita financeira bruta: reconhecida mensalmente (competência)
  Débito:  CDB a receber (Ativo)
  Crédito: Receita financeira (Resultado)

IRRF retido no resgate:
  Débito:  IRRF a recuperar (Ativo Circulante)
  Crédito: Caixa/Banco (pelo líquido recebido)
  Crédito: CDB a receber (zerado)

Na DCTF/ECF: IRRF informado como antecipação de IRPJ/CSLL
LCI/LCA/CRI/CRA: receita financeira bruta integra base de cálculo IRPJ/CSLL
(apenas IRRF de pessoa física é isento — PJ não tem isenção de IRPJ/CSLL)
*/
