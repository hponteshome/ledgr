// app.module.ts
import { join } from 'path';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { HrModule } from './modules/hr/hr.module';
import { TabelasLegaisModule } from './modules/tabelas-legais/tabelas-legais.module';
import { ApuracaoModule } from './modules/apuracao/apuracao.module';
import { RfbModule } from './modules/rfb/rfb.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './core/companies/company.module';
import { UsersModule } from './core/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { CertificatesModule } from './core/certificates/certificates.module';
import { CompanyInterceptor } from './multi-company/company.interceptor';
import { AuditModule } from './core/audit/audit.module';
import { DocumentsModule } from './core/documents/documents.module';
import { PersonsModule } from './core/persons/persons.module';
import { ContratosModule } from './core/contratos/contratos.module';
import { BackupModule } from './core/system/backup.module';
import { SystemModule } from './core/system/system.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { SpedModule } from './modules/sped/sped.module';
import { AssetsModule } from './modules/assets/assets.module';
import { RentalContractsModule } from './modules/locacao/rental-contracts.module';
import { Reflector } from '@nestjs/core';
import { FinanceModule } from './modules/finance/finance.module';
import { BankImportModule } from './modules/finance/bank-import.module';
import { CorporateModule } from './modules/corporate/corporate.module'; 
import { SignaturesModule } from './modules/signatures/signatures.module';
import { SidebarPermissionsModule } from './modules/sidebar-permissions/sidebar-permissions.module';
import { ChatModule } from './chat/chat.module';


@Module({
  imports: [
    DashboardModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    CertificatesModule,
    UsersModule,
    AuthModule,
    CompaniesModule,
    AuditModule,
    RfbModule,
    HrModule,
    FiscalModule,
    TabelasLegaisModule,
    ApuracaoModule,
    DocumentsModule,
    ContratosModule,
    PersonsModule,
    BackupModule,
    SystemModule,
    AccountingModule,
    CalendarModule,
    SpedModule,
    AssetsModule,
    RentalContractsModule,
    FinanceModule,
    BankImportModule,
    CorporateModule,
    SignaturesModule,
        SidebarPermissionsModule,
        ChatModule,
    
  ],
  providers: [
    Reflector,
    {
      provide: APP_INTERCEPTOR,
      useClass: CompanyInterceptor,
    },
  ],
})
export class AppModule {
  constructor() {}
}


