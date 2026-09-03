// apps/api/src/modules/accounting/controllers/journal-manual-import.controller.ts
// CRIADO 03/09/2026 (Etapa 3). Mesmo padrao de guards/interceptors do
// journal-importer.controller.ts existente. Reaproveita bufferToString de la
// (mesmo helper, sem duplicar).

import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard }       from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JournalManualImportService } from '../services/journal-manual-import.service';
import { bufferToString } from '../services/journal-importer.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/journal')
export class JournalManualImportController {
  constructor(private readonly svc: JournalManualImportService) {}

  @Post('preview-manual-import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async preview(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    const companyId = req.companyId as string;
    if (!companyId) throw new BadRequestException('Empresa não identificada.');
    return this.svc.preview(bufferToString(file.buffer), companyId);
  }

  @Post('manual-import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async import(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    const companyId   = req.companyId as string;
    const createdById = req.user.id as string;
    if (!companyId) throw new BadRequestException('Empresa não identificada.');
    return this.svc.import(bufferToString(file.buffer), companyId, createdById);
  }
}
