// apps/api/src/modules/locacao/rental-contracts.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '../../auth/decorators/require-resource-access.decorator';
import { RentalContractsService } from './rental-contracts.service';
import { CreateRentalContractDto, UpdateRentalContractDto } from './dto/rental-contract.dto';

@UseGuards(JwtAuthGuard, SidebarResourceGuard)
@Controller('rental-contracts')
export class RentalContractsController {
  constructor(private svc: RentalContractsService) {}

  @Get()
  @RequireResourceAccess('rental-contracts', 'VIEW')
  findAll(@Req() req: any, @Query('status') status?: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.findAll(companyId, status);
  }

  @Get(':id')
  @RequireResourceAccess('rental-contracts', 'VIEW')
  findOne(@Req() req: any, @Param('id') id: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.findOne(companyId, id);
  }

  @Post()
  @RequireResourceAccess('rental-contracts', 'EDIT')
  create(@Req() req: any, @Body() dto: CreateRentalContractDto) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.create(companyId, userId, dto);
  }

  @Patch(':id')
  @RequireResourceAccess('rental-contracts', 'EDIT')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRentalContractDto) {
    const companyId = req.headers['x-company-id'] ?? '';
    const userId = req.user?.id ?? req.user?.sub ?? '';
    return this.svc.update(companyId, userId, id, dto);
  }

  @Delete(':id')
  @RequireResourceAccess('rental-contracts', 'DELETE')
  remove(@Req() req: any, @Param('id') id: string) {
    const companyId = req.headers['x-company-id'] ?? '';
    return this.svc.remove(companyId, id);
  }
}