// apps/api/src/modules/projects/proj-db.service.ts
// Fase 1.2b (03/10/2026): acesso ao banco do dominio Projetos com RLS.
// Toda consulta do dominio roda numa transacao que informa o usuario ao PostgreSQL (app.user_id,
// valido so na transacao). As politicas das tabelas proj_* decidem o que ele ve; o banco determina
// quem e Master pelo perfil. Sem usuario informado, as tabelas proj_* devolvem zero linhas.
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ProjDbService {
  constructor(private readonly prisma: PrismaService) {}

  async comoUsuario<T>(userId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!userId || !UUID_RE.test(userId)) throw new Error('Contexto RLS sem usuario valido.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.user_id', ${userId}, true)`;
      return fn(tx);
    });
  }
}
