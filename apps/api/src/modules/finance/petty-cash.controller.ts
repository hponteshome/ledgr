// apps/api/src/modules/finance/petty-cash.controller.ts
import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { PettyCashService } from './petty-cash.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('finance/petty-cash')
export class PettyCashController {
  constructor(private readonly service: PettyCashService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.companyId);
  }

  @Post()
  create(@Req() req: any, @Body() dto: any) {
    return this.service.create(req.companyId, dto, req.user.id);
  }

  @Get(':id/summary')
  summary(@Req() req: any, @Param('id') id: string) {
    return this.service.getSummary(req.companyId, id);
  }

  @Get(':id/entries')
  entries(@Req() req: any, @Param('id') id: string, @Query() q: any) {
    return this.service.getEntries(req.companyId, id, q.from, q.to);
  }

  @Post(':id/entries')
  addEntry(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.service.addEntry(req.companyId, id, dto, req.user.id);
  }
}