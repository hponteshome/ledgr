# LEDGR — Contexto do Projeto

> Arquivo de referência para novas sessões com Claude.
> Cole o conteúdo deste arquivo no início de cada sessão nova.
> Atualize sempre que um módulo mudar de estado.
> **Última atualização:** 25/05/2026

---

## Stack

- **Monorepo:** `D:\Projetos\Ledgr`
- **Backend:** NestJS + Prisma + PostgreSQL (`ledgr_app` na porta 5432, Docker)
- **Frontend:** React + TypeScript + Vite (porta 5173)
- **Auth:** JWT · token em `@ledgr:token` · empresa em `@ledgr:activeCompany`
- **API client:** axios em `frontend/src/services/api.ts` · interceptor injeta `x-company-id` automaticamente
- **Upload de arquivo:** usar `fetch` direto (não axios) — axios corrompe multipart boundary
- **TDD:** PowerShell obrigatório — inspecionar → bloco PS → confirmar. NUNCA bash_tool/create_file para arquivos do projeto

---

## Git / GitHub

```powershell
cd D:\Projetos\Ledgr
git add .
git commit -m "feat: <descricao>"
git push origin main
```

- **Repositório:** https://github.com/hponteshome/ledgr (privado)
- **Branch principal:** main

---

## Convenções obrigatórias (Prisma / Backend)

| Regra                      | Exemplo                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| PK com UUID                | `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`                    |
| Campos snake_case no banco | `@map("created_at")`                                                         |
| Timestamps                 | `@db.Timestamp(6)`                                                           |
| Soft delete                | campo `deletedAt DateTime? @db.Timestamp(6)`                                 |
| Valores monetários         | `Decimal` — NUNCA `Float`                                                    |
| companyId                  | nunca em filtro global — sempre via `request.companyId` (CompanyInterceptor) |
| AuditLog                   | campos: `actorId`, `action`, `targetId`, `before`, `after`, `ip`             |

---

## Enums importantes (já no schema)
ApEntryStatus: OPEN | PAID | OVERDUE | PARTIALLY_PAID | CANCELLED | SCHEDULED
APStatus: OPEN | PARTIAL | PAID | OVERDUE | CANCELLED
DocumentStatus: RASCUNHO | EM_REVISAO | AGUARDANDO_ASSINATURA | ASSINADO | REGISTRADO | ARQUIVADO | CANCELADO
BankCode: ITAU | BRADESCO | BB | SANTANDER | CAIXA | SICREDI | SICOOB | NUBANK | INTER | GENERIC
AgendaColor: YELLOW | BLUE | GREEN | RED | ORANGE | PURPLE
AgendaEventType: PAYMENT | PLANNED_PAYMENT | TAX | CLOSING | MEETING | REMINDER | OTHER
SourceModule: ACCOUNTING | FINANCE | FISCAL | HR | BANK_IMPORT | ECD_IMPORT | INVESTMENT | ASSET
StatusFechamento: ABERTO | EM_FECHAMENTO | FECHADO_PREVIO | FECHADO | REABERTO
ModuloFechamento: PROVISOES | PRO_LABORE | RENDA_FIXA | DEPRECIACAO | PIS_COFINS | IRPJ_CSLL
StatusItemFechamento: PENDENTE | CONFERIDO | GERADO | IGNORADO
TipoProvisao: ALUGUEL | HONORARIOS | SERVICO | ENERGIA | TELEFONIA | SEGURO | IPTU | OUTRO
PeriodicidadeProvisao: MENSAL | BIMESTRAL | TRIMESTRAL | SEMESTRAL | ANUAL
ArEntryStatus: OPEN | PARTIAL | RECEIVED | OVERDUE | CANCELLED
AROrigin: MANUAL | FISCAL_DOCUMENT | ALUGUEL | RECURRING
PettyCashEntryType: OPENING | EXPENSE | REPLENISHMENT
RaceColor: BRANCA | PRETA | PARDA | AMARELA | INDIGENA | NAO_INFORMADO
EducationLevel, EmploymentBond, GfipCategory, DependentRelationship (schema RH)

---

