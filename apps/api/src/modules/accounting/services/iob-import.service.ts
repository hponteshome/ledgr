// apps/api/src/modules/accounting/services/iob-import.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountNature, AccountType } from '@prisma/client';
import { IobPlanoParserService, IobPlanoRecord } from './iob-plano-parser.service';

export interface IobImportResult {
  status:   'done' | 'partial' | 'dry-run';
  stats: {
    total:    number;
    matched:  number;
    created:  number;
    notFound: number;
  };
  notFound: string[];
  errors:   Array<{ line: number; message: string }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Aplica máscara "0.0.0.00.00.0000" a um código sem pontos "11101010001" */
function applyMask(raw: string, mask: string): string {
  const sizes = mask.split('.').map(s => s.length);
  let pos = 0;
  const parts: string[] = [];
  for (const size of sizes) {
    const chunk = raw.slice(pos, pos + size);
    if (!chunk) break;
    parts.push(chunk);
    pos += size;
  }
  return parts.join('.');
}

/** Remove pontos de um código formatado */
function stripDots(code: string): string {
  return code.replace(/\./g, '');
}

/** Retorna o código pai: remove o último segmento separado por ponto */
function parentFormatted(formatted: string): string | null {
  const idx = formatted.lastIndexOf('.');
  return idx > 0 ? formatted.slice(0, idx) : null;
}

function inferType(raw: string): AccountType {
  const d = raw[0];
  if (d === '1') return AccountType.ASSET;
  if (d === '2') return raw.startsWith('23') ? AccountType.EQUITY : AccountType.LIABILITY;
  if (d === '3') return AccountType.REVENUE;
  return AccountType.EXPENSE;
}

function inferNature(raw: string, natureChar: string): AccountNature {
  if (natureChar === 'D') return AccountNature.DEBIT;
  if (natureChar === 'C') return AccountNature.CREDIT;
  // fallback por tipo
  const d = raw[0];
  return (d === '1' || d === '4') ? AccountNature.DEBIT : AccountNature.CREDIT;
}

// ──────────────────────────────────────────────────────────────────────────

@Injectable()
export class IobImportService {
  private readonly logger = new Logger(IobImportService.name);

  constructor(
    private prisma:  PrismaService,
    private parser:  IobPlanoParserService,
  ) {}

  async importPlano(
    companyId: string,
    fileContent: string,
    dryRun: boolean,
    userId: string,
  ): Promise<IobImportResult> {
    const mask = '0.0.0.00.00.0000';
    const parsed = this.parser.parse(fileContent);
    const stats  = { total: parsed.records.length, matched: 0, created: 0, notFound: 0 };
    const notFound: string[] = [];
    const errors:   Array<{ line: number; message: string }> = [...parsed.errors];

    // ── 1. Garantir CompanyMaskConfig ──────────────────────────────────────
    if (!dryRun) {
      const existing = await this.prisma.companyMaskConfig.findFirst({
        where: { companyId, validTo: null },
      });
      if (!existing) {
        await this.prisma.companyMaskConfig.create({
          data: {
            companyId,
            mask,
            validFrom: new Date(),
            createdById: userId,
          },
        });
        this.logger.log(`[IOB] Máscara criada: ${mask}`);
      }
    }

    // ── 2. Construir mapa de códigos formatados → record ───────────────────
    const recordMap = new Map<string, IobPlanoRecord>();
    for (const rec of parsed.records) {
      const formatted = applyMask(stripDots(rec.classification), mask);
      recordMap.set(formatted, rec);
    }

    // ── 3. Carregar contas já existentes da empresa ────────────────────────
    const existing = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const codeToId = new Map<string, string>(existing.map(a => [a.code, a.id]));

    // ── 4. Ordenar por nível (pai antes de filho) ──────────────────────────
    const sorted = [...recordMap.entries()].sort((a, b) => {
      const levA = a[0].split('.').length;
      const levB = b[0].split('.').length;
      return levA - levB;
    });

    // ── 5. Processar cada conta ────────────────────────────────────────────
    for (const [formatted, rec] of sorted) {
      try {
        const existingId = codeToId.get(formatted);

        if (existingId) {
          // Conta já existe → atualiza reducedCode
          stats.matched++;
          if (!dryRun && rec.reducedCode) {
            await this.prisma.chartOfAccounts.update({
              where: { id: existingId },
              data:  { reducedCode: rec.reducedCode } as any,
            });
          }
          continue;
        }

        // Conta não existe → criar
        const level      = formatted.split('.').length;
        const parentCode = parentFormatted(formatted);
        const parentId   = parentCode ? (codeToId.get(parentCode) ?? null) : null;
        const raw        = stripDots(formatted);
        const isAnalytic = rec.grade >= 5 || level >= 5;

        if (!dryRun) {
          const created = await this.prisma.chartOfAccounts.create({
            data: {
              companyId,
              code:        formatted,
              name:        rec.description,
              level,
              type:        inferType(raw),
              nature:      inferNature(raw, rec.nature),
              isAnalytic,
              parentId,
              spedCode:    rec.spedRef || null,
              reducedCode: rec.reducedCode || null,
              createdById: userId,
            },
          });
          codeToId.set(formatted, created.id);
        }

        stats.created++;
      } catch (e: any) {
        errors.push({ line: 0, message: `${formatted}: ${e.message}` });
      }
    }

    this.logger.log(
      `IOB Plano [${dryRun ? 'DRY-RUN' : 'CONFIRM'}] ` +
      `total=${stats.total} matched=${stats.matched} created=${stats.created} notFound=${stats.notFound}`,
    );

    return {
      status:   dryRun ? 'dry-run' : stats.notFound > 0 ? 'partial' : 'done',
      stats,
      notFound,
      errors,
    };
  }
}
