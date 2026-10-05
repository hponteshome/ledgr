import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { HolidayService } from './holiday.service';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { MasterOnlyGuard } from '../../auth/guards/master-only.guard';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';

@Controller('calendar/holidays')
@UseGuards(JwtAuthGuard)
@SkipCompanyCheck()
export class HolidayController {
  constructor(private svc: HolidayService) {}

  @Get()
  findAll(@Query('year') year?: string, @Query('type') type?: string) {
    return this.svc.findAll(year ? parseInt(year) : undefined, type);
  }

  @Get('business-days')
  countBusinessDays(@Query('from') from: string, @Query('to') to: string) {
    return this.svc.countBusinessDays(new Date(from), new Date(to));
  }

  @UseGuards(MasterOnlyGuard) // Seguranca 0A (04/10/2026): feriados sao globais; so o Master altera
  @Post('import/:year')
  importYear(@Param('year') year: string) {
    return this.svc.importFromBrasilApi(parseInt(year));
  }

  @UseGuards(MasterOnlyGuard) // Seguranca 0A (04/10/2026): feriados sao globais; so o Master altera
  @Post()
  create(@Body() dto: any) {
    return this.svc.create(dto);
  }

  @UseGuards(MasterOnlyGuard) // Seguranca 0A (04/10/2026): feriados sao globais; so o Master altera
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
