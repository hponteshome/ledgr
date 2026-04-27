// src/core/certificates/certificates.controller.ts

import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Request,
  UseGuards, UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard }      from '../../auth/guards/jwt.guard';
import { CertificatesService } from './certificates.service';
import { ImportCertificateDto, UpdateCertificateDto } from './certificates.dto';
import { SigningService } from './signing.service';

// ── Limite de tamanho: 2 MB (certificados típicos < 10 KB) ──────
const MAX_CERT_SIZE = 2 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller('certificates')
export class CertificatesController {
  constructor(
    private readonly svc:     CertificatesService,
    private readonly signing: SigningService,
  ) {}

  // ── GET /certificates?companyId=xxx&onlyActive=true ──────────
  @Get()
  findAll(
    @Query('companyId') companyId: string,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.svc.findAll(companyId, onlyActive === 'true');
  }

  // ── GET /certificates/:id?companyId=xxx ──────────────────────
  @Get(':id')
  findOne(
    @Param('id')         id:        string,
    @Query('companyId')  companyId: string,
  ) {
    return this.svc.findOne(id, companyId);
  }

  // ── POST /certificates/import ────────────────────────────────
  // multipart/form-data:
  //   file     — arquivo .p12 ou .pfx
  //   alias    — nome descritivo
  //   type     — "A1" | "A3"
  //   usage[]  — "SIGNING" | "TRANSMISSION"
  //   password — senha do .p12
  //   companyId
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_CERT_SIZE })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body() dto:        ImportCertificateDto,
    @Body('companyId') companyId: string,
    @Request()         req: any,
  ) {
    return this.svc.import(companyId, dto, file.buffer);
  }

  // ── POST /certificates/preview ───────────────────────────────
  // Faz parse sem salvar — para o frontend mostrar preview antes de confirmar
  @Post('preview')
  @UseInterceptors(FileInterceptor('file'))
  async preview(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: MAX_CERT_SIZE })],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body('password') password: string,
  ) {
    return this.svc.preview(file.buffer, password);
  }

  // ── PATCH /certificates/:id ──────────────────────────────────
  @Patch(':id')
  update(
    @Param('id')         id:        string,
    @Query('companyId')  companyId: string,
    @Body()              dto:       UpdateCertificateDto,
  ) {
    return this.svc.update(id, companyId, dto);
  }

  // ── DELETE /certificates/:id ─────────────────────────────────
  // Soft delete (isActive = false)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id')         id:        string,
    @Query('companyId')  companyId: string,
  ) {
    await this.svc.remove(id, companyId);
  }

  // ── POST /certificates/:id/evict ─────────────────────────────
  // Remove a chave do cache em memória imediatamente
  @Post(':id/evict')
  @HttpCode(HttpStatus.NO_CONTENT)
  async evict(@Param('id') id: string) {
    this.signing.evictKey(id);
  }
}
