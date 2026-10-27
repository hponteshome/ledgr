// apps/api/src/modules/integridade/integridade.module.ts
// CRIADO 27/10/2026 - Central de Integridade
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { IntegridadeController } from './integridade.controller';
import { IntegridadeService } from './integridade.service';

@Module({
  imports: [PrismaModule],
  controllers: [IntegridadeController],
  providers: [IntegridadeService],
  exports: [IntegridadeService],
})
export class IntegridadeModule {}
