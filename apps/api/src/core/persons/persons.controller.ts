import { Req as ReqEscopo } from '@nestjs/common';
import { isMasterAdmin } from '../../multi-company/company.interceptor';
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
import { EscopoEmpresaGuard, EscopoEmpresa } from '../../multi-company/escopo-empresa.guard';
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
  async findAll(@Query() query: any, @ReqEscopo() req: any) {
    // Seguranca 0A (04/10/2026) - opcao A: o filtro e sempre definido aqui (sobrescreve qualquer valor vindo do cliente)
    return await this.service.findAll({ ...query, __escopoFiltro: await this.service.filtroPessoas(req.user?.id, isMasterAdmin(req.user)) } as any);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @Get('document/:document')
  async findByDocumentEscopo(@Param('document') document: string, @ReqEscopo() req: any) {
    return this.cpfComEscopo(document, req);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @Get('cpf/:cpf')
  async findByCpfEscopo(@Param('cpf') cpf: string, @ReqEscopo() req: any) {
    return this.cpfComEscopo(cpf, req);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): opcao A - pessoa vinculada a empresa do usuario
  @EscopoEmpresa('pessoa:id')
  @Get(':id/qualificacao')
  async qualificacao(@Param('id') id: string) {
    return await this.service.qualificacao(id);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): opcao A - pessoa vinculada a empresa do usuario
  @EscopoEmpresa('pessoa:id')
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
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): opcao A - pessoa vinculada a empresa do usuario
  @EscopoEmpresa('pessoa:id')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return await this.service.update(id, dto);
  }

  @RequireResourceAccess('persons', 'DELETE')
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): opcao A - pessoa vinculada a empresa do usuario
  @EscopoEmpresa('pessoa:id')
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return await this.service.remove(id);
  }

  @RequireResourceAccess('persons', 'VIEW')
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa DO REGISTRO
  @EscopoEmpresa('param:companyId')
  @Get('links/company/:companyId')
  async linksByCompany(@Param('companyId') companyId: string) {
    return await this.service.linksByCompany(companyId);
  }
  @RequireResourceAccess('persons', 'EDIT')
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa DO REGISTRO
  @EscopoEmpresa('vinculoNovo:companyId') // empresa do corpo E pessoa do corpo
  @Post('links')
  async createLink(@Body() dto: CreatePersonCompanyDto) {
    return await this.service.createLink(dto);
  }

  @RequireResourceAccess('persons', 'EDIT')
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa DO REGISTRO
  @EscopoEmpresa('vinculo:linkId')
  @Patch('links/:linkId')
  async updateLink(@Param('linkId') linkId: string, @Body() dto: UpdatePersonCompanyDto) {
    return await this.service.updateLink(linkId, dto);
  }

  @RequireResourceAccess('persons', 'DELETE')
  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa DO REGISTRO
  @EscopoEmpresa('vinculo:linkId')
  @Delete('links/:linkId')
  @HttpCode(HttpStatus.OK)
  async removeLink(@Param('linkId') linkId: string) {
    return await this.service.removeLink(linkId);
  }

  // Seguranca 0A (04/10/2026) - opcao A: CPF de pessoa fora do alcance do usuario = so a informacao de que existe, sem dados
  private async cpfComEscopo(cpf: string, req: any) {
    const p: any = await this.service.findByCpf(cpf);
    if (!p || !p.id || isMasterAdmin(req.user)) return p;
    if (await this.service.pessoaVisivel(p.id, req.user?.id)) return p;
    return { existe: true, visivel: false, mensagem: 'Ja existe uma pessoa com este CPF, vinculada a empresa a que voce nao tem acesso. Solicite o vinculo ao Master.' };
  }
}
