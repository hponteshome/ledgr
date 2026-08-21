> **NOTA (21/08/2026) — ABORDAGEM SUPERADA, NAO REPETIR:**
> Este documento registra o remapeamento DESTRUTIVO do Passivo 2025 da Hotelsys
> (mover FK de journal_entry_items/account_balances pra conta matriz + soft-delete
> da origem). Na mesma sessao, decidimos que isso quebra a integridade do historico
> ECD para retificacao futura - a Hotelsys foi totalmente resetada (wipe) e o
> trabalho abaixo foi refeito do zero com abordagem NAO-destrutiva (lancamento de
> abertura nativo na matriz, arvore ECD sempre intocada). Fica mantido aqui so como
> registro do que NAO fazer - ver LEDGR-contexto.md secao 21/08/2026 pra abordagem
> atual.
# Transicao ECD -> Matriz: Hotelsys (c2d48edc-28b7-4fd8-9272-b486449ab2cc)
Data: 21/08/2026

## Contexto
A empresa e cadastrada com duas arvores de plano de contas coexistindo: a raiz
compartilhada (nivel 1-2) serve tanto a matriz quanto a arvore importada do ECD,
que diverge a partir do nivel 3. So as contas analiticas da arvore ECD com
qtd_lancamentos > 0 precisam de mapeamento.

## Contas novas criadas na matriz
| Codigo | Nome | Pai |
|---|---|---|
| 21101060008 | IPTU a Pagar | Tributos a Pagar |
| 21101060009 | ICMS a Pagar | Tributos a Pagar |
| 21101060010 | CIM a Pagar | Tributos a Pagar |
| 21101040006 | Multas MAED a Pagar | Obrigacoes Trabalhistas |
| 21101040007 | CLT a Pagar | Obrigacoes Trabalhistas |
| 21101020005 | SPU - Foro/Laudemio a Pagar | Contas a Pagar |
| 23301010004 | Ajustes de Exercicios Anteriores | Lucros Acumulados |
| 42301010008 | Atualizacao Monetaria | Despesas Financeiras |
| 42301010009 | Multa CLT | Despesas Financeiras |
| 42301010010 | Encargos e Multas Trabalhistas (CLT) | Despesas Financeiras |
| 42301010011 | Juros e Encargos MAED | Despesas Financeiras |

## Decisoes de julgamento contabil (precedente p/ proximas empresas)
- IRPJ/CSLL "a pagar" reaproveita as contas "Provisao IRPJ/CSLL" ja existentes.
- JUROS/MULTAS genericos tratados como mora fiscal/trabalhista, nao juros bancarios.
- CIM (despesa) vai para "Taxas Diversas" por falta de conta especifica.
- ENCARGOS LEGAIS + MULTAS E ENCARGOS LEGAIS-CLT consolidadas numa unica conta
  nova - nomenclatura duplicada no sistema de origem, gatilho dos bugs abaixo.
- SPU e especifico de hoteis costeiros/terrenos de marinha.

## Bugs reais corrigidos no script de remapeamento
1. Postgres nao tem MIN/MAX nativo para uuid - use (array_agg(x))[1].
2. Consolidacao N-para-1 quebra UNIQUE(account_id, reference_date) em
   account_balances - corrigido com INSERT...ON CONFLICT somando os saldos.
   Mesmo risco em accounting_view_mappings (UNIQUE view_id+account_id) -
   resolvido com dedup via ROW_NUMBER().

## Pendencia para reuso automatico
Falta colar chart-of-accounts.service.ts e chart-of-accounts.controller.ts para
construir o endpoint /remap e o modal de mapeamento de verdade. Ate la, o fluxo
e via scripts/sql/remap-plano-de-contas-template.sql.

