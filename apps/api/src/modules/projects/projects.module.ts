// apps/api/src/modules/projects/projects.module.ts
// Dominio Projetos (Recife Ocean) - bussola docs/LEDGR-OceanProject.md.
// Dependencia unidirecional: este modulo usa o nucleo; o nucleo nao importa este modulo.
import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjetosFinanceiroController } from './projetos-financeiro.controller';
import { CadastrosController } from './cadastros.controller';
import { ConcessoesService } from './concessoes.service';
import { ProjEscopoGuard } from './proj-escopo.guard';
import { ProjDbService } from './proj-db.service';

@Module({
  controllers: [ProjectsController, ProjetosFinanceiroController, CadastrosController],
  providers: [ConcessoesService, ProjEscopoGuard, ProjDbService],
  exports: [ConcessoesService],
})
export class ProjectsModule {}
