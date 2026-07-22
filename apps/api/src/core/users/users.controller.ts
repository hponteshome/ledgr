// apps/api/src/core/users/users.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '../../auth/decorators/require-resource-access.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
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
//  7. Migrado de ProfileGuard/RequirePermission (legado) para
//     SidebarResourceGuard/RequireResourceAccess (catalogo de sidebar_items)
// ─────────────────────────────────────────────────────────────────────────────

@Controller('users')
@UseGuards(JwtAuthGuard, SidebarResourceGuard)
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

  @RequireResourceAccess('users', 'VIEW')
  @Get('audit-logs')
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

  @RequireResourceAccess('users', 'VIEW')
  @Get()
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(u => new UserDto(u));
  }

  @RequireResourceAccess('users', 'EDIT')
  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get('pendentes/count')
  countPendentes() { return this.usersService.contarPendentes(); }

  @Get('pendentes')
  listPendentes() { return this.usersService.listarPendentes(); }

  @Post(':id/aprovar')
  aprovar(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.usersService.aprovarUsuario(id, body, req.user?.id ?? 'system');
  }

  @Post(':id/rejeitar')
  rejeitar(@Param('id') id: string, @Body('motivo') motivo: string, @Req() req: any) {
    return this.usersService.rejeitarUsuario(id, motivo || 'Sem motivo informado', req.user?.id ?? 'system');
  }


  @Get(':id')
  async findOne(@Param('id') id: string) {
    const found = await this.usersService.findById(id);
    if (!found) throw new NotFoundException('Usuário não encontrado.');
    return new UserDto(found);
  }

  @RequireResourceAccess('users', 'EDIT')
  @RequireResourceAccess('users', 'EDIT')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @CurrentUser('object') user: any,
  ) {
    return this.usersService.updateUser(id, data, user.id);
  }

  @RequireResourceAccess('users', 'EDIT')
  @Patch(':id/status')
  async changeStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser('object') user: any,
  ) {
    return this.usersService.updateUser(id, { status }, user.id);
  }

  @RequireResourceAccess('users', 'EDIT')
  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string, @CurrentUser('object') user: any) {
    return this.usersService.updateUser(
      id,
      { status: 'inactive', deletedAt: new Date() },
      user.id,
    );
  }

  @RequireResourceAccess('users', 'DELETE')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('object') user: any) {
    return this.usersService.remove(id, user.id);
  }


  @RequireResourceAccess('users', 'VIEW')
  @Get(':id/access-schedule')
  getAccessSchedule(@Param('id') id: string) {
    return this.usersService.getAccessSchedule(id);
  }

  @RequireResourceAccess('users', 'EDIT')
  @Post(':id/access-schedule')
  setAccessSchedule(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.usersService.setAccessSchedule(id, dto, req.user.id);
  }

  @RequireResourceAccess('users', 'EDIT')
  @Delete(':id/access-schedule')
  removeAccessSchedule(@Param('id') id: string) {
    return this.usersService.removeAccessSchedule(id);
  }

  @RequireResourceAccess('users', 'VIEW')
  @Get('unlock-requests/list')
  listUnlockRequests(@Query('status') status?: string) {
    return this.usersService.listUnlockRequests(status);
  }

  @RequireResourceAccess('users', 'EDIT')
  @Post('unlock-requests/:requestId/approve')
  approveUnlockRequest(@Param('requestId') requestId: string, @Req() req: any) {
    return this.usersService.resolveUnlockRequest(requestId, true, req.user.id);
  }

  @RequireResourceAccess('users', 'EDIT')
  @Post('unlock-requests/:requestId/deny')
  denyUnlockRequest(@Param('requestId') requestId: string, @Req() req: any) {
    return this.usersService.resolveUnlockRequest(requestId, false, req.user.id);
  }

}