## Estrutura de módulos (`apps/api/src/modules/`)
accounting/ controllers/ services/ dto/
assets/ controllers/ services/ — Ativo Imobilizado
finance/ dto/ parsers/
├ finance.service/controller/module
├ accounts-payable.service/controller
├ accounts-receivable.service/controller
├ cashflow.service/controller
├ petty-cash.service/controller
├ agenda.service — Agenda Financeira
├ integration.service — AP x Fiscal x Contabil x Agenda ($transaction)
├ provisao.service/controller — Provisoes Recorrentes
├ fechamento.service/controller — Fechamento Mensal
├ bank-import.service/controller/module
├ suggestion.service — motor 3 camadas sugestao de conta
└ parsers/bank-parser.service
hr/ pro-labore.service/controller
informe.service/controller/informe-pdf.service — Informe de Rendimentos
employee.service/controller + employee-pdf-parser.service
sped/ ecd/ ecf/ efd/
rfb/ — Consulta RFB
signatures/ — Assinaturas digitais (ClickSign, gov.br, A1/A3)
corporate/ — Societario (shareholders, transfers, corporate-pdf)
dashboard/ — DashboardModule (controller + service)

---

## Models principais

| Model                   | Tabela                     | Observacao                                                                     |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| AccountsPayable         | accounts_payable           | status usa APStatus                                                            |
| ApEntry                 | ap_entries                 | status usa ApEntryStatus; propertyId→Property                                  |
| ArEntry                 | ar_entries                 | ArEntryStatus; propertyId→Property; customerId→Person                          |
| ARPayment               | ar_payments                | baixas parciais de ArEntry                                                     |
| AgendaEvent             | agenda_events              | `provisaoConfigId`, `eventType: PLANNED_PAYMENT\|PAYMENT`                      |
| FiscalDocument          | fiscal_documents           | campo obrigatorio: createdById                                                 |
| BankStatement           | bank_statements            |                                                                                |
| BankTransaction         | bank_transactions          | motor sugestao 3 camadas                                                       |
| BankImportRule          | bank_import_rules          | aprendizado automatico                                                         |
| JournalEntry            | journal_entries            | campo: date, sourceModule                                                      |
| JournalEntryItem        | journal_entry_items        | campos: accountId, type, value                                                 |
| ProvisaoConfig          | provisao_configs           | geraAgenda, geraContabil, favorecidoPersonId, favorecidoCompanyId, agendaColor |
| ProvisaoLancamento      | provisao_lancamentos       | agendaEventId, apEntryId                                                       |
| ProvisaoRateioConfig    | provisao_rateio_configs    | rateio variavel por competencia                                                |
| FechamentoMensal        | fechamentos_mensais        | controle fechamento por competencia                                            |
| FechamentoItem          | fechamento_itens           | itens por modulo                                                               |
| ProLaboreConfig         | pro_labore_configs         | configuracao por diretor                                                       |
| ProLaboreCalculo        | pro_labore_calculos        | calculo mensal INSS/IRRF                                                       |
| InformeRendimentos      | informes_rendimentos       | @@unique(companyId+personId+anoCalendario), Q3-Q8 RFB                          |
| CompanyAccountingConfig | company_accounting_configs | config contabil por empresa                                                    |
| ChartOfAccounts         | chart_of_accounts          | campo reducedCode                                                              |
| FixedIncomeInvestment   | fixed_income_investments   | accountingAccountId                                                            |
| FixedAsset              | fixed_assets               | assetAccountId, depreciationAccId, accumDeprecAccId                            |
| PettyCash               | petty_cash                 | targetBalance, alertThreshold, currentBalance; responsibleId→Person            |
| PettyCashEntry          | petty_cash_entries         | OPENING/EXPENSE/REPLENISHMENT; balanceAfter; description TEXT                  |
| Employee                | employees                  | ~50 campos eSocial S-2200                                                      |
| EmployeeDependent       | employee_dependents        | SF/IR; @relation("EmployeePerson")                                             |
| AuditLog                | audit_logs                 | actorId, action, targetId, before, after, ip                                   |
| Person                  | persons                    | cpf sem mascara no banco, @SkipCompanyCheck no controller                      |

---

## Estado dos módulos — atualizado 25/05/2026

