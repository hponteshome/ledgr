// apps/api/src/modules/sped/ecd-arquivo/ecd-arquivo.controller.ts
// ============================================================================
// ARQUIVO FIEL DA ECD - CRIADO 21/09/2026
// Rotas: POST carregar (unica que grava, e so em ecd_arq*) e GETs de consulta.
// ============================================================================
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { CompanyGuard } from '@multi-company/multi-company.guard';
import { Company } from '@multi-company/company.decorator';
import { EcdArquivoService } from './ecd-arquivo.service';

@Controller('sped/ecd-arquivo')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class EcdArquivoController {
  constructor(private readonly service: EcdArquivoService) {}

  @Post('carregar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 60 * 1024 * 1024 } }))
  async carregar(
    @UploadedFile() file: Express.Multer.File,
    @Company() companyId: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Arquivo nao enviado.');
    return this.service.carregar(companyId, req.user?.id ?? null, file.originalname, file.buffer);
  }

  @Get('arquivos')
  listar(@Company() companyId: string) {
    return this.service.listar(companyId);
  }

  @Get('resultado-anual')
  resultadoAnual(@Company() companyId: string) {
    return this.service.resultadoAnual(companyId);
  }

  @Get(':id/contas')
  contas(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('bloco') bloco?: string,
  ) {
    return this.service.contas(companyId, id, bloco ?? 'I');
  }

  @Get(':id/razao')
  razao(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('conta') conta: string,
    @Query('dtIni') dtIni?: string,
    @Query('dtFin') dtFin?: string,
  ) {
    return this.service.razao(companyId, id, conta, dtIni, dtFin);
  }

  @Get(':id/razao-geral')
  razaoGeral(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('contas') contas?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('dtIni') dtIni?: string,
    @Query('dtFin') dtFin?: string,
    @Query('soComMovimento') soComMovimento?: string,
  ) {
    return this.service.razaoGeral(companyId, id, {
      contas,
      de,
      ate,
      dtIni,
      dtFin,
      soComMovimento: soComMovimento !== '0',
    });
  }
}
