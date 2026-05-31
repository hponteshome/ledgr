// apps/api/src/modules/hr/hr.controller.ts
import { Controller, Get, Post, Param, Res, UseGuards, UseInterceptors, Req } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';
import { CompanyInterceptor } from '@/multi-company/company.interceptor';
import { EsocialS2200Service } from './services/esocial-s2200.service';

@UseGuards(JwtAuthGuard)
@UseInterceptors(CompanyInterceptor)
@Controller('hr')
export class HrController {
  constructor(private readonly esocial: EsocialS2200Service) {}

  @Get('esocial/s2200/:employeeId')
  async s2200(@Req() req: any, @Param('employeeId') employeeId: string, @Res() res: Response) {
    const xml = await this.esocial.generateS2200(req.companyId, employeeId);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="S-2200-${employeeId}.xml"`);
    return res.send(xml);
  }

  @Get('esocial/s2200')
  async s2200All(@Req() req: any) {
    return this.esocial.generateAllS2200(req.companyId);
  }
}