| Módulo                               | Status         | Observações                                                              |
| ------------------------------------ | -------------- | ------------------------------------------------------------------------ |
| Accounting — Plano de Contas         | ✅ Produção    | shortCode, toggle tabela/árvore, inferência automática                   |
| Accounting — Lançamentos             | ✅ Produção    | Diário Geral, Razão Analítico, Balancete                                 |
| Accounting — Balancete               | ✅ Produção    | Mensal + Verificação, exclusivamente via journal_entry_items             |
| Accounting — Livro Diário            | ✅ Produção    | Layout IOB, termos abertura/encerramento editáveis                       |
| Accounting — Livro Razão             | ✅ Produção    | Layout LEDGR, filtro por lista de contas, reducedCode                    |
| Accounting — Balanço Patrimonial     | ✅ Produção    | Grid 2 colunas Ativo/Passivo+PL, equilibrado                             |
| Accounting — DRE                     | ✅ Produção    | Filtra REVENUE/EXPENSE, exclui código 49                                 |
| Accounting — Renda Fixa              | ✅ Produção    | CDB, lançamentos automáticos, enum INVESTMENT                            |
| Accounting — Ativo Imobilizado       | ✅ Produção    | Backfill depreciação, relatório anual, lançamentos contábeis             |
| Accounting — ECD Import              | ✅ Produção    | ECD 2024 LM importado, saldo anterior via i155                           |
| Accounting — CompanyAccountingConfig | ✅ Produção    | GET/PUT /accounting/config                                               |
| Calendário de Feriados               | ✅ Produção    | 63 feriados nacionais 2022-2026, feriados judaicos                       |
| Sistema — Tabelas Legais             | ✅ Produção    | IRPF 2024/2025/2026 + INSS 2024/2025/2026 + Simulador                   |
| Sistema — Backup/Manutenção          | ✅ Funcionando | TableManager 29 tabelas, BackupRestore, menu Sistema                     |
| Dashboard v2                         | ✅ Produção    | 6 KPIs reais, agenda 60d, painel AP, aging AP×AR; DashboardModule        |
| Finance — Doc. Fiscal                | ✅ Funcionando | Integração AP × CT × Agenda via $transaction                             |
| Finance — Contas a Pagar             | ✅ Funcionando | Baixa individual e lote, Aging/Posição AP                                |
| Finance — Contas a Receber           | ✅ Funcionando | ArEntry, baixa parcial, aging, vínculo imóvel/cliente                    |
| Finance — Fluxo de Caixa Gerencial   | ✅ Funcionando | Tabela mensal, gráfico barras, filtro imóvel, selects mês/ano dinâmicos  |
| Finance — Fluxo de Caixa Bancário    | ✅ Funcionando | Aba bancária com BankTransactions por mês                                |
| Finance — Fundo Fixo                 | ✅ Funcionando | PettyCash, abertura automática, alerta visual, histórico detalhado       |
| Finance — Agenda Financeira          | ✅ Produção    | PLANNED_PAYMENT ao cadastrar provisão; PAYMENT ao gerar lançamento       |
| Finance — Bank Import                | ✅ Funcionando | Itaú, Bradesco, BB, OFX, CSV, ExcelPreviewModal                          |
| Finance — Provisões Recorrentes      | ✅ Produção    | Configs, geração mensal, NF, rateio, favorecido, geraAgenda/geraContabil |
| Finance — Fechamento Mensal          | ✅ Produção    | Bloqueio lançamentos, FECHADO_PREVIO, cascata, auditoria                 |
| RH — Funcionários                    | ✅ Funcionando | Parser PDF Kipstone, eSocial S-2200, importação batch                    |
| RH — Pró-labore                      | ✅ Produção    | INSS/IRRF 2026, GPS, DARF, retroativos                                   |
| RH — Informe de Rendimentos          | ✅ Produção    | Formulário RFB Q3-Q8, preview fiel, PDF Puppeteer, edição, filtro ano    |
| SPED ECD — Import                    | ✅ Produção    | ECD 2024 LM importado, saldo anterior via i155, 12 meses equilibrados    |
| SPED ECD — Export                    | ✅ Produção    | Arquivo txt validado PGE, 6 erros residuais (Bloco J pendente I052)      |
| SPED ECD — Pre-validate              | ✅ Produção    | GET /sped/ecd/pre-validate — 5 bloqueantes + 4 avisos                    |
| SPED — Visões Contábeis              | 🔧 Parcial     | Schema + backend + JSONs RFB prontos; frontend editor I052 pendente      |
| Societário                           | ✅ Produção    | Shareholders, transferências, corporate-pdf, DocumentViewModal           |
| Assinaturas Digitais                 | ✅ Funcionando | ClickSign sandbox, validador ICP-Brasil/gov.br                           |
| Arquivo / Repositório                | ✅ Funcionando | DocumentViewModal, ImportarDocumentoModal                                |
| RFB                                  | ✅ Produção    |                                                                          |
| Finance — Conciliação AP             | 🔲 Pendente    | apEntryId em BankTransaction já existe                                   |
| Finance — Fluxo de Caixa Completo    | 🔲 Pendente    | Combinar gerencial + bancário para compliance                            |
| Sistema — Indicadores                | 🔧 Parcial     | CDI completo; Selic e IGP-M pendentes                                    |

