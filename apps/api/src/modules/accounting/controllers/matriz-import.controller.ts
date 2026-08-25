// apps/api/src/modules/accounting/controllers/matriz-import.controller.ts
// CRIADO 24/08/2026 (separado de IobImportController): importacao do Plano
// de Contas MATRIZ (formato proprio LEDGR, nao tem mais relacao com IOB).
// REESCRITO 25/08/2026: nao precisa mais de upload de arquivo - le direto de
// matriz_master_accounts (ver MatrizImportService).
import { Body, Controller, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard }        from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor }  from '../../../multi-company/company.interceptor';
import { MatrizImportService } from '../services/matriz-import.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/matriz')
export class MatrizImportController {
  constructor(
    private readonly matrizImportService: MatrizImportService,
  ) {}

  @Post('import-plano')
  async importPlano(
    @Req() req: any,
    @Query('dryRun') dryRun: string,
    @Body('blocos') blocos: string[], // ex: ["HOTELARIA"]
  ) {
    return this.matrizImportService.importPlano(
      req.companyId,
      dryRun !== 'false',
      req.user?.id,
      blocos ?? [],
    );
  }
}
