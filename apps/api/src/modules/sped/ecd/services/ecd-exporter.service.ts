// apps/api/src/modules/sped/ecd/ecd-exporter.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';

export interface EcdExportOptions {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  bookNumber?: string;
  bookNature?: string;
  bookType?: 'G' | 'R' | 'B';
  layoutVersion?: string;
}

@Injectable()
export class EcdExporterService {
  private readonly logger = new Logger(EcdExporterService.name);
  private lines: string[] = [];
  private lineCount = 0;

  constructor(private prisma: PrismaService) {}

  async export(options: EcdExportOptions): Promise<string> {
    this.lines = [];
    this.lineCount = 0;

    const {
      companyId,
      periodStart,
      periodEnd,
      bookNumber = '1',
      bookNature = 'DIÁRIO GERAL',
      bookType = 'G',
      layoutVersion = '9.00',
    } = options;

    // Busca dados da empresa
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        taxId: true,
        legalName: true,
        state: true,
        city: true,
      },
    });
    if (!company) throw new Error('Empresa não encontrada.');

    const cnpj = company.taxId.replace(/\D/g, '');
    const dtIni = this.formatDate(periodStart);
    const dtFin = this.formatDate(periodEnd);

    // ── Bloco 0 ──────────────────────────────────────────────────
    this.addLine(`|0000|LECD|${dtIni}|${dtFin}|${company.legalName}|${cnpj}|${company.state}||||||0|0|0||0|0||N|N|0|0||`);
    this.addLine('|0001|0|');
    this.addLine(`|0007|00||`);
    this.addLine(`|0990|${this.lineCount + 1}|`);

    const bloco0Lines = this.lineCount;

    // ── Bloco C (vazio — sem ECD recuperada) ─────────────────────
    this.addLine('|C001|1|');
    this.addLine(`|C990|2|`);

    // ── Bloco I ──────────────────────────────────────────────────
    this.addLine('|I001|0|');
    this.addLine(`|I010|${bookType}|${layoutVersion}|`);
    this.addLine(`|I030|TERMO DE ABERTURA|${bookNumber}|${bookNature}|0|${company.legalName}||${cnpj}|||${company.city}|${dtFin}|`);

    // Plano de Contas (I050)
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });

    for (const acc of accounts) {
      const dtAlt = this.formatDate(acc.createdAt);
      const natCode = this.typeToNatureCode(acc.type);
      const indCta = acc.isAnalytic ? 'A' : 'S';
      this.addLine(`|I050|${dtAlt}|${natCode}|${indCta}|${acc.level}|${acc.code}|${acc.parentId ? await this.getParentCode(acc.parentId) : ''}|${acc.name}|`);
    }

    // Saldos Periódicos (I150/I155) — agrupa por mês
    const balances = await this.prisma.accountBalance.findMany({
      where: {
        companyId,
        referenceDate: { gte: periodStart, lte: periodEnd },
      },
      include: { account: true },
      orderBy: { referenceDate: 'asc' },
    });

    // Agrupa por mês
    const byMonth = new Map<string, typeof balances>();
    for (const bal of balances) {
      const key = this.formatDate(bal.referenceDate);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(bal);
    }

    for (const [dateKey, monthBalances] of byMonth) {
      const d = new Date(monthBalances[0].referenceDate);
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      const dtIniMes = this.formatDate(firstDay);
      const dtFinMes = dateKey;

      this.addLine(`|I150|${dtIniMes}|${dtFinMes}|`);

      for (const bal of monthBalances) {
        const value = bal.balance.abs().toNumber();
        const sign = bal.balance.gte(0) ? 'D' : 'C';
        this.addLine(`|I155|${bal.account.code}||0,00|D|0,00|0,00|${this.formatDecimal(value)}|${sign}|`);
      }
    }

    // Lançamentos (I200/I250)
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        date: { gte: periodStart, lte: periodEnd },
      },
      include: {
        items: { include: { account: true } },
      },
      orderBy: { date: 'asc' },
    });

    for (const entry of entries) {
      if (!entry.items.length) continue;
      const totalValue = entry.items
        .filter(i => i.type === 'DEBIT')
        .reduce((s, i) => s + Number(i.value), 0);

      this.addLine(`|I200|${entry.reference || entry.id.substring(0, 8)}|${this.formatDate(entry.date)}|${this.formatDecimal(totalValue)}|N||`);

      for (const item of entry.items) {
        const sign = item.type === 'DEBIT' ? 'D' : 'C';
        this.addLine(`|I250|${item.account.code}||${this.formatDecimal(Number(item.value))}|${sign}|||${entry.description}||`);
      }
    }

    // Encerramento Bloco I
    const blocoILines = this.lineCount - bloco0Lines - 2; // -2 do bloco C
    // Atualiza a linha I030 com o total correto seria complexo — simplificamos
    this.addLine(`|I990|${blocoILines}|`);

    // ── Bloco J (vazio) ──────────────────────────────────────────
    this.addLine('|J001|1|');
    this.addLine(`|J990|2|`);

    // ── Bloco K (vazio) ──────────────────────────────────────────
    this.addLine('|K001|1|');
    this.addLine(`|K990|2|`);

    // ── Bloco 9 ──────────────────────────────────────────────────
    this.addLine('|9001|0|');

    // Conta registros por tipo
    const regCount = new Map<string, number>();
    for (const line of this.lines) {
      const reg = line.split('|')[1]?.toUpperCase();
      if (reg) regCount.set(reg, (regCount.get(reg) || 0) + 1);
    }

    for (const [reg, count] of regCount) {
      this.addLine(`|9900|${reg}|${count}|`);
    }
    this.addLine(`|9990|${regCount.size + 3}|`); // +3 = 9001, 9990, 9999
    this.addLine(`|9999|${this.lineCount + 1}|`);

    const content = this.lines.join('\r\n') + '\r\n';
    this.logger.log(`ECD gerada: ${this.lineCount} linhas, ${accounts.length} contas, ${entries.length} lançamentos`);
    return content;
  }

  // ── Helpers ───────────────────────────────────────────────────

  private addLine(line: string): void {
    this.lines.push(line);
    this.lineCount++;
  }

  /** Date → ddmmaaaa */
  private formatDate(date: Date): string {
    const d = date instanceof Date ? date : new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}${mm}${yyyy}`;
  }

  /** Number → "1234,56" (formato SPED) */
  private formatDecimal(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  private typeToNatureCode(type: string): string {
    switch (type) {
      case 'ASSET':     return '01';
      case 'LIABILITY': return '02';
      case 'EQUITY':    return '03';
      case 'REVENUE':   return '04';
      case 'EXPENSE':   return '04';
      default:          return '09';
    }
  }

  private async getParentCode(parentId: string): Promise<string> {
    const parent = await this.prisma.chartOfAccounts.findUnique({
      where: { id: parentId },
      select: { code: true },
    });
    return parent?.code || '';
  }
}