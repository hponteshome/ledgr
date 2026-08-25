// apps/api/src/modules/accounting/services/matriz-import.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface MatrizImportResult {
  status:   'done' | 'partial' | 'dry-run';
  stats: {
    total:    number;
    matched:  number;
    created:  number;
    notFound: number;
  };
  blocosDisponiveis: string[];
  notFound: string[];
  errors:   Array<{ line: number; message: string }>;
}

// ──────────────────────────────────────────────────────────────────────────
// REESCRITO 25/08/2026: le de matriz_master_accounts (tabela) em vez de
// parsear um arquivo texto de largura fixa enviado por upload. O arquivo
// PlanoContasMatrizLEDGR.txt foi fonte de varios bugs reais nesta mesma
// sessao (desalinhamento de coluna, encoding UTF-8/Latin-1) - a tabela tem
// hierarquia por FK real (parentId), elimina a necessidade inteira da logica
// de mascara/prefixo de codigo (applyMask/stripDots/parentFormatted) que
// existia so para simular hierarquia a partir de um codigo formatado.
@Injectable()
export class MatrizImportService {
  private readonly logger = new Logger(MatrizImportService.name);

  constructor(private prisma: PrismaService) {}

  async importPlano(
    companyId: string,
    dryRun: boolean,
    userId: string,
    blocosIncluidos: string[] = [],
  ): Promise<MatrizImportResult> {
    const blocosSet = new Set(blocosIncluidos.map(b => b.toUpperCase()));

    const masterAccounts = await this.prisma.matrizMasterAccount.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { bloco: 'NUCLEO' },
          { bloco: { in: Array.from(blocosSet) } },
        ],
      },
      orderBy: { level: 'asc' },
    });

    const stats = { total: masterAccounts.length, matched: 0, created: 0, notFound: 0 };
    const errors: Array<{ line: number; message: string }> = [];

    const existing = await this.prisma.chartOfAccounts.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, code: true },
    });
    const codeToId = new Map<string, string>(existing.map(a => [a.code, a.id]));

    // masterId -> id da conta correspondente na empresa (recem-criada ou ja
    // existente) - construido incrementalmente; como masterAccounts vem
    // ordenado por level ascendente, o pai de qualquer conta ja foi
    // processado antes dela.
    const masterIdToTargetId = new Map<string, string>();

    for (const acc of masterAccounts) {
      try {
        const existingId = codeToId.get(acc.code);

        if (existingId) {
          stats.matched++;
          if (!dryRun && acc.reducedCode) {
            await this.prisma.chartOfAccounts.update({
              where: { id: existingId },
              data: { reducedCode: acc.reducedCode },
            });
          }
          masterIdToTargetId.set(acc.id, existingId);
          continue;
        }

        const parentTargetId = acc.parentId ? (masterIdToTargetId.get(acc.parentId) ?? null) : null;

        if (!dryRun) {
          const created = await this.prisma.chartOfAccounts.create({
            data: {
              companyId,
              code:        acc.code,
              name:        acc.name,
              level:       acc.level,
              type:        acc.type,
              nature:      acc.nature,
              isAnalytic:  acc.isAnalytic,
              parentId:    parentTargetId,
              reducedCode: acc.reducedCode,
              createdById: userId,
            },
          });
          masterIdToTargetId.set(acc.id, created.id);
          codeToId.set(acc.code, created.id);
        }

        stats.created++;
      } catch (e: any) {
        errors.push({ line: 0, message: `${acc.code}: ${e.message}` });
      }
    }

    const blocosDisponiveis = Array.from(
      new Set(masterAccounts.map(a => a.bloco).filter(b => b !== 'NUCLEO')),
    );

    this.logger.log(
      `Matriz [${dryRun ? 'DRY-RUN' : 'CONFIRM'}] ` +
      `total=${stats.total} matched=${stats.matched} created=${stats.created} ` +
      `blocos=${blocosIncluidos.join(',') || '(so nucleo)'}`,
    );

    return {
      status: dryRun ? 'dry-run' : errors.length > 0 ? 'partial' : 'done',
      stats,
      blocosDisponiveis,
      notFound: [],
      errors,
    };
  }
}
