// apps/api/src/modules/apuracao/apuracao.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApuracaoController } from './apuracao.controller';
import { ApuracaoService } from './apuracao.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApuracaoController],
  providers: [ApuracaoService],
  exports: [ApuracaoService],
})
export class ApuracaoModule {}
