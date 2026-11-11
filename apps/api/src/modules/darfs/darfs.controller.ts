import { SidebarResourceGuard } from '../../auth/guards/sidebar-resource.guard';
import { RecursoMenu } from '../../auth/decorators/recurso-menu.decorator';
// apps/api/src/modules/darfs/darfs.controller.ts
import { Controller, Get, Post, Delete, Param, Body, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { DarfsService } from './darfs.service';

@UseGuards(SidebarResourceGuard) // mesmo recurso de menu da Apuracao de Impostos
@RecursoMenu('apuracao')
@UseGuards(JwtAuthGuard)
@Controller('darfs')
export class DarfsController {
  constructor(private readonly svc: DarfsService) {}

  @Post('calcular')
  calcular(@Body() body: any) {
    return this.svc.calcular(body);
  }

  @Post()
  salvar(@Req() req: any, @Body() body: any) {
    return this.svc.salvar(req.companyId, body, req.user);
  }

  @Get()
  listar(@Req() req: any, @Query() q: any) {
    return this.svc.listar(req.companyId, q);
  }

  @Post('html')
  html(@Req() req: any, @Body() body: any) {
    return this.svc.html(req.companyId, body?.ids ?? []);
  }

  @Post('pdf')
  async pdf(@Req() req: any, @Body() body: any, @Res() res: any) {
    const pdf = await this.svc.pdf(req.companyId, body?.ids ?? []);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename=DARFs.pdf' });
    res.send(pdf);
  }

  @Post(':id/pagamento')
  pagar(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.registrarPagamento(req.companyId, id, body);
  }

  @Delete(':id')
  cancelar(@Req() req: any, @Param('id') id: string) {
    return this.svc.cancelar(req.companyId, id);
  }
}
