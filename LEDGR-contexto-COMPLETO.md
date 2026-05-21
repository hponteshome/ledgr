# LEDGR — Contexto do Projeto

> Arquivo de referência para novas sessões com Claude.
> Cole o conteúdo deste arquivo no início de cada sessão nova.
> Atualize sempre que um módulo mudar de estado.
> **Última atualização:** 21/05/2026

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

---

## Estrutura de módulos (`apps/api/src/modules/`)

accounting/ controllers/ services/ dto/
assets/ controllers/ services/ — Ativo Imobilizado
finance/ dto/ parsers/
├ finance.service/controller/module
├ accounts-payable.service/controller
├ agenda.service — Agenda Financeira
├ integration.service — AP x Fiscal x Contabil x Agenda ($transaction)
├ provisao.service/controller — Provisoes Recorrentes
├ fechamento.service/controller — Fechamento Mensal
├ bank-import.service/controller/module
├ suggestion.service — motor 3 camadas sugestao de conta
└ parsers/bank-parser.service
hr/ pro-labore.service/controller
informe.service/controller/informe-pdf.service — Informe de Rendimentos
sped/ ecd/ ecf/ efd/
rfb/ — Consulta RFB
signatures/ — Assinaturas digitais (ClickSign, gov.br, A1/A3)
corporate/ — Societario (shareholders, transfers, corporate-pdf)

---

## Models principais

| Model                   | Tabela                     | Observacao                                                                     |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| AccountsPayable         | accounts_payable           | status usa APStatus                                                            |
| ApEntry                 | ap_entries                 | status usa ApEntryStatus                                                       |
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
| AuditLog                | audit_logs                 | actorId, action, targetId, before, after, ip                                   |
| Person                  | persons                    | cpf sem mascara no banco, @SkipCompanyCheck no controller                      |

---

## Estado dos módulos

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
| Sistema — Tabelas Legais             | ✅ Produção    | IRPF 2024/2025/2026 + INSS 2024/2025/2026 + Simulador                    |
| Finance — Doc. Fiscal                | ✅ Funcionando | Integração AP × CT × Agenda via $transaction                             |
| Finance — Contas a Pagar             | ✅ Funcionando | Baixa individual e lote, Aging/Posição AP                                |
| Finance — Agenda Financeira          | ✅ Produção    | PLANNED_PAYMENT ao cadastrar provisão; PAYMENT ao gerar lançamento       |
| Finance — Bank Import                | ✅ Funcionando | Itaú, Bradesco, BB, OFX, CSV, AccountPicker                              |
| Finance — Provisões Recorrentes      | ✅ Produção    | Configs, geração mensal, NF, rateio, favorecido, geraAgenda/geraContabil |
| Finance — Fechamento Mensal          | ✅ Produção    | Bloqueio lançamentos, FECHADO_PREVIO, cascata, auditoria                 |
| RH — Pró-labore                      | ✅ Produção    | INSS/IRRF 2026, GPS, DARF, retroativos                                   |
| RH — Informe de Rendimentos          | ✅ Produção    | Formulário RFB Q3-Q8, preview fiel, PDF Puppeteer, edição, filtro ano    |
| SPED ECD                             | ✅ Produção    |                                                                          |
| Societário                           | ✅ Produção    | Shareholders, transferências, corporate-pdf                              |
| Assinaturas Digitais                 | ✅ Funcionando | ClickSign sandbox, validador ICP-Brasil/gov.br                           |
| Arquivo / Repositório                | ✅ Funcionando | DocumentViewModal, ImportarDocumentoModal                                |
| RFB                                  | ✅ Produção    |                                                                          |
| Finance — Contas a Receber           | 🔲 Pendente    | estrutura preparada (arEntryId nos models)                               |
| Finance — Conciliação AP             | 🔲 Pendente    | apEntryId em BankTransaction já existe                                   |
| Finance — Fluxo de Caixa             | 🔲 Pendente    |                                                                          |
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

## Pendências (ordem de prioridade)

1. **Reimportar ECD LM Administração** — validar saldo anterior 2023-12-31
2. **DocumentViewerModal.tsx** — Societário
3. **Provisões — PIS/COFINS** como partidas contábeis (creditaPisCofins = true)
4. **Finance — Contas a Receber**
5. **Finance — Fluxo de Caixa**
6. **Fase 5 ECD SPED** — gerar arquivo txt, validar PGE
7. **LALUR/LACS** — Fechamento Mensal JSSIA Lucro Real 2025
8. **Selic e IGP-M** — abas pendentes em `IndicadoresPage.tsx`
9. **Excluir empresas de teste** desnecessárias

Horizon:

- Apuração IRPJ/CSLL JOSE SILVA
- Guias DARF IRPJ/CSLL geradas pelo fechamento
- Consulta CPF via Serpro
- Integração gov.br assinatura digital
- ECF parser blocos J/K/L/M/N
- Conciliação AP x Banco
- Livros Societários — Assembleias e Reuniões
- LM Administração — receitas com aluguéis
- Informe de Rendimentos — alimentação automática via folha pró-labore

