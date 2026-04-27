# LEDGR — Contexto do Projeto

> Arquivo de referência para novas sessões com Claude.
> Cole o conteúdo deste arquivo no início de cada sessão nova.
> Atualize sempre que um módulo mudar de estado.

---

## Stack

- **Monorepo:** `D:\Projetos\Ledgr`
- **Backend:** NestJS + Prisma + PostgreSQL (`ledgr_app` na porta 5432)
- **Frontend:** React + TypeScript + Vite (porta 5173)
- **Auth:** JWT · token em `@ledgr:token` · empresa em `@ledgr:activeCompany`
- **API client:** axios em `apps/web/src/services/api.ts` · interceptor injeta `x-company-id` automaticamente
- **Upload de arquivo:** usar `fetch` direto (não axios) — axios corrompe multipart boundary

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
ApEntryStatus:     OPEN | PAID | OVERDUE | PARTIALLY_PAID | CANCELLED | SCHEDULED
APStatus:          OPEN | PARTIAL | PAID | OVERDUE | CANCELLED
DocumentStatus:    RASCUNHO | EM_REVISAO | AGUARDANDO_ASSINATURA | ASSINADO | REGISTRADO | ARQUIVADO | CANCELADO
BankCode:          ITAU | BRADESCO | BB | SANTANDER | CAIXA | SICREDI | SICOOB | NUBANK | INTER | GENERIC
AgendaColor:       YELLOW | BLUE | GREEN | RED | ORANGE | PURPLE
AgendaEventType:   PAYMENT | TAX | CLOSING | MEETING | REMINDER | OTHER
FiscalDocumentType: NFE | NFSE | FATURA | DUPLICATA | BOLETO | CONSUMO | OUTROS
IntegrationStatus: PENDING | INTEGRATED | ERROR | MANUAL
BankImportStatus:  PENDING | CLASSIFIED | POSTED | IGNORED | RECONCILED
TransactionType:   DEBIT | CREDIT
source_module:     (enum existente no schema — usado em JournalEntry)
```

---

## Estrutura de módulos (`apps/api/src/modules/`)

```
accounting/      controllers/ services/ dto/   — Contabilidade, Plano de Contas, Lançamentos
assets/          controllers/ services/ dto/   — Ativo Imobilizado
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

| Model              | Tabela                | Observação                                                           |
| ------------------ | --------------------- | -------------------------------------------------------------------- |
| `AccountsPayable`  | `accounts_payable`    | status usa `APStatus` (não `ApEntryStatus`)                          |
| `ApEntry`          | `ap_entries`          | model antigo, status usa `ApEntryStatus`                             |
| `AgendaEvent`      | `agenda_events`       | campo obrigatório: `createdById`                                     |
| `FiscalDocument`   | `fiscal_documents`    | campo obrigatório: `createdById` · status: `DocumentStatus`          |
| `BankStatement`    | `bank_statements`     | novo (migrado em 22/03/2026)                                         |
| `BankTransaction`  | `bank_transactions`   | novo                                                                 |
| `BankImportRule`   | `bank_import_rules`   | motor de aprendizado                                                 |
| `JournalEntry`     | `journal_entries`     | campo: `date` (não `entryDate`) · `sourceModule` (não `isAutomatic`) |
| `JournalEntryItem` | `journal_entry_items` | campos: `accountId`, `type`, `value`                                 |
| `AuditLog`         | `audit_logs`          | campos: `actorId`, `action`, `targetId`, `before`, `after`, `ip`     |

---

## Estado dos módulos

| Módulo                     | Status         | Observações                                       |
| -------------------------- | -------------- | ------------------------------------------------- |
| Accounting                 | ✅ Produção    | Plano de Contas, Lançamentos, Balancete, Saldos   |
| Finance — Doc. Fiscal      | ✅ Funcionando | Integração AP × CT × Agenda via $transaction      |
| Finance — Contas a Pagar   | ✅ Funcionando | Baixa individual e lote, Aging/Posição AP         |
| Finance — Agenda           | ✅ Funcionando | Calendário post-its, recorrência                  |
| Finance — Bank Import      | ✅ Funcionando | Itaú, Bradesco, BB, OFX, CSV · sugestão 3 camadas |
| SPED ECD                   | ✅ Produção    |                                                   |
| Ativo Imobilizado          | ✅ Produção    |                                                   |
| Societário                 | ✅ Produção    |                                                   |
| RFB                        | ✅ Produção    |                                                   |
| Finance — Contas a Receber | 🔲 Pendente    | estrutura preparada (arEntryId nos models)        |
| Finance — Folha RH         | 🔲 Pendente    | estrutura preparada (payrollId nos models)        |
| Finance — Conciliação AP   | 🔲 Pendente    | apEntryId em BankTransaction já existe            |
| Finance — Fluxo de Caixa   | 🔲 Pendente    |                                                   |

