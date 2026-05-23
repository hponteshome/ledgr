// apps/api/src/modules/finance/cashflow.controller.ts
import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { CashflowService } from './cashflow.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('finance/cashflow')
export class CashflowController {
  constructor(private readonly service: CashflowService) {}

  private defaults(q: any) {
    const y = new Date().getFullYear();
    return {
      from: q.from || (y + '-01'),
      to:   q.to   || (y + '-12'),
    };
  }

  @Get('min-year')
  minYear(@Req() req: any) {
    return this.service.minYear(req.companyId);
  }

  @Get('gerencial')
  gerencial(@Req() req: any, @Query() q: any) {
    const { from, to } = this.defaults(q);
    return this.service.gerencial(req.companyId, from, to, q.propertyId);
  }

  @Get('bancario')
  bancario(@Req() req: any, @Query() q: any) {
    const { from, to } = this.defaults(q);
    return this.service.bancario(req.companyId, from, to);
  }

  @Get('summary')
  summary(@Req() req: any, @Query() q: any) {
    const { from, to } = this.defaults(q);
    return this.service.summary(req.companyId, from, to);
  }
}