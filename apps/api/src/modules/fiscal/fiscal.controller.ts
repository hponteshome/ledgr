import { Controller, Post, Get, UseGuards, UseInterceptors,
  UploadedFiles, Req, Body, Query } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { NfseImportService } from './services/nfse-import.service';

@Controller('fiscal')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
export class FiscalController {
  constructor(private nfse: NfseImportService) {}

  // Preview — parse sem salvar
  @Post('nfse-sp/preview')
  @UseInterceptors(FilesInterceptor('files', 50))
  preview(@UploadedFiles() files: Express.Multer.File[], @Req() req: any) {
    if (!files?.length) throw new Error('Nenhum arquivo enviado');
    return this.nfse.preview(files, req.companyId);
  }

  // Import — salva no banco
  @Post('nfse-sp/import')
  @UseInterceptors(FilesInterceptor('files', 50))
  importar(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
    @Body('skipDuplicates') skip?: string,
  ) {
    if (!files?.length) throw new Error('Nenhum arquivo enviado');
    return this.nfse.importar(files, req.companyId, req.user.id, skip !== 'false');
  }

  // Lista NFS-e importadas
  @Get('nfse-sp')
  async listar(@Req() req: any, @Query('competencia') comp?: string) {
    const where: any = { companyId: req.companyId, documentType: 'NFSE', deletedAt: null };
    if (comp) where.competenceMonth = comp;
    return req['prisma'] ?? [];
  }
}
