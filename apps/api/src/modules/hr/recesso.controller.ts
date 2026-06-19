import { Controller, Get, Post, Param, Body, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { RecessoService } from './services/recesso.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { Response } from 'express';

@Controller('hr/recesso')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
export class RecessoController {
  constructor(private svc: RecessoService) {}

  @Post()
  criar(@Req() req: any, @Body() body: any) {
    return this.svc.criar(req.companyId, body, req.user.id);
  }

  @Get()
  listar(@Req() req: any) {
    return this.svc.listar(req.companyId);
  }

  @Get(':id/preview')
  preview(@Req() req: any, @Param('id') id: string) {
    return this.svc.preview(req.companyId, id);
  }

  @Post(':id/aplicar')
  aplicar(@Req() req: any, @Param('id') id: string) {
    return this.svc.aplicarParaTodos(req.companyId, id, req.user.id);
  }

  @Get(':id/recibos/zip')
  async zip(@Req() req: any, @Param('id') id: string, @Res() res: Response) {
    const buf = await this.svc.gerarZipRecibos(req.companyId, id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="recibos-recesso-${id}.zip"`);
    return res.send(buf);
  }
}
