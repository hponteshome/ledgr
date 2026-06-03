# LEDGR — Contexto do Projeto

> Arquivo de referência para novas sessões com Claude.
> Última atualização: 11/05/2026

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

| Regra | Exemplo |
| --- | --- |
| PK com UUID | `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` |
| Campos snake_case no banco | `@map("created_at")` |
| Timestamps | `@db.Timestamp(6)` |
| Soft delete | campo `deletedAt DateTime? @db.Timestamp(6)` |
| Valores monetários | `Decimal` — NUNCA `Float` |
| companyId | nunca em filtro global — sempre via `request.companyId` (CompanyInterceptor) |
| AuditLog | campos: `actorId`, `action`, `targetId`, `before`, `after`, `ip` |

---

## Enums importantes (já no schema)

- ApEntryStatus: OPEN | PAID | OVERDUE | PARTIALLY_PAID | CANCELLED | SCHEDULED
- APStatus: OPEN | PARTIAL | PAID | OVERDUE | CANCELLED
- DocumentStatus: RASCUNHO | EM_REVISAO | AGUARDANDO_ASSINATURA | ASSINADO | REGISTRADO | ARQUIVADO | CANCELADO
- BankCode: ITAU | BRADESCO | BB | SANTANDER | CAIXA | SICREDI | SICOOB | NUBANK | INTER | GENERIC
- SourceModule: ACCOUNTING | FINANCE | FISCAL | HR | BANK_IMPORT | ECD_IMPORT | INVESTMENT | ASSET
- StatusFechamento: ABERTO | EM_FECHAMENTO | FECHADO_PREVIO | FECHADO | REABERTO
- ModuloFechamento: PROVISOES | PRO_LABORE | RENDA_FIXA | DEPRECIACAO | PIS_COFINS | IRPJ_CSLL
- StatusItemFechamento: PENDENTE | CONFERIDO | GERADO | IGNORADO
- TipoProvisao: ALUGUEL | HONORARIOS | SERVICO | ENERGIA | TELEFONIA | SEGURO | IPTU | OUTRO
- PeriodicidadeProvisao: MENSAL | BIMESTRAL | TRIMESTRAL | SEMESTRAL | ANUAL

---

## Estrutura de módulos (`apps/api/src/modules/`)

- accounting/ — Contabilidade, Plano de Contas, Lançamentos
- assets/ — Ativo Imobilizado
- finance/ — Financeiro
  - finance.service/controller/module
  - accounts-payable.service/controller
  - agenda.service
  - integration.service — AP x Fiscal x Contabil x Agenda ($transaction)
  - provisao.service/controller — Provisoes Recorrentes
  - fechamento.service/controller — Fechamento Mensal com bloqueio de lancamentos
  - bank-import.service/controller/module
  - suggestion.service — motor 3 camadas sugestao de conta
  - parsers/bank-parser.service — Itau, Bradesco, BB, Santander, OFX, CSV
- hr/ — pro-labore.service/controller — Prolabore diretoria, GPS, DARF
- fiscal/ — Fiscal
- sped/ ecd/ ecf/ efd/
- rfb/ — Consulta RFB

---

## Models principais

| Model | Tabela | Observacao |
| --- | --- | --- |
| AccountsPayable | accounts_payable | status usa APStatus |
| ApEntry | ap_entries | model antigo, status usa ApEntryStatus |
| AgendaEvent | agenda_events | campo obrigatorio: createdById |
| FiscalDocument | fiscal_documents | campo obrigatorio: createdById |
| BankStatement | bank_statements | novo |
| BankTransaction | bank_transactions | novo |
| BankImportRule | bank_import_rules | motor de aprendizado |
| JournalEntry | journal_entries | campo: date, sourceModule |
| JournalEntryItem | journal_entry_items | campos: accountId, type, value |
| ProvisaoConfig | provisao_configs | provisoes recorrentes |
| ProvisaoLancamento | provisao_lancamentos | lancamento mensal por provisao |
| ProvisaoRateioConfig | provisao_rateio_configs | rateio variavel por competencia |
| FechamentoMensal | fechamentos_mensais | controle fechamento por competencia |
| FechamentoItem | fechamento_itens | itens por modulo do fechamento |
| ProLaboreConfig | pro_labore_configs | configuracao por diretor |
| ProLaboreCalculo | pro_labore_calculos | calculo mensal INSS/IRRF |
| AuditLog | audit_logs | actorId, action, targetId, before, after, ip |

---

## Estado dos modulos