---

## Padrões técnicos consolidados

- **TDD PowerShell:** inspecionar com `Select-String`/`Get-Content -Index`, alterar com `WriteAllLines`, confirmar. NUNCA bash_tool para arquivos do projeto
- **Encoding legados:** SPED usa `latin1` — `$env:PGCLIENTENCODING = "LATIN1"` antes do psql
- **Timezone Windows:** `Date.UTC(..., 12)` para campos `@db.Date` (evita offset UTC-3)
- **Todos os relatórios:** exclusivamente via `journal_entry_items` — NUNCA misturar com snapshots ECD
- **CPF/CNPJ:** NUNCA gravar formatado — sempre `replace(/\D/g,'')` antes do Prisma
- **Enums Prisma:** strings vazias `""` causam erro — sempre limpar com `v === '' ? null : v`
- **NestJS módulos:** controllers devem ser registrados explicitamente no module
- **`@SkipCompanyCheck()`:** obrigatório em controllers globais (Persons, Companies, Calendar) — importar de `../../multi-company/company.interceptor`
- **Puppeteer:** usar `waitUntil: 'domcontentloaded'` (não `networkidle0` — causa timeout)
- **Download autenticado:** `api.get(url, { responseType: 'blob' }) + URL.createObjectURL`
- **Alertas:** Sweetalert2 com `confirmButtonColor: '#111111'`
- **Modal padrão:** maxHeight: 90vh, overflowY: auto, fechar com Escape/click fora
- **Primeira linha de cada arquivo:** comentada com nome e caminho completo
- **Reescrever vs editar:** sempre reescrever arquivo completo quando há múltiplas duplicatas — edições cirúrgicas só quando o arquivo está limpo

- **Formatação numérica no frontend:** NUNCA type="number" em campos de valor monetário — usar type="text" com fmtBR/parseBR
  - `parseBR(v)` → converte "1.250,00" para 1250 (remove pontos, troca vírgula por ponto)
  - `fmtBR(v)` → converte 1250 para "1.250,00" (toLocaleString pt-BR, 2 casas)
  - `onFocus` → exibe valor bruto (para edição)
  - `onBlur` → aplica fmtBR (formatação visual)
  - Ao salvar → parseBR antes de enviar ao backend
- **CPF/CNPJ display:** sempre formatar na exibição com regex, nunca no banco
  - CPF: `v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')`
  - CNPJ: `v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')`

---

## Informe de Rendimentos — Detalhes

- **Rota:** `/app/hr/informe-rendimentos` · Sidebar: RH → Informe de Rendimentos
- **Schema:** `InformeRendimentos` com campos Q3-Q8 conforme modelo RFB (IN 2.060/2021)
- **@@unique:** `companyId + personId + anoCalendario` — upsert por esta chave
- **PDF:** Puppeteer, cabeçalho esquerdo com nome+CNPJ da empresa (não Ministério da Fazenda), rodapé "Gerado na Plataforma LEDGR"
- **Preview:** `PreviewModal` com layout fiel ao PDF, botão "Gerar PDF"
- **Formulário:** tabela com uma linha por campo, valores com ponto milhar (fmtBR/parseBR), CPF formatado após lookup
- **Busca beneficiário:** `GET /persons/document/:cpf` — ao não encontrar, botão "+ Cadastrar pessoa"
- **Filtro listagem:** select com "Todos" + últimos 5 anos
- **Edição:** botão ✏️ Editar reabre `InformeModal` com dados preenchidos, usa `PUT /hr/informes/:id`
- **`upsert` service:** desestrutura `person, company, companyId, createdById, createdAt, updatedAt, id` antes do `...clean` para evitar campos relacionais no update

---

## Agenda Financeira — Fluxo

- **Ao cadastrar/editar provisão:** `gerarAgendaPlanejada()` cria `AgendaEvent` tipo `PLANNED_PAYMENT` para todo o período
- **Ao gerar lançamentos:** evento `PLANNED_PAYMENT` atualizado para `PAYMENT` + `apEntryId` vinculado
- **`AgendaEvent.provisaoConfigId`:** campo para vincular evento à config de provisão
- **Token:** `@ledgr:token` no `useAgenda.ts`

---

## Layout — Comportamento

- **Loading global:** `CompanyContext.loading === true` → tela de spinner "Conectando ao servidor..." cobre toda a UI
- **Sem autenticação:** banner amarelo fixo abaixo do header avisando que o usuário precisa fazer login
- **Header:** quando `!user` exibe formulário de login inline; quando `user` exibe nome + dropdown com My Profile e Sign Out
- **Guard de rotas:** `ProtectedRoute` nas rotas — responsável por redirecionar para login

---

## Provisões Recorrentes — Detalhes

- **Favorecido:** lookup CPF/CNPJ no `onBlur`
- **Draft localStorage:** `@ledgr:provisao_draft`
- **`geraContabil`:** controla se gera `JournalEntry`
- **`geraAgenda`:** controla se gera `AgendaEvent`

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
