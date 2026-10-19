// apps/api/src/modules/accounting/controllers/consolidation.controller.ts
// CRIADO 19/10/2026: Balanco Consolidado Intercompany (leitura) e cadastro dos pares intercompany (so Master).
import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { SidebarResourceGuard } from '../../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../../auth/decorators/recurso-menu.decorator';
import { MasterOnlyGuard } from '../../../auth/guards/master-only.guard';
import { ConsolidationService, PairDto } from '../services/consolidation.service';

@Controller('accounting/consolidation')
@UseGuards(SidebarResourceGuard) // Seguranca 0A: perfil na API = permissoes do menu (roda depois do JwtAuthGuard)
@RecursoMenu('relatorios-contabeis')
@UseGuards(JwtAuthGuard)
export class ConsolidationController {
  constructor(private readonly svc: ConsolidationService) {}

  // GET /accounting/consolidation?companyIds=a,b,c&date=AAAA-MM-DD
  // Acesso conferido empresa a empresa no servico (Master ou vinculo em user_companies).
  @Get()
  consolidar(@Req() req: any, @Query('companyIds') companyIds: string, @Query('date') date: string) {
    return this.svc.consolidar(req.user, String(companyIds || '').split(',').map(s => s.trim()), date);
  }

  @Get('pares')
  listarPares(@Req() req: any) {
    return this.svc.listarPares(req.user);
  }

  @UseGuards(MasterOnlyGuard)
  @Post('pares')
  criarPar(@Req() req: any, @Body() dto: PairDto) {
    return this.svc.criarPar(req.user, dto);
  }

  @UseGuards(MasterOnlyGuard)
  @Delete('pares/:id')
  removerPar(@Param('id') id: string) {
    return this.svc.removerPar(id);
  }
}