---

## Pendências documentadas

1. **`agenda.service.ts`** — `create()` e `generateRecurringSeries()` exigem `createdById: userId`
2. **`integration.service.ts`** — `FiscalDocument.create` e `AgendaEvent.create` exigem `createdById: userId` · status inicial: `'RASCUNHO'` (não `'ACTIVE'`)
3. **`filter-ap.dto.ts`** — deve ter campos `dueDateFrom`, `dueDateTo`, `aging` (já corrigido)
4. **Bank Import — tela de classificação** — campos de conta contábil precisam ser conectados ao autocomplete do Plano de Contas

---

## Arquivos de referência úteis para colar em sessões específicas

- Schema de um model específico → cole só o trecho relevante
- Erros de compilação → cole o output do terminal
- Novo módulo → informe nome, stack e o que já existe de similar

---

## Como usar este arquivo

**Início de sessão simples** (bug fix, pequena feature):

> Cole apenas as seções "Stack", "Convenções" e "Estado dos módulos"

**Início de sessão de desenvolvimento** (novo módulo, feature grande):

> Cole o arquivo inteiro + o trecho do schema dos models envolvidos

**Não precisa colar:**

> O schema.prisma completo — peça trechos específicos quando necessário

Registrado. O padrão operacional fica assim para todas as sessões LEDGR:
Inspeção cirúrgica antes de qualquer leitura:

Select-String -Pattern "..." para localizar trechos específicos
ForEach { $\_.Split('|')[1] } | Sort-Object -Unique para inventariar registros
Get-Content -TotalCount 20 para ver cabeçalho de arquivo
Measure-Object para contar linhas antes de abrir qualquer coisa

Handoff entre sessões:

.md colado inline no chat — nunca DOCX anexado
Custo: ~400 tokens vs ~4.000 do DOCX

Próxima sessão (ECF parser):
Cole o LEDGR-contexto.md atualizado + a tabela de layout RFB que você já tem. Com a inspeção via PowerShell do arquivo real, o parser dos blocos J/K/L/M/N sai em uma passagem só.

# LEDGR — Design System

> Adicionar esta seção ao LEDGR-contexto.md
> Aprovado em 22/03/2026

---

## Estilo geral: Clean Minimalista

- Superfícies brancas, sem gradientes, sem sombras decorativas
- Bordas `0.5px solid #E5E7EB` — finas e discretas
- Tipografia em dois pesos apenas: `400` regular e `500` médio — nunca 600/700
- Whitespace generoso como elemento de design
- Cantos levemente arredondados em todos os componentes

---

## Tokens de espaçamento e radius

| Token        | Valor   | Uso                        |
| ------------ | ------- | -------------------------- |
| radius-sm    | 6px     | Inputs, pills, badges      |
| radius-md    | 10px    | Cards, botões, KPIs        |
| radius-lg    | 14px    | Modais, painéis, drawers   |
| border       | 0.5px   | Todas as bordas            |
| border-color | #E5E7EB | Cor padrão de bordas       |
| surface      | #F9FAFB | Background de páginas/KPIs |

---

## Paleta de cores — identidade por módulo

| Módulo            | Accent principal | Surface (bg claro) | Texto sobre surface |
| ----------------- | ---------------- | ------------------ | ------------------- |
| Financeiro        | `#0369A1`        | `#F0F9FF`          | `#075985`           |
| Contábil          | `#2563EB`        | `#EFF6FF`          | `#1D4ED8`           |
| SPED              | `#7C3AED`        | `#FAF5FF`          | `#6D28D9`           |
| Ativo Imobilizado | `#EA580C`        | `#FFF7ED`          | `#C2410C`           |
| Societário        | `#0891B2`        | `#ECFEFF`          | `#0E7490`           |
| RFB / Tax         | `#0F766E`        | `#F0FDFA`          | `#115E59`           |
| Primário (UI)     | `#111111`        | `#F9FAFB`          | `#374151`           |

