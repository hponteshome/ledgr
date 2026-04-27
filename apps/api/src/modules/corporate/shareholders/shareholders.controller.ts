// apps/api/src/modules/corporate/shareholders/shareholders.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ShareholdersService } from './shareholders.service';
import { CreateShareholderDto } from './dto/create-shareholder.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('corporate/shareholders')
export class ShareholdersController {
  constructor(private svc: ShareholdersService) {}

  @Get()
  findAll(@Request() req, @Query() query: { entryType?: string; active?: string }) {
    return this.svc.findAll(req.companyId, {
      entryType: query.entryType,
      active: query.active !== undefined ? query.active === 'true' : undefined,
    });
  }

  @Get('capital-summary')
  capitalSummary(@Request() req) {
    return this.svc.getCapitalSummary(req.companyId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.svc.findOne(req.companyId, id);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateShareholderDto) {
    return this.svc.create(req.companyId, req.user.id, dto);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: Partial<CreateShareholderDto>) {
    return this.svc.update(req.companyId, id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.svc.softDelete(req.companyId, id);
  }
}