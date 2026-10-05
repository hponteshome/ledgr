import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { ShareholderService } from './shareholder.service';
import { CreateShareholderDto, UpdateShareholderDto } from './shareholder.dto';
import { EscopoEmpresaGuard, EscopoEmpresa } from '../../multi-company/escopo-empresa.guard';

@Controller('companies/:companyId/shareholders')
@UseGuards(SidebarResourceGuard) // Seguranca 0A (04/10/2026): perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('societario')
@UseGuards(JwtAuthGuard)
export class ShareholderController {
  constructor(private service: ShareholderService) {}

  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:companyId')
  @Get()
  findAll(@Param('companyId') companyId: string) {
    return this.service.findByCompany(companyId);
  }

  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:companyId')
  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateShareholderDto) {
    return this.service.create(companyId, dto);
  }

  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:companyId')
  @Patch(':id')
  update(@Param('companyId') companyId: string, @Param('id') id: string, @Body() dto: UpdateShareholderDto) {
    return this.service.update(id, companyId, dto);
  }

  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('param:companyId')
  @Delete(':id')
  remove(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(id, companyId);
  }
}
