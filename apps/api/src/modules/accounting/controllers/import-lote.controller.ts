// apps/api/src/modules/accounting/controllers/import-lote.controller.ts
// NOVO (10/09/2026): listagem dos lotes de importacao.
import { Controller, Get, Query, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { ImportLoteService } from '../services/import-lote.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/import-lotes')
export class ImportLoteController {
  constructor(private readonly svc: ImportLoteService) {}

  @Get()
  async findAll(@Req() req: any, @Query('ano') ano?: string) {
    return this.svc.findAll(req.companyId, ano ? parseInt(ano, 10) : undefined);
  }
}