---

## Empresas de teste

| Empresa                                      | CNPJ               | UUID                                 | Uso                            |
| -------------------------------------------- | ------------------ | ------------------------------------ | ------------------------------ |
| JOSE SILVA SOCIEDADE INDIVIDUAL DE ADVOCACIA | 35.416.962/0001-00 | c188b188-de58-4fbd-8aa0-fcf07c35e65e | Principal — Lucro Real, 7 CDBs |
| LM ADMINISTRACAO DE BENS IMOVEIS LTDA        | 17.970.759/0001-08 | f00af1b1-d50b-4ae6-aa17-4c2262e058db | ECD 2024, 20 ativos, provisões |
| HALLO ADMINISTRACAO E PARTICIPACOES LTDA     | 07.432.458/0001-69 | 06a88dfa-d4cf-4c5c-8dc1-83538d6b8b7c | Testes gerais                  |
| F5 PARTICIPACOES S/A                         | 33.652.701/0001-64 | 30437192-bfe5-4344-8407-b758d7382153 | Societário, assinaturas        |
| ADVOCACIA GOMES, ROSSETTI E BARELLI          | 06.190.032/0001-83 | d85731d7-d0a5-441b-a488-56109b5d0d47 | Testes Informe de Rendimentos  |

---

## Pendências — atualizado 25/05/2026

### Fila imediata

1. **Visões Contábeis + I052** — frontend editor de mapeamento + importar JSONs RFB → habilitar Bloco J ECD
2. **Bloco J ECD** — usar AccountingViewMapping para gerar I052 + J100/J150/J210/J215
3. **Sidebar** — adicionar Visões Contábeis em Accounting
4. **Provisões — PIS/COFINS** como partidas contábeis (creditaPisCofins = true)
5. **Sistema — Indicadores** — Selic e IGP-M (abas pendentes em `IndicadoresPage.tsx`)

### Horizon

- LALUR/LACS — Fechamento Mensal JSSIA Lucro Real 2025
- Apuração IRPJ/CSLL JOSE SILVA
- Guias DARF IRPJ/CSLL geradas pelo fechamento
- Consulta CPF via Serpro
- Integração gov.br assinatura digital
- ECF parser blocos J/K/L/M/N
- Conciliação AP x Banco
- Livros Societários — Assembleias e Reuniões
- LM Administração — receitas com aluguéis (ArEntry)
- Informe de Rendimentos — alimentação automática via folha pró-labore
- Finance — Fluxo de Caixa Completo (compliance)

---

## Padrões técnicos consolidados

