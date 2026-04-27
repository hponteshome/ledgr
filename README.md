# LEDGR — Agenda Mensal: Guia de Implementação
## Onde colocar cada arquivo

```
ARQUIVO GERADO                          →  DESTINO NO PROJETO
─────────────────────────────────────────────────────────────────────────
frontend/AgendaPage.tsx                 →  apps/web/src/pages/finance/AgendaPage.tsx
frontend/FinancePage.tsx                →  apps/web/src/pages/finance/FinancePage.tsx   (SUBSTITUI)
frontend/hooks/useAgenda.ts             →  apps/web/src/hooks/useAgenda.ts
frontend/components/AgendaCalendar.tsx  →  apps/web/src/pages/finance/components/AgendaCalendar.tsx
frontend/components/AgendaSidebar.tsx   →  apps/web/src/pages/finance/components/AgendaSidebar.tsx
frontend/components/AgendaEventModal.tsx→  apps/web/src/pages/finance/components/AgendaEventModal.tsx
```

## Ordem de implementação

1. Copiar `useAgenda.ts` para `apps/web/src/hooks/`
2. Copiar os 3 componentes para `apps/web/src/pages/finance/components/`
3. Copiar `AgendaPage.tsx` para `apps/web/src/pages/finance/`
4. **Substituir** `FinancePage.tsx` existente pela versão nova
5. Verificar `apps/web/src/types/finance.ts` — deve ter `AgendaMonthResponse`
6. Aplicar os patches do `PATCHES.ts` no backend se necessário

## O que foi implementado

### AgendaCalendar.tsx
- Grade 7×6 com navegação de mês (← Hoje →)
- Seletor de 5 fundos (creme, azul, verde, neutro, rosa)
- Post-its por cor com hover animation e indicador de atraso
- Clique no dia abre modal de novo evento pré-preenchendo a data
- Clique no post-it abre modal de edição
- Legenda de cores na base
- Fim de semana em vermelho

### AgendaSidebar.tsx
- Painel lateral 240px com fundo creme
- Eventos agrupados em: **Atrasados** / **Próximos 7 dias** / **Mais tarde**
- Big post-it com: título, valor, data, countdown e botão "✓ Pago"
- Legenda de cores compacta no rodapé

### AgendaEventModal.tsx
- Modal de criar / editar evento
- Preview em tempo real do post-it conforme preenchimento
- Seletor de tipo com ícones (6 tipos)
- Auto-seleção de cor conforme tipo escolhido
- Recorrência: semanal / mensal / anual
- Proteção: eventos de documentos fiscais não podem ser excluídos
- Confirmação em 2 cliques para exclusão

### useAgenda.ts
- fetchMonth(month) → AgendaMonthResponse
- fetchUpcoming(days) → AgendaEvent[]
- createEvent / updateEvent / markPaid / deleteEvent
- Tratamento de erro centralizado

## Notas importantes

- Eventos gerados automaticamente (fiscalDocumentId != null) **não aparecem** o botão de excluir
- `markPaid` faz PATCH com `{ isPaid: true }` — o backend define `paidAt` automaticamente
- A recorrência gera a série no backend — o frontend não precisa gerenciar
- O `FinancePage.tsx` usa `lazy(() => import('./AgendaPage'))` — agenda só carrega quando o usuário clica na aba
