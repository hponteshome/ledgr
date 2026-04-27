# LEDGR — Diário de Lançamentos
## Especificação Funcional e Técnica

**Módulo:** Accounting → Diário de Lançamentos  
**Versão:** 1.0 — Março/2026  
**Status:** Aprovado para desenvolvimento

---

## 1. Visão Geral

O Diário de Lançamentos é a interface central de escrituração contábil do LEDGR. Opera em **modo de lançamento exclusivo** — ao entrar, o usuário permanece na tela até sair explicitamente. Suporta lançamentos de múltiplas origens (ECD importado, manual, provisão) na mesma interface, com visibilidade clara da fonte de cada registro.

---

## 2. Estrutura da Tela

### 2.1 Barra Superior (sempre visível)
| Elemento | Descrição |
|---|---|
| Título | "Diário de lançamentos" |
| Nome da empresa | Empresa ativa no contexto |
| Seletor de mês de referência | Dropdown com períodos disponíveis (meses com lançamentos ou saldos importados) |
| Badges de fonte | ECD (azul) · Manual (verde) · Provisão (âmbar) |
| Botão "Sair do modo lançamento" | Único ponto de saída da tela |

### 2.2 Formulário de Lançamento (sempre visível)
Campos em linha única sempre que possível. Permanece visível durante toda a sessão.

**Linha 1 — Identificação:**
- Data do lançamento (obrigatório)
- Nº lançamento (automático, somente leitura)
- Tipo: Manual / Provisão / Ajuste (select)
- Histórico padrão: código (opcional) + nome (readonly, preenchido pelo lookup)

**Linha 2 — Partidas:**
- Débito: código da conta + nome (readonly)
- Crédito: código da conta + nome (readonly)
- Valor (R$, obrigatório)
- Centro de custo (desabilitado na fase 1 — campo presente mas não funcional)

**Linha 3 — Complemento:**
- Complemento do histórico (texto livre, opcional)

**Linha 4 — Repetição:**
Checkboxes individuais para cada campo:
`☐ Data` `☐ Débito` `☐ Crédito` `☐ Valor` `☐ C. custo` `☐ Histórico` `☐ Complemento`

Ao gravar, campos marcados mantêm seus valores para o próximo lançamento.

**Rodapé do formulário — Totalizadores:**
- Total débitos do mês de referência
- Total créditos do mês de referência  
- Diferença (verde com ✓ se zero, vermelho se divergente)
- Botões: `Limpar` | `Gravar lançamento`

### 2.3 Grid de Lançamentos
**Toolbar:**
- Seletor de período (intervalo de datas)
- Campo de busca livre (filtra conta, histórico, complemento)
- Contador de lançamentos exibidos
- Botão `Excluir período...` (abre modal de exclusão)

**Colunas:**
| Coluna | Largura | Notas |
|---|---|---|
| Data | 82px | formato DD/MM/AAAA |
| Nº lanç. | 68px | monospace |
| Débito | flex | código · nome da conta |
| Crédito | flex | código · nome da conta |
| Valor | 110px | monospace, alinhado à direita |
| Histórico / complemento | flex | texto truncado |
| Fonte | 70px | badge colorido |
| Ação | 44px | botão ✕ para exclusão individual |

