// apps/api/src/modules/accounting/services/iob-lotd-import.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IobLotdParserService, LotdEntry } from './iob-lotd-parser.service';

export interface LotdImportResult {
  status:   'done' | 'partial' | 'dry-run' | 'error';
  stats: {
    total:        number;
    imported:     number;
    skipped:      number;
    totalDebit:   number;
    totalCredit:  number;
    balanced:     boolean;
    notFound:     string[];
  };
  errors:   Array<{ line: number; message: string }>;
  preview?: Array<{ date: string; debit: string; credit: string; value: number; complement: string }>;
  header?:  { batchType: string; date: string; description: string } | null;
}

interface JournalGroup {
  date:     Date;
  desc:     string;
  items:    Array<{ accountId: string; accountName: string; value: number; type: 'DEBIT' | 'CREDIT' }>;
  totalDeb: number;
  totalCre: number;
}

@Injectable()
export class IobLotdImportService {
  private readonly logger = new Logger(IobLotdImportService.name);

  constructor(
    private prisma:  PrismaService,
    private parser:  IobLotdParserService,
  ) {}
  async importLotd(
    companyId:   string,
    fileContent: string,
    fileName:    string,
    dryRun:      boolean,
    userId:      string,
  ): Promise<LotdImportResult> {
    // Verificar duplicata
    if (!dryRun) {
      const existing = await this.prisma.loteImport.findFirst({
        where: { companyId, fileName, deletedAt: null },
      });
      if (existing) {
        return {
          status: "error",
          stats: { total: 0, imported: 0, skipped: 0, totalDebit: 0, totalCredit: 0, balanced: true, notFound: [] },
          errors: [{ line: 0, message: `Lote "${fileName}" ja foi importado em ${existing.importedAt.toLocaleDateString("pt-BR")}. Exclua o registro anterior para reimportar.` }],
        };
      }
    }

    const parsed  = this.parser.parse(fileContent);
    const header  = parsed.header;
    const entries = parsed.entries;
    const batchDate = header ? this.parser.parseDate(header.date) : new Date();

    // Montar mapa reducedCode -> account
    const accounts = await this.prisma.chartOfAccounts.findMany({
      where:  { companyId, isAnalytic: true },
      select: { id: true, code: true, reducedCode: true, name: true },
    });
    const byReduced = new Map<string, { id: string; name: string }>();
    const byCode    = new Map<string, { id: string; name: string }>();
    for (const a of accounts) {
      if (a.reducedCode) {
        byReduced.set(a.reducedCode.replace(/^0+/, ''), { id: a.id, name: a.name });
        byReduced.set(a.reducedCode, { id: a.id, name: a.name });
      }
      byCode.set(a.code, { id: a.id, name: a.name });
    }

    const resolve = (raw: string, classif: string) => {
      const num = raw.replace(/^0+/, '');
      if (num && byReduced.has(num)) return byReduced.get(num)!;
      if (raw && byReduced.has(raw)) return byReduced.get(raw)!;
      if (classif && byCode.has(classif)) return byCode.get(classif)!;
      return null;
    };

    const isZero = (s: string) => !s || s.replace(/0/g, '') === '';

    // ── Agrupar entradas ──────────────────────────────────────────
    const groups: JournalGroup[] = [];
    const notFoundSet = new Set<string>();

    // Separar por identificador
    const withId    = entries.filter(e => e.identifier);
    const withoutId = entries.filter(e => !e.identifier);

    // Entradas com identificador — agrupar
    const idMap = new Map<string, LotdEntry[]>();
    for (const e of withId) {
      const list = idMap.get(e.identifier) ?? [];
      list.push(e);
      idMap.set(e.identifier, list);
    }

    for (const [, grpEntries] of idMap) {
      const g = this.buildGroup(grpEntries, batchDate, resolve, isZero, notFoundSet);
      if (g) groups.push(g);
    }

    // Entradas sem identificador
    // Se linha tem ambas contas preenchidas — partida simples
    // Se linha tem apenas uma — parear com próxima linha complementar
    const pending: LotdEntry[] = [];
    for (const e of withoutId) {
      const hasDeb  = !isZero(e.debitAccount)  || !isZero(e.classDeb);
      const hasCred = !isZero(e.creditAccount) || !isZero(e.classCred);

      if (hasDeb && hasCred) {
        const g = this.buildGroup([e], batchDate, resolve, isZero, notFoundSet);
        if (g) groups.push(g);
      } else {
        pending.push(e);
      }
    }

    // Parear pendentes sequencialmente
    while (pending.length >= 2) {
      const pair = pending.splice(0, 2);
      const g = this.buildGroup(pair, batchDate, resolve, isZero, notFoundSet);
      if (g) groups.push(g);
    }

    // ── Calcular totais ───────────────────────────────────────────
    let totalDebit  = 0;
    let totalCredit = 0;
    for (const g of groups) {
      totalDebit  += g.totalDeb;
      totalCredit += g.totalCre;
    }
    const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const stats = {
      total:       entries.length,
      imported:    0,
      skipped:     entries.length - groups.reduce((s, g) => s + g.items.length, 0),
      totalDebit,
      totalCredit,
      balanced,
      notFound:    [...notFoundSet],
    };

    // ── Preview ───────────────────────────────────────────────────
    const preview = groups.slice(0, 20).map(g => ({
      date:       g.date.toISOString().substring(0, 10),
      debit:      g.items.filter(i => i.type === 'DEBIT').map(i => i.accountName).join(', '),
      credit:     g.items.filter(i => i.type === 'CREDIT').map(i => i.accountName).join(', '),
      value:      g.items.filter(i => i.type === 'DEBIT').reduce((s, i) => s + i.value, 0),
      complement: g.desc,
    }));

    if (dryRun) {
      stats.imported = groups.length;
      return { status: 'dry-run', stats, errors: parsed.errors, preview, header: header ? { batchType: header.batchType, date: header.date, description: header.description } : null };
    }

    // ── Importar ──────────────────────────────────────────────────
    for (const g of groups) {
      try {
        const je = await this.prisma.journalEntry.create({
          data: { companyId, date: g.date, description: g.desc, sourceModule: 'ACCOUNTING', createdById: userId },
        });
        await this.prisma.journalEntryItem.createMany({
          data: g.items.map(i => ({ journalEntryId: je.id, accountId: i.accountId, value: i.value, type: i.type })),
        });
        stats.imported++;
      } catch (e: any) {
        stats.skipped++;
        parsed.errors.push({ line: 0, message: e.message });
      }
    }


    // Persistir historico de importacao
    await this.prisma.loteImport.create({
      data: {
        companyId,
        fileName,
        fileSize:    fileContent.length,
        source:      "IOB",
        batchType:   header?.batchType ?? "D",
        batchDate:   batchDate,
        description: header?.description ?? "",
        status:      stats.skipped > 0 ? "partial" : "done",
        stats:       stats as any,
        errors:      parsed.errors.slice(0, 50) as any,
        importedBy:  userId,
      },
    }).catch(() => {});
    this.logger.log(`IOB LOTD [CONFIRM] groups=${groups.length} imported=${stats.imported} balanced=${balanced}`);
    return { status: stats.skipped > 0 ? 'partial' : 'done', stats, errors: parsed.errors };
  }
  async listLoteImports(companyId: string) {
    return this.prisma.loteImport.findMany({
      where:   { companyId, deletedAt: null },
      orderBy: { importedAt: "desc" },
      take:    20,
    });
  }


