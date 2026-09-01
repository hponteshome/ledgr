// apps/api/src/modules/accounting/services/ecd-movimentacao.service.ts
// CRIADO 01/09/2026: ferramenta SOMENTE LEITURA - mostra a movimentacao
// declarada (I155, account_balances) das contas ECD nativas ano a ano
// apos 2017, SEM criar, alterar ou apagar nenhum registro. Nao gera
// journal_entry, nao toca em chart_of_accounts, nao toca em nenhuma
// tabela - so consulta account_balances (dado ja importado e imutavel
// neste contexto) e calcula a diferenca entre saldos de fechamento de
// anos consecutivos no proprio codigo, sem persistir nada.
// Motivacao: usuario quer visibilidade do que aconteceu na ECD historica
// (2018 em diante) sem lancar isso na contabilidade real - principio ja
// estabelecido de que, a partir da abertura, ECD serve so para
// conferencia retroativa.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface ContaMovimentacao {
  accountId: string;
  code: string;
  name: string;
  type: string;
  saldosPorAno: Record<string, number | null>; // ano -> saldo declarado em 31/12
  movimentoPorAno: Record<string, number | null>; // ano -> diferenca vs ano anterior
  temMovimentoPosAbertura: boolean;
}

@Injectable()
export class EcdMovimentacaoService {
  constructor(private prisma: PrismaService) {}

  async getMovimentacao(companyId: string): Promise<{ anos: number[]; contas: ContaMovimentacao[] }> {
    // Contas nativas ECD (com vinculo de importacao) - mesmo criterio usado
    // em toda a plataforma para distinguir origem ECD de Matriz.
    const contas = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null, isAnalytic: true, ecdImportLinks: { some: {} } },
      select: { id: true, code: true, name: true, type: true },
    });

    if (contas.length === 0) return { anos: [], contas: [] };

    const contaIds = contas.map(c => c.id);

    // Todos os saldos de 31/12 de cada ano, para essas contas - LEITURA PURA
    const saldosBrutos = await this.prisma.$queryRaw<{ account_id: string; ano: number; balance: string }[]>`
      SELECT account_id, EXTRACT(YEAR FROM reference_date)::int AS ano, balance::text
      FROM account_balances
      WHERE account_id = ANY(${contaIds}::uuid[])
        AND EXTRACT(MONTH FROM reference_date) = 12
        AND EXTRACT(DAY FROM reference_date) = 31
        AND EXTRACT(YEAR FROM reference_date) >= 2017
      ORDER BY account_id, ano;
    `;

    const anosSet = new Set<number>();
    const porConta = new Map<string, Map<number, number>>();
    for (const s of saldosBrutos) {
      anosSet.add(s.ano);
      if (!porConta.has(s.account_id)) porConta.set(s.account_id, new Map());
      porConta.get(s.account_id)!.set(s.ano, Number(s.balance));
    }
    const anos = Array.from(anosSet).sort((a, b) => a - b);

    const resultado: ContaMovimentacao[] = contas.map(c => {
      const saldosAno = porConta.get(c.id) ?? new Map<number, number>();
      const saldosPorAno: Record<string, number | null> = {};
      const movimentoPorAno: Record<string, number | null> = {};
      let anterior: number | null = null;
      let temMovimentoPosAbertura = false;

      for (const ano of anos) {
        const saldo = saldosAno.has(ano) ? saldosAno.get(ano)! : null;
        saldosPorAno[ano] = saldo;
        if (anterior !== null && saldo !== null) {
          const mov = Math.round((saldo - anterior) * 100) / 100;
          movimentoPorAno[ano] = mov;
          if (ano > 2017 && Math.abs(mov) > 0.005) temMovimentoPosAbertura = true;
        } else {
          movimentoPorAno[ano] = null;
        }
        if (saldo !== null) anterior = saldo;
      }

      return {
        accountId: c.id, code: c.code, name: c.name, type: c.type,
        saldosPorAno, movimentoPorAno, temMovimentoPosAbertura,
      };
    });

    resultado.sort((a, b) => a.code.localeCompare(b.code));
    return { anos, contas: resultado };
  }
}
