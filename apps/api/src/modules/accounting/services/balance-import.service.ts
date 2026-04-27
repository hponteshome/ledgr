import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

@Injectable()
export class BalanceImportService {
  private readonly logger = new Logger(BalanceImportService.name);
  private readonly DELIMITER = '|';

  constructor(private prisma: PrismaService) {}

  async importBalances(companyId: string, fileContent: string, userId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { taxId: true }
    });

    if (!company) throw new BadRequestException('Empresa não encontrada.');

    const lines = fileContent
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new BadRequestException('Arquivo deve conter o CNPJ na 1ª linha e os dados nas seguintes.');
    }

    const cnpjHeader = lines[0].replace(/\D/g, '');
    const companyCnpj = company.taxId.replace(/\D/g, '');

    if (cnpjHeader !== companyCnpj) {
      throw new BadRequestException(`CNPJ do arquivo (${cnpjHeader}) não confere com a empresa ativa (${companyCnpj}).`);
    }

    const stats = { imported: 0, updated: 0, skipped: 0 };
    const errors: Array<{ line: string; error: string }> = [];

    const dataLines = lines.slice(1);

    for (const line of dataLines) {
      try {
        const values = line.split(this.DELIMITER).map(v => v.trim());

        if (values.length !== 4) {
          throw new Error(`Formato inválido. Esperado 4 colunas, recebido ${values.length}`);
        }

        let rawDate, accountCode, valueStr, dc;

        if (values[0].includes('/')) {
          [rawDate, accountCode, valueStr, dc] = values;
        } else {
          [accountCode, rawDate, valueStr, dc] = values;
        }

        const referenceDate = this.parseDate(rawDate);
        const amount = this.parseCurrency(valueStr, dc);

        const account = await this.prisma.chartOfAccounts.findFirst({
          where: {
            code: accountCode,
            companyId: companyId
          }
        });

        if (!account) {
          throw new Error(`Conta "${accountCode}" não encontrada no Plano de Contas desta empresa.`);
        }

        await this.processUpsert(account.id, companyId, referenceDate, amount, userId, stats);

      } catch (err) {
        this.logger.warn(`Falha na linha [${line}]: ${err.message}`);
        errors.push({ line, error: err.message });
        stats.skipped++;
      }
    }

    return {
      message: 'Importação concluída',
      results: {
        total: dataLines.length,
        success: stats.imported + stats.updated,
        imported: stats.imported,
        updated: stats.updated,
        skipped: stats.skipped
      },
      errors
    };
  }

  private async processUpsert(accountId: string, companyId: string, date: Date, balance: number, userId: string, stats: any) {
    const existing = await this.prisma.accountBalance.findFirst({
      where: { accountId, companyId, referenceDate: date }
    });

    const payload = {
      balance,
      updatedBy: userId,
      updatedAt: new Date()
    };

    if (existing) {
      await this.prisma.accountBalance.update({
        where: { id: existing.id },
        data: payload
      });
      stats.updated++;
    } else {
      await this.prisma.accountBalance.create({
        data: {
          ...payload,
          accountId,
          companyId,
          referenceDate: date,
          createdBy: userId,
          createdAt: new Date()
        }
      });
      stats.imported++;
    }
  }

  private parseDate(dateStr: string): Date {
    const parts = dateStr.split('/');
    if (parts.length !== 3) throw new Error(`Data inválida: ${dateStr}`);

    const [d, m, y] = parts.map(Number);
    // Date.UTC garante 00:00:00Z independente do fuso do servidor
    const date = new Date(Date.UTC(y, m - 1, d));

    if (isNaN(date.getTime())) throw new Error(`Data inexistente: ${dateStr}`);
    return date;
  }

  private parseCurrency(valueStr: string, dc: string): number {
    const normalized = valueStr.replace(/\./g, '').replace(',', '.');
    const val = parseFloat(normalized);

    if (isNaN(val)) throw new Error(`Valor não numérico: ${valueStr}`);

    return dc.toUpperCase() === 'C' ? -Math.abs(val) : Math.abs(val);
  }
}