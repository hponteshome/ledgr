# LEDGR — Contexto do Projeto

> Arquivo de referência para novas sessões com Claude.
> Cole o conteúdo deste arquivo no início de cada sessão nova.
> Atualize sempre que um módulo mudar de estado.
> **Última atualização:** 06/05/2026

---

## Stack

- **Monorepo:** `D:\Projetos\Ledgr`
- **Backend:** NestJS + Prisma + PostgreSQL (`ledgr_app` na porta 5432)
- **Frontend:** React + TypeScript + Vite (porta 5173)
- **Auth:** JWT · token em `@ledgr:token` · empresa em `@ledgr:activeCompany`
- **API client:** axios em `apps/web/src/services/api.ts` · interceptor injeta `x-company-id` automaticamente
- **Upload de arquivo:** usar `fetch` direto (não axios) — axios corrompe multipart boundary

---

## Git / GitHub — Procedimento de Backup

```powershell
cd D:\Projetos\Ledgr
git add .
git commit -m "feat: <descricao>"
git push origin main

# Se houver arquivos grandes (>100MB) bloqueando o push:
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch <arquivo>" --prune-empty --tag-name-filter cat -- --all
git for-each-ref --format="delete %(refname)" refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin main --force

# Adicionar ao .gitignore para evitar reincidência:
Add-Content -Path D:\Projetos\Ledgr\.gitignore -Value "`n<padrão>"
```

- **Repositório:** https://github.com/hponteshome/ledgr (privado)
- **Usuário:** hponteshome@gmail.com
- **Branch principal:** main

---

## Convenções obrigatórias (Prisma / Backend)

| Regra | Exemplo |
| ----- | ------- |
| PK com UUID | `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| Campos snake_case no banco | `@map("created_at")` |
| Timestamps | `@db.Timestamp(6)` |
| Soft delete | campo `deletedAt DateTime? @db.Timestamp(6)` |
| Valores monetários | `Decimal` — NUNCA `Float` |
| companyId | nunca em filtro global do PrismaService — sempre via `request.companyId` (CompanyInterceptor) |
| AuditLog | campos: `actorId`, `action`, `targetId`, `before`, `after`, `ip` |

---

## Enums importantes (já no schema)

```
ApEntryStatus:       OPEN | PAID | OVERDUE | PARTIALLY_PAID | CANCELLED | SCHEDULED
APStatus:            OPEN | PARTIAL | PAID | OVERDUE | CANCELLED
DocumentStatus:      RASCUNHO | EM_REVISAO | AGUARDANDO_ASSINATURA | ASSINADO | REGISTRADO | ARQUIVADO | CANCELADO
BankCode:            ITAU | BRADESCO | BB | SANTANDER | CAIXA | SICREDI | SICOOB | NUBANK | INTER | GENERIC
AgendaColor:         YELLOW | BLUE | GREEN | RED | ORANGE | PURPLE
AgendaEventType:     PAYMENT | TAX | CLOSING | MEETING | REMINDER | OTHER
FiscalDocumentType:  NFE | NFSE | FATURA | DUPLICATA | BOLETO | CONSUMO | OUTROS
IntegrationStatus:   PENDING | INTEGRATED | ERROR | MANUAL
BankImportStatus:    PENDING | CLASSIFIED | POSTED | IGNORED | RECONCILED
TransactionType:     DEBIT | CREDIT
FixedIncomeType:     CDB | LCI | LCA | CRI | CRA | DEBENTURE | TESOURO
FixedIncomeIndexer:  CDI | IPCA | SELIC | PREFIXADO
FixedIncomeStatus:   ATIVO | VENCIDO | RESGATADO
FixedIncomeEventType: RENDIMENTO | RESGATE | ATUALIZACAO
HolidayType:         NACIONAL | ESTADUAL | MUNICIPAL | JUDAICO | FACULTATIVO
SourceModule:        ACCOUNTING | FINANCE | FISCAL | HR | BANK_IMPORT | ECD_IMPORT | ASSET
source_module:       (enum existente no schema — usado em JournalEntry)
```

---

## Estrutura de módulos (`apps/api/src/modules/`)

