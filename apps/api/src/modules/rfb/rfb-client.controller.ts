// src/services/rfb-client.controller.ts completo
import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards/jwt.guard';  // ← CORRIGIDO!
import { RfbClientService } from './rfb-client.service';

@Controller('rfb')
@UseGuards(JwtAuthGuard)
export class RfbController {
  constructor(private readonly rfbClientService: RfbClientService) {}

  @Get('consulta/:cnpj')
  async consultarCNPJ(@Param('cnpj') cnpj: string) {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    
    if (cnpjLimpo.length !== 14) {
      throw new BadRequestException('CNPJ inválido. Deve conter 14 dígitos.');
    }

    try {
      const result = await this.rfbClientService.consultarCNPJ(cnpjLimpo);
      return {
        success: true,
        data: result,
        source: 'api'
      };
    } catch (error) {
      throw new BadRequestException('Erro ao consultar CNPJ: ' + error.message);
    }
  }

  @Get('cnpj/:cnpj')
  async buscarCNPJ(@Param('cnpj') cnpj: string) {
    return this.consultarCNPJ(cnpj);
  }
}