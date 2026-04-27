import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Patch, 
  Param, 
  Body, 
  UseGuards, 
  NotFoundException 
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { ProfileGuard } from '../../auth/guards/profile.guard'; // Recomendado renomear para ProfileGuard depois
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermission } from '../../auth/decorators/permission.decorator'; // Recomendado renomear para RequirePermission depois
import { CompanyService } from './company.service';
import { CompanyDto } from '../../core/dto/company.dto'; // Nome atualizado

@Controller('companies') // Rota atualizada para inglês
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly CompanyService: CompanyService) {}

  // 1. ROTAS DE CONSULTA ESPECÍFICA

  @Get('me')
  async getMyCompany(@CurrentUser() user: any) {
    // No seu novo Schema, o campo é companyId
    const company = await this.CompanyService.findById(user.companyId);
    if (!company) throw new NotFoundException('Empresa do usuário não encontrada');
    
    // Retornando DTO atualizado
    return new CompanyDto(company);
  }

  @Get('available') // Antes: 'disponiveis'
  async listAvailable() {
    try {
      const companies = await this.CompanyService.findAll();
      return companies; 
    } catch (error) {
      console.error('ERRO NO BACKEND (listAvailable):', error);
      throw error;
    }
  }

  @Get('audit') // Antes: 'auditoria'
  @UseGuards(ProfileGuard)
  @RequirePermission('companies_view') // Permissão atualizada para inglês
  listLogs() {
    return { message: "Audit logs integrated into Ledgr 1.0 monolith" };
  }

  // 2. ROTAS CRUD

  @Get()
  async findAll() {
    const companies = await this.CompanyService.findAll();
    // Mapeamento para o novo DTO
    return companies.map(c => new CompanyDto(c));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const company = await this.CompanyService.findById(id);
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return new CompanyDto(company);
  }

  // 3. ROTAS DE AÇÃO/ALTERAÇÃO

  @Patch(':id/status')
  @UseGuards(ProfileGuard)
  @RequirePermission('companies_edit')
  async changeStatus(
    @Param('id') id: string, 
    @Body('status') status: string, 
    @CurrentUser() user: any
  ) {
    // Chamada ao método 'update' (antigo 'atualizar')
    return this.CompanyService.update(id, { status }, user.id);
  }

  @Delete(':id')
  @UseGuards(ProfileGuard)
  @RequirePermission('companies_delete')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    // Chamada ao método 'remove' (antigo 'remover')
    return this.CompanyService.remove(id, user.id); 
  }
}