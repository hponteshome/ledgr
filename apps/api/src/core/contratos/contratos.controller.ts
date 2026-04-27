// apps/api/src/core/contratos/contratos.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Request,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard }    from '../../auth/guards/jwt.guard';
import { ContratosService } from './contratos.service';
import {
  CreateContratoDto, UpdateContratoDto, ContratoFilters,
} from './contratos.dto';

@UseGuards(JwtAuthGuard)
@Controller('contratos')
export class ContratosController {
  constructor(private readonly service: ContratosService) {}

  // ── GET /contratos ────────────────────────────────────────
  // Query params: companyId, type, status, search
  @Get()
  findAll(@Query() filters: ContratoFilters) {
    return this.service.findAll(filters);
  }

  // ── GET /contratos/:id ────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ── GET /contratos/:id/versions ───────────────────────────
  @Get(':id/versions')
  getVersions(@Param('id') id: string) {
    return this.service.getVersions(id);
  }

  // ── GET /contratos/socio/:personId/qualificacao ───────────
  // Retorna a qualificação completa de uma Pessoa Física para
  // auto-preenchimento no ContratoEdit (chamada pelo frontend
  // junto com /persons/cpf/:cpf).
  @Get('socio/:personId/qualificacao')
  qualificacaoSocio(@Param('personId') personId: string) {
    return this.service.qualificacaoSocio(personId);
  }

  // ── POST /contratos ───────────────────────────────────────
  @Post()
  create(@Request() req, @Body() dto: CreateContratoDto) {
    return this.service.create(dto, req.user.id);
  }

  // ── PATCH /contratos/:id ──────────────────────────────────
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContratoDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user.id);
  }

  // ── DELETE /contratos/:id ─────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
