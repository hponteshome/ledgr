// apps/api/src/modules/accounting/cdi/cdi.controller.ts
import { Controller, Get, Post, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CdiService } from './cdi.service';

@UseGuards(JwtAuthGuard)
@Controller('accounting/cdi')
export class CdiController {
  constructor(private readonly svc: CdiService) {}

  @Get()
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.findAll(from, to);
  }

  @Get('latest')
  getLatest() {
    return this.svc.getLatestDate();
  }

  @Get('monthly')
  getMonthly(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getMonthlyRates(from, to);
  }

  @Get('competence/:comp')
  getByCompetence(@Param('comp') comp: string) {
    return this.svc.findByCompetence(comp);
  }

  @Post('import')
  importRates(@Body() body: { rows: any[] }) {
    return this.svc.upsertMany(body.rows);
  }

  @Delete(':date')
  remove(@Param('date') date: string) {
    return this.svc.deleteByDate(date);
  }
}