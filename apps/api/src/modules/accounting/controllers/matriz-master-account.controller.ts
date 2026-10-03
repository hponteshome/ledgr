// apps/api/src/modules/accounting/controllers/matriz-master-account.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/guards/jwt.guard';
import { MatrizMasterAccountService } from '../services/matriz-master-account.service';
import { MasterOnlyGuard, AcessoAutenticado } from '../../../auth/guards/master-only.guard';

@UseGuards(JwtAuthGuard, MasterOnlyGuard) // Seguranca 0A: Matriz global - escrita so Master
@Controller('accounting/matriz-master')
export class MatrizMasterAccountController {
  constructor(private readonly svc: MatrizMasterAccountService) {}

  @Get()
  @AcessoAutenticado() // Seguranca 0A: leitura liberada
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Req() req: any, @Body() dto: any) {
    return this.svc.create(req.user?.id, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.svc.update(req.user?.id, id, dto);
  }

  @Delete(':id')
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.svc.deactivate(req.user?.id, id);
  }

  @Patch(':id/reactivate')
  reactivate(@Req() req: any, @Param('id') id: string) {
    return this.svc.reactivate(req.user?.id, id);
  }
}