  private buildGroup(
    entries:    LotdEntry[],
    batchDate:  Date,
    resolve:    (raw: string, classif: string) => { id: string; name: string } | null,
    isZero:     (s: string) => boolean,
    notFoundSet: Set<string>,
  ): JournalGroup | null {
    const items: JournalGroup['items'] = [];
    let totalDeb = 0;
    let totalCre = 0;
    let date = batchDate;
    let desc = '';

    for (const e of entries) {
      if (e.date && e.date !== '00000000') {
        try { date = this.parser.parseDate(e.date); } catch {}
      }
      if (!desc) desc = e.observation || e.complement || '';

      if (!isZero(e.debitAccount) || !isZero(e.classDeb)) {
        const acc = resolve(e.debitAccount, e.classDeb);
        if (!acc) { notFoundSet.add('Débito: ' + (e.debitAccount || e.classDeb)); }
        else { items.push({ accountId: acc.id, accountName: acc.name, value: e.value, type: 'DEBIT' }); totalDeb += e.value; }
      }
      if (!isZero(e.creditAccount) || !isZero(e.classCred)) {
        const acc = resolve(e.creditAccount, e.classCred);
        if (!acc) { notFoundSet.add('Crédito: ' + (e.creditAccount || e.classCred)); }
        else { items.push({ accountId: acc.id, accountName: acc.name, value: e.value, type: 'CREDIT' }); totalCre += e.value; }
      }
    }

    if (items.length < 2) return null;
    return { date, desc, items, totalDeb, totalCre };
  }
}
