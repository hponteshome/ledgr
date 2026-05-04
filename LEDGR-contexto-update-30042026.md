# LEDGR — Contexto do Projeto

> Arquivo de referência para novas sessões com Claude.
> Cole o conteúdo deste arquivo no início de cada sessão nova.
> Atualize sempre que um módulo mudar de estado.
> **Última atualização:** 30/04/2026

---

## Stack

- **Monorepo:** `D:\Projetos\Ledgr`
- **Backend:** NestJS + Prisma + PostgreSQL (`ledgr_app` na porta 5432)
- **Frontend:** React + TypeScript + Vite (porta 5173)
- **Auth:** JWT · token em `@ledgr:token` · empresa em `@ledgr:activeCompany`
- **API client:** axios em `apps/web/src/services/api.ts` · interceptor injeta `x-company-id` automaticamente
- **Upload de arquivo:** usar `fetch` direto (não axios) — axios corrompe multipart boundary

---

## Backup — Procedimento GitHub

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

**Repositório:** https://github.com/hponteshome/ledgr

---

## Convenções obrigatórias (Prisma / Backend)

| Regra                      | Exemplo                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| PK com UUID                | `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`                                     |
| Campos snake_case no banco | `@map("created_at")`                                                                          |
| Timestamps                 | `@db.Timestamp(6)`                                                                            |
| Soft delete                | campo `deletedAt DateTime? @db.Timestamp(6)`                                                  |
| Valores monetários         | `Decimal` — NUNCA `Float`                                                                     |
| companyId                  | nunca em filtro global do PrismaService — sempre via `request.companyId` (CompanyInterceptor) |
| AuditLog                   | campos: `actorId`, `action`, `targetId`, `before`, `after`, `ip`                              |

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
source_module:       (enum existente no schema — usado em JournalEntry)
```

---

## Estrutura de módulos (`apps/api/src/modules/`)

```
accounting/      controllers/ services/ dto/   — Contabilidade, Plano de Contas, Lançamentos
  ├ cdi/         cdi.service/controller/module — Tabela CDI, importação BCB
  └ fixed-income/ fixed-income.service/controller/module — Renda Fixa (CDB/LCI/etc)
assets/          controllers/ services/ dto/   — Ativo Imobilizado
calendar/        holiday.service/controller/module — Calendário de Feriados
finance/         dto/ parsers/                 — Financeiro (tudo flat na raiz)
  ├ finance.service/controller/module
  ├ accounts-payable.service/controller
  ├ agenda.service
  ├ integration.service                        — AP × Fiscal × Contábil × Agenda ($transaction)
  ├ bank-import.service/controller/module
  ├ suggestion.service                         — motor de 3 camadas para sugestão de conta
  └ parsers/bank-parser.service               — Itaú, Bradesco, BB, Santander, OFX, CSV
