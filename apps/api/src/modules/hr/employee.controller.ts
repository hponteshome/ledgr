import { BancoHorasService } from './services/banco-horas.service';
// apps/api/src/modules/hr/employee.controller.ts
import { Controller, Post, Get, Put, Patch, Delete, UseGuards, UseInterceptors, Req, UploadedFile, Body, Param, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { EmployeePdfParserService } from './services/employee-pdf-parser.service';
import { EmployeeService } from './services/employee.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('hr/employees')
export class EmployeeController {
  constructor(
    private readonly parser:    EmployeePdfParserService,
    private readonly service:   EmployeeService,
    private readonly bhService: BancoHorasService,
  ) {}

  // ── Importacao PDF ───────────────────────────────────────────────────────────
  @Post('parse-pdf')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  async parsePdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo PDF nao enviado.');
    return this.parser.parse(file.buffer);
  }

  @Post('import')
  async importEmployee(@Req() req: any, @Body() body: any) {
    return this.service.importFromParsed(req.companyId, body, req.user.id);
  }

  @Post('import-batch')
  async importBatch(@Req() req: any, @Body() body: { employees: any[] }) {
    const results = [];
    for (const emp of body.employees) {
      try {
        const r = await this.service.importFromParsed(req.companyId, emp, req.user.id);
        results.push({ success: true, name: emp.fullName, ...r });
      } catch (e: any) {
        results.push({ success: false, name: emp.fullName, error: e.message });
      }
    }
    return results;
  }

  // ── CRUD basico ──────────────────────────────────────────────────────────────
  @Get()
  list(@Req() req: any) {
    return this.service.listByCompany(req.companyId);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.companyId, id);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.companyId, id, body, req.user.id);
  }

  @Patch(':id/desligar')
  desligar(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.desligar(req.companyId, id, body, req.user.id);
  }

  // ── Historico contratual ─────────────────────────────────────────────────────
  @Get(':id/historico')
  historico(@Req() req: any, @Param('id') id: string) {
    return this.service.listarHistorico(req.companyId, id);
  }

  @Post(':id/historico')
  addHistorico(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.addHistorico(req.companyId, id, body, req.user.id);
  }

  // ── Ocorrencias ──────────────────────────────────────────────────────────────
  @Get(':id/ocorrencias')
  ocorrencias(@Req() req: any, @Param('id') id: string) {
    return this.service.listarOcorrencias(req.companyId, id);
  }

  @Post(':id/ocorrencias')
  addOcorrencia(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.addOcorrencia(req.companyId, id, body, req.user.id);
  }

  // ── Afastamentos ─────────────────────────────────────────────────────────────
  @Get(':id/afastamentos')
  afastamentos(@Req() req: any, @Param('id') id: string) {
    return this.service.listarAfastamentos(req.companyId, id);
  }

  @Post(':id/afastamentos')
  addAfastamento(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.addAfastamento(req.companyId, id, body, req.user.id);
  }

  // ── Banco de horas ───────────────────────────────────────────────────────────
  @Get(':id/banco-horas')
  bancoHoras(@Req() req: any, @Param('id') id: string) {
    return this.bhService.getSaldo(req.companyId, id);
  }
  @Get('banco-horas/relatorio')
  bhRelatorio(@Req() req: any) {
    return this.bhService.getRelatorio(req.companyId);
  }
  @Post(':id/banco-horas/creditar')
  bhCreditar(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.bhService.creditar(req.companyId, id, body, req.user.id);
  }
  @Post(':id/banco-horas/debitar')
  bhDebitar(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.bhService.debitar(req.companyId, id, body, req.user.id);
  }
  @Post(':id/banco-horas/ajustar')
  bhAjustar(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.bhService.ajustar(req.companyId, id, body, req.user.id);
  }
  @Post(':id/banco-horas/configurar')
  bhConfigurar(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.bhService.configurar(req.companyId, id, body);
  }

  @Post(':id/banco-horas/lancamentos/:lancamentoId/estornar')
  bhEstornar(@Req() req: any, @Param('id') id: string, @Param('lancamentoId') lancamentoId: string, @Body() body: any) {
    return this.bhService.estornar(req.companyId, id, lancamentoId, body.motivo, req.user.id);
  }

  @Post(':id/banco-horas/lancamentos/:lancamentoId/corrigir')
  bhCorrigir(@Req() req: any, @Param('id') id: string, @Param('lancamentoId') lancamentoId: string, @Body() body: any) {
    return this.bhService.corrigir(req.companyId, id, lancamentoId, body, req.user.id);
  }

  @Post(':id/banco-horas')
  addBancoHoras(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.addLancamentoBH(req.companyId, id, body, req.user.id);
  }
}
