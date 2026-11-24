// apps/api/src/modules/locacao/rental-contracts.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '../../auth/decorators/require-resource-access.decorator';
import { RentalContractsService } from './rental-contracts.service';
import { CreateRentalContractDto, UpdateRentalContractDto } from './dto/rental-contract.dto';

@UseGuards(JwtAuthGuard, SidebarResourceGuard)
@Controller('rental-contracts')
export class RentalContractsController {
  constructor(private svc: RentalContractsService) {}

  @Post('by-document/:documentId/prepare-signers')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  prepareSignersByDocument(@Req() req: any, @Param('documentId') documentId: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.prepareSignersByDocument(companyId, documentId);
  }

  @Post('gerar-lancamentos')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  gerarLancamentos(@Req() req: any, @Body('competencia') competencia: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.gerarLancamentos(companyId, userId, competencia);
  }

  @Get()
  @RequireResourceAccess('rental-contracts', 'VIEW')
  findAll(@Req() req: any, @Query('status') status?: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.findAll(companyId, status);
  }

  // NOVO 23/10/2026: alertas de locacao (antes de GET :id)
  @Get('alerts')
  @RequireResourceAccess('rental-contracts', 'VIEW')
  alertas(@Req() req: any) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.alertas(companyId);
  }

  // 17/11/2026: lastro documental (PDF assinado, conferencia, ressalva)
  @Patch(':id/lastro')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  lastro(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.lastro(req.companyId ?? req.headers['x-company-id'], req.user?.id ?? req.user?.sub, id, body ?? {});
  }

  // REAJ-01 (24/11/2026): reajuste do aluguel - registrar (APLICADO ou DISPENSADO) e excluir o mais recente
  @Post(':id/reajustes')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  registrarReajuste(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.registrarReajuste(companyId, userId, id, body ?? {});
  }

  @Patch(':id/reajustes/:reajusteId/excluir')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  excluirReajuste(@Req() req: any, @Param('id') id: string, @Param('reajusteId') reajusteId: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.excluirReajuste(companyId, userId, id, reajusteId);
  }

  // 04/11/2026: encerramento por fim de prazo ou rescisao
  @Post(':id/encerrar')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  encerrar(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.encerrar(companyId, userId, id, body);
  }

  @Get(':id')
  @RequireResourceAccess('rental-contracts', 'VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.findOne(companyId, id);
  }

  @Post()
  @RequireResourceAccess('rental-contracts', 'EDIT')
  create(@Req() req: any, @Body() dto: CreateRentalContractDto) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.create(companyId, userId, dto);
  }

  @Patch(':id')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRentalContractDto) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.update(companyId, userId, id, dto);
  }

  @Delete(':id')
  @RequireResourceAccess('rental-contracts', 'DELETE')
  remove(@Req() req: any, @Param('id') id: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.remove(companyId, id);
  }

  @Post(':id/generate-document')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  generateDocument(
    @Req() req: any,
    @Param('id') id: string,
    @Body('force') force?: boolean,
    @Body('dataInstrumento') dataInstrumento?: string,
    @Body('templateId') templateId?: string,
  ) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.generateDocument(companyId, userId, id, force === true, dataInstrumento, templateId || undefined);
  }

  // POST /rental-contracts/:id/preview-template - PDF do texto de um template (em edicao) com os dados deste contrato
  @Post(':id/preview-template')
  @RequireResourceAccess('rental-contracts', 'VIEW')
  async previewTemplate(
    @Req() req: any,
    @Param('id') id: string,
    @Body('content') content: string,
    @Body('dataInstrumento') dataInstrumento: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.svc.previewTemplate(req.headers['x-company-id'] ?? '', id, content, dataInstrumento);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="previsualizacao.pdf"' });
    res.send(buffer);
  }

  @Post(':id/prepare-signers')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  prepareSigners(@Req() req: any, @Param('id') id: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.prepareSigners(companyId, id);
  }
}