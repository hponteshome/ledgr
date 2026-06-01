// apps/api/src/modules/hr/folha.controller.ts
import { Controller, Get, Post, Patch, Param, Body, Req, Res, UseGuards, UseInterceptors } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "@/auth/guards/jwt.guard";
import { CompanyInterceptor } from "@/multi-company/company.interceptor";
import { FolhaService } from "./services/folha.service";
import { GuiasService } from "./services/guias.service";

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller("hr/folha")
export class FolhaController {
  constructor(
    private readonly service: FolhaService,
    private readonly guias: GuiasService,
  ) {}

  // ── Rotas estaticas ANTES do :id ─────────────────────────────────────────────
  @Get()
  listar(@Req() req: any) {
    return this.service.listar(req.companyId);
  }

  @Post()
  criar(@Req() req: any, @Body() body: any) {
    return this.service.criar(req.companyId, body.competencia, req.user.id);
  }

  // ── Beneficios ───────────────────────────────────────────────────────────────
  @Get("beneficios/:employeeId")
  listarBeneficios(@Req() req: any, @Param("employeeId") empId: string) {
    return this.service.listarBeneficios(req.companyId, empId);
  }

  @Post("beneficios")
  criarBeneficio(@Req() req: any, @Body() body: any) {
    return this.service.criarBeneficio(req.companyId, body);
  }

  // ── Dissidios ────────────────────────────────────────────────────────────────
  @Get("dissidios")
  listarDissidios(@Req() req: any) {
    return this.service.listarDissidios(req.companyId);
  }

  @Post("dissidios")
  criarDissidio(@Req() req: any, @Body() body: any) {
    return this.service.criarDissidio(req.companyId, body, req.user.id);
  }

  // ── Previews HTML ────────────────────────────────────────────────────────────
  @Get(":id/recibo/:funcId/preview")
  async reciboPreview(@Req() req: any, @Param("id") id: string, @Param("funcId") funcId: string) {
    return this.guias.gerarReciboHtml(req.companyId, id, funcId);
  }

  @Get(":id/gps-preview")
  async gpsPreview(@Req() req: any, @Param("id") id: string) {
    return this.guias.gerarGpsHtml(req.companyId, id);
  }

  @Get(":id/darf-preview")
  async darfPreview(@Req() req: any, @Param("id") id: string) {
    return this.guias.gerarDarfHtml(req.companyId, id);
  }

  // ── PDFs ─────────────────────────────────────────────────────────────────────
  @Get(":id/recibo/:funcId")
  async recibo(@Req() req: any, @Param("id") id: string, @Param("funcId") funcId: string, @Res() res: Response) {
    const { pdf, filename } = await this.guias.gerarReciboPdf(req.companyId, id, funcId);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=" + filename });
    res.send(pdf);
  }

  @Get(":id/gps-pdf")
  async gpsPdf(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const { pdf, filename } = await this.guias.gerarGpsFolhaPdf(req.companyId, id);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=" + filename });
    res.send(pdf);
  }

  @Get(":id/darf-pdf")
  async darfPdf(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const { pdf, filename } = await this.guias.gerarDarfFolhaPdf(req.companyId, id);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=" + filename });
    res.send(pdf);
  }

  // ── Rotas parametrizadas (:id) ────────────────────────────────────────────────
  @Get(":id")
  detalhe(@Req() req: any, @Param("id") id: string) {
    return this.service.detalhe(req.companyId, id);
  }

  @Post(":id/calcular")
  calcular(@Req() req: any, @Param("id") id: string) {
    return this.service.calcular(req.companyId, id, req.user.id);
  }

  @Patch(":id/fechar")
  fechar(@Req() req: any, @Param("id") id: string) {
    return this.service.fechar(req.companyId, id);
  }

  @Patch(":id/reabrir")
  reabrir(@Req() req: any, @Param("id") id: string) {
    return this.service.reabrir(req.companyId, id);
  }
}
