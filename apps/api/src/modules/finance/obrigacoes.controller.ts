import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@/auth/guards/jwt.guard";
import { CompanyGuard } from "@/multi-company/multi-company.guard";
import { ObrigacoesService } from "./obrigacoes.service";

@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller("finance/obrigacoes")
export class ObrigacoesController {
  constructor(private readonly svc: ObrigacoesService) {}

  @Get()
  findAll(@Request() req: any, @Query("competence") competence?: string) {
    if (competence) return this.svc.findByCompetence(req.companyId, competence);
    return this.svc.findAll(req.companyId);
  }

  @Post("sync")
  sync(@Request() req: any, @Body() body: { items: any[] }) {
    return this.svc.upsertMany(req.companyId, req.user.id, body.items);
  }

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
