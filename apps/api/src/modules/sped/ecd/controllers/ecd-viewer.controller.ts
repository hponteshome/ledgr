// apps/api/src/modules/sped/ecd/ecd-viewer.controller.ts

import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EcdViewerService } from '../services/ecd-viewer.service';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard'; // Exemplo de Guard que você já usa

@Controller('sped/ecd/viewer')
@UseGuards(JwtAuthGuard)
export class EcdViewerController {
  constructor(private readonly viewerService: EcdViewerService) {}

  @Get(':importId')
  async getDetails(@Param('importId') importId: string) {
    return this.viewerService.getImportDetails(importId);
  }
}