- **TDD PowerShell:** inspecionar com `Select-String`/`Get-Content -Index`, alterar com `WriteAllLines`, confirmar. NUNCA bash_tool para arquivos do projeto
- **BOM UTF-8:** SEMPRE `[System.IO.File]::WriteAllText($f, $text, (New-Object System.Text.UTF8Encoding $false))` — `WriteAllLines` reinsere BOM e quebra o Prisma
- **Encoding legados:** SPED usa `latin1` — `$env:PGCLIENTENCODING = "LATIN1"` antes do psql
- **Timezone Windows:** `Date.UTC(..., 12)` para campos `@db.Date` (evita offset UTC-3)
- **Todos os relatórios:** exclusivamente via `journal_entry_items` — NUNCA misturar com snapshots ECD
- **CPF/CNPJ:** NUNCA gravar formatado — sempre `replace(/\D/g,'')` antes do Prisma
- **Enums Prisma:** strings vazias `""` causam erro — sempre limpar com `v === '' ? null : v`
- **NestJS módulos:** controllers devem ser registrados explicitamente no module
- **`@SkipCompanyCheck()`:** obrigatório em controllers globais (Persons, Companies, Calendar)
- **Puppeteer:** usar `waitUntil: 'domcontentloaded'` (não `networkidle0` — causa timeout)
- **Download autenticado:** `api.get(url, { responseType: 'blob' }) + URL.createObjectURL`
- **Alertas:** Sweetalert2 com `confirmButtonColor: '#111111'`
- **Modal padrão:** maxHeight: 90vh, overflowY: auto, fechar com Escape/click fora
- **Primeira linha de cada arquivo:** comentada com nome e caminho completo
- **Reescrever vs editar:** sempre reescrever arquivo completo quando há múltiplas duplicatas
- **Migrate sem reset:** `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script | docker exec -i ledgr-postgres psql -U ledgr -d ledgr_app`
- **Template literals PS:** NUNCA usar backtick+$ em blocos heredoc PS para strings TS — usar concatenação `+`
- **Valores com vírgula:** `String(v).replace(',','.')` antes de `new Prisma.Decimal()`
- **Enums com string vazia:** `dto.field || null` (não `?? null`)
- **Debounce em filtros:** `setTimeout` 400ms no `useEffect` do load
- **Selects mês/ano:** preferir dois selects separados a `<input type="month">`
- **$transaction no service:** sempre usar `prisma.$transaction` quando criar entidade pai + filhos
- **PowerShell -replace com |:** NUNCA usar -replace com strings contendo `|` — corrompe arquivo
- **Componentes React auxiliares:** SEMPRE externos ao componente pai — nunca dentro do corpo após o return
- **NestJS watch:** tocar o arquivo não garante recompile — verificar terminal de watch ativo

### Formatação numérica no frontend

- NUNCA `type="number"` em campos de valor monetário — usar `type="text"` com fmtBR/parseBR
- `parseBR(v)` → converte "1.250,00" para 1250
- `fmtBR(v)` → converte 1250 para "1.250,00"
- `onFocus` → exibe valor bruto; `onBlur` → aplica fmtBR; ao salvar → parseBR antes de enviar

### CPF/CNPJ

- CPF: `v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')`
- CNPJ: `v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')`
- Plano de Contas: tratar sem formatação no banco; formatar nas views

---

## Informe de Rendimentos — Detalhes

- **Rota:** `/app/hr/informe-rendimentos` · Sidebar: RH → Informe de Rendimentos
- **Schema:** `InformeRendimentos` com campos Q3-Q8 conforme modelo RFB (IN 2.060/2021)
- **@@unique:** `companyId + personId + anoCalendario` — upsert por esta chave
- **PDF:** Puppeteer, cabeçalho esquerdo com nome+CNPJ da empresa, rodapé "Gerado na Plataforma LEDGR"
- **`upsert` service:** desestrutura `person, company, companyId, createdById, createdAt, updatedAt, id` antes do `...clean`

---

## Agenda Financeira — Fluxo

- **Ao cadastrar/editar provisão:** `gerarAgendaPlanejada()` cria `AgendaEvent` tipo `PLANNED_PAYMENT`
- **Ao gerar lançamentos:** evento `PLANNED_PAYMENT` atualizado para `PAYMENT` + `apEntryId` vinculado

---

## Layout — Comportamento

- **Loading global:** `CompanyContext.loading === true` → spinner "Conectando ao servidor..."
- **Header:** quando `!user` exibe formulário de login inline; dropdown com My Profile e Sign Out
- **Guard de rotas:** `ProtectedRoute` nas rotas
- **Seletor de mês:** removido do Header global — permanece apenas nos módulos contábeis

---

## Dashboard v2 — Detalhes

- `frontend/src/pages/DashboardPage.tsx` — 6 KPI cards reais, agenda fiscal/contábil/financeira 60d, painel AP vencendo 7d, aging AP×AR com toggle
- `apps/api/src/modules/dashboard/` — DashboardModule: controller + service + module
- Endpoint: `GET /dashboard/kpi?month=YYYY-MM` — agrega AP, AR, NF, lançamentos, fechamento, docs
- Dashboard usa mês atual do calendário (não `@ledgr:activeMonth`)

---

## Design System

