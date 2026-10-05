// apps/api/src/core/documents/document-templates.controller.ts
// Templates de documentos (30/09/2026)
import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Req, Res,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { isMasterAdmin } from '../../multi-company/company.interceptor';
import { DocumentTemplatesService } from './document-templates.service';

@UseGuards(JwtAuthGuard)
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private readonly svc: DocumentTemplatesService) {}

  private cid(req: any): string { return req.headers['x-company-id'] ?? ''; }
  private uid(req: any): string { return req.user?.id ?? req.user?.sub ?? ''; }

  @Get()
  list(@Req() req: any, @Query('type') type?: string) {
    return this.svc.list(this.cid(req), type);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.svc.get(id, this.cid(req));
  }

  @Post(':id/duplicate')
  duplicate(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.duplicate(id, this.cid(req), this.uid(req), body, isMasterAdmin(req.user));
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.update(id, this.cid(req), this.uid(req), body, isMasterAdmin(req.user));
  }

  @Patch(':id/active')
  setActive(@Req() req: any, @Param('id') id: string, @Body('active') active: boolean) {
    return this.svc.setActive(id, this.cid(req), active === true, isMasterAdmin(req.user));
  }

  @Patch(':id/default')
  setDefault(@Req() req: any, @Param('id') id: string) {
    return this.svc.setDefault(id, this.cid(req), isMasterAdmin(req.user));
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(id, this.cid(req), isMasterAdmin(req.user));
  }

  @Get(':id/docx')
  async docx(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.svc.exportDocx(id, this.cid(req));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });
    res.send(buffer);
  }

  @Post(':id/import-docx')
  @UseInterceptors(FileInterceptor('file', { storage: require('multer').memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  importDocx(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo .docx nao enviado.');
    return this.svc.importDocx(id, this.cid(req), file, isMasterAdmin(req.user));
  }
}
