// apps/api/src/modules/accounting/services/encerramento-exercicio.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { JournalEntryService } from './journal-entry.service';

interface ResultAccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  saldo: string;
}

@Injectable()
export class EncerramentoExercicioService {
  constructor(
    private prisma: PrismaService,
    private journalEntryService: JournalEntryService,
  ) {}

  private toUTC(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  private toUTCEnd(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }

  private async getConfig(companyId: string) {
    const config = await this.prisma.companyAccountingConfig.findUnique({ where: { companyId } });
    if (!config) {
      throw new BadRequestException(
        'Configuração contábil da empresa não encontrada. Configure as contas de Encerramento de Exercício na aba Contábil antes de prosseguir.',
      );
    }
    return config;
  }

  // ── Prévia: calcula o resultado do período sem gravar nada ──────────────────

  async preview(companyId: string, year: number) {
    const config = await this.getConfig(companyId);

    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;

    const rows = await this.prisma.$queryRaw<ResultAccountRow[]>`
      SELECT coa.id, coa.code, coa.name, coa.type,
        SUM(CASE WHEN jei.type='DEBIT' THEN jei.value ELSE -jei.value END) as saldo
      FROM chart_of_accounts coa
      JOIN journal_entry_items jei ON jei.account_id = coa.id
      JOIN journal_entries je ON je.id = jei.journal_entry_id
      WHERE coa.company_id = ${companyId}::uuid
        AND coa.type IN ('REVENUE','EXPENSE')
        AND coa.is_analytic = true
        AND coa.deleted_at IS NULL
        AND je.date BETWEEN ${periodStart}::date AND ${periodEnd}::date
        AND je.deleted_at IS NULL
      GROUP BY coa.id, coa.code, coa.name, coa.type
      HAVING SUM(CASE WHEN jei.type='DEBIT' THEN jei.value ELSE -jei.value END) != 0
      ORDER BY coa.type, coa.code
    `;

    let totalDebito = 0;
    let totalCredito = 0;
    const accounts = rows.map((r) => {
      const saldo = Number(r.saldo);
      const zeragemTipo: 'DEBIT' | 'CREDIT' = saldo < 0 ? 'DEBIT' : 'CREDIT';
      const zeragemValor = Math.abs(saldo);
      if (zeragemTipo === 'DEBIT') totalDebito += zeragemValor;
      else totalCredito += zeragemValor;
      return { id: r.id, code: r.code, name: r.name, type: r.type, saldo, zeragemTipo, zeragemValor };
    });

    const resultadoBruto = totalDebito - totalCredito; // positivo = lucro
    const resultadoTipo: 'LUCRO' | 'PREJUIZO' | 'NEUTRO' =
      resultadoBruto > 0 ? 'LUCRO' : resultadoBruto < 0 ? 'PREJUIZO' : 'NEUTRO';
    const resultado = Math.abs(resultadoBruto);

    const missingConfig: string[] = [];
    if (!config.encerramentoContaApuracaoResultadoId) missingConfig.push('Apuração do Resultado do Exercício (ARE)');
    if (resultadoTipo === 'LUCRO' && !config.encerramentoContaLucroExercicioId) missingConfig.push('Lucro do Exercício');
    if (resultadoTipo === 'PREJUIZO' && !config.encerramentoContaPrejuizoExercicioId) missingConfig.push('Prejuízo do Exercício');

    const existing = await this.prisma.journalEntry.findFirst({
      where: {
        companyId,
        date: { gte: this.toUTC(periodEnd), lte: this.toUTCEnd(periodEnd) },
        description: { contains: `Encerramento do Exercício ${year}` },
        deletedAt: null,
      },
    });

    return {
      year,
      accounts,
      totalDebito,
      totalCredito,
      resultado,
      resultadoTipo,
      missingConfig,
      podeEncerrar: missingConfig.length === 0 && accounts.length > 0 && !existing,
      jaEncerrado: !!existing,
    };
  }

  // ── Confirma: grava o encerramento em 2 etapas (Receita/Despesa → ARE → Lucro/Prejuízo) ──

  async confirmar(companyId: string, userId: string, year: number) {
    const prev = await this.preview(companyId, year);

    if (prev.jaEncerrado) {
      throw new BadRequestException(`O exercício ${year} já possui lançamento de encerramento.`);
    }
    if (prev.missingConfig.length > 0) {
      throw new BadRequestException(`Configure antes de encerrar: ${prev.missingConfig.join(', ')}.`);
    }
    if (prev.accounts.length === 0) {
      throw new BadRequestException('Nenhuma conta de resultado com movimento no período informado.');
    }

    const config = await this.getConfig(companyId);
    const closingDate = `${year}-12-31`;

    const areId = config.encerramentoContaApuracaoResultadoId!;
    const areAccount = await this.prisma.chartOfAccounts.findUnique({ where: { id: areId } });
    if (!areAccount) throw new BadRequestException('Conta de Apuração do Resultado do Exercício configurada não foi encontrada.');

    const destinoId =
      prev.resultadoTipo === 'LUCRO'
        ? config.encerramentoContaLucroExercicioId!
        : config.encerramentoContaPrejuizoExercicioId!;
    const destinoAccount = await this.prisma.chartOfAccounts.findUnique({ where: { id: destinoId } });
    if (!destinoAccount) throw new BadRequestException('Conta de Lucro/Prejuízo do Exercício configurada não foi encontrada.');

    // Etapa 1: zera cada conta de Receita/Despesa contra a ARE
    const itemsEtapa1 = prev.accounts.map((a) => ({
      accountId: a.id,
      accountCode: a.code,
      value: a.zeragemValor,
      type: a.zeragemTipo,
    }));
    itemsEtapa1.push({
      accountId: areId,
      accountCode: areAccount.code,
      value: prev.resultado,
      type: prev.resultadoTipo === 'LUCRO' ? 'CREDIT' : 'DEBIT',
    });

    const entry1 = await this.journalEntryService.create(companyId, userId, {
      date: closingDate,
      description: `Encerramento do Exercício ${year} - Apuração do Resultado (Etapa 1/2)`,
      items: itemsEtapa1,
    });

    // Etapa 2: zera a ARE contra Lucro ou Prejuízo do Exercício
    const entry2 = await this.journalEntryService.create(companyId, userId, {
      date: closingDate,
      description: `Encerramento do Exercício ${year} - Transferência do Resultado (Etapa 2/2)`,
      items: [
        {
          accountId: areId,
          accountCode: areAccount.code,
          value: prev.resultado,
          type: prev.resultadoTipo === 'LUCRO' ? 'DEBIT' : 'CREDIT',
        },
        {
          accountId: destinoId,
          accountCode: destinoAccount.code,
          value: prev.resultado,
          type: prev.resultadoTipo === 'LUCRO' ? 'CREDIT' : 'DEBIT',
        },
      ],
    });

    return { entry1, entry2, resultado: prev.resultado, resultadoTipo: prev.resultadoTipo };
  }

  // ── Reverte (soft-delete) o encerramento ja gravado de um exercicio ─────────

  async reverter(companyId: string, year: number) {
    const periodEnd = `${year}-12-31`;
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        date: { gte: this.toUTC(periodEnd), lte: this.toUTCEnd(periodEnd) },
        description: { contains: `Encerramento do Exercício ${year}` },
        deletedAt: null,
      },
    });

    if (entries.length === 0) {
      throw new BadRequestException(`Não há lançamento de encerramento gravado para o exercício ${year}.`);
    }

    await this.prisma.journalEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { deletedAt: new Date() },
    });

    return { revertido: true, lancamentosRevertidos: entries.length };
  }
}
