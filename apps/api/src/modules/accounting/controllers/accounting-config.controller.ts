import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CompanyInterceptor } from '../../../multi-company/company.interceptor';
import { UseInterceptors } from '@nestjs/common';
import { AccountingConfigService } from '../services/accounting-config.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('accounting/config')
export class AccountingConfigController {
  constructor(private readonly svc: AccountingConfigService) {}

  @Get()
  get(@Req() req: any) {
    return this.svc.getConfig(req.companyId);
  }

  @Put()
  upsert(@Req() req: any, @Body() dto: any) {
    return this.svc.upsertConfig(req.companyId, req.user.id, dto);
  }
}
