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

@SkipCompanyCheck()
@UseGuards(JwtAuthGuard)
@Controller('persons')
export class PersonsController {
  constructor(private readonly service: PersonsService) {}

  @Get()
  async findAll(@Query() query: { search?: string; isActive?: string; page?: string; limit?: string }) {
    return await this.service.findAll(query);
  }

  @Get('document/:document')
  async findByDocument(@Param('document') document: string) {
    return await this.service.findByCpf(document);
  }

  @Get('cpf/:cpf')
  async findByCpf(@Param('cpf') cpf: string) {
    return await this.service.findByCpf(cpf);
  }

  @Get(':id/qualificacao')
  async qualificacao(@Param('id') id: string) {
    return await this.service.qualificacao(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.service.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreatePersonDto) {
    return await this.service.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return await this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return await this.service.remove(id);
  }

  @Post('links')
  async createLink(@Body() dto: CreatePersonCompanyDto) {
    return await this.service.createLink(dto);
  }

  @Patch('links/:linkId')
  async updateLink(@Param('linkId') linkId: string, @Body() dto: UpdatePersonCompanyDto) {
    return await this.service.updateLink(linkId, dto);
  }

  @Delete('links/:linkId')
  @HttpCode(HttpStatus.OK)
  async removeLink(@Param('linkId') linkId: string) {
    return await this.service.removeLink(linkId);
  }
}