```
accounting/      controllers/ services/ dto/
  ├ cdi/         cdi.service/controller/module — Tabela CDI, importação BCB
  └ fixed-income/ service/controller/module   — Renda Fixa (CDB/LCI/etc)
assets/          controllers/ services/ dto/   — Ativo Imobilizado
calendar/        holiday.service/controller/module — Calendário de Feriados
finance/         dto/ parsers/
  ├ finance.service/controller/module
  ├ accounts-payable.service/controller
  ├ agenda.service
  ├ integration.service                        — AP × Fiscal × Contábil × Agenda ($transaction)
  ├ bank-import.service/controller/module
  ├ suggestion.service                         — motor de 3 camadas para sugestão de conta
  └ parsers/bank-parser.service
fiscal/          — Fiscal
hr/              — RH
sped/            ecd/ ecf/ efd/
rfb/             — Consulta RFB
signatures/      — Assinaturas digitais (ClickSign, gov.br, A1/A3)
corporate/       — Societário (shareholders, transfers, corporate-pdf)
```

---

## Models principais (resumo)

| Model | Tabela | Observação |
| ----- | ------ | ---------- |
| `AccountsPayable` | `accounts_payable` | status usa `APStatus` |
| `ApEntry` | `ap_entries` | model antigo, status usa `ApEntryStatus` |
| `AgendaEvent` | `agenda_events` | campo obrigatório: `createdById` |
| `FiscalDocument` | `fiscal_documents` | campo obrigatório: `createdById` · status: `DocumentStatus` |
| `BankStatement` | `bank_statements` | migrado em 22/03/2026 |
| `BankTransaction` | `bank_transactions` | motor sugestão 3 camadas |
| `BankImportRule` | `bank_import_rules` | motor de aprendizado |
| `JournalEntry` | `journal_entries` | campo: `date` · `sourceModule` |
| `JournalEntryItem` | `journal_entry_items` | campos: `accountId`, `type`, `value` |
| `AuditLog` | `audit_logs` | campos: `actorId`, `action`, `targetId`, `before`, `after`, `ip` |
| `FixedIncomeInvestment` | `fixed_income_investments` | campo `accountingAccountId` (conta contábil do CDB) |
| `FixedIncomeEvent` | `fixed_income_events` | resgates e atualizações mensais |
| `FixedIncomeMonthlyRate` | `fixed_income_monthly_rates` | taxas CDI mensais |
| `CdiDailyRate` | `cdi_daily_rates` | taxas CDI diárias da BCB |
| `Holiday` | `holidays` | feriados · campos hebrewName/hebrewDate |
| `LoteImport` | `lote_imports` | source, batchType, batchDate, stats |
| `FixedAsset` | `fixed_assets` | relações assetAccount/depreciationAcc/accumDeprecAcc |
| `AssetDepreciationLog` | `asset_depreciation_logs` | histórico mensal de depreciação |
| `ChartOfAccounts` | `chart_of_accounts` | campo `reducedCode` (shortCode) |

---

## Estado dos módulos

| Módulo | Status | Observações |
| ------ | ------ | ----------- |
| Accounting — Plano de Contas | ✅ Produção | shortCode, toggle tabela/árvore, inferência automática |
| Accounting — Lançamentos | ✅ Produção | Diário Geral, Razão Analítico, Balancete |
| Accounting — Balancete | ✅ Produção | Mensal + Verificação, baseado exclusivamente em journal_entry_items |
| Accounting — Renda Fixa (CDB) | ✅ Produção | Carteira, extrato, projeção, resgates, proporcionalização 1º mês |
| Accounting — Ativo Imobilizado | ✅ Produção | Backfill depreciação, relatório anual, lançamentos contábeis mensais |
| Calendário de Feriados | ✅ Produção | 63 feriados nacionais 2022-2026, feriados judaicos |
| Sistema — Tabelas Legais | ✅ Produção | IRPF 2024/2025/2026 + INSS 2024/2025/2026 + Simulador |
| Finance — Doc. Fiscal | ✅ Funcionando | Integração AP × CT × Agenda via $transaction |
| Finance — Contas a Pagar | ✅ Funcionando | Baixa individual e lote, Aging/Posição AP |
| Finance — Agenda | ✅ Funcionando | Calendário post-its, recorrência |
| Finance — Bank Import | ✅ Funcionando | Itaú, Bradesco, BB, OFX, CSV · sugestão 3 camadas |
| Finance — IOB Lotes | ✅ Funcionando | Multi-arquivo, deduplicação, observação pos.232 |
| SPED ECD | ✅ Produção | |
| Societário | ✅ Produção | Shareholders, transferências, corporate-pdf |
| Assinaturas Digitais | ✅ Funcionando | ClickSign sandbox, validador ICP-Brasil/gov.br, DocumentViewModal |
| Arquivo / Repositório | ✅ Funcionando | Prateleiras por URL, DocumentViewModal, ImportarDocumentoModal |
| RFB | ✅ Produção | |
| Finance — Contas a Receber | 🔲 Pendente | estrutura preparada (arEntryId nos models) |
| Finance — Folha RH | 🔲 Pendente | estrutura preparada (payrollId nos models) |
| Finance — Conciliação AP | 🔲 Pendente | apEntryId em BankTransaction já existe |
| Finance — Fluxo de Caixa | 🔲 Pendente | |
| Sistema — Indicadores | 🔧 Parcial | CDI completo; Selic e IGP-M pendentes |

