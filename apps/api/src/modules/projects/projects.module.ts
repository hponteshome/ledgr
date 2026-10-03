// apps/api/src/modules/projects/projects.module.ts
// Dominio Projetos (Recife Ocean) - bussola docs/LEDGR-OceanProject.md.
// Dependencia unidirecional: este modulo usa o nucleo; o nucleo nao importa este modulo.
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ConcessoesService } from './concessoes.service';
import { ProjEscopoGuard } from './proj-escopo.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ConcessoesService, ProjEscopoGuard],
  exports: [ConcessoesService],
})
export class ProjectsModule {}
