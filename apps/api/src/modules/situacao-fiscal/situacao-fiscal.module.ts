// apps/api/src/modules/situacao-fiscal/situacao-fiscal.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SituacaoFiscalController } from './situacao-fiscal.controller';
import { SituacaoFiscalService } from './situacao-fiscal.service';

@Module({
  imports: [PrismaModule],
  controllers: [SituacaoFiscalController],
  providers: [SituacaoFiscalService],
  exports: [SituacaoFiscalService],
})
export class SituacaoFiscalModule {}
