import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
  ],
  controllers: [
    UsersController, 
    ProfilesController  // ← ADICIONAR AQUI
  ],
  providers: [UsersService, ProfilesService,],
  exports: [UsersService],
})
export class UsersModule {}