fiscal/          — Fiscal
hr/              — RH
sped/            ecd/ ecf/ efd/
rfb/             — Consulta RFB
```

---

## Models principais (resumo — não o schema completo)

| Model                    | Tabela                        | Observação                                                           |
| ------------------------ | ----------------------------- | -------------------------------------------------------------------- |
| `AccountsPayable`        | `accounts_payable`            | status usa `APStatus` (não `ApEntryStatus`)                          |
| `ApEntry`                | `ap_entries`                  | model antigo, status usa `ApEntryStatus`                             |
| `AgendaEvent`            | `agenda_events`               | campo obrigatório: `createdById`                                     |
| `FiscalDocument`         | `fiscal_documents`            | campo obrigatório: `createdById` · status: `DocumentStatus`          |
| `BankStatement`          | `bank_statements`             | novo (migrado em 22/03/2026)                                         |
| `BankTransaction`        | `bank_transactions`           | novo                                                                 |
| `BankImportRule`         | `bank_import_rules`           | motor de aprendizado                                                 |
| `JournalEntry`           | `journal_entries`             | campo: `date` (não `entryDate`) · `sourceModule` (não `isAutomatic`) |
| `JournalEntryItem`       | `journal_entry_items`         | campos: `accountId`, `type`, `value`                                 |
| `AuditLog`               | `audit_logs`                  | campos: `actorId`, `action`, `targetId`, `before`, `after`, `ip`     |
| `FixedIncomeInvestment`  | `fixed_income_investments`    | campo `accountingAccountId` (conta contábil do CDB)                  |
| `FixedIncomeEvent`       | `fixed_income_events`         | resgates e atualizações mensais                                      |
| `FixedIncomeMonthlyRate` | `fixed_income_monthly_rates`  | taxas CDI mensais por investimento                                   |
| `CdiDailyRate`           | `cdi_daily_rates`             | taxas CDI diárias importadas da BCB                                  |
| `Holiday`                | `holidays`                    | feriados nacionais/estaduais/judaicos · campos hebrewName/hebrewDate |

---

## Estado dos módulos

| Módulo                     | Status         | Observações                                                          |
| -------------------------- | -------------- | -------------------------------------------------------------------- |
| Accounting                 | ✅ Produção    | Plano de Contas, Lançamentos, Balancete, Saldos                      |
| Renda Fixa (CDB)           | ✅ Produção    | Carteira, extrato, projeção, resgates, proporcionalização 1º mês     |
| Calendário de Feriados     | ✅ Produção    | 63 feriados nacionais 2022-2026, feriados judaicos                   |
| Sistema — Tabelas Legais   | ✅ Produção    | IRPF 2024/2025/2026 + INSS 2024/2025/2026 + Simulador               |
| Finance — Doc. Fiscal      | ✅ Funcionando | Integração AP × CT × Agenda via $transaction                         |
| Finance — Contas a Pagar   | ✅ Funcionando | Baixa individual e lote, Aging/Posição AP                            |
| Finance — Agenda           | ✅ Funcionando | Calendário post-its, recorrência                                     |
| Finance — Bank Import      | ✅ Funcionando | Itaú, Bradesco, BB, OFX, CSV · sugestão 3 camadas                   |
| SPED ECD                   | ✅ Produção    |                                                                      |
| Ativo Imobilizado          | ✅ Produção    |                                                                      |
| Societário                 | ✅ Produção    |                                                                      |
| RFB                        | ✅ Produção    |                                                                      |
| Finance — Contas a Receber | 🔲 Pendente    | estrutura preparada (arEntryId nos models)                           |
| Finance — Folha RH         | 🔲 Pendente    | estrutura preparada (payrollId nos models)                           |
| Finance — Conciliação AP   | 🔲 Pendente    | apEntryId em BankTransaction já existe                               |
| Finance — Fluxo de Caixa   | 🔲 Pendente    |                                                                      |
| Sistema — Indicadores      | 🔧 Parcial     | CDI completo; Selic e IGP-M pendentes (abas a implementar)           |

---

## Sessão 30/04/2026 — Renda Fixa + Sistema + Plano de Contas

### Módulo Renda Fixa (COMPLETO ✅)

**Empresa de dados:** JOSE SILVA SOCIEDADE INDIVIDUAL DE ADVOCACIA (UUID `c188b188-de58-4fbd-8aa0-fcf07c35e65e`, CNPJ 35.416.962/0001-00)
**7 CDBs cadastrados, todos 96% CDI BB** — migrados da LM ADMINISTRACAO (UUID `f00af1b1-d50b-4ae6-aa17-4c2262e058db`)

**Contas contábeis da empresa (Renda Fixa):**
- IRRF a Recuperar: `11309010010` (UUID a confirmar)
- Receitas Aplic. Financeiras: `32101010001` (UUID `0d5ab7bf-0315-463a-936b-f910d610fae6`)

**CDBs com contas individuais no plano:**
- `11104040001` — CDB 3600889897272 (saldo capital R$ 82.500)
- `11104040002` — CDB 1600890985631 (saldo capital R$ 9.628.000)
- `11104040003` — CDB 1500908586930 (saldo capital R$ 1.000.000)
- `11104040004` — CDB 3600901425272 (saldo capital R$ 680.000)
- `11104040005` — CDB 0500905755609 (saldo capital R$ 950.000)
- `11104040006` — CDB 4500911443590 (saldo capital R$ 350.000)
- `11104040007` — CDB 0100950505802 (saldo capital R$ 31.000)

**Schema — campo adicionado em `FixedIncomeInvestment`:**
```prisma
accountingAccountId String? @map("accounting_account_id") @db.Uuid
```
Migration: `20260430223656_add_accounting_account_to_fixed_income`

**Frontend `RendaFixaPage.tsx`:**
- Lista consolidada com colunas: Descrição, Tipo, Emissor, Indexador, Capital Inicial, Saldo Capital, Rend. Bruto, IRRF Est., Saldo Líquido, Aplicação, Vencimento, Status, Ações
- `allProjections` — calcula projeção de todos os investimentos via `buildProjection` + feriados
- Filtro de período único (acima da tabela, à direita) — aplica na lista E no detalhe
- Linha de totais no `<tfoot>` destacada em azul (`#F0F9FF`, borda `#2563EB`)
- 3 cards: Investimentos Ativos, Saldo de Capital (azul), Total IRRF Estimado (vermelho), Rendimento Líquido Projetado (verde)
- Detalhe em **accordion** — expande inline ao clicar na linha, com recuo à esquerda
- Indicador ►/▼ na coluna Ações
- 3 abas no detalhe: Extrato completo, Projeção, Resgates
- `buildProjection` recebe `holidays: Set<string>` para proporcionalização precisa do 1º mês
- Precisão 99,87% vs extrato bancário BB (CDB 1600890985631: R$ 4.622.439 vs banco R$ 4.628.372)

