// apps/api/src/modules/accounting/services/iob-import.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IobPlanoParserService, IobPlanoRecord } from './iob-plano-parser.service';

export interface IobImportResult {
  status:   'done' | 'partial' | 'dry-run';
  stats: {
    total:       number;
    matched:     number;
    created:     number;
    notFound:    number;
  };
  notFound: string[];
  errors:   Array<{ line: number; message: string }>;
}

@Injectable()
export class IobImportService {
  private readonly logger = new Logger(IobImportService.name);

  constructor(
    private prisma:  PrismaService,
    private parser:  IobPlanoParserService,
  ) {}

  async importPlano(
    companyId:   string,
    fileContent: string,
    dryRun:      boolean,
    userId:      string,
  ): Promise<IobImportResult> {
    const parsed = this.parser.parse(fileContent);
    const stats  = { total: parsed.records.length, matched: 0, created: 0, notFound: 0 };
    const notFound: string[] = [];

    for (const rec of parsed.records) {
      try {
        // Busca conta pelo classification (= code no banco, sem pontos)
        const account = await this.prisma.chartOfAccounts.findFirst({
          where: {
            companyId,
            OR: [
              { code:     rec.classification },
              { spedCode: rec.classification },
            ],
          },
          select: { id: true, code: true },
        });

        if (!account) {
          stats.notFound++;
          notFound.push(`${rec.classification} (${rec.description})`);
          continue;
        }

        stats.matched++;

        if (!dryRun) {
          await this.prisma.chartOfAccounts.update({
            where: { id: account.id },
            data:  { reducedCode: rec.reducedCode } as any,
          });
        }
      } catch (e: any) {
        parsed.errors.push({ line: 0, message: `${rec.classification}: ${e.message}` });
      }
    }

    this.logger.log(
      `IOB Plano [${dryRun ? 'DRY-RUN' : 'CONFIRM'}] ` +
      `total=${stats.total} matched=${stats.matched} notFound=${stats.notFound}`,
    );

    return {
      status:   dryRun ? 'dry-run' : stats.notFound > 0 ? 'partial' : 'done',
      stats,
      notFound,
      errors:   parsed.errors,
    };
  }
}
