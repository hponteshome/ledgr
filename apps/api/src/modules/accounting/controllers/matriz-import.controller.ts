// apps/api/src/modules/accounting/controllers/matriz-import.controller.ts
// CRIADO 24/08/2026 (separado de IobImportController): importacao do Plano
// de Contas MATRIZ (formato proprio LEDGR, nao tem mais relacao com IOB).
import {
  Controller, Post, UseGuards, UseInterceptors,
  Req, UploadedFile, Query, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard }       from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { MatrizImportService } from '../services/matriz-import.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/matriz')
export class MatrizImportController {
  constructor(
    private readonly matrizImportService: MatrizImportService,
  ) {}

  @Post('import-plano')
  @UseInterceptors(FileInterceptor('file'))
  async importPlano(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun: string,
    @Body('blocos') blocos: string, // CSV opcional, ex: "HOTELARIA"
  ) {
    const fileContent = file.buffer.toString('latin1');
    const blocosIncluidos = blocos ? blocos.split(',').map(b => b.trim()).filter(Boolean) : [];
    return this.matrizImportService.importPlano(
      req.companyId,
      fileContent,
      dryRun !== 'false',
      req.user?.id,
      blocosIncluidos,
    );
  }
}
