// apps/api/src/modules/accounting/controllers/equity-method.controller.ts
import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { EquityMethodService, CreateEquityMethodDto } from '../services/equity-method.service';

@UseGuards(JwtAuthGuard)
@Controller('accounting/equity-method')
export class EquityMethodController {
  constructor(private readonly svc: EquityMethodService) {}

  @Get()
  list(@Req() req: any) {
    return this.svc.list(req.headers['x-company-id']);
  }

  @Post()
  create(@Req() req: any, @CurrentUser('object') user: any, @Body() dto: CreateEquityMethodDto) {
    return this.svc.create(req.headers['x-company-id'], user, dto);
  }

  // Rota estatica antes das rotas ':id/...' (Regra 7)
  @Get('percentual-sugerido')
  percentualSugerido(@Req() req: any, @Query('investeeCompanyId') investeeCompanyId: string) {
    return this.svc.percentualSugerido(req.headers['x-company-id'], investeeCompanyId);
  }

  @Get(':id/calcular')
  calcular(@Req() req: any, @Param('id') id: string, @Query('referenceDate') referenceDate: string) {
    return this.svc.calcular(req.headers['x-company-id'], id, referenceDate);
  }

  @Post(':id/lancar')
  lancar(@Req() req: any, @Param('id') id: string, @Body('referenceDate') referenceDate: string) {
    return this.svc.lancar(req.headers['x-company-id'], req.user.id, id, referenceDate);
  }

  @Get(':id/historico')
  historico(@Req() req: any, @Param('id') id: string) {
    return this.svc.historico(req.headers['x-company-id'], id);
  }

  @Post(':id/atualizar-percentual')
  atualizarPercentual(@Req() req: any, @Param('id') id: string, @Body('percentOwned') percentOwned: number) {
    return this.svc.updatePercentOwned(req.headers['x-company-id'], id, percentOwned);
  }
}
