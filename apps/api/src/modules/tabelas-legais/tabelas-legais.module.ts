// apps/api/src/modules/tabelas-legais/tabelas-legais.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TabelasLegaisController } from './tabelas-legais.controller';
import { TabelasLegaisService } from './tabelas-legais.service';

@Module({
  imports: [PrismaModule],
  controllers: [TabelasLegaisController],
  providers: [TabelasLegaisService],
  exports: [TabelasLegaisService],
})
export class TabelasLegaisModule {}
