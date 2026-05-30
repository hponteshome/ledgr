// apps/api/src/core/companies/company-tax-regime.controller.ts
import { Controller, Get, Post, Delete, Param, Body, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@/auth/guards/jwt.guard";
import { CompanyTaxRegimeService } from "./company-tax-regime.service";

@Controller("companies")
@UseGuards(JwtAuthGuard)
export class CompanyTaxRegimeController {
  constructor(private readonly svc: CompanyTaxRegimeService) {}

  @Get(":id/tax-regimes")
  findAll(@Param("id") id: string) {
    return this.svc.findByCompany(id);
  }

  @Post(":id/tax-regimes")
  create(@Param("id") id: string, @Body() body: any) {
    return this.svc.create(id, body);
  }

  @Delete(":id/tax-regimes/:regimeId")
  remove(@Param("regimeId") regimeId: string) {
    return this.svc.remove(regimeId);
  }
}
