import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../../prisma/prisma.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentTemplatesService } from './document-templates.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule,
    MulterModule.register({ dest: './uploads/documents' }),
],
  controllers: [DocumentsController, DocumentTemplatesController],
  providers: [DocumentsService, DocumentTemplatesService],
  exports: [DocumentsService],
})
export class DocumentsModule {}