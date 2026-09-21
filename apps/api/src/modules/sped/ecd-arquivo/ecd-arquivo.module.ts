// apps/api/src/modules/sped/ecd-arquivo/ecd-arquivo.module.ts
// ARQUIVO FIEL DA ECD - CRIADO 21/09/2026 (mesmo padrao do EfdModule/EcfModule)
import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';
import { EcdArquivoController } from './ecd-arquivo.controller';
import { EcdArquivoService } from './ecd-arquivo.service';

@Module({
  imports: [PrismaModule],
  controllers: [EcdArquivoController],
  providers: [PrismaService, EcdArquivoService],
})
export class EcdArquivoModule {}
