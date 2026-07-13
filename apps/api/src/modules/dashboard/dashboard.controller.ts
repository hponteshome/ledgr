// apps/api/src/modules/dashboard/dashboard.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get('kpi')
  kpi(@Req() req: any, @Query('month') month: string) {
    return this.svc.kpi(req.companyId, month);
  }

  @Get('summary')
  summary(@Req() req: any) {
    return this.svc.summary(req.companyId);
  }
}
