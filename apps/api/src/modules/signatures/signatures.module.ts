// apps/api/src/modules/signatures/signatures.module.ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { SignaturesController } from './signatures.controller';
import { SignatureService } from './signature.service';
import { CertificatesService } from './certificates.service';
import { GovBrService } from './govbr.service';
import { ClicksignService } from './clicksign.service';
import { SignatureValidatorService } from './signature-validator.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [MulterModule.register({ storage: undefined })],
  controllers: [SignaturesController],
  providers: [
    SignatureService, CertificatesService, GovBrService,
    ClicksignService, SignatureValidatorService, PrismaService
  ],
  exports: [SignatureService, CertificatesService, GovBrService, ClicksignService, SignatureValidatorService],
})
export class SignaturesModule {}
