// apps/api/src/core/users/users.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { ProfileGuard } from '../../auth/guards/profile.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { UsersService } from './users.service';
import { UserDto } from '../../auth/dto/user.dto';
import { CreateUserDto } from '../dto/create-user.dto';

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMAS CORRIGIDOS:
//  1. @SkipCompanyCheck() na classe inteira — usuários são globais do sistema
//  2. Rota 'audit-logs' movida para ANTES de ':id' (evita conflito de rota)
//  3. Rota 'document/:document' movida para ANTES de ':id' (mesmo motivo)
//  4. @Post() reposicionado corretamente
//  5. Guards e permissões reativados (estavam comentados)
//  6. @Req() substituído por @Request() e @CurrentUser() onde aplicável
// ─────────────────────────────────────────────────────────────────────────────

@Controller('users')
@UseGuards(JwtAuthGuard, ProfileGuard)
@SkipCompanyCheck() // Usuários são globais — não exigem empresa ativa
export class UsersController {

  constructor(private readonly usersService: UsersService) {}

  // ── Rotas estáticas SEMPRE antes de rotas com parâmetro (':id') ─────────────

  @Get('me')
  async getMe(@CurrentUser('object') user: any) {
    const found = await this.usersService.findById(user.id);
    if (!found) throw new NotFoundException('Usuário não encontrado.');
    return new UserDto(found);
  }

  @Get('audit-logs')
  @RequirePermission('users_view')
  getAuditLogs() {
    return { message: 'Auditoria será integrada em breve ao monolito Ledgr.' };
  }

  @Get('document/:document')
  async findByDocument(@Param('document') document: string) {
    const user = await this.usersService.findByDocument(document);
    if (!user) throw new NotFoundException(`Usuário com documento ${document} não encontrado.`);
    return user;
  }

  // ── Rotas com parâmetro dinâmico ────────────────────────────────────────────

  @Get()
  @RequirePermission('users_view')
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(u => new UserDto(u));
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const found = await this.usersService.findById(id);
    if (!found) throw new NotFoundException('Usuário não encontrado.');
    return new UserDto(found);
  }

  @Patch(':id')
  @RequirePermission('users_edit')
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @CurrentUser('object') user: any,
  ) {
    return this.usersService.updateUser(id, data, user.id);
  }

  @Patch(':id/status')
  @RequirePermission('users_edit')
  async changeStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser('object') user: any,
  ) {
    return this.usersService.updateUser(id, { status }, user.id);
  }

  @Patch(':id/deactivate')
  @RequirePermission('users_edit')
  async deactivate(@Param('id') id: string, @CurrentUser('object') user: any) {
    return this.usersService.updateUser(
      id,
      { status: 'inactive', deletedAt: new Date() },
      user.id,
    );
  }

  @Delete(':id')
  @RequirePermission('users_delete')
  async remove(@Param('id') id: string, @CurrentUser('object') user: any) {
    return this.usersService.remove(id, user.id);
  }
}
