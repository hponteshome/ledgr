// apps/api/src/core/persons/persons.module.ts
import { Module } from '@nestjs/common';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { PrismaModule } from '../../prisma/prisma.module';


@Module({
  imports: [PrismaModule],
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService],   // exporta para uso no DocumentsModule, AGEModule, etc.
})
export class PersonsModule {}