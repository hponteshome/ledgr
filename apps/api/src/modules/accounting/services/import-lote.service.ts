// apps/api/src/modules/accounting/services/import-lote.service.ts
// NOVO (10/09/2026): listagem dos lotes de importacao (ImportLote) - numero
// sequencial unico por empresa+ano, atribuido atomicamente na criacao
// (ver journal-manual-import.service.ts, getOrCreateLoteForYear). Serve
// qualquer tipo de importacao (MANUAL, IOB, ECD) que venha a popular a
// tabela import_lotes no futuro.
import { Injectable, NotFoundException } from '@nestjs/common';
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

  // NOVO 13/09/2026: exclusao INTEGRAL do lote (hard delete) - remove todos
  // os lancamentos/itens vinculados e o proprio registro do lote. Usado
  // quando o usuario precisa reimportar um arquivo corrigido do zero.
  // Mesma logica ja usada internamente em journal-manual-import.service.ts
  // (hardDeleteLote, privado, so acionado no fluxo de "sobrepor duplicata")
  // - aqui exposta como acao explicita do usuario a partir da tela de
  // listagem de lotes.
  async remove(loteId: string, companyId: string) {
    const lote = await this.prisma.importLote.findFirst({
      where: { id: loteId, companyId, deletedAt: null },
    });
    if (!lote) {
      throw new NotFoundException('Lote não encontrado.');
    }

    const entriesCount = await this.prisma.$transaction(async (tx) => {
      const count = await tx.journalEntry.count({ where: { importLoteId: loteId } });
      await tx.journalEntryItem.deleteMany({
        where: { journalEntry: { importLoteId: loteId } },
      });
      await tx.journalEntry.deleteMany({ where: { importLoteId: loteId } });
      await tx.importLote.delete({ where: { id: loteId } });
      return count;
    });

    return {
      message: `Lote ${lote.numero}/${lote.ano} excluído com sucesso.`,
      lancamentosExcluidos: entriesCount,
    };
  }
}
