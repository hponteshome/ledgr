// apps/api/src/modules/accounting/services/matriz-import.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AccountNature, AccountType } from '@prisma/client';
import { MatrizPlanoParserService, MatrizPlanoRecord } from './matriz-plano-parser.service';

export interface MatrizImportResult {
  status:   'done' | 'partial' | 'dry-run';
  stats: {
    total:    number;
    matched:  number;
    created:  number;
    notFound: number;
  };
  blocosDisponiveis: string[]; // blocos opcionais encontrados no arquivo (informativo)
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

const BLOCO_NUCLEO = 'NUCLEO';

// ──────────────────────────────────────────────────────────────────────────
// RENOMEADO 24/08/2026 (de IobImportService): este importa o Plano de Contas
// MATRIZ (PlanoContasMatrizLEDGR.txt) - nao tem mais relacao com o sistema
// externo IOB, e um formato proprio do LEDGR. O grupo LOTD (import-lotd,
// iob-lotd-import.service.ts/iob-lotd-parser.service.ts) continua com o nome
// IOB de proposito - la sim e o layout real de exportacao do sistema IOB,
// mantido para compatibilidade com arquivos gerados por aquele sistema.
@Injectable()
export class MatrizImportService {
  private readonly logger = new Logger(MatrizImportService.name);

  constructor(
    private prisma:  PrismaService,
    private parser:  MatrizPlanoParserService,
  ) {}

  async importPlano(
    companyId: string,
    fileContent: string,
    dryRun: boolean,
    userId: string,
    blocosIncluidos: string[] = [],
  ): Promise<MatrizImportResult> {
    const mask = '0.0.0.00.00.0000';
    const parsedFull = this.parser.parse(fileContent);

    // CRIADO 24/08/2026: filtra por bloco opcional. NUCLEO sempre entra;
    // blocos opcionais (ex: HOTELARIA) so entram se explicitamente pedidos.
    const blocosSet = new Set(blocosIncluidos.map(b => b.toUpperCase()));
    const parsed = {
      ...parsedFull,
      records: parsedFull.records.filter(
        r => r.bloco === BLOCO_NUCLEO || blocosSet.has(r.bloco),
      ),
    };

    const stats  = { total: parsed.records.length, matched: 0, created: 0, notFound: 0 };
    const notFound: string[] = [];
    const errors:   Array<{ line: number; message: string }> = [...parsedFull.errors];

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
        this.logger.log(`[Matriz] Máscara criada: ${mask}`);
      }
    }

    // ── 2. Construir mapa de códigos formatados → record ───────────────────
    const recordMap = new Map<string, MatrizPlanoRecord>();
    for (const rec of parsed.records) {
      const formatted = applyMask(stripDots(rec.classification), mask);
      recordMap.set(formatted, rec);
    }

    // ── 3. Carregar contas já existentes da empresa ────────────────────────
    const existing = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const codeToId = new Map<string, string>(
      existing.map(a => [applyMask(stripDots(a.code), mask), a.id]),
    );

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
              code:        raw,
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
      `Matriz Plano [${dryRun ? 'DRY-RUN' : 'CONFIRM'}] ` +
      `total=${stats.total} matched=${stats.matched} created=${stats.created} notFound=${stats.notFound} ` +
      `blocos=${blocosIncluidos.join(',') || '(so nucleo)'}`,
    );

    return {
      status:   dryRun ? 'dry-run' : stats.notFound > 0 ? 'partial' : 'done',
      stats,
      blocosDisponiveis: parsedFull.blocos,
      notFound,
      errors,
    };
  }
}
