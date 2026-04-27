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
import { ProfileGuard } from '../../auth/guards/profile.guard';
import { RequirePermission } from '../../auth/decorators/permission.decorator';
import { SkipCompanyCheck } from '../../multi-company/company.interceptor';
import { ProfilesService } from './profiles.service';

// ─────────────────────────────────────────────────────────────────────────────
// PROBLEMAS CORRIGIDOS:
//  1. PrismaService removido — acesso ao banco vai pelo ProfilesService
//  2. @SkipCompanyCheck() na classe inteira — perfis são globais do sistema,
//     não pertencem a uma empresa específica
//  3. CRUD completo: GET, GET :id, PATCH :id, DELETE :id
//  4. ProfileGuard adicionado para proteger mutations
// ─────────────────────────────────────────────────────────────────────────────

@Controller('profiles')
@UseGuards(JwtAuthGuard, ProfileGuard)
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

  @Patch(':id')
  @RequirePermission('profiles_edit')
  async update(@Param('id') id: string, @Body() data: any) {
    const profile = await this.profilesService.update(id, data);
    if (!profile) throw new NotFoundException('Perfil não encontrado.');
    return profile;
  }

  @Delete(':id')
  @RequirePermission('profiles_delete')
  async remove(@Param('id') id: string) {
    return this.profilesService.remove(id);
  }
}