---

## Status pills — padrão global

| Status       | Background | Texto                         |
| ------------ | ---------- | ----------------------------- |
| Pago         | `#F0FDF4`  | `#15803D`                     |
| Vencido      | `#FEF2F2`  | `#B91C1C`                     |
| Pendente     | `#FEFCE8`  | `#854D0E`                     |
| Integrado    | `#EFF6FF`  | `#1D4ED8`                     |
| Rascunho     | `#F9FAFB`  | `#374151` (+ borda `#E5E7EB`) |
| Parcial      | `#FFF7ED`  | `#C2410C`                     |
| Assinado     | `#FDF4FF`  | `#7E22CE`                     |
| Cancelado    | `#FEF2F2`  | `#991B1B`                     |
| Classificado | `#F0F9FF`  | `#075985`                     |

---

## KPI Cards

```
background: #FFFFFF
border: 0.5px solid #E5E7EB
border-radius: 10px
padding: 14px 16px

label:  font-size 11px · uppercase · #9CA3AF · letter-spacing 0.3px
valor:  font-size 22px · font-weight 500 · #111111
sub:    font-size 12px · #9CA3AF
trend+: font-size 12px · font-weight 500 · #16A34A (↑ positivo)
trend-: font-size 12px · font-weight 500 · #DC2626 (↓ negativo)
```

---

## Botões

```
Primário:  background #111111 · color #fff · radius 8px · padding 8px 18px
Secundário: background #fff · border 0.5px #D1D5DB · color #374151
Ghost:     background transparent · border 0.5px accent-color · color accent
```

---

## Tabelas

```
th: background #F9FAFB · color #6B7280 · font-size 11px · uppercase
    border-bottom 0.5px #E5E7EB · padding 10px 14px
td: color #374151 · border-bottom 0.5px #F5F5F5 · padding 10px 14px
tr hover: background #FAFAFA
```

---

## Navegação lateral — item ativo

```
ativo:   background accent-surface · color accent · font-weight 500 · radius 8px
inativo: color #6B7280
hover:   background #F9FAFB
```

---

## Badge de módulo

```html
<span
  style="
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600;
  padding: 4px 12px; border-radius: 20px;
  background: {surface}; color: {accent}
"
  >◆ {NomeMódulo}</span
>
```

---

## Regras de uso

- Nunca usar verde (`#16A34A`) como accent de módulo — reservado para status "Pago/Sucesso"
- Nunca usar vermelho (`#DC2626`) como accent — reservado para status "Vencido/Erro"
- Cada módulo usa seu accent **apenas** em: nav ativo, badge, botão primário, KPI de destaque
- Tabelas, inputs e modais são sempre neutros (sem accent) — identidade só no header/nav
- Bordas nunca com `border-radius` em lados únicos (ex: só `border-left`) — usar `border-radius: 0`

## Correções 22/03/2026 (sessão 2)

### Sidebar — Accounting

- `SideBar.tsx`: path "Plano de Contas - Manutenção" corrigido para
  `/app/accounting/accounts?action=maintenance`
- `AccountsPage.tsx`: adicionado `useLocation` + `useEffect` que lê
  `?action=maintenance` e abre `showMaintenanceModal` automaticamente

### Design System aprovado

- Estilo: Clean Minimalista
- Accent Financeiro: #0369A1 (Azul céu)
- Tokens documentados em LEDGR-design-system.md
- FinancePage.tsx e BankImportPage.tsx reescritos com novo design

### Pendente para próxima sessão

- Aplicar design system nos demais módulos (Accounting, SPED)
- Parser ECF: reescrever com layout oficial RFB (tabela já enviada)
- Encoding ECF: latin1 em vez de utf-8
  Na primeira linha de cada arquivo vem o nome do arquivo com caminho completo, prrecedido de "//"
  sempre que possível, indicar linha/conteúdo anterior e posterior do bloco a ser substituído;
  ////////////////////////////////////////////
  Arquivos tem primeira linha comentada com respectivo nome e caminho completo;
  Ao propor uma alteração, indicar entre quais trechos/linhas deve ser implementada;
  Números são tratados sem formatação, máscaras são aplicadas na exibição, formatação aplicada ao digitar nos campos de formulários;