| Modulo | Status | Observacoes |
| --- | --- | --- |
| Accounting | Producao | Plano de Contas, Lancamentos, Balancete, Saldos |
| Finance Doc. Fiscal | Funcionando | Integracao AP x CT x Agenda via $transaction |
| Finance Contas a Pagar | Funcionando | Baixa individual e lote, Aging |
| Finance Agenda | Funcionando | Calendario post-its, recorrencia |
| Finance Bank Import | Funcionando | Itau, Bradesco, BB, OFX, CSV, AccountPicker |
| Finance Provisoes Recorrentes | Producao | Configs, geracao mensal, conferencia NF, rateio |
| Finance Fechamento Mensal | Producao | Bloqueio lancamentos, FECHADO_PREVIO, cascata, auditoria |
| RH Prolabore | Producao | INSS/IRRF 2026, GPS, DARF, retroativos |
| SPED ECD | Producao | |
| Ativo Imobilizado | Producao | |
| Societario | Producao | |
| RFB | Producao | |
| Renda Fixa | Producao | CDB, lancamentos automaticos, enum INVESTMENT |
| Finance Contas a Receber | Pendente | estrutura preparada (arEntryId nos models) |
| Finance Folha RH | Pendente | estrutura preparada (payrollId nos models) |
| Finance Conciliacao AP | Pendente | apEntryId em BankTransaction ja existe |
| Finance Fluxo de Caixa | Pendente | |

---

## Pendencias (ordem de prioridade)

1. Provisoes — lancamentos PIS/COFINS como partidas contabeis (creditaPisCofins = true)
2. Finance — Contas a Receber
3. Finance — Fluxo de Caixa
4. Reimport LM Administracao ECD — validar Balancete saldo anterior 2023-12-31 (empresa: f00af1b1-d50b-4ae6-aa17-4c2262e058db)
5. Selic e IGP-M — abas pendentes em frontend/src/pages/sistema/IndicadoresPage.tsx

Horizon:
- Apuracao IRPJ/CSLL JOSE SILVA — lancamentos definitivos a partir do Fechamento Mensal
- Guias DARF IRPJ/CSLL geradas pelo fechamento
- Consulta CPF via Serpro
- Integracao gov.br assinatura digital
- ECF parser blocos J/K/L/M/N
- Conciliacao AP x Banco
- Livros Societarios — Assembleias e Reunioes
- LM Administracao — receitas com alugueis

---

## Empresas de teste

| Empresa | CNPJ | UUID | Uso |
| --- | --- | --- | --- |
| JOSE SILVA SOCIEDADE INDIVIDUAL DE ADVOCACIA | 35416962000100 | c188b188-de58-4fbd-8aa0-fcf07c35e65e | Principal — Lucro Real |
| HALLO ADMINISTRACAO E PARTICIPACOES LTDA | 07432458000169 | 06a88dfa-d4cf-4c5c-8dc1-83538d6b8b7c | Testes gerais |
| LM Administracao | — | f00af1b1-d50b-4ae6-aa17-4c2262e058db | ECD import — Balancete |
| F5 PARTICIPACOES S/A | 33652701000164 | 30437192-bfe5-4344-8407-b758d7382153 | Societario — Livros e Assinaturas |

---

## Fechamento Mensal — Regras de negocio

- Fechamento sempre manual, mes a mes
- Status FECHADO_PREVIO quando mes anterior esta em aberto — registrado na auditoria
- Reabrir um mes: cascata em todos os meses posteriores fechados para REABERTO
- Mes corrente exige selecao de motivo (encerramento, cisao, auditoria, judicial, outro)
- JournalEntry.create/update/remove verifica FechamentoMensal — rejeita com BadRequestException se FECHADO ou FECHADO_PREVIO
- Reabertura exige motivo obrigatorio + AuditLog

## Status visual Fechamento

| Status | Cor | Badge |
| --- | --- | --- |
| ABERTO | Cinza | Descanso Em aberto |
| EM_FECHAMENTO | Amarelo | Em fechamento |
| FECHADO_PREVIO | Laranja | Fechamento Previo |
| FECHADO | Verde | Fechado |
| REABERTO | Laranja | Reaberto |

---

## Endpoints principais

### Finance/Fechamento
- GET    /finance/fechamento
- GET    /finance/fechamento/:competencia
- POST   /finance/fechamento/:competencia/calcular
- PUT    /finance/fechamento/itens/:id/conferir
- PUT    /finance/fechamento/itens/:id/ignorar
- POST   /finance/fechamento/:competencia/fechar    (body: motivoMesCorrente?, confirmarPrevio?)
- POST   /finance/fechamento/:competencia/reabrir   (body: motivo)
- GET    /finance/fechamento/:competencia/status

### Finance/Provisoes
- GET/POST /finance/provisoes/configs
- PUT/DELETE /finance/provisoes/configs/:id
- POST   /finance/provisoes/gerar                  (body: competencia)
- GET    /finance/provisoes/lancamentos
- PUT    /finance/provisoes/lancamentos/:id/conferir-nf
- PUT    /finance/provisoes/configs/:id/rateio/:competencia

