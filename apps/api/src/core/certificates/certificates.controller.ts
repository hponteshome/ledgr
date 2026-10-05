import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
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
import { isMasterAdmin, empresaEfetiva } from '../../multi-company/company.interceptor';

// ── Limite de tamanho: 2 MB (certificados típicos < 10 KB) ──────
const MAX_CERT_SIZE = 2 * 1024 * 1024;

@UseGuards(SidebarResourceGuard) // Seguranca 0A (04/10/2026): perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('certificates')
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
    @Request() req: any,
    @Query('onlyActive') onlyActive?: string,
  ) {
    return this.svc.findAll(empresaEfetiva(req, companyId) as string, onlyActive === 'true');
  }

  // ── GET /certificates/:id?companyId=xxx ──────────────────────
  @Get(':id')
  findOne(
    @Param('id')         id:        string,
    @Query('companyId')  companyId: string,
    @Request() req: any,
  ) {
    return this.svc.findOne(id, empresaEfetiva(req, companyId) as string);
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
    return this.svc.import(empresaEfetiva(req, companyId) as string, dto, file.buffer);
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
    @Request() req: any,
  ) {
    return this.svc.update(id, empresaEfetiva(req, companyId) as string, dto);
  }

  // ── DELETE /certificates/:id ─────────────────────────────────
  // Soft delete (isActive = false)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id')         id:        string,
    @Query('companyId')  companyId: string,
    @Request() req: any,
  ) {
    await this.svc.remove(id, empresaEfetiva(req, companyId) as string);
  }

  // ── POST /certificates/:id/evict ─────────────────────────────
  // Remove a chave do cache em memória imediatamente
  @Post(':id/evict')
  @HttpCode(HttpStatus.NO_CONTENT)
  async evict(@Param('id') id: string, @Request() req: any) {
    if (!isMasterAdmin(req.user)) await this.svc.findOne(id, req.companyId); // Seguranca 0A: certificado da empresa ativa
    this.signing.evictKey(id);
  }
}
