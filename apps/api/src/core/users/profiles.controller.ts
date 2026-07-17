// apps/api/src/core/profiles/profiles.controller.ts

import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RequireResourceAccess } from '../../auth/decorators/require-resource-access.decorator';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { ProfilesService } from './profiles.service';
import { Req, Post } from '@nestjs/common';

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMAS CORRIGIDOS:
//  1. PrismaService removido — acesso ao banco vai pelo ProfilesService
//  2. @SkipCompanyCheck() na classe inteira — perfis são globais do sistema,
//     não pertencem a uma empresa específica
//  3. CRUD completo: GET, GET :id, PATCH :id, DELETE :id
//  4. Migrado de ProfileGuard/RequirePermission (legado) para
//     SidebarResourceGuard/RequireResourceAccess (catalogo de sidebar_items)
// ─────────────────────────────────────────────────────────────────────────────

@Controller('profiles')
@UseGuards(JwtAuthGuard, SidebarResourceGuard)
@SkipCompanyCheck() // Perfis são globais — não exigem empresa ativa
export class ProfilesController {

  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  async findAll() {
    return this.profilesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const profile = await this.profilesService.findById(id);
    if (!profile) throw new NotFoundException('Perfil não encontrado.');
    return profile;
  }

  @RequireResourceAccess('profiles', 'EDIT')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    const profile = await this.profilesService.update(id, data);
    if (!profile) throw new NotFoundException('Perfil não encontrado.');
    return profile;
  }

  @RequireResourceAccess('profiles', 'DELETE')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.profilesService.remove(id);
  }

  @RequireResourceAccess('profiles', 'VIEW')
  @Get(':id/access-schedule')
  getAccessSchedule(@Param('id') id: string) {
    return this.profilesService.getAccessSchedule(id);
  }

  @RequireResourceAccess('profiles', 'EDIT')
  @Post(':id/access-schedule')
  setAccessSchedule(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.profilesService.setAccessSchedule(id, dto, req.user.id);
  }

  @RequireResourceAccess('profiles', 'EDIT')
  @Delete(':id/access-schedule')
  removeAccessSchedule(@Param('id') id: string) {
    return this.profilesService.removeAccessSchedule(id);
  }
}
