// apps/api/src/modules/accounting/services/balance-comparison.service.ts
import { Injectable } from '@nestjs/common';
import { TrialBalanceService } from './trial-balance.service';

// CRIADO 25/08/2026: reescreve por completo a logica antiga de
// BalancesService.getBalanceComparison (agrupava account_balance bruto por
// ANO, sem filtro de deletedAt, sem garantia de fim-de-periodo - so pegava o
// que aparecesse por ultimo). Reaproveita 100% a logica ja validada do
// Balancete (TrialBalanceService.getVerificationBalance): chamando com
// startDate = endDate = <data>, o previousBalance (tudo antes) + movimento
// do proprio dia = saldo acumulado exatamente ate aquela data - da o "saldo
// num ponto no tempo" sem duplicar nenhuma logica de calculo.
//
// Inclui deliberadamente a arvore ECD (decisao explicita do usuario 25/08/2026
// - historico de saldos antigos normalmente so existe la; diferente do Plano
// de Contas/Balancete de rotina, que a partir de 24/08/2026 oculta ECD).
@Injectable()
export class BalanceComparisonService {
  constructor(private trialBalance: TrialBalanceService) {}

  private monthEndDates(startMonth: string, endMonth: string): Date[] {
    // startMonth/endMonth no formato "YYYY-MM"
    const [sy, sm] = startMonth.split('-').map(Number);
    const [ey, em] = endMonth.split('-').map(Number);
    const dates: Date[] = [];
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
      // dia 0 do mes seguinte = ultimo dia do mes atual
      dates.push(new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)));
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return dates;
  }

  async getComparison(companyId: string, startMonth: string, endMonth: string) {
    const periodos = this.monthEndDates(startMonth, endMonth);

    // conta.id -> { conta, descricao, level, isAnalytic, saldos: { "YYYY-MM-DD": valor } }
    const porConta = new Map<string, any>();

    for (const dataFim of periodos) {
      const chave = dataFim.toISOString().slice(0, 10);
      const { balances } = await this.trialBalance.getVerificationBalance(companyId, dataFim, dataFim);

      for (const b of balances as any[]) {
        const acc = b.account;
        if (!porConta.has(acc.id)) {
          porConta.set(acc.id, {
            conta: acc.code,
            descricao: acc.name,
            level: acc.level,
            isAnalytic: acc.isAnalytic,
            saldos: {},
          });
        }
        porConta.get(acc.id).saldos[chave] = b.currentBalance;
      }
    }

    return {
      periodos: periodos.map(d => d.toISOString().slice(0, 10)),
      contas: Array.from(porConta.values()).sort((a, b) => a.conta.localeCompare(b.conta)),
    };
  }

  // NOVO 12/09/2026: visao anual com movimento intercalado. Uma chamada por
  // ano (nao por mes) - getVerificationBalance(ano-01-01, ano-12-31) ja
  // devolve previousBalance = saldo em 31/12 do ano anterior e currentBalance
  // = saldo em 31/12 do proprio ano, entao "movimento do ano" e simplesmente
  // debits - credits do proprio periodo anual (sem calculo extra).
  async getComparisonAnual(companyId: string, anoIni: number, anoFim: number) {
    const anos: number[] = [];
    for (let a = anoIni; a <= anoFim; a++) anos.push(a);

    const porConta = new Map<string, any>();

    for (let idx = 0; idx < anos.length; idx++) {
      const ano = anos[idx];
      const dataIni = new Date(Date.UTC(ano, 0, 1, 0, 0, 0, 0));
      const dataFim = new Date(Date.UTC(ano, 11, 31, 23, 59, 59, 999));
      const { balances } = await this.trialBalance.getVerificationBalance(companyId, dataIni, dataFim);

      for (const b of balances as any[]) {
        const acc = b.account;
        if (!porConta.has(acc.id)) {
          porConta.set(acc.id, {
            conta: acc.code,
            descricao: acc.name,
            level: acc.level,
            isAnalytic: acc.isAnalytic,
            saldoAnterior: 0,
            saldos: {},
            movimentos: {},
          });
        }
        const linha = porConta.get(acc.id);
        if (idx === 0) linha.saldoAnterior = b.previousBalance;
        linha.saldos[ano] = b.currentBalance;
        linha.movimentos[ano] = b.debits - b.credits;
      }
    }

    return {
      anos,
      contas: Array.from(porConta.values()).sort((a, b) => a.conta.localeCompare(b.conta)),
    };
  }
}