---

## Empresas de teste

| Empresa | CNPJ | UUID | Observação |
| ------- | ---- | ---- | ---------- |
| SUNRISE HOTELS & RESORTS HOLDING LTDA | 16.846.468/0001-31 | `4ef0b48b-80c1-4bc6-b06b-781e90a78fd8` | Empresa principal |
| HALLO ADMINISTRACAO E PARTICIPACOES LTDA | 07.432.458/0001-69 | `06a88dfa-d4cf-4c5c-8dc1-83538d6b8b7c` | |
| LM ADMINISTRACAO DE BENS IMOVEIS LTDA | 17.970.759/0001-08 | `f00af1b1-d50b-4ae6-aa17-4c2262e058db` | ECD 2024, 20 ativos imobilizados |
| JOSE SILVA SOCIEDADE INDIVIDUAL DE ADVOCACIA | 35.416.962/0001-00 | `c188b188-de58-4fbd-8aa0-fcf07c35e65e` | 7 CDBs, plano de contas 168 contas |
| F5 PARTICIPACOES S/A | 33.652.701/0001-64 | `30437192-bfe5-4344-8407-b758d7382153` | Societário, assinaturas |

---

## Sessão 22/03/2026 (Sessão 1 — Design System)

- Design System aprovado: Clean Minimalista, accent Financeiro #0369A1
- `SideBar.tsx`: path "Plano de Contas - Manutenção" corrigido
- `FinancePage.tsx` e `BankImportPage.tsx` reescritos com novo design
- Tokens documentados em LEDGR-design-system.md

---

## Sessão 25/03/2026 — Balancete + Plano de Contas

- `trial-balance.service.ts` reescrito — calcula exclusivamente via `journal_entry_items`
- `TrialBalanceView.tsx` — abas Mensal e Verificação, checkboxes, cards, sem subtotais
- `ChartOfAccountsPage.tsx` — shortCode, toggle tabela/árvore, inferência automática de Type/Nature/parent
- UTC date helpers `toUTC()` / `toUTCEnd()` — fix crítico para Windows (UTC-3)
- Remoção de controller duplicado que causava conflito de rota no Mapa de Saldos
- `JournalPage.tsx` — input livre de mês (aceita `mm/aa`, `mm/aaaa`), valores crédito em vermelho, `EditModal`

---

## Sessão 26/03/2026 — ECD Import + Mapeamento

- ECD 2024 LM Administração importado (266 contas, 658 saldos, 1.070 lançamentos)
- `EcdOpeningModal.tsx` — 3 passos: upload → mapeamento com autocomplete → resultado
- **Bug pendente em `JournalPage.tsx`:** bloco inline `EcdOpeningModal` duplicado — deletar bloco que começa em `// ── Modal de Preview de Abertura ECD` até `};` antes de `// ── Modal de Exclusão em Lote`

---

## Sessão 27/03/2026 — Balancete de Verificação + Diário/Razão