**Atualização mensal executada:** jan-abr/2026 para todos os 7 CDBs

**Correção crítica — `cdi.service.ts`:**
```typescript
// ANTES (errado — pegava dia intermediário):
cur.accum = Number(r.monthlyAccum);
// DEPOIS (correto — pega último dia do mês):
cur.accum = Math.max(cur.accum, Number(r.monthlyAccum));
```

### Calendário de Feriados (COMPLETO ✅)

**Backend:** `apps/api/src/modules/calendar/`
- `GET /calendar/holidays` — lista por ano/tipo (`@SkipCompanyCheck()`)
- `POST /calendar/holidays/import/:year` — importa via BrasilAPI
- `POST /calendar/holidays` — cadastro manual (feriados judaicos)
- `DELETE /calendar/holidays/:id`
- 63 feriados nacionais importados (2022-2026)

**Frontend:** `frontend/src/pages/sistema/CalendarioPage.tsx`

### Menu Sistema (COMPLETO ✅)

**Subitens:**
- Calendário de Feriados → `/app/sistema/calendario`
- Indicadores Econômicos → `/app/sistema/indicadores` (CDI; Selic/IGP-M pendentes)
- Tabelas Legais → `/app/sistema/tabelas`

**Tabela CDI** removida do menu Accounting e movida para Sistema → Indicadores Econômicos.

### Tabelas Legais (COMPLETO ✅)

**`frontend/src/pages/sistema/TabelasLegaisPage.tsx`**
- IRPF: 3 vigências (Fev/2024-Abr/2025, Mai/2025+, Jan/2026+)
- INSS: 2024, 2025, 2026
- Simulador integrado INSS + IRPF com desconto simplificado / dependentes
- Redutor 2026 (Lei 15.270/2025): fórmula `R$ 978,62 − (0,133145 × renda bruta)`

