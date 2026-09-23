// apps/api/src/modules/sped/ecf-arquivo/ecf-arquivo.controller.ts
// ============================================================================
// ARQUIVO FIEL DA ECF - CRIADO 21/09/2026
// Rotas: POST carregar (unica que grava, e so em ecf_arq*) e GETs de analise.
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
import { EcfArquivoService } from './ecf-arquivo.service';

@Controller('sped/ecf-arquivo')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class EcfArquivoController {
  constructor(private readonly service: EcfArquivoService) {}

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

  @Get('lalur/resumo')
  resumo(@Company() companyId: string) {
    return this.service.resumo(companyId);
  }

  @Get('lalur/cadeia')
  cadeia(@Company() companyId: string) {
    return this.service.cadeia(companyId);
  }

  @Get('lalur/parte-b-validacao')
  parteBValidacao(@Company() companyId: string) {
    return this.service.parteBValidacao(companyId);
  }

  @Get('lalur/parte-a-validacao')
  parteAValidacao(@Company() companyId: string) {
    return this.service.parteAValidacao(companyId);
  }

  @Get(':id/parte-a')
  parteA(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('per') per?: string,
    @Query('trib') trib?: string,
  ) {
    return this.service.parteA(companyId, id, per, trib);
  }

  @Get(':id/parte-b')
  parteB(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('per') per?: string,
  ) {
    return this.service.parteB(companyId, id, per);
  }

  @Get(':id/indice')
  indice(@Company() companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.indice(companyId, id);
  }

  @Get(':id/registros')
  registros(
    @Company() companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('reg') reg: string,
    @Query('per') per?: string,
    @Query('q') q?: string,
    @Query('limite') limite?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.registros(companyId, id, reg, per, q, limite, offset);
  }
}
