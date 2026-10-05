// apps/api/src/core/companies/company-tax-regime.controller.ts
import { Controller, Get, Post, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@/auth/guards/jwt.guard";
import { CompanyTaxRegimeService } from "./company-tax-regime.service";
import { EscopoEmpresaGuard, EscopoEmpresa } from '../../multi-company/escopo-empresa.guard';

@Controller("companies")
@UseGuards(JwtAuthGuard)
export class CompanyTaxRegimeController {
  constructor(private readonly svc: CompanyTaxRegimeService) {}

  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:id')
  @Get(":id/tax-regimes")
  findAll(@Param("id") id: string) {
    return this.svc.findByCompany(id);
  }

  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:id')
  @Post(":id/tax-regimes")
  create(@Param("id") id: string, @Body() body: any) {
    return this.svc.create(id, body);
  }

  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('regime:regimeId')
  @Delete(":id/tax-regimes/:regimeId")
  remove(@Param("regimeId") regimeId: string) {
    return this.svc.remove(regimeId);
  }
}