**Dados IRPF Mai/2025 e 2026 (mesma tabela):**
| Faixa | Alíquota | Dedução |
|-------|----------|---------|
| Até R$ 2.428,80 | Isento | — |
| R$ 2.428,81 a R$ 2.826,65 | 7,5% | R$ 182,16 |
| R$ 2.826,66 a R$ 3.751,05 | 15% | R$ 394,16 |
| R$ 3.751,06 a R$ 4.664,68 | 22,5% | R$ 675,49 |
| Acima de R$ 4.664,68 | 27,5% | R$ 908,73 |
Desc. simplificado: R$ 607,20 | Dep: R$ 189,59/mês

**Dados INSS 2026:**
| Faixa | Alíquota |
|-------|----------|
| Até R$ 1.621,00 | 7,5% |
| R$ 1.621,01 a R$ 2.902,84 | 9% |
| R$ 2.902,85 a R$ 4.354,27 | 12% |
| R$ 4.354,28 a R$ 8.475,55 | 14% |
Desconto máximo: R$ 988,09

### Plano de Contas (COMPLETO ✅)

**168 contas importadas** de arquivo `.txt` do sistema legado (encoding latin1).
**Importante:** salvar o SQL como `latin1` para o psql interpretar corretamente:
```powershell
$env:PGCLIENTENCODING = "LATIN1"
psql -h localhost -U ledgr -d ledgr_app -f D:\Temp\import_plano.sql
```

---

## Pendências documentadas

1. **Renda Fixa — Lançamentos contábeis:** gerar automaticamente no `bulk-update` mensal
   - `D — Conta do CDB (accountingAccountId)` / `C — Receitas Aplic. Financeiras (32101010001)` — rendimento bruto
   - `D — IRRF a Recuperar (11309010010)` / `C — Conta do CDB` — IRRF estimado
   - Campo `accountingAccountId` já no schema — falta cadastro no frontend e lógica no service
   - Contas fixas (Receitas + IRRF) devem ser configuráveis por empresa
2. **Renda Fixa — Frontend cadastro:** adicionar campo "Conta Contábil" no formulário de novo/editar CDB (autocomplete do plano de contas)
3. **Sistema — Indicadores:** abas Selic e IGP-M pendentes (schema + endpoints + frontend)
4. **`agenda.service.ts`** — `create()` e `generateRecurringSeries()` exigem `createdById: userId`
5. **`integration.service.ts`** — `FiscalDocument.create` e `AgendaEvent.create` exigem `createdById: userId`
6. **Bank Import — tela de classificação** — campos de conta contábil precisam ser conectados ao autocomplete do Plano de Contas

---

## Padrões técnicos consolidados

- **Terminal Driven Development:** edições via Python scripts em `D:\Temp\` — nunca editores visuais
- **Inspeção antes de editar:** `Select-String` para localizar, `Get-Content -TotalCount` para cabeçalho
- **Encoding de arquivos legados:** sempre `latin1` — salvar SQL como latin1 e setar `$env:PGCLIENTENCODING = "LATIN1"` antes do psql
- **Timezone Windows:** `Date.UTC(..., 12)` para evitar offset UTC-3 em campos `@db.Date`
- **CDI `getMonthlyRates`:** usar `Math.max(cur.accum, ...)` para pegar último dia do mês
- **`SkipCompanyCheck`:** importar de `../../multi-company/company.interceptor` — usado em rotas globais (calendário, CDI, etc.)
- **Prisma enum filtering:** filtrar enums em memória no frontend, não passar para `where` do Prisma
- **`useMemo` para parsed values:** evitar loops infinitos de render com dependências instáveis

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

---

## Como usar este arquivo

**Início de sessão simples** (bug fix, pequena feature):
> Cole apenas as seções "Stack", "Convenções", "Estado dos módulos" e "Pendências"

**Início de sessão de desenvolvimento** (novo módulo, feature grande):
> Cole o arquivo inteiro + trecho do schema dos models envolvidos

**Handoff entre sessões:**
> `.md` colado inline no chat — nunca DOCX anexado (~400 tokens vs ~4.000)
