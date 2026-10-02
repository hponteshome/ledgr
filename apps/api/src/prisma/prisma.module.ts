import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Seguranca 0A.2 (02/10/2026): global para injecao no CompanyInterceptor
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 🔥 IMPORTANTE
})
export class PrismaModule {}
