import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard }       from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { ChartImporterService } from '../services/chart-importer.service';

function detectEncoding(buffer: Buffer): 'utf8' | 'latin1' {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return 'utf8';
  } catch {
    return 'latin1';
  }
}

function bufferToString(buffer: Buffer): string {
  const enc = detectEncoding(buffer);
  return buffer.toString(enc);
}

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/chart-of-accounts')
export class ChartImporterController {
  constructor(private readonly svc: ChartImporterService) {}

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async preview(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    return this.svc.preview(bufferToString(file.buffer));
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async import(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    const companyId   = req.companyId as string;
    const createdById = req.user.id as string;
    if (!companyId) throw new BadRequestException('Empresa não identificada.');
    return this.svc.import(companyId, bufferToString(file.buffer), createdById);
  }
}



