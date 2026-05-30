import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@/auth/guards/jwt.guard";
import { CompanyGuard } from "@/multi-company/multi-company.guard";
import { ObrigacoesService } from "./obrigacoes.service";

@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller("finance/obrigacoes")
export class ObrigacoesController {
  constructor(private readonly svc: ObrigacoesService) {}

  // GET /finance/obrigacoes?competence=2026-05
  @Get()
  findAll(@Request() req: any, @Query("competence") competence?: string) {
    if (competence) return this.svc.findByCompetence(req.companyId, competence);
    return this.svc.findAll(req.companyId);
  }

  // POST /finance/obrigacoes/gerar/:competence
  // Gera e persiste obrigações baseado no regime tributário cadastrado
  @Post("gerar/:competence")
  gerar(@Request() req: any, @Param("competence") competence: string) {
    return this.svc.gerarObrigacoes(req.companyId, competence);
  }

  // POST /finance/obrigacoes/sync — sincroniza lista gerada pelo frontend
  @Post("sync")
  sync(@Request() req: any, @Body() body: { items: any[] }) {
    return this.svc.upsertMany(req.companyId, req.user.id, body.items);
  }

  // PATCH /finance/obrigacoes/:code/:competence
  @Patch(":code/:competence")
  updateStatus(
    @Request() req: any,
    @Param("code") code: string,
    @Param("competence") competence: string,
    @Body() body: { status: any; notes?: string }
  ) {
    return this.svc.updateStatus(req.companyId, req.user.id, code, competence, body.status, body.notes);
  }
}
