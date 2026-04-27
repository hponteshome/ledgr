// apps/api/src/modules/accounting/controllers/iob-import.controller.ts
import {
  Controller, Post, Get, UseGuards, UseInterceptors,
  Req, UploadedFile, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard }        from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor }  from '../../../multi-company/company.interceptor';
import { IobImportService }    from '../services/iob-import.service';
import { IobLotdImportService } from '../services/iob-lotd-import.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/iob')
export class IobImportController {
  constructor(
    private readonly iobImportService:     IobImportService,
    private readonly iobLotdImportService: IobLotdImportService,
  ) {}

  @Post('import-plano')
  @UseInterceptors(FileInterceptor('file'))
  async importPlano(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun: string,
  ) {
    const fileContent = file.buffer.toString('latin1');
    return this.iobImportService.importPlano(
      req.companyId,
      fileContent,
      dryRun !== 'false',
      req.user?.id,
    );
  }

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
