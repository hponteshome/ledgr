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
---

## Sessão 28/05/2026 — ECD Exporter Kipstone S/A (Lucro Real)

### Contexto
- Empresa: **Kipstone Tecnologia S/A** — CNPJ `31.799.461/0001-08`
- companyId: `9047fcd8-41f4-4656-8423-187f44659e1b`
- Período: 01/01/2025 a 31/12/2025 — Leiaute 9

### Caminhos do projeto (definitivos)
- Backend: `D:\Projetos\Ledgr\apps\api\src\modules\sped\ecd\`
  - Controller: `controllers\ecd.controller.ts` — rotas: `@Controller('sped/ecd')`, `@Get('export')`, `@Get('pre-validate')`, `@Post('import')`, `@Post('validate')`, `@Get('imports')`, `@Get('imports/:id')`
  - Exporter: `services\ecd-exporter.service.ts`
- Frontend: `D:\Projetos\Ledgr\frontend\src\pages\VisoesContabeisPage.tsx`
- Visões: `D:\Projetos\Ledgr\apps\api\src\modules\sped\visoes\`

### Problemas resolvidos

**1. Views vinculadas à empresa errada**
- As `AccountingView` BP 2024, BP 2025 e DRE 2025 estavam vinculadas à Kipstone LTDA (`671d09ef`) em vez da Kipstone S/A (`9047fcd8`).
- Correção: `UPDATE accounting_views SET company_id = '9047fcd8...' WHERE id IN (...)`

**2. DRE 2024 inexistente**
- Criada via SQL com 3 mapeamentos: `42103010050 → 3.01.01.07.01.23`, `42301010005 → 3.01.01.09.01.08`, `42401010001 → 3.01.01.09.01.09`

**3. I050 emitindo todas as contas**
- Adicionado filtro `accountsFiltered` — apenas contas com movimento, saldo ou mapeamento I052, expandindo ancestrais sintéticos.

**4. bookNumber hardcoded como "1" no controller**
- Corrigido: `bookNumber || undefined` no controller; default no exporter: `String(periodStart.getUTCFullYear()).slice(-2)` (ex: `"25"` para 2025).
- O frontend tem campo "Número do livro" que o usuário preenche manualmente.

**5. J100 usando BAL_+reducedCode inventado**
- Corrigido para usar `i052Map` (código RFB real) nas linhas de detalhe.
- J150 corrigido para usar `aglCode152.padEnd(30, " ")` em vez de `DRE_NNN_DO0_*`.

**6. J100 com COD_AGL duplicado (múltiplas contas para mesmo código RFB)**
- Substituído loop por conta por agregação: `j100Map` acumula `ini/fin` por código RFB antes de emitir.

**7. J100 sem hierarquia de totalizadores**
- Implementada busca completa da tabela `rfb_aglutination_codes` (leiaute 9, anoBase, tipo BP).
- Totalizadores (`T`) emitidos para todos os ancestrais dos códigos de detalhe, com saldos propagados bottom-up.
- Detalhes (`D`) emitidos após totalizadores.

**8. Bug saldo duplo nos totalizadores raiz (1 e 2)**
- A propagação somava ATIVO + PASSIVO na raiz. Corrigido: loop para quando `codigoPai` é vazio — não propaga além da raiz imediata.

**9. Mapeamentos com códigos totalizadores (2.01.01, 2.03.01)**
- Contas `22101020002`, `22101020003`, `22101030003` remapeadas para `2.01.01.17.03`
- Contas `23101010001`, `23101020001`, `23101020002` remapeadas para `2.03.01.01.01`
- Correção feita via frontend Visões Contábeis (VisoesContabeisPage.tsx)

### Resultado final
- **PGE: 1 erro — apenas assinatura do contador (J930) — não técnico**
- ECD pronto para assinar e transmitir

### Estado das AccountingViews — Kipstone S/A
| View | Tipo | Ano | Mapeamentos |
|---|---|---|---|
| Balanço Patrimonial 2024 | BP | 2024 | 38 |
| DRE 2024 | DRE | 2024 | 3 |
| Balanço Patrimonial 2025 | BP | 2025 | 39 |
| DRE 2025 | DRE | 2025 | 4 |

### Aprendizados técnicos desta sessão
- Schema: `Company.legalName` → coluna `legal_name` (não `name`)
- J100 exige hierarquia completa de totalizadores RFB — não pode emitir apenas detalhes
- COD_AGL do J100 deve ser único — múltiplas contas analíticas com mesmo código RFB devem ser agregadas
- Totalizadores (`T`) no J100 não podem constar no I052 — apenas detalhes (`D`)
- A propagação de saldo para totalizadores deve parar ao atingir a raiz (sem `codigoPai`)
- `bookNumber` vem do frontend (campo "Número do livro"); default é `slice(-2)` do ano

### Commits desta sessão
- `feat(ecd): exporter - hierarquia J100 RFB, agregacao COD_AGL, bookNumber por ano`
- `feat(visoes): editor de visoes contabeis + JSONs RFB leiaute 9 2025`

### Complemento sessão 28/05/2026 — Nome do arquivo ECD

**Problema:** arquivo gerado com nome `ECD_2026.txt` sem CNPJ
**Causa raiz:** nome hardcoded no frontend (`EcdPage.tsx` linha 306); `Content-Disposition` não exposto no CORS
**Solução:**
1. `apps/api/src/main.ts` — adicionado `Content-Disposition` em `exposedHeaders`
2. `apps/api/src/modules/sped/ecd/controllers/ecd.controller.ts` — nome gerado a partir do CNPJ extraído via `companyForName` do banco
3. `frontend/src/pages/sped/EcdPage.tsx` — `a.download` lê o `content-disposition` do response header
**Resultado:** `ECD_2026_31799461.txt` (formato `ECD_ANO_RAIZCNPJ.txt`)

---

## Sessão 28/05/2026 (tarde/noite) — Cadastro SPED + ECD Advocacia Gomes

### Contexto
- Empresa foco: **ADVOCACIA GOMES, ROSSETTI E BARELLI** — CNPJ `06.190.032/0001-83` — companyId: `d85731d7-d0a5-441b-a488-56109b5d0d47`
- Prazo ECD 2025: 29/05/2026
- Problema: arquivo original `ECD_2025_06190032.txt` era BALANCES_ONLY (sem I200) — PGE exige I200/I250 para tipo G

### Correções no ecd-exporter.service.ts

**Fix I050 — skip contas 000000:**
```ts
const reducedCode = (acc as any).reducedCode || acc.code;
if (!reducedCode || reducedCode === "000000") continue; // skip contas sem codigo valido
```

**Registro 0000 dinâmico:**
```ts
const indNireVal = (company.registerOrg||"").match(/OAB|RCPJ|Cartorio/i) ? "0" : (company.nire ? "1" : "0");
add(P+"0000"+P+"LECD"+P+dtIni+P+dtFin+P+company.legalName+P+cnpj+P+(company.state||"")+P+P+(company.codMun||"3550308")+P+(codPlanRef||"")+P+P+tipEcd+P+indNireVal+P+"0"+P+(hashAnterior||"")+P+"0"+P+"0"+P+(indSitEsp||"")+P+"N"+P+"N"+P+"0"+P+"0"+P+"1"+P);
```

**Interface EcdExportOptions expandida:**
```ts
tipEcd?: string; indSitEsp?: string; codPlanRef?: string; hashAnterior?: string;
```

**Select company expandido:**
```ts
select: { taxId: true, legalName: true, state: true, city: true, nire: true, codMun: true, registerOrg: true }
```

**Destructuring com defaults:**
```ts
tipEcd = "0", indSitEsp = "", codPlanRef = "", hashAnterior = "",
```

### Schema Prisma — novos campos

**Em `companies`** (após `indMoedaFunc`):
```prisma
indNire              String? @default("0") @map("ind_nire") @db.VarChar(1)
indSitEsp            String? @map("ind_sit_esp") @db.VarChar(2)
codPlanRef           String? @map("cod_plan_ref") @db.VarChar(20)
hashAnterior         String? @map("hash_anterior") @db.VarChar(255)
tabelasRfbPath       String? @map("tabelas_rfb_path") @db.VarChar(500)
escritorioContabilId String? @map("escritorio_contabil_id") @db.Uuid
```

**Nova tabela `CompanyTaxRegime`** (regime tributário por período — muda a cada exercício):
```prisma
model CompanyTaxRegime {
  id / companyId / dtIni / dtFin / formaTributacao / periodoApuracaoIRPJ
  qualificacaoPJ / tipoEscritECF / criterioReceitas / indOptanteRefis
  @@unique([companyId, dtIni])
  @@map("company_tax_regimes")
}
```

**Em `PersonCompany`** (para QSA e J930):
```prisma
qualificacaoCvm  String?  @map("qualificacao_cvm") @db.VarChar(2)
assinaEcd        Boolean? @default(false) @map("assina_ecd")
assinaEcf        Boolean? @default(false) @map("assina_ecf")
```

> `Person` já possui `crcNumber`, `crcState`, `crcType` — não precisou alterar.

### Campo duplicado resolvido
- `registerOrg` (`register_org`) — campo existente — USAR ESTE
- `orgRegistro` (`org_registro`) — era duplicata — REMOVIDO do schema

### Decisão: campos que ficam no cadastro vs no form de geração

**Cadastro da empresa (aba SPED/ECD) — fixos por empresa:**
- NIRE, Indicador NIRE (derivado de `registerOrg`)
- Órgão de Registro (`registerOrg`)
- Cod. Município IBGE (`codMun`)
- Inscrição Estadual, Escrituração Consolidada, Moeda Funcional, Escrituração Centralizada
- Caminho Tabelas RFB

**Form de geração ECD — variam por exercício/situação:**
- Natureza do Livro (bookType: G/R/B)
- Tipo ECD (0=Original, 1=Retificadora...)
- Situação Especial (CI/FU/EX/TR)
- Cod. Plano Referencial RFB
- Hash ECD Anterior (só para retificadora)
- Número do livro

### Frontend atualizado

**`CompanyEdit.tsx` — aba SPED/ECD:**
- Seção "ECD — Escrituração Contábil Digital" com: NIRE, Indicador NIRE, Órgão de Registro, Cod. Município, Inscrição Estadual, Escrituração Consolidada/Centralizada, Moeda Funcional, Caminho Tabelas RFB

**`EcdPage.tsx` — form de geração:**
- 4 novos states: `exportTipEcd`, `exportIndSitEsp`, `exportCodPlanRef`, `exportHashAnterior`
- Hash anterior aparece condicionalmente só quando Tipo ECD = 1 (Retificadora)
- Preview do registro 0000 em tempo real (fundo âmbar, texto azul, fonte serifada)

**`ecd.controller.ts`:**
- 4 novos `@Query`: `tipEcd`, `indSitEsp`, `codPlanRef`, `hashAnterior`

### Lógica indNire
- `indNire` é **derivado** de `registerOrg`, não tem campo próprio no banco
- `OAB`, `RCPJ`, `Cartório` → `indNire = "0"` (não registrado na Junta)
- `JUCESP` etc. → `indNire = "1"` (possui NIRE)

### Pendências para próxima sessão

1. **Aba QSA** — Quadro Societário e Administradores no cadastro da empresa
   - Grid de `PersonCompany` com qualificação (`qualificacaoCvm`), flags `assinaEcd`/`assinaEcf`
   - Base para geração do J930
2. **Grid CompanyTaxRegime** — regime tributário por exercício na aba SPED
3. **Preview J930** no cadastro (após QSA implementado)
4. **Testar geração ECD Advocacia Gomes** com novos parâmetros e validar no PGE
   - Reimportar ECD da empresa com plano de contas limpo (sem contas 000000)

### Dados Advocacia Gomes no banco
```sql
-- Já gravados:
nire = NULL, register_org = 'OAB/SP', cod_mun = '3550308', nat_livro = 'G'
ind_esc_cons = 'N', ind_centralizada = '0', tip_ecd = '0', ind_moeda_func = 'N'
```

### Commits desta sessão
- `feat(sped): campos ECD no cadastro empresa + form geracao ECD`
- `feat(qsa): PersonCompany + qualificacaoCvm + assinaEcd + assinaEcf; Company + escritorioContabilId`
- `feat(sped): preview registro 0000 em tempo real no form ECD`

---

## Sessão 29/05/2026 — Company Cadastro/Edição/View + QSA + ContabilTab

### Entregas concluídas

#### RFB Service expandido
- `rfb-client.service.ts` — `formatarDados()` expandida para retornar todos os campos do cartão CNPJ:
  - `cnpj`, `razaoSocial`, `nomeFantasia`, `dataAbertura`
  - `endereco` (com `cep` limpo), `contato`
  - `capitalSocial`, `naturezaJuridica`, `porte`, `situacaoCadastral`, `dataSituacao`
  - `codMun` (código IBGE 7 dígitos)
  - `cnaePrincipal` `{codigo, descricao}`, `cnaesSecundarios[]`
  - `regimeTributario[]` (histórico por ano)
  - `qsa[]` com `nome`, `cpfCnpj`, `qualificacao`, `codigoQualificacao`, `dataEntrada`, `representanteLegal`
  - `simples`, `mei`

#### CompanyForm (cadastro) — reformulado
- Removidos blocos Registro Institucional e SPED/eSocial (ficam só no Edit)
- Dados RFB mapeados: `cnaePrincipal`, `cnaesSecundarios`, `taxRegime` (normalizado com `.replace(/ /g, '_')`), `status` (mapeado ATIVA→active, BAIXADA→inactive)
- QSA exibido como grid read-only após Dados Fiscais
- CNAE Principal e CNAEs Secundárias exibidos como campos read-only

#### CompanyEdit — aba Geral reformulada
- Espelho do CompanyForm com campos editáveis
- `handleRFBData` expandido com todos os campos novos
- QSA exibido como grid read-only

#### CompanyShow — 4 abas completas
- **Geral**: Identificação, Endereço, Contato, Dados Fiscais, QSA
- **Contábil**: Escritório, Contador, Rep. Legal, QSA com status assinaEcd/assinaEcf
- **eSocial**: Em desenvolvimento
- **SPED/ECD**: campos ECD read-only

#### ContabilTab (novo componente)
- `frontend/src/pages/companies/ContabilTab.tsx`
- Seções: Escritório Contábil, Contador Responsável, Representante Legal, Auditor
- Salva via `PUT /accounting/config` com `x-company-id` explícito (não usa empresa ativa)
- Schema `company_accounting_configs` expandido com campos: `escritorioCnpj`, `escritorioNome`, `escritorioCrc`, `escritorioCrcState`, `escritorioEmail`, `escritorioTelefone`, `accountantCpf`

#### PersonLookupField (novo componente reutilizável)
- `frontend/src/components/PersonLookupField.tsx`
- Lookup por CPF (→ `/persons/cpf/:cpf`) ou CNPJ (→ `/companies/taxid/:cnpj`) no `onBlur`
- Quando não encontrado: botão "+ Cadastrar Pessoa/Empresa" com `returnTo` para voltar à aba
- Campo Nome fica read-only quando encontrado, editável quando não encontrado
- `initialFound` prop para pré-marcar como encontrado ao carregar dados existentes
- `returnTo` inclui `?tab=contabil&escritorioCnpj=CNPJ` para preservar contexto

#### QsaVinculoGrid (novo componente)
- `frontend/src/pages/companies/QsaVinculoGrid.tsx`
- Match sócio RFB → Person cadastrada por:
  1. CPF parcial (dígitos visíveis do mascarado `***240219**`)
  2. Fallback: similaridade de nome (>= 50% palavras em comum)
- Status: ✓ Ok / ⚠ Divergência / Não cadastrado
- Checkboxes `assinaEcd` e `assinaEcf` — salvos via `PATCH /persons/links/:id`
- Botão "+ Cadastrar" com `returnTo` para voltar após cadastro

#### Sync automático QSA → PersonCompany
- `company.service.ts` — método `syncQsaLinks(companyId, partners)`
- Chamado automaticamente no `update()` quando `partners` é enviado
- Lógica: extrai dígitos visíveis do CPF mascarado → busca `Person` → cria `PersonCompany` se não existe
- Só cria quando há exatamente 1 match (evita ambiguidade)
- `notes: 'Vinculo criado automaticamente via QSA/RFB'`

#### Endpoint novo
- `GET /persons/links/company/:companyId` — retorna PersonCompany com dados da Person

#### Fix api.ts — respeitar x-company-id explícito
- Interceptor do axios agora verifica `if (!config.headers['x-company-id'])` antes de sobrescrever
- Permite que componentes como `ContabilTab` passem `companyId` explícito sem ser sobrescrito pela empresa ativa

#### Normalização status/taxRegime
- Banco normalizado: `LUCRO PRESUMIDO` → `LUCRO_PRESUMIDO`, `Lucro Real` → `LUCRO_REAL`
- Frontend normaliza ao receber da RFB: `.replace(/ /g, '_')`
- `findAvailable` aceita `status: { in: ['active', 'ATIVA'] }` para não excluir empresas com status legado

#### Fixes diversos
- `SkipCompanyCheck` adicionado em `GET /companies/:id` e `GET /companies/taxid/:taxId`
- Interceptor `company.interceptor.ts`: whitelist expandida com `/companies/[uuid]` pattern
- `CompanyEdit` lê `?tab=` da URL para restaurar aba ativa ao retornar de cadastro

### Aprendizados desta sessão

- **PowerShell heredoc com aspas simples**: usar `@' ... '@` evita interpolação e problemas com caracteres especiais TypeScript. Aspas duplas dentro do heredoc não precisam de escape.
- **WriteAllLines vs Set-Content**: `Set-Content` com `-Value @'...'@` é mais seguro para arquivos TypeScript com JSX do que `WriteAllLines` com array de strings.
- **x-company-id interceptor**: quando um componente precisa operar em empresa diferente da ativa (ex: Master Admin editando empresa cliente), deve passar o header explicitamente E o interceptor deve respeitá-lo.
- **CPF mascarado RFB**: formato `***240219**` — extrair dígitos visíveis com `.replace(/\*/g,'').replace(/\D/g,'')` e usar `String.includes()` para match parcial.
- **JSX quebrado em operações de string**: template literals com backticks se perdem em operações PowerShell `-replace`. Sempre verificar linha por linha após edições.
- **returnTo com tab**: para preservar aba ativa ao navegar para cadastro e voltar, passar `?tab=contabil` no `returnTo`. O componente destino lê `searchParams.get('tab')` e inicializa `useState` com esse valor.

### Pendências mantidas

1. **Grid CompanyTaxRegime** — regime tributário por exercício na aba SPED do CompanyEdit
2. **Preview J930** no CompanyEdit aba SPED (após QSA implementado)
3. **Testar geração ECD Advocacia Gomes** no PGE com todos os novos parâmetros
4. **Fix PersonForm** — erro 500 ao editar nome de Person existente
5. **ContabilTab returnTo** — ao voltar com `?escritorioCnpj=CNPJ`, o lookup automático deve buscar e preencher o nome (pendência menor)
6. **QSA no CompanyForm** — ao criar empresa nova e salvar, `syncQsaLinks` é chamado mas as Persons podem não existir ainda

### Commits desta sessão
- `feat(companies): form cadastro/edicao espelhados - QSA, CNAE, regime tributario, status normalizado`
- `feat(companies): PersonLookupField reutilizavel + ContabilTab + returnTo com tab e cnpj`
- `feat(companies): QsaVinculoGrid com match CPF parcial + checkboxes assinaEcd/assinaEcf`
- `feat(companies): sync QSA auto via RFB + fix api.ts respeitar x-company-id explicito`
- `feat(companies): CompanyShow 4 abas completas - Geral/Contabil/eSocial/SPED`
- `feat(companies): sessao 29/05 - cadastro/edicao/view empresa completos`
