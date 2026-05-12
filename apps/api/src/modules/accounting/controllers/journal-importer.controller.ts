import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard }       from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JournalImporterService, bufferToString } from '../services/journal-importer.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/journal')
export class JournalImporterController {
  constructor(private readonly svc: JournalImporterService) {}

  @Post('preview-import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async preview(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    const companyId = req.companyId as string;
    if (!companyId) throw new BadRequestException('Empresa não identificada.');
    return this.svc.preview(bufferToString(file.buffer), companyId);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async import(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    const companyId   = req.companyId as string;
    const createdById = req.user.id as string;
    if (!companyId) throw new BadRequestException('Empresa não identificada.');
    return this.svc.import(bufferToString(file.buffer), companyId, createdById);
  }
}