**Badges de fonte:**
- `ECD` — azul (#E6F1FB / #185FA5)
- `Manual` — verde (#EAF3DE / #3B6D11)
- `Provisão` — âmbar (#FAEEDA / #854F0B)

**Rodapé do grid:**
```
Exibindo N de TOTAL · D: R$ X · C: R$ X · Δ: R$ 0,00
```

---

## 3. Regras de Negócio

### 3.1 Histórico Padrão
- Campo de código é **opcional** — pode ficar em branco ou receber o valor `0`
- Se código preenchido, o nome do histórico padrão é carregado via lookup e exibido em readonly
- O campo **Complemento** é sempre editável independentemente do histórico padrão
- O complemento é concatenado ao histórico padrão na exibição e no SPED exportado

### 3.2 Balanceamento
- Débitos devem ser iguais a créditos para cada lançamento
- O sistema permite gravar lançamentos desbalanceados com aviso (não bloqueia)
- Os totalizadores do mês mostram o saldo acumulado — diferença diferente de zero indica inconsistência no período

### 3.3 Numeração de Lançamentos
- Sequencial por empresa e período
- Gerado automaticamente pelo backend
- Não editável pelo usuário

### 3.4 Centro de Custo
- Campo presente na interface (fase 1: desabilitado)
- Estrutura de dados já preparada no schema para ativação futura
- Exibe placeholder "— não utilizado —" em readonly

### 3.5 Repetição de Campos
- Checkboxes individuais por campo
- Ao clicar `Gravar lançamento`, campos marcados **não são limpos**
- Campos não marcados são limpos após gravação
- Estado dos checkboxes persiste durante a sessão (não salvo entre sessões)

---

## 4. Modal de Exclusão de Lançamentos

Aberto pelo botão `Excluir período...` na toolbar do grid.

### 4.1 Filtros disponíveis

**Período / data do lançamento:**
- De (data) → Até (data)

**Contas contábeis:**
- Débito: código de → código até
- Crédito: código de → código até

**Valor:**
- De (R$) → Até (R$)

**Histórico:**
- Código histórico padrão (exato)
- Complemento contém (texto livre, busca parcial)

**Fonte / origem:**
- ☑ ECD importado
- ☑ Manual
- ☑ Provisão
- ☐ Outras integrações

### 4.2 Painel de impacto (tempo real)
Atualizado a cada alteração nos filtros:
```
Os filtros acima retornaram N lançamentos e M partidas 
no período DD/MM/AAAA → DD/MM/AAAA. Os saldos calculados 
serão recalculados automaticamente. Os saldos ECD (I155) 
não serão afetados e continuarão disponíveis para comparação.
```

### 4.3 Rodapé do modal
```
N lançamentos · M partidas · R$ X,XX afetados
```
Botões: `Cancelar` | `Excluir lançamentos filtrados` (vermelho)

### 4.4 Regras de exclusão
- Sempre apresentar resumo com impacto antes de confirmar
- Exclusão física dos registros em `journal_entries` e `journal_entry_items`
- `account_balances` (saldos ECD/I155) **não são afetados**
- Saldo calculado é recalculado automaticamente após exclusão (on-demand, sem trigger)
- Lançamentos futuros de outras integrações seguem a mesma lógica

---

## 5. Fontes de Lançamentos

| Fonte | `sourceModule` no banco | Badge | Editável | Excluível |
|---|---|---|---|---|
| ECD importado | `ECD_IMPORT` | ECD (azul) | Não | Sim |
| Manual | `ACCOUNTING` | Manual (verde) | Sim | Sim |
| Provisão | `ACCOUNTING` (tipo=provisão) | Provisão (âmbar) | Sim | Sim |
| Futuras integrações | `BANK_IMPORT`, `FISCAL`, etc. | A definir | A definir | Sim |

---

## 6. Tabelas do Banco de Dados Afetadas

### Leitura
- `chart_of_accounts` — lookup de contas por código
- `journal_entries` + `journal_entry_items` — grid de lançamentos
- `account_balances` — totalizadores (saldo ECD para comparação)

### Escrita (novos lançamentos)
- `journal_entries` — um registro por lançamento
- `journal_entry_items` — dois ou mais registros (débito + crédito)

### Exclusão
- `journal_entry_items` — excluídos primeiro (FK)
- `journal_entries` — excluídos após os itens

### Nunca afetado por esta tela
- `account_balances` — fotografia do SPED, somente via importação ECD
- `chart_of_accounts` — somente via importação ou cadastro dedicado
- `ecd_imports` — histórico de importações

---

## 7. Endpoints de API necessários

### Lançamentos
```
GET    /journal-entries?companyId&periodStart&periodEnd&search&page
POST   /journal-entries                    — novo lançamento
PATCH  /journal-entries/:id                — editar lançamento manual
DELETE /journal-entries/:id                — excluir lançamento individual
POST   /journal-entries/bulk-delete        — exclusão em lote com filtros
```

### Lookup
```
GET    /chart-of-accounts/lookup?companyId&code   — busca conta por código
GET    /standard-histories?companyId&code          — busca histórico padrão
```

### Totalizadores
```
GET    /journal-entries/totals?companyId&periodStart&periodEnd
```
Retorna: `{ totalDebit, totalCredit, difference, count }`

---

## 8. Payload — Novo Lançamento

```typescript
// POST /journal-entries
{
  companyId:    string;       // UUID da empresa ativa
  date:         string;       // ISO date "2013-12-15"
  type:         'MANUAL' | 'PROVISION' | 'ADJUSTMENT';
  historyCode?: string;       // código do histórico padrão (opcional)
  description:  string;       // complemento livre (pode ser vazio)
  costCenter?:  string;       // null na fase 1
  items: [
    { accountCode: string; type: 'DEBIT';  value: number },
    { accountCode: string; type: 'CREDIT'; value: number },
  ]
}
```

---

## 9. Payload — Exclusão em Lote

```typescript
// POST /journal-entries/bulk-delete
{
  companyId:    string;
  filters: {
    dateFrom?:      string;   // ISO date
    dateTo?:        string;
    debitCodeFrom?: string;
    debitCodeTo?:   string;
    creditCodeFrom?: string;
    creditCodeTo?:  string;
    valueFrom?:     number;
    valueTo?:       number;
    historyCode?:   string;
    descriptionContains?: string;
    sources?:       Array<'ECD_IMPORT' | 'ACCOUNTING' | 'BANK_IMPORT' | 'FISCAL' | 'HR'>;
  }
}
```

Retorna preview quando `dryRun: true`:
```typescript
{
  dryRun: true,
  count:        number;   // lançamentos afetados
  itemCount:    number;   // partidas afetadas
  totalValue:   number;   // soma dos valores
  periodStart:  string;
  periodEnd:    string;
}
```

---

## 10. Fluxo de Uso — Sessão de Lançamento

```
1. Usuário acessa Accounting → Diário de Lançamentos
2. Seleciona mês de referência no seletor da barra superior
3. Grid carrega lançamentos do período selecionado
4. Formulário fica pronto para entrada
5. Usuário preenche: data, tipo, débito, crédito, valor, complemento
6. Clica "Gravar lançamento"
7. Backend valida e persiste
8. Grid atualiza com novo lançamento no topo
9. Totalizadores atualizam em tempo real
10. Campos marcados nos checkboxes de repetição são mantidos
11. Usuário repete a partir do passo 5 ou clica "Sair do modo lançamento"
```

---

## 11. Fluxo de Exclusão de Período

```
1. Usuário clica "Excluir período..." na toolbar do grid
2. Modal abre com filtros pré-preenchidos com o período atual
3. Usuário ajusta filtros conforme necessário
4. Painel de impacto atualiza em tempo real (dryRun)
5. Usuário lê o resumo: N lançamentos · M partidas · R$ X afetados
6. Clica "Excluir lançamentos filtrados"
7. Confirmação adicional: "Confirmar exclusão de N lançamentos?"
8. Backend executa exclusão:
   a. DELETE journal_entry_items WHERE journalEntryId IN (...)
   b. DELETE journal_entries WHERE filtros
9. Modal fecha
10. Grid recarrega
11. Totalizadores atualizam
12. account_balances (saldos ECD) permanecem intactos
```

---

## 12. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Modo de entrada | Tela exclusiva (não modal) | Volume de lançamentos exige foco; padrão de sistemas contábeis |
| Saída | Botão explícito | Evita perda acidental de dados em edição |
| Histórico padrão | Opcional (código 0 ou vazio = livre) | Flexibilidade para reconstituição retroativa |
| Centro de custo | Presente mas desabilitado | Estrutura preparada; ativação futura sem refatoração |
| Saldos ECD | Nunca afetados por exclusões | Integridade da fotografia fiscal |
| Numeração | Automática sequencial | Conformidade com padrões contábeis |
| Scroll | Infinito (não paginado) | Melhor UX para navegação em diários grandes |
| Exclusão | Sempre com preview de impacto | Segurança — operação irreversível |

---

## 13. Fase 1 — Escopo do Desenvolvimento Inicial

**Incluído:**
- Formulário de novo lançamento (manual e provisão)
- Grid com lançamentos ECD importados + manuais
- Filtro por período e busca livre
- Exclusão individual (botão ✕)
- Modal de exclusão em lote com todos os filtros
- Totalizadores do mês em tempo real
- Checkboxes de repetição de campos
- Badges de fonte por lançamento

**Excluído (fases futuras):**
- Centro de custo (campo presente, não funcional)
- Edição inline de lançamentos ECD
- Histórico padrão — tabela de cadastro (fase 2)
- Estorno automático de lançamentos
- Lançamentos múltiplos (N débitos / N créditos)
- Importação via planilha

---

*Documento gerado em 18/03/2026 — LEDGR v1.0*
