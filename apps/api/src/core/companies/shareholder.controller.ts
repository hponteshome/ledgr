import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { ShareholderService } from './shareholder.service';
import { CreateShareholderDto, UpdateShareholderDto } from './shareholder.dto';

@Controller('companies/:companyId/shareholders')
@UseGuards(JwtAuthGuard)
export class ShareholderController {
  constructor(private service: ShareholderService) {}

  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.service.findByCompany(companyId);
  }

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateShareholderDto) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  update(@Param('companyId') companyId: string, @Param('id') id: string, @Body() dto: UpdateShareholderDto) {
    return this.service.update(id, companyId, dto);
  }

  @Delete(':id')
  remove(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(id, companyId);
  }
}
