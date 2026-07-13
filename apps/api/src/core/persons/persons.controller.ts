// apps/api/src/core/persons/persons.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { PersonsService } from './persons.service';
import {
  CreatePersonDto, UpdatePersonDto,
  CreatePersonCompanyDto, UpdatePersonCompanyDto,
} from './persons.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '../../auth/decorators/require-resource-access.decorator';

@SkipCompanyCheck()
@UseGuards(JwtAuthGuard, SidebarResourceGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly service: PersonsService) {}

  @RequireResourceAccess('persons', 'VIEW')
  @Get()
  async findAll(@Query() query: { search?: string; isActive?: string; page?: string; limit?: string }) {
    return await this.service.findAll(query);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @Get('document/:document')
  async findByDocument(@Param('document') document: string) {
    return await this.service.findByCpf(document);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @Get('cpf/:cpf')
  async findByCpf(@Param('cpf') cpf: string) {
    return await this.service.findByCpf(cpf);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @Get(':id/qualificacao')
  async qualificacao(@Param('id') id: string) {
    return await this.service.qualificacao(id);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.service.findOne(id);
  }

  @RequireResourceAccess('persons', 'EDIT')
  @Post()
  async create(@Body() dto: CreatePersonDto) {
    return await this.service.create(dto);
  }

  @RequireResourceAccess('persons', 'EDIT')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return await this.service.update(id, dto);
  }

  @RequireResourceAccess('persons', 'DELETE')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return await this.service.remove(id);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @Get('links/company/:companyId')
  async linksByCompany(@Param('companyId') companyId: string) {
    return await this.service.linksByCompany(companyId);
  }
  @RequireResourceAccess('persons', 'EDIT')
  @Post('links')
  async createLink(@Body() dto: CreatePersonCompanyDto) {
    return await this.service.createLink(dto);
  }

  @RequireResourceAccess('persons', 'EDIT')
  @Patch('links/:linkId')
  async updateLink(@Param('linkId') linkId: string, @Body() dto: UpdatePersonCompanyDto) {
    return await this.service.updateLink(linkId, dto);
  }

  @RequireResourceAccess('persons', 'DELETE')
  @Delete('links/:linkId')
  @HttpCode(HttpStatus.OK)
  async removeLink(@Param('linkId') linkId: string) {
    return await this.service.removeLink(linkId);
  }
}
