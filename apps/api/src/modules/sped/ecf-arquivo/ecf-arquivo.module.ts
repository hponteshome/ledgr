// apps/api/src/modules/sped/ecf-arquivo/ecf-arquivo.module.ts
// ARQUIVO FIEL DA ECF - CRIADO 21/09/2026 (mesmo padrao do EcdArquivoModule)
import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';
import { EcfArquivoController } from './ecf-arquivo.controller';
import { EcfArquivoService } from './ecf-arquivo.service';

@Module({
  imports: [PrismaModule],
  controllers: [EcfArquivoController],
  providers: [PrismaService, EcfArquivoService],
})
export class EcfArquivoModule {}