---

## Sessão 18/04/2026 — Módulo Societário + Assinaturas Digitais

### Módulo de Livros Societários (COMPLETO ✅)

**Backend:** `apps/api/src/modules/corporate/`
- `ShareholderRecord` + `ShareTransfer` — schema Prisma implementado
- `shareholders.service.ts` — findAll, findOne (com transfersAsFrom/AsTo), create, update, softDelete, getCapitalSummary, recálculo automático de percentOwned em toda transferência
- `transfers.service.ts` — create em $transaction atômica, averbar, recálculo percentOwned
- `corporate-pdf.service.ts` — template HTML completo conforme IN DREI 82/2021:
  - Termo de abertura
  - Quadro resumo geral de titulares
  - Bloco individual por titular com movimentações (formato razão)
  - Seção de averbações
  - Campo observações
  - Nota legal + linhas de assinatura
- `company.service.ts` + `company.controller.ts` — adicionado `findByTaxId()` e `GET /companies/taxid/:taxId`

**Frontend:** `frontend/src/pages/corporate/shareholders/`
- `ShareholdersPage.tsx` — Livro de Registro + Livro de Transferência
  - KPIs: titulares ativos, total quotas/ações, capital social, transferências/averbadas
  - Livro de Registro: tabela com extrato expansível por titular (formato razão com movimentações)
  - Livro de Transferência: tabela com detalhe expansível por lançamento
  - Componente `HolderExtratoRow` — extrato com Entrada/Saída/Saldo por titular
- `ShareMovementModal.tsx` — modal 3 passos para adição e alienação
  - Lookup CPF → `/persons/cpf/:cpf`
  - Lookup CNPJ → `/companies/taxid/:cnpj`
  - Detecção automática PF/PJ
  - Link "Cadastrar Pessoa/Empresa →" abre nova aba com CPF/CNPJ pré-preenchido

**Empresa de teste societário:** F5 PARTICIPACOES S/A (CNPJ 33652701000164, UUID 30437192-bfe5-4344-8407-b758d7382153)
**Titulares atuais:** Helenilto Pontes (50%) + J.A.A.H. EMPREENDIMENTOS IMOBILIARIOS LTDA (50%)
**Transferência registrada:** 29/03/2026 — Alienação 50.000 ON — Averbada em 17/04/2026

---

### Módulo de Assinaturas Digitais (EM DESENVOLVIMENTO)

**Backend:** `apps/api/src/modules/signatures/`
- `certificates.service.ts` — upload/gerenciamento de certificados A1 (.pfx), criptografia AES-256-GCM
- `signature.service.ts` — assinatura A1 server-side, fluxo gov.br
- `govbr.service.ts` — OAuth2 com PKCE, cache seguro em memória (TTL 10min, one-time use, rate limiting por IP, audit log)
- `clicksign.service.ts` — integração ClickSign API v1 (upload PDF, signatários, sequenciamento)
- `signatures.controller.ts` — endpoints REST completos
- `signatures.module.ts` — módulo registrado no AppModule

**Endpoints registrados:**
- `GET/POST/DELETE /signatures/certificates`
- `GET/POST /signatures/documents/:id/signers`
- `POST /signatures/documents/:id/sign/govbr/init`
- `GET /signatures/govbr/callback`
- `POST /signatures/documents/:id/clicksign/request`
- `POST /signatures/clicksign/webhook`
- `GET /signatures/documents/:id/clicksign/download`
- `GET /signatures/documents/:id/status`

**Frontend:** `frontend/src/pages/documents/signatures/`
- `SignatureList.tsx` — lista documentos reais do banco, status ClickSign por signatário
- `SignatureRequest.tsx` — formulário com seleção de documento, signatários, método de autenticação (email/sms/whatsapp/pix/icp), prazo

