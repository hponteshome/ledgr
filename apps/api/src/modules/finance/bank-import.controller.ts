// ============================================================
// LEDGR — apps/api/src/modules/finance/bank-import.controller.ts
// FIX: FileInterceptor com memoryStorage explícito
// ============================================================
import {
  Controller, Post, Get, Patch, Body, Param,
  UseGuards, UseInterceptors, Req, UploadedFile,
  HttpCode, HttpStatus,
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

  // Lista extratos já importados
  @Get('statements')
  listStatements(@Req() req: any) {
    return this.service.listStatements(req.companyId);
  }

  // Upload e parse do extrato
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // mantém o arquivo em buffer na memória
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máximo
    }),
  )
  upload(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('Arquivo não enviado.');
    }
    return this.service.uploadStatement(
      req.companyId,
      file.buffer,
      file.originalname,
      req.user.id,
    );
  }

  // Retorna grupos de transações para classificação
  @Get('statements/:id/groups')
  getGroups(@Param('id') id: string, @Req() req: any) {
    return this.service.getGroups(req.companyId, id);
  }

  // Classifica um grupo
  @Patch('statements/:id/groups')
  @HttpCode(HttpStatus.OK)
  classifyGroup(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: ClassifyGroupDto,
  ) {
    return this.service.classifyGroup(req.companyId, id, dto, req.user.id);
  }

  // Confirma e gera JournalEntries
  @Post('statements/:id/post')
  @HttpCode(HttpStatus.OK)
  post(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: Omit<PostStatementDto, 'statementId'>,
  ) {
    return this.service.postStatement(
      req.companyId,
      { ...dto, statementId: id },
      req.user.id,
    );
  }
}