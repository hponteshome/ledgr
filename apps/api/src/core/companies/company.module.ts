import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanyHistoryController } from './company-history.controller';
import { CompanyTaxRegimeController } from './company-tax-regime.controller';
import { CompanyTaxRegimeService } from './company-tax-regime.service';
import { CompanyHistoryService } from './company-history.service';
import { AuditModule } from '../audit/audit.module';
import { ShareholderController } from './shareholder.controller';
import { ShareholderService } from './shareholder.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuditModule, HttpModule],
  controllers: [CompanyController, CompanyHistoryController, CompanyTaxRegimeController, ShareholderController],
  providers: [CompanyService, CompanyHistoryService, CompanyTaxRegimeService, ShareholderService],
  exports: [CompanyService, CompanyHistoryService, CompanyTaxRegimeService, ShareholderService],
})
export class CompaniesModule {}
