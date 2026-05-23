// apps/api/src/modules/sped/ecd/services/ecd-exporter.service.ts
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

  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  // EXPORT PRINCIPAL
  // ═══════════════════════════════════════════════════════════════
  async export(options: EcdExportOptions): Promise<Buffer> {
    const {
      companyId,
      periodStart,
      periodEnd,
      bookNumber  = '1',
      bookNature  = 'DIARIO E BALANCETES',
      bookType    = 'G',
      layoutVersion = '9.00',
    } = options;

    // ── Dados da empresa ─────────────────────────────────────────
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        taxId: true, legalName: true,
        state: true, city: true,
        legalNature: true, taxRegime: true,
        openingDate: true,
      },
    });
    if (!company) throw new Error('Empresa nao encontrada.');

    const cnpj    = company.taxId.replace(/\D/g, '');
    const dtIni   = this.fmtDate(periodStart);
    const dtFin   = this.fmtDate(periodEnd);
    const ano     = periodEnd.getFullYear();

    // ── Plano de contas ─────────────────────────────────────────
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
    });

    // Map id -> code para lookup rápido (evita N+1)
    const codeById = new Map<string, string>(accounts.map(a => [a.id, a.code]));

    // Contas analíticas — usadas para filtrar I155
    const analyticIds = new Set(accounts.filter(a => a.isAnalytic).map(a => a.id));

    // ── Lançamentos do período ──────────────────────────────────
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        companyId,
        date: { gte: periodStart, lte: periodEnd },
        deletedAt: null,
      },
      include: {
        items: {
          include: { account: { select: { code: true } } },
        },
      },
      orderBy: { date: 'asc' },
    });

    // ── Movimentos históricos (antes do período) — para saldo ini ─
    const beginning = new Date(Date.UTC(1900, 0, 1));
    const beforeStart = new Date(Date.UTC(
      periodStart.getUTCFullYear(),
      periodStart.getUTCMonth(),
      periodStart.getUTCDate(),
    ));
    beforeStart.setUTCDate(beforeStart.getUTCDate() - 1);

    const prevItems = await this.prisma.journalEntryItem.findMany({
      where: {
        journalEntry: {
          companyId,
          date: { gte: beginning, lte: beforeStart },
          deletedAt: null,
        },
      },
      select: { accountId: true, type: true, value: true },
    });

    // Saldo inicial por accountId (apenas analíticas)
    const saldoIni = new Map<string, number>();
    for (const item of prevItems) {
      if (!analyticIds.has(item.accountId)) continue;
      const cur = saldoIni.get(item.accountId) ?? 0;
      saldoIni.set(item.accountId, cur + (item.type === 'DEBIT' ? 1 : -1) * Number(item.value));
    }

    // Fallback I155 para contas sem lancamentos historicos
    const i155Rows = await this.prisma.accountBalance.findMany({
      where: { companyId, referenceDate: { lt: new Date(periodStart) } },
      orderBy: { referenceDate: 'desc' },
    });
    for (const row of i155Rows) {
      if (!saldoIni.has(row.accountId) && analyticIds.has(row.accountId)) {
        saldoIni.set(row.accountId, Number(row.balance));
      }
    }

    // ── Itens do período agrupados por mês e conta ────────────────
    const periodItems = await this.prisma.journalEntryItem.findMany({
      where: {
        journalEntry: {
          companyId,
          date: { gte: periodStart, lte: periodEnd },
          deletedAt: null,
        },
      },
      select: {
        accountId: true, type: true, value: true,
        journalEntry: { select: { date: true } },
      },
    });

    // Map: "YYYY-MM" -> accountId -> { deb, cre }
    const byMonthAcc = new Map<string, Map<string, { deb: number; cre: number }>>();
    for (const item of periodItems) {
      if (!analyticIds.has(item.accountId)) continue;
      const d = item.journalEntry.date instanceof Date
        ? item.journalEntry.date
        : new Date(item.journalEntry.date);
      const key = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
      if (!byMonthAcc.has(key)) byMonthAcc.set(key, new Map());
      const accMap = byMonthAcc.get(key)!;
      if (!accMap.has(item.accountId)) accMap.set(item.accountId, { deb: 0, cre: 0 });
      const mv = accMap.get(item.accountId)!;
      if (item.type === 'DEBIT') mv.deb += Number(item.value);
      else                       mv.cre += Number(item.value);
    }

    // ── Meses do período ordenados ───────────────────────────────
    const months = this.monthRange(periodStart, periodEnd);

    // ══════════════════════════════════════════════════════════════
    // GERAÇÃO DAS LINHAS
    // ══════════════════════════════════════════════════════════════
    const lines: string[] = [];
    const add = (l: string) => lines.push(l);

    // ── BLOCO 0 ──────────────────────────────────────────────────
    add('|0000|LECD|' + dtIni + '|' + dtFin + '|' + company.legalName + '|' + cnpj + '|' + company.state + '|' + company.city + '|||||0|0|0||0|0||N|N|0|0||');
    add('|0001|0|');
    add('|0007|' + cnpj + '||');
    // 0990 sera atualizado no final
    const idx0990 = lines.length;
    add('|0990|PLACEHOLDER|');

    // ── BLOCO C (vazio) ───────────────────────────────────────────
    add('|C001|1|');
    add('|C990|2|');

    // ── BLOCO I ───────────────────────────────────────────────────
    add('|I001|0|');
    add('|I010|' + bookType + '|' + layoutVersion + '|');
    add('|I030|TERMO DE ABERTURA DO ' + bookNature.toUpperCase() + '|' + bookNumber + '|' + bookNature.toUpperCase() + '|0|' + company.legalName + '||' + cnpj + '|||' + company.city + '|' + dtFin + '|');

    // I050 — plano de contas
    for (const acc of accounts) {
      const dtAlt    = this.fmtDate(acc.createdAt);
      const natCode  = this.typeToNat(acc.type.toString(), acc.nature.toString());
      const indCta   = acc.isAnalytic ? 'A' : 'S';
      const parentCode = acc.parentId ? (codeById.get(acc.parentId) ?? '') : '';
      add('|I050|' + dtAlt + '|' + natCode + '|' + indCta + '|' + acc.level + '|' + acc.code + '|' + parentCode + '|' + acc.name + '|');
    }

    // I150/I155 — saldos mensais (apenas analíticas com saldo ou movimento)
    // Acumulador de saldo corrente por conta ao longo dos meses
    const saldoCorrente = new Map<string, number>(saldoIni);

    for (const { year, month, firstDay, lastDay } of months) {
      const monthKey = year + '-' + String(month).padStart(2, '0');
      const accMap   = byMonthAcc.get(monthKey);

      // Contas com saldo anterior != 0 OU movimento no mês
      const contasDoMes = new Set<string>([
        ...Array.from(saldoCorrente.entries()).filter(([, v]) => v !== 0).map(([k]) => k),
        ...(accMap ? Array.from(accMap.keys()) : []),
      ]);

      if (contasDoMes.size === 0) {
        // Atualiza saldoCorrente mesmo sem linhas
        if (accMap) {
          for (const [aid, mv] of accMap) {
            const cur = saldoCorrente.get(aid) ?? 0;
            saldoCorrente.set(aid, cur + mv.deb - mv.cre);
          }
        }
        continue;
      }

      add('|I150|' + this.fmtDate(firstDay) + '|' + this.fmtDate(lastDay) + '|');

      for (const aid of Array.from(contasDoMes).sort((a, b) => {
        const ca = codeById.get(a) ?? '';
        const cb = codeById.get(b) ?? '';
        return ca.localeCompare(cb);
      })) {
        const mv      = accMap?.get(aid) ?? { deb: 0, cre: 0 };
        const sldIni  = saldoCorrente.get(aid) ?? 0;
        const sldFin  = sldIni + mv.deb - mv.cre;
        const cod     = codeById.get(aid) ?? '';

        // Atualiza saldo corrente
        saldoCorrente.set(aid, sldFin);

        const dcIni = sldIni >= 0 ? 'D' : 'C';
        const dcFin = sldFin >= 0 ? 'D' : 'C';

        add('|I155|' + cod + '||' +
          this.fmtDec(Math.abs(sldIni)) + '|' + dcIni + '|' +
          this.fmtDec(mv.deb) + '|' +
          this.fmtDec(mv.cre) + '|' +
          this.fmtDec(Math.abs(sldFin)) + '|' + dcFin + '|' +
          this.fmtDec(Math.abs(sldFin)) + '|' + dcFin + '|');
      }
    }

    // I200/I250 — lançamentos
    let lctoNum = 1;
    for (const entry of entries) {
      if (!entry.items.length) continue;
      const totalDeb = entry.items
        .filter(i => i.type === 'DEBIT')
        .reduce((s, i) => s + Number(i.value), 0);

      const numLcto = String(lctoNum++).padStart(6, '0');
      const desc    = (entry.description || '').substring(0, 60).replace(/\|/g, ' ');
      add('|I200|' + numLcto + '|' + this.fmtDate(entry.date instanceof Date ? entry.date : new Date(entry.date)) + '|' + this.fmtDec(totalDeb) + '|N||');

      for (const item of entry.items) {
        const sign = item.type === 'DEBIT' ? 'D' : 'C';
        const cod  = item.account.code;
        add('|I250|' + cod + '||' + this.fmtDec(Number(item.value)) + '|' + sign + '|||' + desc + '||');
      }
    }

    // Encerramento Bloco I
    const idxI001 = lines.findIndex(l => l === '|I001|0|');
    const blocoILines = lines.length - idxI001;
    add('|I990|' + (blocoILines + 1) + '|');

    // ── BLOCO J (vazio) ──────────────────────────────────────────
    add('|J001|1|');
    add('|J990|2|');

    // ── BLOCO K (vazio) ──────────────────────────────────────────
    add('|K001|1|');
    add('|K990|2|');

    // ── BLOCO 9 ──────────────────────────────────────────────────
    add('|9001|0|');

    // Contar registros por tipo (sobre as linhas ja geradas)
    const regCount = new Map<string, number>();
    for (const line of lines) {
      const reg = line.split('|')[1]?.toUpperCase();
      if (reg) regCount.set(reg, (regCount.get(reg) ?? 0) + 1);
    }
    // Adicionar os proprios registros do bloco 9
    regCount.set('9001', 1);
    regCount.set('9900', (regCount.size + 1)); // +1 pelo proprio 9900
    regCount.set('9990', 1);
    regCount.set('9999', 1);

    for (const [reg, count] of Array.from(regCount.entries()).sort()) {
      add('|9900|' + reg + '|' + count + '|');
    }

    const total9 = Array.from(regCount.values()).reduce((s, v) => s + v, 0);
    add('|9990|' + (lines.length - lines.findIndex(l => l === '|9001|0|') + 1) + '|');
    add('|9999|' + (lines.length + 1) + '|');

    // ── Atualizar 0990 com contagem real ─────────────────────────
    const idx0001 = 0; // primeira linha
    const idxC001 = lines.findIndex(l => l === '|C001|1|');
    lines[idx0990] = '|0990|' + idxC001 + '|';

    // ── Montar conteudo final ─────────────────────────────────────
    const content = lines.join('\r\n') + '\r\n';

    // Converter para latin1 (ISO-8859-1) — padrao SPED
    const latin1Buf = Buffer.from(content, 'latin1');

    this.logger.log(
      'ECD gerada: ' + lines.length + ' linhas | ' +
      accounts.length + ' contas | ' + entries.length + ' lancamentos'
    );

    return latin1Buf;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  /** Date -> ddmmaaaa */
  private fmtDate(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    const dd   = String(d.getUTCDate()).padStart(2, '0');
    const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getUTCFullYear());
    return dd + mm + yyyy;
  }

  /** Number -> "1234,56" */
  private fmtDec(v: number): string {
    return Math.abs(v).toFixed(2).replace('.', ',');
  }

  /** AccountType + AccountNature -> codigo natureza SPED */
  private typeToNat(type: string, nature: string): string {
    switch (type) {
      case 'ASSET':     return '01';
      case 'LIABILITY': return '02';
      case 'EQUITY':    return '03';
      case 'REVENUE':   return '04';
      case 'EXPENSE':   return '05';
      default:          return '09';
    }
  }

  /** Gera lista de meses entre duas datas */
  private monthRange(start: Date, end: Date): Array<{
    year: number; month: number; firstDay: Date; lastDay: Date;
  }> {
    const result = [];
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth() + 1;
    const endY = end.getUTCFullYear();
    const endM = end.getUTCMonth() + 1;

    while (y < endY || (y === endY && m <= endM)) {
      const firstDay = new Date(Date.UTC(y, m - 1, 1));
      const lastDay  = new Date(Date.UTC(y, m, 0)); // ultimo dia do mes
      result.push({ year: y, month: m, firstDay, lastDay });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return result;
  }
}
