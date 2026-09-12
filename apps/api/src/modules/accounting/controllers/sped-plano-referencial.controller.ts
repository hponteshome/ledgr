// apps/api/src/modules/accounting/controllers/sped-plano-referencial.controller.ts
// NOVO (11/09/2026): importacao do plano referencial SPED (registro I051).
import { Controller, Post, Get, UploadedFiles, UseInterceptors, UseGuards } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { SpedPlanoReferencialService } from '../services/sped-plano-referencial.service';

@Controller('accounting/sped-plano-referencial')
@UseGuards(JwtAuthGuard)
export class SpedPlanoReferencialController {
  constructor(private readonly svc: SpedPlanoReferencialService) {}

  @Post('import')
  @UseInterceptors(FilesInterceptor('files', 50, { storage: multer.memoryStorage() }))
  async import(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      return { results: [], message: 'Nenhum arquivo enviado.' };
    }
    const results = await this.svc.importFiles(
      files.map(f => ({ originalname: f.originalname, buffer: f.buffer })),
    );
    return { results };
  }

  @Get('summary')
  async summary() {
    return this.svc.listSummary();
  }

  @Get('status')
  async status() {
    return this.svc.getStatus();
  }
}
