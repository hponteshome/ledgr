import { EscopoEmpresaGuard, EscopoEmpresa } from '../../../../multi-company/escopo-empresa.guard';
// apps/api/src/modules/sped/ecd/ecd-viewer.controller.ts

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EcdViewerService } from '../services/ecd-viewer.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard'; // Exemplo de Guard que você já usa

@Controller('sped/ecd/viewer')
@UseGuards(JwtAuthGuard)
export class EcdViewerController {
  constructor(private readonly viewerService: EcdViewerService) {}

  @UseGuards(EscopoEmpresaGuard) // Seguranca 0A (04/10/2026): vinculo com a empresa dona do registro
  @EscopoEmpresa('ecd:importId')
  @Get(':importId')
  async getDetails(@Param('importId') importId: string) {
    return this.viewerService.getImportDetails(importId);
  }
}