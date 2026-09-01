// apps/api/src/modules/accounting/controllers/ecd-lancamentos-import.controller.ts
// Upload via navegador (multipart) - mesmo padrao do importador original
// (ecd.controller.ts). Arquivos ECD SPED sao latin1 (ISO-8859-1). Ano
// extraido automaticamente do proprio arquivo (registro 0000).
import { BadRequestException, Controller, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { EcdLancamentosImportService } from '../services/ecd-lancamentos-import.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/ecd-lancamentos')
export class EcdLancamentosImportController {
  constructor(private readonly svc: EcdLancamentosImportService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo nao enviado.');
    const content = file.buffer.toString('latin1');
    return this.svc.preview(req.companyId, content);
  }

  @Post('registrar')
  @UseInterceptors(FileInterceptor('file'))
  async registrar(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo nao enviado.');
    const content = file.buffer.toString('latin1');
    return this.svc.registrar(req.companyId, content, req.user.id);
  }
}
