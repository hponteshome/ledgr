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

  @Get('gerencial')
  gerencial(@Req() req: any, @Query() q: any) {
    const now = new Date();
    const fromMonth = q.from ?? `${now.getFullYear()}-01`;
    const toMonth   = q.to   ?? `${now.getFullYear()}-12`;
    return this.service.gerencial(req.companyId, fromMonth, toMonth, q.propertyId);
  }

  @Get('summary')
  summary(@Req() req: any, @Query() q: any) {
    const now = new Date();
    const fromMonth = q.from ?? `${now.getFullYear()}-01`;
    const toMonth   = q.to   ?? `${now.getFullYear()}-12`;
    return this.service.summary(req.companyId, fromMonth, toMonth);
  }
}