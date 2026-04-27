// /apps/api/src/modules/accounting/controllers/balance-import.controller.ts

import { Controller, Post, UseInterceptors, UploadedFile, Body, UseGuards, Req, Headers } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@auth/guards/jwt.guard';
import { CompanyGuard } from '@multi-company/multi-company.guard';
import { BalanceImportService } from '../services/balance-import.service';

@Controller('accounting/import-balances')
@UseGuards(JwtAuthGuard, CompanyGuard)
export class BalanceImportController {
  constructor(private readonly balanceImportService: BalanceImportService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async importBalances(
    @UploadedFile() file: Express.Multer.File,
    @Body('companyId') bodyCompanyId: string, // Pode vir do body (opcional)
    @Headers('x-company-id') headerCompanyId: string, // OU do header (opcional)
    @Req() req: any
  ) {
    const userId = req.user.id;
    const fileContent = file.buffer.toString('utf-8');
    
    // Prioridade: bodyCompanyId > headerCompanyId > null
    // Mas o service vai priorizar o CNPJ do arquivo
    const companyId = bodyCompanyId || headerCompanyId || null;
    
    console.log('📥 Importando arquivo:', {
      fileName: file.originalname,
      fileSize: file.size,
      companyId: companyId || 'NÃO FORNECIDO (usará CNPJ do arquivo)',
      userId
    });

    return this.balanceImportService.importBalances(
      companyId, // Pode ser null - o service vai buscar pelo CNPJ
      fileContent,
      userId,
 //     file.originalname
    );
  }
}