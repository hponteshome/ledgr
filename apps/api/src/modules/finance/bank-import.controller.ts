// ============================================================
// LEDGR — apps/api/src/modules/finance/bank-import.controller.ts
// ============================================================
import {
  Controller, Post, Get, Patch, Delete, Body, Param,
  UseGuards, UseInterceptors, Req, UploadedFile,
  HttpCode, HttpStatus, BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { BankImportService, ClassifyGroupDto, PostStatementDto } from './bank-import.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('bank-import')
export class BankImportController {
  constructor(private readonly service: BankImportService) {}

  @Get('statements')
  listStatements(@Req() req: any) {
    return this.service.listStatements(req.companyId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo não enviado.');
    return this.service.uploadStatement(req.companyId, file.buffer, file.originalname, req.user.id);
  }

  @Post('preview-excel')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  previewExcel(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo Excel não fornecido.');
    return this.service.previewExcelMapped(req.companyId, file.buffer);
  }

  @Post('upload-excel')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } }))
  uploadExcel(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo Excel não fornecido.');
    return this.service.uploadExcelMapped(req.companyId, file.buffer, file.originalname, req.user.id);
  }

  @Get('statements/:id/groups')
  getGroups(@Param('id') id: string, @Req() req: any) {
    return this.service.getGroups(req.companyId, id);
  }

  @Patch('statements/:id/groups')
  @HttpCode(HttpStatus.OK)
  classifyGroup(@Param('id') id: string, @Req() req: any, @Body() dto: ClassifyGroupDto) {
    return this.service.classifyGroup(req.companyId, id, dto, req.user.id);
  }

  @Post('statements/confirm')
  @HttpCode(HttpStatus.OK)
  postStatement(@Req() req: any, @Body() dto: PostStatementDto) {
    return this.service.postStatement(req.companyId, dto, req.user.id);
  }

  @Delete('statements/:id')
  @HttpCode(HttpStatus.OK)
  deleteStatement(@Param('id') id: string, @Req() req: any) {
    return this.service.deleteStatement(req.companyId, id);
  }
}
