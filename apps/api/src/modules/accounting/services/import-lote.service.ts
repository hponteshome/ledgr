// apps/api/src/modules/accounting/services/import-lote.service.ts
// NOVO (10/09/2026): listagem dos lotes de importacao (ImportLote) - numero
// sequencial unico por empresa+ano, atribuido atomicamente na criacao
// (ver journal-manual-import.service.ts, getOrCreateLoteForYear). Serve
// qualquer tipo de importacao (MANUAL, IOB, ECD) que venha a popular a
// tabela import_lotes no futuro.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ImportLoteService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, ano?: number) {
    const lotes = await this.prisma.importLote.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(ano ? { ano } : {}),
      },
      orderBy: [{ ano: 'desc' }, { numero: 'desc' }],
    });

    // createdById e campo solto (sem relacao Prisma formal, mesmo padrao de
    // JournalEntry) - busca os nomes numa consulta separada, sem N+1.
    const userIds = [...new Set(lotes.map(l => l.createdById))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, email: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    return lotes.map(l => ({
      ...l,
      createdByName: userMap.get(l.createdById)?.fullName ?? userMap.get(l.createdById)?.email ?? null,
    }));
  }
}