| Módulo            | Accent  | Surface |
| ----------------- | ------- | ------- |
| Financeiro        | #0369A1 | #F0F9FF |
| Contábil          | #2563EB | #EFF6FF |
| SPED              | #7C3AED | #FAF5FF |
| Ativo Imobilizado | #EA580C | #FFF7ED |
| Societário        | #0891B2 | #ECFEFF |
| RFB/Tax           | #0F766E | #F0FDFA |
| RH                | #0891B2 | #ECFEFF |
| Primário UI       | #111111 | #F9FAFB |

Tokens: radius-sm 6px, radius-md 10px, radius-lg 14px, border 0.5px #E5E7EB, surface #F9FAFB

Botões:
- Primário: background #111111, color #fff, radius 8px, padding 8px 18px
- Secundário: background #fff, border 0.5px #D1D5DB, color #374151

Tabelas:
- th: background #F9FAFB, color #6B7280, font-size 11px, uppercase, border-bottom 0.5px #E5E7EB
- td: color #374151, border-bottom 0.5px #F5F5F5

---

## Como usar este arquivo

**Início de sessão simples** (bug fix, pequena feature):
> Cole as seções Stack, Convenções, Estado dos módulos e Pendências

**Início de sessão de desenvolvimento** (novo módulo, feature grande):
> Cole o arquivo inteiro + trecho do schema dos models envolvidos

---

## Histórico de atualizações

### 21/05/2026

- **Finance — Bank Import (Excel Mapeado):** `ExcelPreviewModal.tsx`, endpoint `POST /bank-import/preview-excel` (dry-run), 24 lançamentos gerados, balanceados em R$ 108.729,16

### 22/05/2026

- **RH — Funcionários (eSocial S-2200):** schema expandido ~50 campos, parser PDF Kipstone, `employee.service.ts` em `$transaction`, `EmployeeImportModal.tsx` 3 etapas, 3 funcionários importados
- **Company Management:** `CompanyForm.tsx` + `CompanyList.tsx` com `loadCompanies()` e verificação de dependências; `Toaster` adicionado no `Layout.tsx`
- **Sistema — Backup e Manutenção:** `TableManager.tsx` expandido para 29 tabelas; menu Sistema atualizado
- **Finance — Contas a Receber:** schema `ArEntry`/`ARPayment`, enums `ArEntryStatus`/`AROrigin`, endpoints `/finance/ar`, `ContasAReceberPage.tsx` com listagem/filtros/baixa/aging
- **Finance — Fluxo de Caixa:** `cashflow.service.ts` com gerencial/bancário/summary/minYear; `FluxoCaixaPage.tsx` com 3 abas, selects mês/ano dinâmicos, filtro imóvel
- **Finance — Fundo Fixo:** schema `PettyCash`/`PettyCashEntry`, barra de progresso colorida, alerta "REPOR FUNDO", modal de despesa

### 23/05/2026 (tarde/noite)

- **Dashboard v2:** `DashboardPage.tsx` completo, `DashboardModule` backend, endpoint `GET /dashboard/kpi`; seletor de mês removido do Header global
- **SPED ECD Export:** `ecd-exporter.service.ts` reescrito — saldo via `account_balance` exclusivamente, I155 leiaute 9 (8 campos), I250 HIST ASCII, Bloco J vazio (J001/J900); validado no PGE (6 erros residuais todos Bloco J)
- **SPED ECD Pre-validate:** `ecd-pre-validate.service.ts` — 5 bloqueantes + 4 avisos; `EcdPreValidateModal.tsx` integrado ao `EcdPage`
- **Docs técnicos:** `docs/sped/layouts/ecd/ECD-Leiaute9-Referencia.md` — 204 linhas, histórico leiautes 1-9, layout validado por registro, status Bloco J

### Aprendizados técnicos críticos (23/05/2026)

- **ECD saldo inicial:** usar EXCLUSIVAMENTE `account_balance` — misturar journal histórico causa desequilíbrio
- **`account_balance.balance`:** positivo = devedor, negativo = credor — usar sinal diretamente
- **Layout 0000 ECD:** muda a cada exercício — sempre validar contra manual do ano
- **I155 leiaute 9:** 8 campos (VL_SLD_360 removido vs leiautes anteriores)
- **Bloco J ECD:** requer I052 (aglutinação) + I350/I355 + Visões Contábeis — não implementável sem infraestrutura
- **Pré-validação ECD:** sempre validar equilíbrio, fechamentos e plano antes de gerar