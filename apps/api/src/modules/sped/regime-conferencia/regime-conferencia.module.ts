// apps/api/src/modules/sped/regime-conferencia/regime-conferencia.module.ts
// REGIMES x DECLARACOES - CRIADO 16/11/2026 (mesmo padrao do EcfArquivoModule)
import { Module } from '@nestjs/common';
import { SidebarPermissionsModule } from '../../sidebar-permissions/sidebar-permissions.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';
import { RegimeConferenciaController } from './regime-conferencia.controller';
import { RegimeConferenciaService } from './regime-conferencia.service';

@Module({
  imports: [SidebarPermissionsModule, PrismaModule],
  controllers: [RegimeConferenciaController],
  providers: [PrismaService, RegimeConferenciaService],
})
export class RegimeConferenciaModule {}
