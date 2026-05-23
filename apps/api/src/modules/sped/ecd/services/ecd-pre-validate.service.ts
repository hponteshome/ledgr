// apps/api/src/modules/sped/ecd/services/ecd-pre-validate.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

export interface PreValidateIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  detail?: string;
}

export interface PreValidateResult {
  canGenerate: boolean;
  errors: PreValidateIssue[];
  warnings: PreValidateIssue[];
}

@Injectable()
export class EcdPreValidateService {
  constructor(private prisma: PrismaService) {}

  async validate(companyId: string, periodStart: Date, periodEnd: Date): Promise<PreValidateResult> {
    const errors:   PreValidateIssue[] = [];
    const warnings: PreValidateIssue[] = [];

    const months = this.monthRange(periodStart, periodEnd);

    // ── 1. Fechamento mensal ─────────────────────────────────────────
    const fechamentos = await this.prisma.fechamentoMensal.findMany({
      where: { companyId },
      select: { competencia: true, status: true },
    });
    const fechMap = new Map(fechamentos.map(f => [f.competencia.slice(0, 7), f.status]));

    for (const { year, month } of months) {
      const key = year + '-' + String(month).padStart(2, '0');
      const status = fechMap.get(key);
      if (!status) {
        errors.push({
          type: 'error', code: 'FECHAMENTO_NAO_ENCONTRADO',
          message: `Fechamento de ${key} não registrado`,
          detail: 'Acesse Contabilidade → Fechamento Mensal e registre o período antes de gerar a ECD.',
        });
      } else if (!['FECHADO', 'FECHADO_PREVIO'].includes(status)) {
        errors.push({
          type: 'error', code: 'FECHAMENTO_NAO_FECHADO',
          message: `Fechamento de ${key} com status "${status}"`,
          detail: 'O período deve estar com status FECHADO ou FECHADO_PREVIO para gerar a ECD.',
        });
      }
    }

    // ── 2. Equilíbrio dos lançamentos (débitos = créditos por entry) ─
    const desequilibrados = await this.prisma.$queryRaw<{ id: string; ref: string; diff: number }[]>`
      SELECT je.id, je.reference as ref,
        SUM(CASE WHEN jei.type = 'DEBIT' THEN jei.value ELSE -jei.value END) as diff
      FROM journal_entries je
      JOIN journal_entry_items jei ON jei.journal_entry_id = je.id
      WHERE je.company_id = ${companyId}
        AND je.date >= ${periodStart}
        AND je.date <= ${periodEnd}
        AND je.deleted_at IS NULL
      GROUP BY je.id, je.reference
      HAVING ABS(SUM(CASE WHEN jei.type = 'DEBIT' THEN jei.value ELSE -jei.value END)) > 0.01
      LIMIT 10
    `;

    if (desequilibrados.length > 0) {
      for (const d of desequilibrados) {
        errors.push({
          type: 'error', code: 'LANCAMENTO_DESEQUILIBRADO',
          message: `Lançamento ${d.ref ?? d.id.slice(0, 8)} com débitos ≠ créditos (diff: ${Number(d.diff).toFixed(2)})`,
          detail: 'Acesse Contabilidade → Lançamentos e corrija o lançamento antes de gerar a ECD.',
        });
      }
    }

    // ── 3. Saldo inicial equilibrado ─────────────────────────────────
    const saldoIni = await this.prisma.$queryRaw<{ diff: number }[]>`
      SELECT SUM(ab.balance) as diff
      FROM account_balances ab
      JOIN chart_of_accounts coa ON coa.id = ab.account_id AND coa.company_id = ab.company_id
      WHERE ab.company_id = ${companyId}
        AND ab.reference_date < ${periodStart}
        AND coa.is_analytic = true
    `;
    const diffIni = Math.abs(Number(saldoIni[0]?.diff ?? 0));
    if (diffIni > 0.02) {
      errors.push({
        type: 'error', code: 'SALDO_INICIAL_DESEQUILIBRADO',
        message: `Saldo inicial desequilibrado (diferença: R$ ${diffIni.toFixed(2)})`,
        detail: 'Os saldos de abertura importados via ECD anterior não estão equilibrados. Reimporte o ECD do exercício anterior.',
      });
    }

    // ── 4. Plano de contas vazio ─────────────────────────────────────
    const totalAnaliticas = await this.prisma.chartOfAccounts.count({
      where: { companyId, isAnalytic: true, deletedAt: null },
    });
    if (totalAnaliticas === 0) {
      errors.push({
        type: 'error', code: 'PLANO_CONTAS_VAZIO',
        message: 'Nenhuma conta analítica encontrada no plano de contas',
        detail: 'Importe o plano de contas antes de gerar a ECD.',
      });
    }

    // ── 5. Lançamentos sem conta válida ──────────────────────────────
    const semConta = await this.prisma.journalEntryItem.count({
      where: {
        journalEntry: {
          companyId,
          date: { gte: periodStart, lte: periodEnd },
          deletedAt: null,
        },
        accountId: undefined,
      },
    });
    if (semConta > 0) {
      errors.push({
        type: 'error', code: 'ITEM_SEM_CONTA',
        message: `${semConta} partidas sem conta contábil vinculada`,
        detail: 'Acesse Contabilidade → Lançamentos e corrija as partidas sem conta.',
      });
    }

    // ── AVISOS ───────────────────────────────────────────────────────

    // A. Bloco J não disponível
    warnings.push({
      type: 'warning', code: 'BLOCO_J_NAO_GERADO',
      message: 'Balanço Patrimonial e DRE (Bloco J) não serão incluídos',
      detail: 'O arquivo gerado não conterá demonstrações contábeis. Será necessário incluir manualmente antes de transmitir à RFB.',
    });

    // B. Contas com data de criação posterior ao período
    const contasPosteriores = await this.prisma.chartOfAccounts.count({
      where: {
        companyId,
        deletedAt: null,
        createdAt: { gt: periodEnd },
      },
    });
    if (contasPosteriores > 0) {
      warnings.push({
        type: 'warning', code: 'CONTAS_DATA_POSTERIOR',
        message: `${contasPosteriores} contas criadas após ${periodEnd.toLocaleDateString('pt-BR')}`,
        detail: 'O PGE emitirá advertências de data para essas contas. Não impede a transmissão.',
      });
    }

    // C. Natureza divergente entre conta pai e filha
    const naturezaDivergente = await this.prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*) as total
      FROM chart_of_accounts filho
      JOIN chart_of_accounts pai ON pai.id = filho.parent_id
      WHERE filho.company_id = ${companyId}
        AND filho.deleted_at IS NULL
        AND pai.nature != filho.nature
    `;
    const totalDiv = Number(naturezaDivergente[0]?.total ?? 0);
    if (totalDiv > 0) {
      warnings.push({
        type: 'warning', code: 'NATUREZA_DIVERGENTE',
        message: `${totalDiv} contas com natureza diferente da conta pai`,
        detail: 'O PGE emitirá advertências de natureza. Verifique o plano de contas.',
      });
    }

    // D. COD_ENT_REF no 0007 — entidade registral
    warnings.push({
      type: 'warning', code: 'ENTIDADE_REGISTRAL',
      message: 'Código da entidade registral (Junta Comercial) não cadastrado',
      detail: 'Acesse Cadastro da Empresa e preencha o campo "Órgão de Registro" antes de transmitir.',
    });

    return {
      canGenerate: errors.length === 0,
      errors,
      warnings,
    };
  }

  private monthRange(start: Date, end: Date): { year: number; month: number }[] {
    const result = [];
    let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1;
    const ey = end.getUTCFullYear(), em = end.getUTCMonth() + 1;
    while (y < ey || (y === ey && m <= em)) {
      result.push({ year: y, month: m });
      m++; if (m > 12) { m = 1; y++; }
    }
    return result;
  }
}
