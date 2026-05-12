import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { AccountNature, SourceModule } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface JournalIssue {
  severity: 'error' | 'warning';
  ref: string;
  lineNum?: number;
  reason: string;
}

interface RawLine {
  lineNum: number;
  date: Date;
  dateStr: string;    // DD/MM/YYYY normalizado
  code: string;
  historic: string;
  lote: string;       // ex: "1988"
  lcto: string;       // ex: "1988/35750" — original do arquivo
  groupKey: string;   // lote|dateStr|historic — chave de agrupamento
  debit: Decimal;
  credit: Decimal;
}

interface ParsedEntry {
  groupKey: string;
  lote: string;
  date: Date;
  description: string;
  reference: string;  // IMP-{lote}-{dateStr}
  lctos: string[];    // Lctos originais agrupados
  lines: RawLine[];
}

export interface PreviewEntry {
  reference: string; date: string; description: string;
  debitTotal: string; creditTotal: string; lineCount: number;
  lctos: string; balanced: boolean;
}

export interface JournalPreviewResult {
  entries: PreviewEntry[]; issues: JournalIssue[]; hasErrors: boolean;
  totalEntries: number; totalLines: number;
}

export interface JournalImportResult {
  inserted: number; skipped: number;
  errors: Array<{ ref: string; reason: string }>; issues: JournalIssue[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function parseDate(raw: string): { date: Date; str: string } | null {
  const parts = raw.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(p => parseInt(p, 10));
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(dt.getTime())) return null;
  const str = `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
  return { date: dt, str };
}

function parseDecimal(raw: string): Decimal | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned || cleaned === '-') return new Decimal(0);
  try { return new Decimal(cleaned); } catch { return null; }
}

function fixEncoding(str: string): string {
  // Corrige Latin-1 mal interpretado como UTF-8 (ex: "ApuraÃ§Ã£o" → "Apuração")
  try {
    const bytes = Uint8Array.from(str.split('').map(c => c.charCodeAt(0)));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return str;
  }
}

export function detectEncoding(buffer: Buffer): 'utf8' | 'latin1' {
  try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); return 'utf8'; }
  catch { return 'latin1'; }
}

export function bufferToString(buffer: Buffer): string {
  return buffer.toString(detectEncoding(buffer));
}

// ─────────────────────────────────────────────────────────────
// Parser
// ─────────────────────────────────────────────────────────────

function parseFile(content: string): { entries: ParsedEntry[]; issues: JournalIssue[] } {
  const lines  = content.split('\n').map(l => l.replace(/\r$/, ''));
  const issues: JournalIssue[] = [];
  const rawLines: RawLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split('|');
    if (parts.length < 7) {
      if (i === 0) continue; // cabeçalho
      issues.push({ severity: 'error', ref: '?', lineNum: i + 1,
        reason: `Linha com ${parts.length} campos (esperado 7)` });
      continue;
    }

    const [rawDate, code, , rawHistoric, loteLcto, rawDebit, rawCredit] = parts;

    const parsed = parseDate(rawDate);
    if (!parsed) {
      issues.push({ severity: 'error', ref: loteLcto?.trim() ?? '?', lineNum: i + 1,
        reason: `Data inválida: "${rawDate}"` });
      continue;
    }

    const debit  = parseDecimal(rawDebit);
    const credit = parseDecimal(rawCredit);
    if (debit === null || credit === null) {
      issues.push({ severity: 'error', ref: loteLcto?.trim() ?? '?', lineNum: i + 1,
        reason: `Valor inválido: débito="${rawDebit}" crédito="${rawCredit}"` });
      continue;
    }

    if (debit.isZero() && credit.isZero()) {
      issues.push({ severity: 'error', ref: loteLcto?.trim() ?? '?', lineNum: i + 1,
        reason: 'Débito e crédito ambos zero' });
      continue;
    }

    const historic = rawHistoric.trim();
    const lcto     = loteLcto?.trim() ?? '';
    const lote     = lcto.split('/')[0] ?? lcto;
    const groupKey = `${lote}|${parsed.str}|${historic}`;

    if (historic.length > 500) {
      issues.push({ severity: 'warning', ref: lcto, lineNum: i + 1,
        reason: `Histórico com ${historic.length} caracteres — gravado integralmente` });
    }

    rawLines.push({
      lineNum: i + 1, date: parsed.date, dateStr: parsed.str,
      code: code.trim(), historic, lote, lcto, groupKey, debit, credit,
    });
  }

  // ── Agrupar por lote|data|histórico ──────────────────────────
  const grouped = new Map<string, RawLine[]>();
  for (const l of rawLines) {
    if (!grouped.has(l.groupKey)) grouped.set(l.groupKey, []);
    grouped.get(l.groupKey)!.push(l);
  }

  const entries: ParsedEntry[] = [];

  for (const [groupKey, lns] of grouped) {
    const totalDebit  = lns.reduce((s, l) => s.add(l.debit),  new Decimal(0));
    const totalCredit = lns.reduce((s, l) => s.add(l.credit), new Decimal(0));

    if (!totalDebit.equals(totalCredit)) {
      issues.push({
        severity: 'error', ref: groupKey,
        reason: `Lançamento desbalanceado — débito ${totalDebit.toFixed(2)} ≠ crédito ${totalCredit.toFixed(2)}`,
      });
      continue;
    }

    const lote      = lns[0].lote;
    const dateStr   = lns[0].dateStr;
    const reference = `IMP-${lote}-${dateStr}`;

    // Histórico único por grupo (já é igual por definição do groupKey)
    const description = lns[0].historic;

    // Lctos originais para rastreabilidade
    const lctos = [...new Set(lns.map(l => l.lcto))];

    entries.push({ groupKey, lote, date: lns[0].date, description, reference, lctos, lines: lns });
  }

  return { entries, issues };
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

@Injectable()
export class JournalImporterService {
  private readonly logger = new Logger(JournalImporterService.name);
  constructor(private readonly prisma: PrismaService) {}

  async preview(content: string, companyId: string): Promise<JournalPreviewResult> {
    const { entries, issues } = parseFile(content);

    // Validar contas
    const allCodes = [...new Set(entries.flatMap(e => e.lines.map(l => l.code)))];
    const found = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, code: { in: allCodes } },
      select: { code: true, isAnalytic: true },
    });
    const foundMap = new Map(found.map(a => [a.code, a]));

    for (const entry of entries) {
      for (const l of entry.lines) {
        const acc = foundMap.get(l.code);
        if (!acc) {
          issues.push({ severity: 'error', ref: entry.reference, lineNum: l.lineNum,
            reason: `Conta ${l.code} não cadastrada no plano de contas` });
        } else if (!acc.isAnalytic) {
          issues.push({ severity: 'warning', ref: entry.reference, lineNum: l.lineNum,
            reason: `Conta ${l.code} é sintética — recomendado usar conta analítica` });
        }
      }
    }

    const hasErrors = issues.some(i => i.severity === 'error');

    const previewEntries: PreviewEntry[] = entries.slice(0, 10).map(e => {
      const totalDebit  = e.lines.reduce((s, l) => s.add(l.debit),  new Decimal(0));
      const totalCredit = e.lines.reduce((s, l) => s.add(l.credit), new Decimal(0));
      return {
        reference:   e.reference,
        date:        e.date.toISOString().slice(0, 10),
        description: e.description,
        debitTotal:  totalDebit.toFixed(2),
        creditTotal: totalCredit.toFixed(2),
        lineCount:   e.lines.length,
        lctos:       e.lctos.join(', '),
        balanced:    totalDebit.equals(totalCredit),
      };
    });

    return {
      entries:      previewEntries,
      issues,
      hasErrors,
      totalEntries: entries.length,
      totalLines:   entries.reduce((s, e) => s + e.lines.length, 0),
    };
  }

  async import(content: string, companyId: string, createdById: string): Promise<JournalImportResult> {
    const { entries, issues } = parseFile(content);
    const hasErrors = issues.some(i => i.severity === 'error');

    if (hasErrors)
      throw new BadRequestException(`Arquivo contém erros. Corrija antes de importar.`);

    const allCodes = [...new Set(entries.flatMap(e => e.lines.map(l => l.code)))];
    const found = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, code: { in: allCodes } },
      select: { id: true, code: true },
    });
    const codeToId = new Map(found.map(a => [a.code, a.id]));

    const missingCodes = allCodes.filter(c => !codeToId.has(c));
    if (missingCodes.length > 0)
      throw new BadRequestException(`Contas não encontradas: ${missingCodes.join(', ')}`);

    // Anti-duplicata por reference
    const references = entries.map(e => e.reference);
    const existing   = await this.prisma.journalEntry.findMany({
      where: { companyId, reference: { in: references } },
      select: { reference: true },
    });
    const existingRefs = new Set(existing.map(e => e.reference));

    const result: JournalImportResult = { inserted: 0, skipped: 0, errors: [], issues };

    for (const entry of entries) {
      if (existingRefs.has(entry.reference)) {
        result.skipped++;
        continue;
      }

      try {
        await this.prisma.journalEntry.create({
          data: {
            companyId,
            date:         entry.date,
            description:  entry.description,
            reference:    entry.reference,
            sourceModule: SourceModule.JOURNAL_IMPORT,
            createdById,
            items: {
              create: entry.lines
                .filter(l => !l.debit.isZero() || !l.credit.isZero())
                .map(l => ({
                  accountId: codeToId.get(l.code)!,
                  type:  l.debit.greaterThan(0) ? AccountNature.DEBIT : AccountNature.CREDIT,
                  value: l.debit.greaterThan(0) ? l.debit : l.credit,
                })),
            },
          },
        });
        result.inserted++;
      } catch (e) {
        result.errors.push({ ref: entry.reference, reason: e.message });
      }
    }

    this.logger.log(`[JournalImporter] inseridos: ${result.inserted} | ignorados: ${result.skipped} | erros: ${result.errors.length}`);
    return result;
  }
}
