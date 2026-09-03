-- prisma/migrations-manuais/2026-09-03-journal-entry-item-description.sql
-- Adiciona historico proprio por partida (JournalEntryItem.description),
-- opcional. Nao afeta nenhum registro existente (coluna nova, NULL por
-- padrao). Ver schema.prisma para o comentario completo da decisao.

ALTER TABLE journal_entry_items ADD COLUMN description TEXT;
