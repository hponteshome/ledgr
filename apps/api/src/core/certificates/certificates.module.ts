// src/core/certificates/certificates.module.ts

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MulterModule }   from '@nestjs/platform-express';
import { memoryStorage }  from 'multer';

import { PrismaModule }          from '../../prisma/prisma.module';
import { CryptoService }         from './crypto.service';
import { SigningService }         from './signing.service';
import { CertificatesService }   from './certificates.service';
import { CertificatesController } from './certificates.controller';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),           // necessário para o @Cron do checkExpirations
    MulterModule.register({
      storage: memoryStorage(),         // arquivo em buffer, nunca em disco
      limits:  { fileSize: 2 * 1024 * 1024 },
    }),
  ],
  providers: [
    CryptoService,
    SigningService,
    CertificatesService,
  ],
  controllers: [CertificatesController],
  exports: [
    CryptoService,    // usado pelo DocumentsService para hash de conteúdo
    SigningService,   // usado pelo DocumentsService para assinar PDFs
    CertificatesService,
  ],
})
export class CertificatesModule {}

// ════════════════════════════════════════════════════════════════
// REGISTRO NO AppModule (apps/api/src/app.module.ts)
// ════════════════════════════════════════════════════════════════
//
// import { CertificatesModule } from './core/certificates/certificates.module';
//
// @Module({
//   imports: [
//     ...
//     CertificatesModule,
//     ...
//   ],
// })
// export class AppModule {}
