// app.module.ts
console.log('🔴🔴🔴 APP MODULES CARREGANDO 🔴🔴🔴');

import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './core/companies/company.module';
import { UsersModule } from './core/users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { CompanyInterceptor } from './multi-company/company.interceptor';
import { AuditModule } from './core/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    CompaniesModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CompanyInterceptor,
    },
  ],
})
export class AppModule {
  constructor() {
    console.log('🏗️ APP MODULE: CONSTRUTOR');
  }
}