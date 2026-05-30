import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { CompanyHistoryController } from './company-history.controller';
import { CompanyHistoryService } from './company-history.service';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuditModule, HttpModule],
  controllers: [CompanyController, CompanyHistoryController],
  providers: [CompanyService, CompanyHistoryService],
  exports: [CompanyService, CompanyHistoryService],
})
export class CompaniesModule {}