- `DiarioGeralPage.tsx` e `RazaoAnaliticoPage.tsx` criados
- `ReportToolbar` com sticky, campos de data inline editáveis, export CSV/PDF/Excel
- Agrupamento por mês/dia com totais, numeração sequencial Lcto por mês
- `BalanceComparisonPage.tsx` — colunas ordenáveis, sticky header, coluna congelada
- Fix `parent_id = NULL` em conta `2.1.1.06.001 Encargos a Apropriar` via SQL direto

---

## Sessão 18/04/2026 — Módulo Societário + Assinaturas Digitais

**Societário (COMPLETO):**
- `shareholders.service.ts` — findAll, findOne, create, update, softDelete, getCapitalSummary
- `transfers.service.ts` — create em $transaction atômica, averbar, recálculo percentOwned
- `corporate-pdf.service.ts` — template HTML completo (IN DREI 82/2021)
- `ShareholdersPage.tsx` — Livro de Registro + Livro de Transferência
- `ShareMovementModal.tsx` — modal 3 passos, lookup CPF/CNPJ, detecção PF/PJ
- Empresa teste: F5 PARTICIPACOES S/A — Helenilto (50%) + J.A.A.H. (50%)

**Assinaturas Digitais (FUNCIONANDO):**
- `certificates.service.ts` — upload A1 (.pfx), criptografia AES-256-GCM
- `govbr.service.ts` — OAuth2 com PKCE, cache TTL 10min, one-time use
- `clicksign.service.ts` — upload PDF, signatários, sequenciamento
- ClickSign sandbox funcionando — `auths: ["email"]`, `group: order`
- `.env` em `D:\Projetos\Ledgr\.env` — `CLICKSIGN_ACCESS_TOKEN=ec9253f7-...` (sandbox)

---

## Sessão 19/04/2026 — Validador de Assinaturas + Repositório

**Validador (COMPLETO):**
- `signature-validator.service.ts` — extração PKCS#7/PAdES/CAdES, 4 abordagens em cascata
- Detecta ICP-Brasil (ITI, SERPRO, Certisign, SERASA, etc.) vs gov.br
- Extração de CPF do CN (formato `NOME:CPF11DIGITOS`)
- Endpoint: `POST /signatures/validate` (multipart/form-data, campo `pdf`)
- Testado com PDF real — 3 signatários ICP-Brasil detectados ✅

**Repositório/Arquivo (COMPLETO):**
- `RepositorioPage.tsx` — prateleiras por URL via `SHELF_CONFIG`, filtro por status
- Prateleiras: Societário, Contábil, Fiscal, RH
- `DocumentViewModal.tsx` — iframe HTML/PDF, SHA-256
- `ImportarDocumentoModal.tsx` — 3 passos: tipo → arquivo → detalhes

---

## Sessão 20/04/2026 — DocumentViewerModal

- Layout proposto: header badge + título + status pill + ações, meta bar, abas (Documento/Histórico/Assinaturas), viewer HTML + sidebar signatários + SHA-256
- **Pendente:** implementação do `DocumentViewerModal.tsx` completo

---

## Sessão 26/04/2026 — IOB Multi-arquivo + DocumentViewModal + Assinaturas

**IOB Lotes (melhorias):**
- Seleção múltipla de arquivos (`input multiple`)
- Deduplicação por `fileName` — bloqueia reimportação do mesmo lote
- Parser corrigido: observação na posição 232 (sem pipe)
- Totais débitos/créditos + indicador de equilíbrio no preview
- Histórico de importações no modal

**JournalPage (melhorias):**
- Toggle "Mostrar Lançamentos" — lista 100 últimos em ordem decrescente
- Coluna Histórico na tabela, data com 4 dígitos (dd/mm/yyyy)
- `BulkDeleteModal` — período, fontes, dry-run, confirmação

**DocumentViewModal (COMPLETO):**
- Header com badge Societário, status pill, tipo, versão
- Meta bar com data, SHA-256 truncado, número de registro
- Abas: Documento e Assinaturas
- Viewer HTML (`srcDoc`) ou PDF (`iframe src`) conforme `fileUrl`
- Footer legal LEDGR / MP 2.200-2/2001 / Lei 14.063/2020

