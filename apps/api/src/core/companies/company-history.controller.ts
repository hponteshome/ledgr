// apps/api/src/core/companies/company-history.controller.ts
// IMPL-RFB-01 (12/11/2026): comparar/aplicar/sincronizar usam o RfbClientService via CompanyHistoryService
// (antes o compare fazia chamada propria a BrasilAPI e gravava o CNAE so com a descricao).
import { Controller, Get, Post, Body, Param, Request, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@/auth/guards/jwt.guard";
import { CompanyHistoryService } from "./company-history.service";
import { EscopoEmpresaGuard, EscopoEmpresa } from '../../multi-company/escopo-empresa.guard';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';

@Controller("companies")
@UseGuards(JwtAuthGuard)
export class CompanyHistoryController {
  constructor(private readonly historySvc: CompanyHistoryService) {}

  // GET /companies/:id/history
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:id')
  @Get(":id/history")
  findHistory(@Param("id") id: string) {
    return this.historySvc.findByCompany(id);
  }

  // POST /companies/rfb-sync-all - sincroniza todas as empresas com a RFB (somente Master)
  @UseGuards(MasterOnlyGuard)
  @Post("rfb-sync-all")
  syncAll(@Request() req: any) {
    return this.historySvc.syncAll(req.user.id);
  }

  // POST /companies/:id/rfb-compare - consulta a RFB pelo CNPJ cadastrado e retorna as divergencias
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:id')
  @Post(":id/rfb-compare")
  compareWithRfb(@Param("id") id: string) {
    return this.historySvc.compareWithRfb(id);
  }

  // POST /companies/:id/rfb-apply - aplica as divergencias selecionadas na tela
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:id')
  @Post(":id/rfb-apply")
  async applyRfb(
    @Param("id") id: string,
    @Request() req: any,
    @Body() body: { changes: any[] },
  ) {
    return this.historySvc.applyRfbChanges(id, req.user.id, body.changes);
  }

  // POST /companies/:id/rfb-sync - aplica todas as divergencias com a RFB
  @UseGuards(EscopoEmpresaGuard)
  @EscopoEmpresa('param:id')
  @Post(":id/rfb-sync")
  syncOne(@Param("id") id: string, @Request() req: any) {
    return this.historySvc.syncFromRfb(id, req.user.id);
  }
}
