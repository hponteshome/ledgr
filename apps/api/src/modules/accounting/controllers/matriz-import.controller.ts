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
    // CORRIGIDO 25/08/2026: PlanoContasMatrizLEDGR.txt sempre foi UTF-8 (achado
    // real: linha pre-existente "Nao Circulante" decodifica certo em UTF-8 e
    // vira mojibake em Latin-1). O 'latin1' aqui foi herdado sem revisao do
    // antigo IobImportController - la faz sentido (formato real do sistema
    // IOB), aqui nao - sao arquivos e fontes diferentes.
    const fileContent = file.buffer.toString('utf-8');
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