**Assinaturas — persistência:**
- Após validação, persiste `DocumentSigner` por CPF único (`deleteMany + create`)
- Guard `didValidate.current` evita dupla execução em StrictMode

**Schema / Migrations:**
- `LoteImport` model + tabela `lote_imports`
- `reducedCode` em `ChartOfAccounts`

**Balancetes:**
- Datas padrão usam ano atual `(Get-Date).Year`

---

## Sessão 30/04/2026 — Renda Fixa + Sistema + Plano de Contas

### Módulo Renda Fixa (COMPLETO ✅)

**Empresa:** JOSE SILVA SOCIEDADE INDIVIDUAL DE ADVOCACIA (UUID `c188b188-de58-4fbd-8aa0-fcf07c35e65e`)
**7 CDBs, todos 96% CDI BB** — migrados da LM via UPDATE direto no banco

**Contas contábeis (Renda Fixa):**
- IRRF a Recuperar: `11309010010`
- Receitas Aplic. Financeiras: `32101010001` (UUID `0d5ab7bf-0315-463a-936b-f910d610fae6`)

**CDBs com contas no plano:**
| CDB | Conta | Saldo Capital |
|-----|-------|--------------|
| 3600889897272 | 11104040001 | R$ 82.500 |
| 1600890985631 | 11104040002 | R$ 9.628.000 |
| 1500908586930 | 11104040003 | R$ 1.000.000 |
| 3600901425272 | 11104040004 | R$ 680.000 |
| 0500905755609 | 11104040005 | R$ 950.000 |
| 4500911443590 | 11104040006 | R$ 350.000 |
| 0100950505802 | 11104040007 | R$ 31.000 |

**Schema:** campo `accountingAccountId String? @map("accounting_account_id") @db.Uuid` adicionado ao `FixedIncomeInvestment`
Migration: `20260430223656_add_accounting_account_to_fixed_income`