**Credenciais configuradas em `D:\Projetos\Ledgr\.env` (raiz do monorepo):**
- `CLICKSIGN_ACCESS_TOKEN=ec9253f7-c8d4-40a6-a188-9c01ba381e0f` (sandbox)
- `CLICKSIGN_BASE_URL=https://sandbox.clicksign.com`
- `CLICKSIGN_WEBHOOK_SECRET=JSUsm4MKXN4S9jMpyPZu/aHhm1w1KohYOVTGs4EPwds=`
- `GOVBR_*` — variáveis preparadas, aguardando credenciais OAuth2

**Status ClickSign:** Funcionando em sandbox — documento criado, signatários adicionados, e-mail enviado automaticamente

---

### Próxima fase — Assinatura de Livros Societários

**Opção A (ideal):** Signatários acessam LEDGR + autenticam com gov.br + assinam — requer credenciais OAuth2 (cadastro em andamento em https://acesso.gov.br/roteiro-tecnico)

**Opção B (MVP sem custo):**
1. Visualização do Livro em HTML na plataforma
2. Botão "Gerar PDF" para download
3. Signatário assina externamente com certificado
4. Upload do PDF assinado de volta para a plataforma
5. LEDGR armazena + SHA-256 + atualiza status → ASSINADO

---

### Lembretes técnicos importantes

- **`.env` correto:** `D:\Projetos\Ledgr\.env` (raiz do monorepo) — NestJS usa `envFilePath: join(process.cwd(), '../../.env')`
- **API iniciada de:** `D:\Projetos\Ledgr\apps\api` com `npm run start:dev`
- **ClickSign campo auth:** usar `auths: ["email"]` (array), não `auth_action`
- **ClickSign sequenciamento:** usar `group: order` (não `sequence`)
- **ClickSign activate:** não existe endpoint `/activate` — documento fica ativo automaticamente
- **CompanyId localStorage:** armazenado como objeto JSON `{id, legalName, ...}` — extrair com `JSON.parse(...).id`

---

## Sessão 19/04/2026 — Validador de Assinaturas + Repositório/Arquivo

### Validador de Assinaturas Digitais (COMPLETO ✅)

**Backend:** `apps/api/src/modules/signatures/signature-validator.service.ts`
- Extração de assinaturas PKCS#7/PAdES/CAdES do PDF via regex `/Contents <hex>`
- 4 abordagens de parsing em cascata: node-forge messageFromAsn1 → ASN.1 recursivo → bytes brutos → texto legível
- Detecção de tipo: ICP-Brasil (ITI, SERPRO, Certisign, SERASA, etc.) vs gov.br vs OTHER
- Extração de CPF do CN (formato `NOME:CPF11DIGITOS`)
- Registro no banco: atualiza status do documento + cria DocumentSignature + AuditLog
- Testado com PDF real com 3 signatários ICP-Brasil — todos detectados corretamente

**Endpoint:** `POST /signatures/validate` (multipart/form-data, campo `pdf`)

**Frontend:** `SignatureValidateModal.tsx`
- Modal de upload → validação → resultado com signatários, badges ICP-Brasil/gov.br, validade
- Botão "Validar Assinatura" na `SignatureList.tsx`
- URL corrigida para `http://localhost:3000/signatures/validate`

---

### Módulo Arquivo — Repositório de Documentos Finalizados (COMPLETO ✅)

**Conceito implementado:**
- **Escrituração** (documentos vivos) → ficam nos módulos específicos (Societário, Accounting, etc.)
- **Arquivo** (documentos finalizados/assinados) → repositório central de custódia

**Frontend:** `frontend/src/pages/documentos/RepositorioPage.tsx`
- Página única serve todas as prateleiras via `SHELF_CONFIG` mapeado por URL
- Filtro por status (Rascunho, Em Revisão, Ag. Assinatura, Assinado, Registrado, Arquivado)
- Ações por documento: Visualizar, Baixar PDF, Validar Assinatura (abre SignatureValidateModal)
- Filtra automaticamente por tipos de documento da prateleira

**Prateleiras implementadas:**
- `/app/arquivo/societario/*` — Contratos/Estatutos, Atas, Procurações, Acordos, Livros Encerrados
- `/app/arquivo/contabil/*` — Balancetes Aprovados, ECDs Assinados, Demonstrações
- `/app/arquivo/fiscal/*` — ECFs Assinados, Obrigações Acessórias
- `/app/arquivo/rh/*` — Contratos de Trabalho, Procurações, Acordos Coletivos

**Menu SideBar.tsx reorganizado:**
- Societário → escrituração ativa (Apresentação, Estatuto, Contrato, Livros e Registros)
- Arquivo → repositório de finalizados (todas as prateleiras)
- Sem duplicatas

**Documentos de teste criados (F5 PARTICIPACOES S/A):**
- Contrato Social (ASSINADO)
- Ata AGO 2023 (ASSINADO)
- Ata AGE 2026 (AGUARDANDO_ASSINATURA)
- Procuração Helenilto (ASSINADO)
- Acordo de Acionistas (RASCUNHO)
- Livro de Registro de Ações 2019 (REGISTRADO)
- Livro de Transferência de Ações 2026 (ASSINADO)
- Livro de Atas AGO 2024 (ASSINADO)

---

### Rotas adicionadas em `routes/index.tsx`
Todas as rotas `/app/arquivo/*` registradas apontando para `RepositorioPage`

---

### Pendências
- Botão "Visualizar" na RepositorioPage — abrir documento em HTML/PDF inline
- Botão "Baixar PDF" — conectar ao endpoint `/documents/:id/pdf`
- Regra automática: documento com status ASSINADO aparece no Arquivo automaticamente
- Rotas `/app/arquivo/*` precisam ser adicionadas também no `routes/index.tsx` (verificar)

---

## Sessão 22/04/2026 — Arquivo/Repositório + Importação de Documentos

### Módulo Arquivo (COMPLETO ✅)

**Conceito implementado:**
- Escrituração (documentos vivos) → módulos específicos
- Arquivo (documentos finalizados) → repositório central de custódia

**Frontend:**
- `RepositorioPage.tsx` — prateleiras por URL, filtro por status, data com hora (createdAt)
- `DocumentViewModal.tsx` — visualiza HTML gerado ou PDF importado via iframe
- `ImportarDocumentoModal.tsx` — upload em 3 passos: tipo → arquivo → detalhes
  - Select agrupado por categoria com indicação da prateleira destino
  - Validação de assinatura opcional ao importar
  - SHA-256 exibido na confirmação

**Backend:**
- `POST /documents/import-signed` — importa PDF, salva em disco, detecta assinatura
- `GET /documents/:id/preview` — retorna HTML para visualização inline
- Arquivos salvos em `apps/api/uploads/` servidos em `http://localhost:3000/uploads/`

**Menu SideBar reorganizado:**
- Societário → escrituração ativa
- Arquivo → Societário, Livros Societários, Contábil, Fiscal, RH/Trabalhista

### Pendências
- Documentos importados antes da correção do storage mostram [PDF importado] — reimportar
- Validação automática ao importar (checkbox funcional, lógica de detecção OK)
- Visualização do PDF real para documentos gerados pelo LEDGR (Puppeteer → PDF inline)

---

## Sessão 23/04/2026 — LM Administração + Balancete + Arquivo

### Método de trabalho: Terminal Driven Development (TDD)
- Inspecionar antes: `Select-String` ou `Get-Content | Select-Object -Index`
- Alterar por índice de linha: `$lines[0..N] + $newBlock + $lines[M..]`
- Confirmar ao final de cada bloco com `Select-String` ou loop `for ($i=...)`
- Nunca colar comentários no PowerShell — só comandos executáveis
- Bloco de replace multilinha: usar `$lines[N..M]` nunca `-replace` com here-string

### Correções aplicadas

**ecd-importer.service.ts**
- `importBalances`: agora salva `openingBalance` do primeiro período com `referenceDate = periodStart - 1 dia` (ex: 2023-12-31) para uso como saldo anterior no balancete de verificação
- `importChartOfAccounts`: usa código original do ECD sem `normalizeAccountCode` para o campo `code` (evita distorção da máscara)

**trial-balance.service.ts**
- `getVerificationBalance`: adicionado fallback `i155Map` — quando não há lançamentos anteriores ao período, usa `AccountBalance` (I155) como `previousBalance`

**assets.controller.ts**
- Rotas estáticas (`maintenances`, `maintenances/overdue`, `depreciation/reprocess`) movidas para antes de `:id` — fix do conflito UUID

**SideBar.tsx**
- Item "RFB" removido
- Item "Validação de Assinatura" adicionado (rota `/app/signatures/validate`, ícone `FiShield`)
- Item `viewer/:importId` removido (rota literal causava erro UUID)

**TrialBalanceView.tsx**
- `ClosingPanel` reescrito em layout horizontal com 4 cards: Total do Ativo | Passivo+PL | Resultado | Equilíbrio

### Novas páginas criadas
- `SignatureValidatePage.tsx` — wrapper standalone do `SignatureValidateModal`
- `MaintenancesPage.tsx` — lista todas as OS da empresa, filtro por status, link para ativo
- `SignatureValidatePage` registrada em `routes/index.tsx` e `pages/documents/index.tsx`
- `MaintenancesPage` registrada em `routes/index.tsx`

### Endpoint novo
- `GET /assets/maintenances` — lista todas as manutenções da empresa sem filtro de ativo

### LM Administração de Bens Imóveis Ltda
- CNPJ: 17970759000108
- ECD 2024 importada: 414 contas, 717 saldos, 1319 lançamentos
- Arquivo: `D:\Projetos\Ledgr\ECD_G_2024_LM.TXT`
- **Pendente:** reimportar ECD para gerar saldo 2023-12-31 (openingBalance já implementado)

### Pendências
1. Reimportar ECD LM → validar saldo anterior no balancete de verificação
2. Modal de injeção manual de saldos anteriores
3. `DocumentViewerModal.tsx` completo (abas + sidebar signatários + SHA-256)
4. Fix validador assinatura — múltiplos signatários (parseCertificateFromBytes retorna só 1)
5. Bug `JournalPage.tsx` — remover bloco inline `EcdOpeningModal` duplicado
## Sessão 24/04/2026 — IOB LOTD

Backend: iob-plano-parser, iob-import, iob-lotd-parser, iob-lotd-import, iob-import.controller
Frontend: IobImportModal, IobLotdImportModal, botoes em AccountsPage e JournalPage
Schema: reducedCode em chart_of_accounts + tabela lote_imports
Pendente: deduplicacao por fileName, historico no modal testar

---

## Sessao 26/04/2026 — IOB Multi-arquivo + Viewer + Assinaturas

### IOB Lotes (melhorias)
- Selecao multipla de arquivos (input multiple) — importa todos em sequencia no confirm
- Deduplicacao por fileName — bloqueia reimportacao do mesmo lote
- Parser corrigido: observacao na posicao 232 (sem pipe) — descricoes ricas nos lancamentos
- Totais debitos/creditos + indicador de equilibrio no preview
- Historico de importacoes no modal (busca do banco ao abrir)
- Descricoes corretas apos reimportacao dos lotes LM

### JournalPage (melhorias)
- Toggle 'Mostrar Lancamentos' — lista 100 ultimos em ordem decrescente
- Coluna Historico na tabela de lancamentos
- Data com 4 digitos (dd/mm/yyyy)
- fDate sincronizado com ultimo dia do mes de referencia via useEffect
- BulkDeleteModal implementado (periodo, fontes, dry-run, confirmacao)

### DocumentViewModal (completo)
- Header com badge Societario, status pill, tipo, versao
- Meta bar com data, SHA-256 truncado, numero de registro
- Abas: Documento e Assinaturas
- Viewer HTML (srcDoc) ou PDF (iframe src) conforme fileUrl
- Footer legal LEDGR / MP 2.200-2/2001 / Lei 14.063/2020

### Assinaturas digitais
- signature-validator.service.ts: apos validacao, persiste DocumentSigner por CPF unico (deleteMany + create)
- SignatureValidateModal: guard didValidate.current evita dupla execucao em StrictMode
- Fluxo: documento importado -> aba Assinaturas vazia -> apos Validar -> 3 signatarios persistidos

### Balancetes
- Datas padrao usam ano atual (Get-Date).Year em vez de hardcoded 2025

### Schema / Migrations
- LoteImport model + tabela lote_imports (source, batchType, batchDate, stats)
- reducedCode em ChartOfAccounts
- loteImports LoteImport[] em Company

---

## Git / GitHub

- Repositorio: https://github.com/hponteshome/ledgr (privado)
- Usuario: hponteshome@gmail.com
- Branch principal: main
- Backup ao final de cada sessao:

cd "D:\Projetos\Ledgr"
git add .
git commit -m "descricao das mudancas"
git push
