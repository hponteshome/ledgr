// apps/api/src/modules/sped/efd/efd.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { EfdController } from './controllers/efd.controller';
import { EfdExporterService } from './services/efd-exporter.service';

@Module({
  imports: [PrismaModule],
  controllers: [EfdController],
  providers: [EfdExporterService],
  exports: [EfdExporterService],
})
export class EfdModule {}
