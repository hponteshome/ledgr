// apps/api/src/modules/dimob/dimob.controller.ts
// LEDGR - DIMOB (18/11/2026): conferencia e arquivo de importacao do PGD (grupo SPED & Obrigacoes Acessorias)
import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyGuard } from '@/multi-company/multi-company.guard';
import { DimobService } from './dimob.service';

@UseGuards(SidebarResourceGuard) // Seguranca 0A: perfil na API = permissoes do menu
@RecursoMenu('dimob')
@UseGuards(JwtAuthGuard, CompanyGuard)
@Controller('dimob')
export class DimobController {
  constructor(private readonly svc: DimobService) {}

  @Get('conferencia')
  conferencia(@Request() req: any, @Query('ano') ano: string, @Query('cpfResponsavel') cpf: string) {
    return this.svc.conferencia(req.companyId, Number(ano), cpf ?? '');
  }

  @Get('arquivo')
  async arquivo(@Request() req: any, @Res() res: Response, @Query('ano') ano: string, @Query('cpfResponsavel') cpf: string) {
    const r = await this.svc.gerarArquivo(req.companyId, Number(ano), cpf ?? '');
    res.setHeader('Content-Type', 'text/plain; charset=us-ascii');
    res.setHeader('Content-Disposition', `attachment; filename="${r.nome}"`);
    res.send(r.conteudo);
  }
}
