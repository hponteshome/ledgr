// apps/api/src/core/contratos/contratos.module.ts
import { Module } from '@nestjs/common';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';
import { PrismaModule } from '../../prisma/prisma.module';


@Module({
   imports: [PrismaModule],
  controllers: [ContratosController],
  providers: [ContratosService],
  exports: [ContratosService], // exporta para uso em AGE (transformação), etc.
})
export class ContratosModule { }