**Frontend `RendaFixaPage.tsx`:**
- Lista: Descrição, Tipo, Emissor, Indexador, Capital Inicial, Saldo Capital, Rend. Bruto, IRRF Est., Saldo Líquido, Aplicação, Vencimento, Status, Ações
- `allProjections` — calcula projeção de todos via `buildProjection` + feriados
- Filtro de período único (direita, acima da tabela) — aplica na lista E no detalhe
- Totalizador `<tfoot>` em azul (#F0F9FF, borda #2563EB)
- 3 cards: Investimentos Ativos, Saldo de Capital, IRRF Estimado, Rendimento Líquido Projetado
- Detalhe em **accordion** — expande inline ao clicar, com recuo à esquerda, indicador ►/▼
- 3 abas: Extrato completo, Projeção, Resgates
- Proporcionalização do 1º mês com feriados reais — precisão 99,87%
- Atualização mensal jan-abr/2026 executada para todos os 7 CDBs

**Correção crítica — `cdi.service.ts`:**
```typescript
// CORRETO — pega último dia do mês:
cur.accum = Math.max(cur.accum, Number(r.monthlyAccum));
```

### Calendário de Feriados (COMPLETO ✅)

- `GET /calendar/holidays`, `POST /calendar/holidays/import/:year`, `POST /calendar/holidays`, `DELETE /calendar/holidays/:id`
- `@SkipCompanyCheck()` — importar de `../../multi-company/company.interceptor`
- 63 feriados nacionais importados (2022-2026) via BrasilAPI
- Campos judaicos: `hebrewName`, `hebrewDate`, `erevStart`
- Frontend: `CalendarioPage.tsx`

### Menu Sistema (COMPLETO ✅)

- Calendário de Feriados → `/app/sistema/calendario`
- Indicadores Econômicos → `/app/sistema/indicadores` (CDI; Selic/IGP-M pendentes)
- Tabelas Legais → `/app/sistema/tabelas`
- Tabela CDI movida de Accounting → Sistema

### Tabelas Legais (COMPLETO ✅)

`frontend/src/pages/sistema/TabelasLegaisPage.tsx`
- IRPF 3 vigências + INSS 2024/2025/2026 + Simulador integrado
- Redutor 2026 (Lei 15.270/2025): `R$ 978,62 − (0,133145 × renda bruta)`

**IRPF Mai/2025+ e 2026 (mesma tabela):**
| Faixa | Alíquota | Dedução |
|-------|----------|---------|
| Até R$ 2.428,80 | Isento | — |
| R$ 2.428,81 a R$ 2.826,65 | 7,5% | R$ 182,16 |
| R$ 2.826,66 a R$ 3.751,05 | 15% | R$ 394,16 |
| R$ 3.751,06 a R$ 4.664,68 | 22,5% | R$ 675,49 |
| Acima de R$ 4.664,68 | 27,5% | R$ 908,73 |
Desc. simplificado: R$ 607,20 | Dep: R$ 189,59/mês

**INSS 2026:**
| Faixa | Alíquota |
|-------|----------|
| Até R$ 1.621,00 | 7,5% |
| R$ 1.621,01 a R$ 2.902,84 | 9% |
| R$ 2.902,85 a R$ 4.354,27 | 12% |
| R$ 4.354,28 a R$ 8.475,55 | 14% |
Desconto máximo: R$ 988,09

### Plano de Contas — Importação (latin1)

168 contas importadas de `.txt` do sistema legado. **Procedimento:**
```powershell
# Salvar SQL como latin1 e setar encoding antes do psql:
$env:PGCLIENTENCODING = "LATIN1"
psql -h localhost -U ledgr -d ledgr_app -f D:\Temp\import_plano.sql
```

---

## Sessão 05/05/2026 — Ativo Imobilizado (Fase 2)

### Relatório Anual de Depreciação (COMPLETO ✅)

- Endpoint `GET /assets/depreciation-report?yearFrom=&yearTo=` — SQL raw com pivot em memória
- Frontend: nova aba "Relatório Anual" no toggle da `AssetsList`
- Tabela dinâmica com colunas por ano, ordenação em todas as colunas, exportar XLSX
- Linha de totais expansível → **painel mensal** com grid Mês × Ano

### Gráfico de Depreciação (`DepreciationTab`) (COMPLETO ✅)

- Labels eixo X em `dez/AAAA` (dezembro de cada ano)
- Projeção inicia no mês seguinte ao último log do backfill
- `accumDeprec` acumulado corretamente a partir do valor atual
- Ponto de aquisição como primeiro ponto
- Campo ajustável de meses de projeção (padrão 60)
- 4 linhas: Valor Contábil real/projeção + Deprec. Acum. real/projeção

### Lançamentos Contábeis de Depreciação (COMPLETO ✅)

- `SourceModule` enum: valor `ASSET` adicionado (migration aplicada)
- Endpoint `POST /assets/depreciation-journal` body: `{ yearMonth: 'YYYY-MM' }`
  - 1 `JournalEntry` consolidado por mês (todos os ativos)
  - Débito: `depreciationAccId` / Crédito: `accumDeprecAccId`
  - Anti-duplicata via `reference: DEPR-YYYY-MM`
- Endpoint `GET /assets/depreciation-monthly-totals?year=`
  - 12 meses com total e flag `hasJournal`
- Painel mensal no Relatório Anual: ⚡ gera lançamento | ✓ já gerado

### `AssetsList.tsx` (COMPLETO ✅)

- Scroll `calc(100vh - 340px)`, `table-fixed` + `colgroup`
- Ordenação por todas as colunas
- Checkboxes de seleção individual e total
- Barra de ações em lote (Ativar/Desativar/Reativar/Depreciar Retroativo/Excluir)
- Modal de período para backfill (De/Até)
- Rodapé com totais de deprec. acum. e valor contábil
- Coluna Conta Contábil adicionada

### Backfill de Depreciação (COMPLETO ✅)

- SQL raw via `$executeRawUnsafe` usando `generate_series` do PostgreSQL
- Deleta todos os logs do ativo e recria mês a mês em uma única query
- Atualiza `accumulated_depreciation`, `book_value`, `remaining_life_months`, `status`
- Aceita `dateFrom` e `dateTo` opcionais
- 20 ativos da LM Administração processados ✅

**Estado LM Administração — Ativos:**
- 20 ativos ACTIVE
- Valor bruto: R$ 21.156.680,31
- Valor contábil: R$ 18.520.794,53
- Deprec. acum.: R$ 2.635.885,78

### Schema — relações adicionadas em `FixedAsset`

```prisma
assetAccount    ChartOfAccounts? @relation("AssetAccount", fields: [assetAccountId], references: [id])
depreciationAcc ChartOfAccounts? @relation("DepreciationAcc", fields: [depreciationAccId], references: [id])
accumDeprecAcc  ChartOfAccounts? @relation("AccumDeprecAcc", fields: [accumDeprecAccId], references: [id])
```

---

## Pendências documentadas (priorizadas)

1. **Renda Fixa — Lançamentos contábeis mensais:** gerar no `bulk-update`
   - `D — Conta CDB (accountingAccountId)` / `C — Receitas Aplic. Financeiras (32101010001)` — rendimento bruto
   - `D — IRRF a Recuperar (11309010010)` / `C — Conta CDB` — IRRF estimado
   - Contas fixas (Receitas + IRRF) configuráveis por empresa
2. **Renda Fixa — Frontend:** campo "Conta Contábil" no formulário de CDB (autocomplete plano de contas)
3. **Ativo Imobilizado:** lançamentos automáticos mensais (cron job ou trigger no bulk-update)
4. **Ativo Imobilizado:** verificar terrenos `nonDepreciable = true` (Cotia, Pinhais, etc.)
5. **Sistema — Indicadores:** abas Selic e IGP-M pendentes
6. **`JournalPage.tsx`:** remover bloco inline duplicado `EcdOpeningModal` (bug de identifiers)
7. **Bank Import — tela de classificação:** conectar ao autocomplete do Plano de Contas
8. **DocumentViewerModal.tsx:** implementação completa com abas Documento/Histórico/Assinaturas

---

## Padrões técnicos consolidados

- **TDD:** Python scripts em `D:\Temp\` para edições de arquivos — nunca editores visuais
- **Inspeção antes de editar:** `Select-String` para localizar, `Get-Content -TotalCount` para cabeçalho
- **Encoding legados:** arquivos `.txt` e SPED usam `latin1` — salvar SQL como latin1 e setar `$env:PGCLIENTENCODING = "LATIN1"` antes do psql
- **Timezone Windows:** `Date.UTC(..., 12)` para evitar offset UTC-3 em campos `@db.Date`
- **CDI `getMonthlyRates`:** usar `Math.max(cur.accum, ...)` para pegar último dia do mês
- **`SkipCompanyCheck`:** importar de `../../multi-company/company.interceptor`
- **Prisma enum filtering:** filtrar enums em memória no frontend
- **`useMemo` para valores parsed:** evitar loops infinitos de render
- **Todos os relatórios contábeis:** calcular exclusivamente via `journal_entry_items` — NUNCA misturar com snapshots ECD

---

## Design System (Clean Minimalista)

| Token | Valor | Uso |
|-------|-------|-----|
| radius-sm | 6px | Inputs, pills |
| radius-md | 10px | Cards, botões |
| radius-lg | 14px | Modais |
| border | 0.5px solid #E5E7EB | Padrão |
| surface | #F9FAFB | Backgrounds |

| Módulo | Accent | Surface |
|--------|--------|---------|
| Contábil | `#2563EB` | `#EFF6FF` |
| Financeiro | `#0369A1` | `#F0F9FF` |
| SPED | `#7C3AED` | `#FAF5FF` |
| Ativo Imob. | `#EA580C` | `#FFF7ED` |
| Societário | `#0891B2` | `#ECFEFF` |
| Sistema | `#374151` | `#F9FAFB` |

**Regras:**
- Verde (`#16A34A`) — reservado para status "Pago/Sucesso"
- Vermelho (`#DC2626`) — reservado para status "Vencido/Erro"
- Tabelas, inputs e modais sempre neutros — identidade só no header/nav

---

## Como usar este arquivo

**Início de sessão simples** (bug fix, pequena feature):
> Cole as seções "Stack", "Convenções", "Estado dos módulos" e "Pendências"

**Início de sessão de desenvolvimento** (novo módulo, feature grande):
> Cole o arquivo inteiro + trecho do schema dos models envolvidos

**Handoff entre sessões:**
> `.md` colado inline no chat — nunca DOCX (~400 tokens vs ~4.000)
