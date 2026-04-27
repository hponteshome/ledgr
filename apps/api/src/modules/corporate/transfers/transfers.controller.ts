// apps/api/src/modules/corporate/transfers/transfers.controller.ts
import { Controller, Get, Post, Param, Body, Query, Request, UseGuards, Patch } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('corporate/transfers')
export class TransfersController {
  constructor(private svc: TransfersService) {}

  @Get()
  findAll(@Request() req, @Query() q: { from?: string; to?: string; year?: string }) {
    return this.svc.findAll(req.companyId, {
      from: q.from,
      to: q.to,
      year: q.year ? Number(q.year) : undefined,
    });
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.svc.findOne(req.companyId, id);
  }

  @Post()
  create(@Request() req, @Body() dto: CreateTransferDto) {
    return this.svc.create(req.companyId, req.user.id, dto);
  }

  @Patch(':id/averbar')
  averbar(@Request() req, @Param('id') id: string) {
    return this.svc.averbar(req.companyId, id, req.user.id);
  }
}