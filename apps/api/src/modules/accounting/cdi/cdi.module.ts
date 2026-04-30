// apps/api/src/modules/accounting/cdi/cdi.module.ts
import { Module } from '@nestjs/common';
import { CdiService } from './cdi.service';
import { CdiController } from './cdi.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CdiController],
  providers: [CdiService],
  exports: [CdiService],
})
export class CdiModule {}