### HR/Prolabore
- GET/POST /hr/pro-labore/configs
- PUT      /hr/pro-labore/configs/:id
- GET      /hr/pro-labore/previa
- POST/GET /hr/pro-labore/calculos
- POST     /hr/pro-labore/calculos/retroativos
- GET      /hr/pro-labore/calculos/:id/guias
- GET      /hr/pro-labore/calculos/:id/guias/gps.pdf
- GET      /hr/pro-labore/calculos/:id/guias/darf.pdf
- GET      /hr/pro-labore/guias/lote?competencia=AAAA-MM

---

## Padroes tecnicos

- TDD PowerShell: Python scripts em D:\Temp\ para edicoes de arquivos
- SQL via Docker: subprocess.run(['docker','exec','-i','ledgr-postgres','psql','-U','ledgr','-d','ledgr_app','-c', sql])
- Timezone Windows: Date.UTC(..., 12) para campos @db.Date
- Todos os relatorios: exclusivamente via journal_entry_items
- Download autenticado: api.get(url, { responseType: 'blob' }) + URL.createObjectURL
- Alertas: Sweetalert2 com confirmButtonColor: '#111111'
- Modal padrao: maxHeight: 90vh, overflowY: auto, fechar com Escape/click fora
- Primeira linha de cada arquivo: comentada com nome e caminho completo
- Ao propor alteracao: indicar entre quais trechos/linhas deve ser implementada
- Numeros: sem formatacao no banco — mascaras aplicadas na exibicao

---

## Design System

| Modulo | Accent | Surface |
| --- | --- | --- |
| Financeiro | #0369A1 | #F0F9FF |
| Contabil | #2563EB | #EFF6FF |
| SPED | #7C3AED | #FAF5FF |
| Ativo Imobilizado | #EA580C | #FFF7ED |
| Societario | #0891B2 | #ECFEFF |
| RFB/Tax | #0F766E | #F0FDFA |
| RH | #0891B2 | #ECFEFF |
| Primario UI | #111111 | #F9FAFB |

Tokens: radius-sm 6px, radius-md 10px, radius-lg 14px, border 0.5px #E5E7EB, surface #F9FAFB

Botoes:
- Primario: background #111111, color #fff, radius 8px, padding 8px 18px
- Secundario: background #fff, border 0.5px #D1D5DB, color #374151
- Ghost: background transparent, border 0.5px accent, color accent

Tabelas:
- th: background #F9FAFB, color #6B7280, font-size 11px, uppercase, border-bottom 0.5px #E5E7EB
- td: color #374151, border-bottom 0.5px #F5F5F5
- tr hover: background #FAFAFA
## SESSÃO 02/06/2026 — APURAÇÃO DE IMPOSTOS + LALUR

### Entregáveis
- Importação extrato LM 2025: 1.160 lançamentos balanceados (jan-dez)
- DRE LM corrigida: nature = CREDIT nas contas REVENUE
- Schema: ApuracaoImpostos + LalurItem (LP + LR) + campos dedutibilidade em ChartOfAccounts + JournalEntry
- Backend: /apuracao/* (PIS/COFINS/IRPJ/CSLL/LALUR/sugerir/aplicar/DARF preview+PDF)
- Frontend: ApuracaoImpostosPage, LalurConfigPage
- Apuração 12 meses 2025 LM: PIS R.575,98 | COFINS R.981,78 | IRPJ R.190,76 | CSLL R.588,67
- DARF PIS (6912) / COFINS (5856) / IRPJ (2362) / CSLL (2484) com preview iframe + PDF
- Config. Dedutibilidade por conta: DEDUTIVEL | PARCIALMENTE_DEDUTIVEL | NAO_DEDUTIVEL + percDeducao
- Override por lancamento: campo dedutibilidade/percDeducao/lalurObservacao em JournalEntry
- Sugestao automatica LALUR: endpoint sugerir-lalur + aplicar-sugestoes
- Autocomplete contas por nome no formulario de lancamentos

### Pendencias abertas
- Aplicar sugestoes LALUR e recalcular IRPJ/CSLL com lucro real ajustado
- Resumo anual consolidado (tabela 12 meses impostos)
- DARF em lote por periodo
- Prejuizos acumulados LALUR

### Proxima sessao: ECD e ECF
- ECD: revisar I051, implementar J100/J150 (Balanco/DRE no Bloco J)
- ECF: iniciar parser/exportador ECF
- Validar ECD 2025 LM no PGE

### Dados tecnico
- Enum PostgreSQL: TipoApuracao, StatusApuracao criados
- VARCHAR(30) para coluna dedutibilidade (era 20, PARCIALMENTE_DEDUTIVEL tem 22 chars)
- percDeducao: Decimal(5,2) no schema, number simples no controller
