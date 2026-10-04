// apps/api/src/core/arquivos/arquivos.module.ts
// Seguranca 0A (04/10/2026): rota autenticada para /uploads (ver arquivos-protegidos.controller.ts).
import { Module } from '@nestjs/common';
import { ArquivosProtegidosController } from './arquivos-protegidos.controller';

@Module({ controllers: [ArquivosProtegidosController] })
export class ArquivosModule {}
