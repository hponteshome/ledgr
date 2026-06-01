// apps/api/src/modules/hr/folha.controller.ts
import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { JwtAuthGuard } from "@/auth/guards/jwt.guard";
import { CompanyInterceptor } from "@/multi-company/company.interceptor";
import { FolhaService } from "./services/folha.service";

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller("hr/folha")
export class FolhaController {
  constructor(private readonly service: FolhaService) {}

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
