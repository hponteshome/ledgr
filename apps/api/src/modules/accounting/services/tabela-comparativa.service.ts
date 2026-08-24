// apps/api/src/modules/accounting/services/tabela-comparativa.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

interface ComparativoRow {
  target_code: string;
  target_name: string;
  target_type: string;
  source_id: string;
  source_code: string;
  source_name: string;
  match_type: string;
  ano: number;
  valor: number | null;
}

export interface ComparativoOrigem {
  sourceId: string;
  sourceCode: string;
  sourceName: string;
  matchType: string;
  valoresPorAno: Record<number, number | null>;
}

export interface ComparativoLinha {
  targetCode: string;
  targetName: string;
  targetType: string;
  valoresPorAno: Record<number, number>;
  origens: ComparativoOrigem[];
}

@Injectable()
export class TabelaComparativaService {
  constructor(private prisma: PrismaService) {}

  // Tabela Comparativa ECD x Matriz (conceito 22/08/2026, LEDGR-contexto.md).
  // Para cada conta matriz mapeada, mostra o saldo/movimento de cada conta ECD
  // de origem (qualquer ano), lado a lado por ano - visualiza renumeracao de
  // conta entre anos vs movimento real. Regra de calculo por classe:
  //   ASSET/LIABILITY/EQUITY -> saldo final em 31/12 do ano (account_balances)
  //   REVENUE/EXPENSE        -> movimento liquido do ano, excluindo lancamentos
  //                             de encerramento (is_closing_entry)
  // Vigencia (chart_of_accounts_ecd_imports): so retorna valor pra (conta, ano)
  // se aquele codigo de fato foi declarado no I050 daquele ano - evita o "eco"
  // do saldo de abertura contaminar o ano anterior (achado real 23/08/2026).
  async getComparativo(companyId: string, anoInicio: number, anoFim: number) {
    const rows = await this.prisma.$queryRaw<ComparativoRow[]>`
      WITH anos AS (
        SELECT generate_series(${anoInicio}::int, ${anoFim}::int) AS ano
      ),
      vigencia AS (
        SELECT link.account_id, EXTRACT(YEAR FROM ei.period_start)::int AS ano
        FROM chart_of_accounts_ecd_imports link
        JOIN ecd_imports ei ON ei.id = link.ecd_import_id
      )
      SELECT
        ca_tgt.code AS target_code,
        ca_tgt.name AS target_name,
        ca_tgt.type AS target_type,
        ca_src.id   AS source_id,
        ca_src.code AS source_code,
        ca_src.name AS source_name,
        m.match_type,
        a.ano,
        CASE WHEN v.ano IS NULL THEN NULL ELSE
          CASE
            WHEN ca_src.type IN ('ASSET','LIABILITY','EQUITY') THEN (
              SELECT ab.balance FROM account_balances ab
              WHERE ab.account_id = ca_src.id AND ab.reference_date::date = make_date(a.ano,12,31)
              LIMIT 1
            )
            ELSE (
              SELECT SUM(CASE
                           WHEN (ca_src.nature = 'DEBIT'  AND jei.type = 'DEBIT')  THEN jei.value
                           WHEN (ca_src.nature = 'CREDIT' AND jei.type = 'CREDIT') THEN jei.value
                           ELSE 0
                         END)
              FROM journal_entry_items jei
              JOIN journal_entries je ON je.id = jei.journal_entry_id
              WHERE jei.account_id = ca_src.id
                AND je.is_closing_entry = false
                AND EXTRACT(YEAR FROM je.date) = a.ano
                AND je.deleted_at IS NULL
            )
          END
        END AS valor
      FROM ecd_account_mappings m
      JOIN chart_of_accounts ca_src ON ca_src.id = m.source_account_id
      JOIN chart_of_accounts ca_tgt ON ca_tgt.id = m.target_account_id
      CROSS JOIN anos a
      LEFT JOIN vigencia v ON v.account_id = ca_src.id AND v.ano = a.ano
      WHERE m.company_id = ${companyId}::uuid
      ORDER BY ca_tgt.code, ca_src.code, a.ano;
    `;

    const porTarget = new Map<string, ComparativoLinha>();
    for (const r of rows) {
      let linha = porTarget.get(r.target_code);
      if (!linha) {
        linha = {
          targetCode: r.target_code,
          targetName: r.target_name,
          targetType: r.target_type,
          valoresPorAno: {},
          origens: [],
        };
        porTarget.set(r.target_code, linha);
      }
      let origem = linha.origens.find((o) => o.sourceId === r.source_id);
      if (!origem) {
        origem = {
          sourceId: r.source_id,
          sourceCode: r.source_code,
          sourceName: r.source_name,
          matchType: r.match_type,
          valoresPorAno: {},
        };
        linha.origens.push(origem);
      }
      const valor = r.valor === null ? null : Number(r.valor);
      origem.valoresPorAno[r.ano] = valor;
      linha.valoresPorAno[r.ano] = (linha.valoresPorAno[r.ano] ?? 0) + (valor ?? 0);
    }

    return {
      anos: Array.from({ length: anoFim - anoInicio + 1 }, (_, i) => anoInicio + i),
      linhas: Array.from(porTarget.values()),
    };
  }
}
