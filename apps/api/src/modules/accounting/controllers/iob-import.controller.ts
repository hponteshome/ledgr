// apps/api/src/modules/accounting/controllers/iob-import.controller.ts
// REDUZIDO 24/08/2026: metodo import-plano (Matriz LEDGR) foi extraido para
// MatrizImportController (accounting/matriz/import-plano) - este controller
// fica so com o LOTD (formato de lote de lancamentos exportado pelo sistema
// IOB de verdade, nome mantido de proposito, ver LEDGR-contexto.md 24/08/2026).
import {
  Controller, Post, Get, UseGuards, UseInterceptors,
  Req, UploadedFile, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard }        from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor }  from '../../../multi-company/company.interceptor';
import { IobLotdImportService } from '../services/iob-lotd-import.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/iob')
export class IobImportController {
  constructor(
    private readonly iobLotdImportService: IobLotdImportService,
  ) {}

  @Post('import-lotd')
  @UseInterceptors(FileInterceptor('file'))
  async importLotd(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun: string,
  ) {
    const fileContent = file.buffer.toString('latin1');
    return this.iobLotdImportService.importLotd(
      req.companyId,
      fileContent,
      file.originalname,
      dryRun !== 'false',
      req.user?.id,
    );
  }

  @Get('lote-imports')
  async listLoteImports(@Req() req: any) {
    return this.iobLotdImportService.listLoteImports(req.companyId);
  }
}
