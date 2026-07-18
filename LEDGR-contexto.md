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
## APRENDIZADO CRÍTICO — SPED Encoding (EFD/ECD/ECF)

### Problema
Arquivos SPED (EFD, ECD, ECF) devem ser gravados em **ISO-8859-1 (latin1)**.
O Node.js/NestJS processa strings internamente em UTF-8, causando bytes duplos
para caracteres acentuados (ç, ã, õ, é, etc.) quando o Buffer é criado com 'latin1'.

### Solução obrigatória em TODOS os exportadores SPED
1. Criar metodo 
orm(s: string): string que:
   - Aplica .normalize('NFD') para decompor diacriticos
   - Remove combining marks (\u0300-\u036f)
   - Substitui chars fora latin1 por '?'
2. Aplicar 	his.norm() em TODOS os campos textuais:
   - NOME da empresa (0000)
   - INFO_COMPL (F100, C100, etc.)
   - Nome do contabilista (0100)
   - Historico/descricao de lancamentos
   - Qualquer campo que possa ter texto livre

### Verificacao
Testar com: ytes.filter(b => b > 127) — deve retornar array vazio.
Erro tipico no PVA: NullPointerException: Campo.getValor() causado por
numero incorreto de campos (UTF-8 multibyte corrompe a contagem de pipes).

### Ja implementado
- EFD-Contribuicoes: norm() aplicado em legalName, accountantName, INFO_COMPL F100
- ECD: verificar se tem norm() implementado (provavelmente nao — adicionar na ECF)
## SESSAO 03/06/2026 — EFD-CONTRIBUICOES VALIDACAO PVA

### Status
- Encoding latin1: CORRIGIDO (norm() aplicado, 0 bytes nao-ASCII)
- Registro 0000: CORRIGIDO (13 campos, IND_SIT + NR_REC adicionados, IND_NATU_PJ='00')
- Registro 0110: PARCIALMENTE CORRIGIDO (5 campos mas gerando 6 — verificar)
- Registro F100: CORRIGIDO (17 campos — verificar se gerou 18 ou 17)
- Registros M200/M400/M410/M600/M800/M810: PENDENTE — leiaute incorreto
- Registros 0140/1010: PENDENTE — verificar leiaute

### Pendencia critica
O PVA 6.1.2 rejeita o arquivo com NullPointerException (campo nao encontrado).
Antes de corrigir M200/M400/M410/M600/M800/M810 e 0140/1010:
BAIXAR MANUALMENTE o Guia Pratico EFD-Contribuicoes v1.35 em:
http://sped.rfb.gov.br/pasta/show/1567
e consultar as tabelas de leiaute de cada registro antes de alterar.

### Leiaute M200 (parcialmente confirmado pelo VRI)
- Campo 02: VL_TOT_CONT_NC_PER (soma de M210.VL_CONT_PER nao-cum)
- Campo 03: VL_TOT_CRED_DESC (soma de M100.VL_CRED_DESC)
- Campos 04-11: nao confirmados — CONSULTAR GUIA PRATICO
- M400/M410 sao para receitas ISENTAS/ALIQUOTA ZERO, NAO para receitas tributadas
- Para receitas tributadas nao-cumulativas usar M210

### Commits da sessao
- feat(efd): pagina EFD-Contribuicoes + download Gerar EFD
- fix(efd): encoding latin1 norm() em campos textuais
- fix(efd): 0000 leiaute correto 13 campos IND_SIT NR_REC IND_NATU_PJ
- fix(efd): 0110 5 campos IND_APRO_CRED COD_TIPO_CONT
- fix(efd): F100 17 campos CST_PIS CST_COF corretos
## SESSAO 07/06/2026 — EFD-CONTRIBUICOES VALIDACAO PVA 6.1.2

### Status: APROVADO — 0 erros no PVA 6.1.2

### Correcoes aplicadas
- 0000: 13 campos, IND_SIT + NR_REC, IND_NATU_PJ=00, getCodVer() dinamico
- 0110: dinamico por regime (LR=4 dados sem IND_REG_CUM | LP=5 dados com IND_REG_CUM=9)
- 0140: 9 campos (COD_EST, NOME, CNPJ, UF, IE, COD_MUN, IM, SUFRAMA)
- 0500: gerado automaticamente com contas REVENUE analiticas da empresa
- F100: 19 campos, IND_OPER=1, COD_PART vazio, CST=01, COD_CTA referenciado do 0500
- M200/M600: 13 campos incluindo VL_TOT_CRED_DESC_ANT (campo 04)
- M205/M605: obrigatorios, COD_REC=691201(PIS) / 585601(COFINS) — DCTF 6 digitos
- M210/M610: ordem correta (filhos do M200/M600), 16 campos FG >= 2019
- Bloco 1: vazio (sem processos judiciais)
- Encoding: norm() em legalName, accountantName, conta.name

### Codigos DCTF confirmados na tabela do PVA
- PIS nao-cumulativo:   691201
- PIS cumulativo:       810902
- COFINS nao-cumulativa: 585601
- COFINS cumulativa:    217201
Tabela em: C:\Arquivos de Programas RFB\Programas SPED\EFD-Contribuicoes\recursos\tabelas\SPEDPISCOFINS_VISAO_DCTF*

### Aviso esperado (nao e erro)
- 0900: prazo de entrega ultrapassado (esperado para periodos retroativos)

### Proxima sessao
- Gerar 12 meses 2025 LM em lote
- Testar Lucro Presumido cumulativo
- EFD em lote (endpoint batch)
## SESSAO 08/06/2026 — EFD LP + REGIME TRIBUTARIO

### EFD-Contribuicoes — Correcoes leiaute v1.35
- 0110: 5 campos, dinamico LR/LP (IND_REG_CUM apenas para LP)
- 0140: 9 campos corretos
- 0500: contas REVENUE analiticas da empresa (obrigatorio FG >= nov/2017 LR)
- F100: 19 campos, IND_OPER=1, COD_PART vazio, CST=01, COD_CTA referenciado
- M200/M600: 13 campos incl. VL_TOT_CRED_DESC_ANT
- M205/M605: obrigatorios, COD_REC=691201(PIS) / 585601(COFINS) DCTF 6 digitos
- M210/M610: ordem correta pai->filho, 16 campos FG >= 2019
- Bloco 1: vazio sem processos judiciais
- EFD LM (LR nao-cumulativo): 0 erros PVA 6.1.2

### EFD Lote Anual
- Endpoint GET /sped/efd-contribuicoes/export-lote?ano=2025
- ZIP 12 meses, nome EFD_ano_regime_cnpjraiz.zip
- Tabela status por competencia no frontend
- LM 2025: 12/12 meses OK

### Regime Tributario — company_tax_regimes
- dtFin nullable (sem data fim = vigente)
- Fechar regime anterior automaticamente ao criar novo (dtFin = dtIni_novo - 1 dia)
- Reabrir regime anterior ao remover o mais recente
- Validacao: dtIni >= openingDate da empresa
- Frontend: pre-preenche dtIni com openingDate quando primeiro regime
- Frontend: exibe 'Vigente' quando dtFin nulo
- Prisma v7: filtro null em DateTime usa queryRaw SQL

### Aprendizado critico Prisma v7
- dtFin: null no where -> PrismaClientValidationError
- dtFin: { equals: null } -> PrismaClientValidationError  
- Solucao: this.prisma.queryRaw com SQL IS NULL
- dtFin null no create/update: schema.prisma deve ter DateTime? (com ?)
- npx prisma generate obrigatorio apos cada alteracao de schema

### Proxima sessao
- EFD LP: bloco M cumulativo (M200 campo 09, sem M210/M610, com M400/M410/M800/M810)
- EFD: integrar regime da empresa automaticamente (sem parametro manual)
- ECD: Bloco J (J100/J150 Balanco/DRE)
- ECF: iniciar exportador
## SESSAO 09/06/2026 — EFD LP + REGIME AUTOMATICO

### EFD-Contribuicoes LP (Lucro Presumido Cumulativo) — 0 erros PVA 6.1.2
- Regime automatico via queryRaw: busca company_tax_regimes por periodo
- 0110: COD_INC_TRIB=2, IND_REG_CUM=9 para LP
- F100: CST=01 para LP e LR (tributavel aliquota basica)
- M200/M600: 13 campos, campo09=VL_TOT_CONT_CUM_PER
- M205/M605: nivel 3 do M200/M600, antes do M210/M610, so quando valor > 0
- M210/M610: leiaute pos-2019 com 16 campos (3 novos: VL_AJUS_ACRES_BC, VL_AJUS_REDUC_BC, VL_BC_CONT_AJUS)
- M400/M800: omitidos para LP com CST=01 (so para receitas isentas CST 04/06/07/08/09)
- pisDevidoRnd/cofinsDevidoRnd: valores arredondados para evitar M205/M605 com 0,00
- 0100: corrigido para 14 campos (faltavam CNPJ,CEP,END,NUM,COMPL,BAIRRO,FAX,COD_MUN)
- Guia PDF renomeado para C:\\Temp\\Guia_EFD_Contrib_1.35.pdf para facilitar acesso

### Aprendizados criticos
- M210/M610 tem leiaute diferente pre/pos 2019: pos-2019 tem 16 campos
- M205/M605 sao nivel 3 do M200/M600 (nao do M210/M610)
- M205/M605 so gerar quando valor arredondado > 0
- M400/M800 exigem CST_PIS/CST_COFINS — omitir quando nao ha receitas isentas
- Prisma v7: dtFin DateTime? exige schema com ? e  para filtro IS NULL

### Proxima sessao
- ECD Bloco J (J100/J150 Balanco Patrimonial e DRE)
- ECF exportador

## SESSAO 09/06/2026 — ECD Bloco J + EFD LP

### EFD-Contribuicoes LP (Lucro Presumido Cumulativo) — 0 erros PVA 6.1.2 ✅
- Regime automatico via company_tax_regimes
- M210/M610 leiaute pos-2019: 16 campos
- M205/M605: nivel 3 do M200/M600, antes do M210/M610
- pisDevidoRnd/cofinsDevidoRnd para evitar M205/M605 com 0,00
- 0100 corrigido para 14 campos
- Controller ECD: retorna { buffer, warnings } com X-Ecd-Warnings header

### ECD Bloco J — WIP
- DC correto: saldo = deb-cre, positivo=D, negativo=C (vale para ativo e passivo)
- IND_GRP_BAL: sempre pelo primeiro digito do COD_AGL (1=A, 2=P)
- Codigos no I052 nunca emitidos como T (movidos para D)
- Orphan T removidos quando pai e D
- PENDENTE: pre-validacao no frontend antes de gerar ECD
  - Bloquear geracao se mapeamento de Visoes Contabeis incompleto
  - Codigos com pai ausente no J100 = erro de mapeamento do usuario
  - Avisos obrigatorios: contador, signatarios, regime tributario, NIRE

### Aprendizados criticos ECD Bloco J
- Codigo que consta no I052 = detalhe (D), nunca totalizador (T)
- Totalizador (T) so valido se tiver filhos emitidos no J100
- Pai de detalhe deve ser T — se pai nao existe no J100, erro de mapeamento
- Desbalancamento BP = problema de dados/mapeamento, nao de codigo
- Warnings devem ser expostos via header X-Ecd-Warnings na API

---
## Sessão 11/06/2026 — ECD Pré-Validação + Vínculos Societários

### ECD Pré-Validação (ENTREGUE)
- `ecd-pre-validate.service.ts` — 13 checks (C1-C13, W1-W2, I1-I3)
- `EcdPreValidatePage.tsx` — UI com cards expansíveis por nível (ERROR/WARNING/INFO)
- Endpoint: `GET /sped/ecd/pre-validate?periodStart=&periodEnd=`
- Sidebar: SPED → ECD — Pré-Validação
- LM 2024 testado: de 5 erros críticos para 1 residual (mapeamento contábil)
- `VisoesContabeisPage.tsx` movida para `/pages/sped/`

### Vínculos PersonCompany (ENTREGUE)
- `QsaVinculoGrid`: botão "Vincular" verifica CPF antes de abrir cadastro
- Auto-vínculo ao retornar de cadastro via `?vinculado=CPF` na URL
- `ContabilTab.handleSave`: cria PersonCompany do contador automaticamente ao salvar
- PJ sócia: exibe "PJ — ver rep. legal" sem botão vincular (correto para SPED)

### PRÓXIMA FEATURE — CompanyShareholder (registrado)
Modelo dedicado para QSA societário completo (PF e PJ sócias):
- Nova tabela `company_shareholders` com `shareholderType: PF|PJ`
- `personId?` para PF, `shareholderCompanyId?` para PJ
- Campos: qualificacao, dataEntrada, dataRetirada, participacaoPercent, assinaEcd, assinaEcf
- Migrar QsaVinculoGrid e syncQsaLinks para novo model
- PersonCompany fica exclusivo para vínculos funcionais (contador, rep. legal, auditor)
- Base para organograma societário do grupo (feature futura)

### Fixes ECD mapeamentos LM 2024 (via SQL — replicar pelo frontend)
- Removidos 11 mapeamentos BP com grupo RFB invertido
- Removidos 24 mapeamentos REVENUE/EXPENSE na visão BP
- 8 códigos totalizadores atualizados para nível folha
- Visão DRE 2024 criada (16 mapeamentos automáticos)
- PersonCompany criado para Jose Rozinei (205) e Helenilto/contador (10)


---

## Sessão 12-13/06/2026 — ECD Geração Final + Pendências Gerais

### ECD — Estado atual (13/06/2026)

**Resultado:** 307 erros → 41 erros residuais (todos de dados/mapeamento do contador)

**Commits desta sessão:**
- `45ac30a` — restaurar exporter b41f4bc + assinatura Promise<{buffer,warnings}> + aviso COD_PLAN_REF frontend
- `919f88f` — EcdPreValidatePage ajustes
- `d667970` — I350 apenas com lancamentos encerramento reais
- `3ae5737` — fix assets terreno Cotia
- `6009a28` — sidebar permissoes 3 camadas
- `356b549` — filtro visual sidebar funcional
- `536b59b` — AccountsPayableController registrado no FinanceModule
- `745878f` — tabelas legais migradas para banco
- `0f8c828` — AP status multi-valor + prefixo finance/accounts-payable

**Erros residuais ECD LM 2024 (dados — não código):**
- 2 erros I350: empresa não tem lançamento de encerramento/zeramento
- 3 erros BP desbalanceado: Ativo ≠ Passivo+PL
- 36 erros J100 COD_AGL_SUP vazio: mapeamentos usam códigos L100A em vez de códigos de aglutinação

**Aprendizados críticos ECD (não regredir):**

1. **COD_PLAN_REF no 0000** — NUNCA preencher sem plano referencial L100A/L300A completo no banco.
   Proteção no backend: `codPlanRefFinal = (codPlanRef && i051Map.size > 0) ? codPlanRef : ""`
   Proteção no frontend: aviso laranja quando campo preenchido

2. **i051Map NUNCA copiar i052Map** — são planos diferentes:
   - i052Map: códigos de aglutinação curtos (ex: `1.01.08`) → tabela `rfb_aglutination_codes`
   - i051Map: códigos referenciais L100A (ex: `1.01.01.02.01`) → NÃO importado ainda

3. **I350 condicional** — emitir APENAS quando há lançamentos reais de encerramento.
   Emitir I350 incondicional gera +50 erros "saldo deve ser zero nos meses de encerramento"

4. **Assinatura do exporter** — `Promise<{ buffer: Buffer; warnings: string[] }>` NUNCA `Promise<Buffer>`
   Controller espera `result.buffer` e `result.warnings`

5. **Nome do arquivo** — `ECD_ANO_CNPJRAIZ.txt` gerado no backend via CNPJ do banco.
   CORS: `Content-Disposition` deve estar em `exposedHeaders` no main.ts

6. **i052Map sem filtro de anoBase** — NUNCA filtrar por anoBase na query de AccountingView.
   Causa i052Map vazio quando view.ano_base ≠ período da ECD.

7. **Restaurar exporter via git show** — sempre verificar assinatura do método após restauração.

**Tabela rfb_aglutination_codes (leiaute 9, 2024):**
- 50 BP + 26 DRE = 76 códigos de AGLUTINAÇÃO (Bloco J)
- Plano referencial L100A/L300A (732+213 códigos) NÃO está importado

---

### Sidebar Permissões — Implementado 13/06/2026

**Arquitetura 3 camadas:**
1. Perfil (`profile_sidebar_permissions`) — base por grupo
2. Usuário (`user_sidebar_permissions`) — override individual
3. Empresa (`companyId` nullable) — restrição por empresa

**Tabelas criadas:**
- `sidebar_items` — 40 itens do menu (seed aplicado)
- `profile_sidebar_permissions` — permissão base por perfil
- `user_sidebar_permissions` — override individual com companyId opcional

**Backend:** `SidebarPermissionsModule` registrado no `AppModule`
- `GET /sidebar-permissions/resolve` — retorna paths permitidos para usuário/empresa ativa
- Master Admin (`permissions.all = true`) recebe `['*']` sem consultar banco

**Frontend:**
- Hook `useSidebarPermissions.ts` — wildcard `['*']` para Master Admin (local, sem API call)
- `SideBar.tsx` — `filteredMenu` com fallback `menuItems` quando `allowed.length === 0`
- Desestruturar `allowed` do hook: `const { canView, allowed, loading } = useSidebarPermissions()`
- Página gestão: `/app/sistema/sidebar-permissions`

**Armadilha:** Race condition — `user` é null no primeiro render.
Solução: `if (permLoading || allowed.length === 0) return menuItems`

---

### Tabelas Legais — Migração completa para banco (13/06/2026)

**Antes:** dados hardcoded em `TabelasLegaisPage.tsx` (379 linhas)
**Depois:** consumindo `GET /tabelas-legais/irrf`, `/inss`, `/salario-minimo`

**Dados no banco:**
- `tabela_irrf`: 14 anos (2013-2026), tipos PROGRESSIVA e REDUTOR
- `tabela_inss`: 14 anos (2013-2026), faixas progressivas
- `salario_minimo`: 17 registros históricos

**Estrutura IRRF 2026:** 5 faixas PROGRESSIVA + 7 faixas REDUTOR (Lei 15.270/2025)
- Redutor: até R$5.000 isento, até R$7.350 redutor decrescente, acima sem redução

**Simulador:** dinâmico, calcula calcIRPF e calcINSS com dados do banco

---

### Ativo Imobilizado — Correção terreno Cotia (13/06/2026)

**Problema:** Lote em Cotia com `non_depreciable = false` e `useful_life_months = 480`
**Correção:**
```sql
UPDATE fixed_assets SET non_depreciable = true, useful_life_months = 0
WHERE company_id = 'f00af1b1...' AND description ILIKE '%cotia%';
DELETE FROM asset_depreciation_logs WHERE asset_id = (SELECT id FROM fixed_assets WHERE description ILIKE '%cotia%');
UPDATE fixed_assets SET accumulated_depreciation = 0 WHERE description ILIKE '%cotia%';
```
55 logs de depreciação indevidos removidos.

**Outros ativos pendentes análise do contador:**
- Casa em Guarujá: 480 meses OK (construção deprecia)
- Lote Piraquara: lote+construção juntos — contador deve avaliar separação

---

### Finance — Contas a Pagar (13/06/2026)

**Problema:** `AccountsPayableController` não estava no `FinanceModule`
**Correção:** registrado em `finance.module.ts`

**Prefixo:** `@Controller('finance/accounts-payable')` — rota: `/finance/accounts-payable`

**Status multi-valor:** Dashboard envia `status=OPEN,OVERDUE` como string.
`buildWhere` corrigido com split:
```typescript
const statuses = filters.status.split(',').map(s => s.trim());
where.status = statuses.length === 1 ? statuses[0] as any : { in: statuses } as any;
```

---

### Pendências atualizadas

**Prioritárias:**
- ECD LM 2024: reimportar para gerar saldo anterior 2023-12-31
- Visões Contábeis LM: corrigir mapeamentos (códigos L100A → códigos de aglutinação)
- ECD plano referencial L100A/L300A: importar 732+213 códigos
- Dashboard: reconstruir com dados reais por perfil (pendência original)

**Backlog:**
- ECF parser completo
- Lançamentos depreciação automáticos no backfill
- Cron job mensal de depreciação
- eSocial eventos completos
- EFD-Contribuições no sidebar (hoje disabled: true)
- Sidebar: testar filtro com usuário não-Master-Admin



---

### Dashboard - Por perfil implementado (14/06/2026)

**Mudanca:** DashboardPage.tsx agora usa useSidebarPermissions() (mesmo hook do SideBar.tsx).

  const show = (path: string) => permLoading || allowed.length === 0 || canView(path);

Fallback identico ao SideBar: enquanto allowed vier vazio (hoje profile_sidebar_permissions
tem 0 linhas, todo perfil nao-Master-Admin recebe allowed=[]), show() retorna true pra tudo -
ou seja, NENHUMA mudanca visual hoje. A filtragem real entra em vigor automaticamente quando
profile_sidebar_permissions for configurado por perfil (tela /app/sistema/sidebar-permissions).

**Mapeamento widget -> path:**

  KPI Contas a pagar              -> /app/finance/accounts-payable
  KPI Contas a receber             -> /app/finance/contas-receber
  KPI NFs pendentes                -> /app/finance/fiscal-documents
  KPI Lancamentos contabeis         -> /app/accounting/journal
  KPI Fechamento mensal             -> /app/finance/fechamento
  KPI Aguard. assinatura            -> /app/arquivo (rota real: /app/arquivo/societario,
                                        nao existe em sidebar_items, usado o path pai)
  Agenda (cronograma)               -> /app/finance/agenda
  ObrigacoesWidget                   -> /app/sistema/obrigacoes
  Paineis inferiores (7 dias+Aging) -> AP e/ou AR (qualquer um libera o painel)
  Abas do Aging (A Pagar/Receber)   -> filtradas individualmente por path

tsc --noEmit: sem erros em DashboardPage.tsx.

Obs: grid de KPIs e fixo em repeat(3, 1fr) - quando a filtragem real entrar em vigor com
menos de 6 cards, vai sobrar espaco vazio na ultima linha (cosmetico, ajustar se incomodar).

---

### Pendencias atualizadas (14/06/2026)

**Prioritarias:**
- Configurar profile_sidebar_permissions para Operador/Visualizador (dados/admin via
  /app/sistema/sidebar-permissions, nao codigo) - so assim o "por perfil" do Dashboard
  fica visivel na pratica
- LedgrHome.tsx (deslogado) - ainda nao avaliado (outra metade da pendencia original
  "dashboards logado + deslogado")

**Backlog:**
- Avaliar buildStaticAgenda (linhas 51-83 do DashboardPage.tsx) - agenda fiscal hardcoded
  com datas genericas, possivelmente redundante com ObrigacoesWidget (que ja cobre
  obrigacoes reais via /finance/obrigacoes)

---

## Sessao 2026-06-14 (cont.) - Testes de usuario por perfil + RBAC real (ProfileGuard)

### Concluido
- Fix users.service.ts updateUser: "level: data.level" (string do form) causava PrismaClientValidationError (500) ao salvar usuario via UserForm. Corrigido p/ "Number(data.level)" com fallback undefined (preserva changeStatus/deactivate que nao enviam level).
- Fix UserForm.tsx: campo Email com autoComplete="off" (Chrome estava autopreenchendo o email do Visualizador Teste com "ver@ledgr.com" ao salvar, quebrando o login - 401).
- Email do usuario Visualizador Teste corrigido no banco: "ver@ledgr.com" -> "visualizador.teste@ledgr.local".
- Confirmado: login + Dashboard "por perfil" funcionam para Visualizador Teste (acesso total - profile_sidebar_permissions ainda vazia, fallback libera tudo).
- Descoberto: users.controller.ts e profiles.controller.ts JA tinham @UseGuards(JwtAuthGuard, ProfileGuard) + @RequirePermission('users_view'|'users_edit'|'users_delete'|'profiles_edit'|'profiles_delete'), mas profiles.permissions usa chaves genericas {read,write,delete} -> mismatch fazia QUALQUER acao de perfis nao-master (Operador/Visualizador) retornar 403, inclusive GET /users.
- Fix profile.guard.ts: fallback - se a permissao especifica (ex: 'users_edit') nao existe no perfil, cai pra generica via sufixo (_view/_list->read, _create/_edit/_update->write, _delete->delete). Ativa RBAC real p/ Usuarios/Perfis sem afetar Master (permissions.all===true continua bypassando tudo).
- Fix api.ts: interceptor de resposta agora trata 403, mostra toast com error.response.data.message (fallback "Acao nao permitida para o seu perfil.").
- Validado: Visualizador Teste (read:true,write:false,delete:false) -> GET /users lista normal (fallback read), PATCH /users/:id -> 403 + toast + banner inline com mensagem real do backend "Voce nao tem permissao para executar esta acao.".
- Commit a013900 (pushed): users.service.ts, profile.guard.ts, UserForm.tsx, api.ts.
- Fase 1 frontend: useSidebarPermissions.ts canView() agora aceita prefixo de secao (/app/users/edit/:id cai sob /app/users). routes/index.tsx ProtectedRoute checa canView(location.pathname) e renderiza novo componente AccessDenied ("Acesso Restrito") quando allowed.length>0 && !isMaster && !canView(path). Validado com tsc --noEmit (0 erros novos; 116 pre-existentes em 43 outros arquivos, nao relacionados).
- COMMIT/PUSH do Fase 1 (useSidebarPermissions.ts + routes/index.tsx) NAO CONFIRMADO nesta sessao - verificar/rodar no inicio da proxima.

### Pendente / Proxima sessao
- Confirmar git status / commit+push do Fase 1 (frontend/src/hooks/useSidebarPermissions.ts, frontend/src/routes/index.tsx) se ainda pendente.
- profile_sidebar_permissions continua VAZIA -> tela AccessDenied e ocultamento real (SideBar/Dashboard) nunca foram exercitados de fato. Configurar via Sistema > Permissoes de Sidebar > Por Perfil (ex: restringir Visualizador de /app/finance/accounts-payable) e validar em conjunto: SideBar esconde item, Dashboard esconde card, ProtectedRoute mostra "Acesso Restrito" em navegacao direta, toast 403 se o modulo tb tiver guard de API.
- Testar Operador Teste (operador.teste@ledgr.local / Operador@123, read:true+write:true+delete:false): deve EDITAR usuarios mas DELETE deve dar 403.
- Achado: PATCH /persons/:id -> 500 PrismaClientValidationError "Unknown argument document" em persons.service.ts:171 (Person nao tem campo "document" no schema, provavelmente deveria ser so "cpf"). Nao corrigido.
- Achado: rotas app/users/edit/:id e app/profiles/edit/:id em routes/index.tsx nao estao dentro de <ProtectedRoute>.
- Achado (nao corrigido): users.service.ts updateUser nao persiste "password", e usa data.phoneNumber mas o frontend envia data.phone (telefone nunca e salvo).
- Achado (nao corrigido): ProfileList.tsx tem prop invalida max-Width (warning React); varios inputs sem autocomplete.
- ProfileGuard so cobre Users/Profiles. Finance/Accounting/SPED/HR/Assets etc continuam SEM guard de perfil (Fase 3, fora desta sessao).

### Aprendizados novos
- Scripts Python via heredoc Pwsh + Out-File -Encoding utf8: \uXXXX dentro de raw string r"""...""" NAO e interpretado como Unicode (fica literal) -> old/new com mensagens acentuadas via \uXXXX falham silenciosamente (count()==0). Usar caractere acentuado real direto na raw string, OU evitar acento em strings de match/novas (texto de usuario em PT-BR sem acento quando envolver match).
- Blocos "old" multi-linha com LINHA VAZIA no meio sao ponto comum de falha (count()==0) mesmo com texto visualmente identico. Preferir ancoras curtas sem linha vazia/acento; dividir edits grandes em 2+ replaces ao redor da linha vazia.
- Padrao de fallback no ProfileGuard (_view/_list->read, _create/_edit/_update->write, _delete->delete) e reaproveitavel quando novos modulos ganharem @RequirePermission(...) - perfis simples {read,write,delete} (Operador/Visualizador) funcionam automaticamente sem chave especifica no JSON.
- canView(path) com prefixo: novo item em sidebar_items ja cobre automaticamente sub-rotas (/edit/:id, /new, etc.) sem cadastro extra.

### Usuarios de teste (recap)
- Visualizador Teste: visualizador.teste@ledgr.local / Visualizador@123 (email corrigido nesta sessao), profile Visualizador (read:true,write:false,delete:false), id fb6d4847-9498-4adc-a92e-ba7a79d6294f.
- Operador Teste: operador.teste@ledgr.local / Operador@123, profile Operador (read:true,write:true,delete:false), id 06dca0e7-44ae-41aa-92b3-903c4af63cfa.

## Sessao 2026-06-18 — HR/eSocial Completo

### Entregue nesta sessao
- eSocial 100% completo: S-2190, S-1202, S-2220, S-1070, S-2298, S-2240, S-2210, S-1210, S-1200 TX, S-1299, S-2230, S-2299, S-2200, S-2205
- Certificados: badge e-CPF/e-CNPJ automatico pelo subject
- Schema HR: TipoHoraBH, BancoHoras (mult noturno/FDS/feriado), PeriodoAquisitivoFerias, ProgramacaoFerias, DecimoTerceiro, RaisDeclaracao, RaisVinculo
- BancoHorasService completo: creditar (com tipo hora + multiplicador automatico), debitar, ajustar, configurar
- FeriasService: inicializarPeriodos, calcularFerias (INSS progressivo + IRRF Lei 15.270), agendar (ate 3 parcelas), aviso PDF, recibo PDF
- FeriasController: endpoints completos incluindo /hr/ferias/funcionarios (filtra demissionarios via Prisma)
- FeriasPage: lista funcionarios ativos, periodos aquisitivos com status, agendamento com preview do calculo, Aviso/Recibo PDF

### Pendente HR
- 13o Salario (DecimoTerceiroService + pagina)
- RAIS (RaisService + pagina)
- DCTFWeb (espelho mensal)

### PROXIMO: Recesso Coletivo + Pontes de Feriado
**Regra KPL:** pontes de feriados prolongados sao compensadas com ferias; recesso coletivo no fim de ano liquida o saldo.

**O que precisar implementar:**
1. Verificar model Holiday existente no schema (campos a confirmar)
2. Model RecessoColetivo — define periodo de recesso para empresa inteira (ex: 23/12 a 02/01)
   - Campos: companyId, dataInicio, dataFim, diasUteis, descricao, tipo (RECESSO|PONTE)
3. Service RecessoService:
   - criarRecesso(companyId, dto) — cria o recesso
   - aplicarParaTodos(recessoId) — gera ProgramacaoFerias para TODOS os funcionarios ativos debitando o periodo aquisitivo disponivel
   - gerarReciboLote(recessoId) — gera todos os recibos em ZIP
4. Logica de escolha do periodo: usa o periodo aquisitivo mais antigo disponivel (DISPONIVEL) ou o atual (ABERTO se nao ha outro)
5. Frontend: pagina de Recesso Coletivo com calendario e aplicacao em lote


## Sessao 2026-06-19 — HR Completo + Calendario + Recessos

### Entregue nesta sessao
- BancoHorasService completo com TipoHoraBH (DIURNA/NOTURNA/FDS_SABADO/FDS_DOMINGO/FERIADO) e multiplicadores configuráveis por CCT
- FeriasService: inicializarPeriodos, calcularFerias (INSS progressivo + IRRF Lei 15.270), agendar (3 parcelas), aviso PDF, recibo PDF
- FeriasPage: funcionários ativos (filtra demissionários), períodos aquisitivos, agendamento com prévia do cálculo
- RecessoService: criar, preview, aplicar em lote, ZIP recibos
- RecessoPage: criar RECESSO_COLETIVO e PONTE, preview saldo por funcionário, aplicar em lote
- CalendarioPage: grid mensal visual, feriados + pontes sugeridas automáticas (qui→sex, ter→seg), recessos, férias, confirmar ponte com 1 clique, + Feriado/+ Ponte, localidade UF+município
- DecimoTerceiroService: cálculo proporcional CLT (meses>=15 dias), 1a parcela (nov), 2a parcela (dez) INSS+IRRF, recibos PDF
- RaisService: geração declaração anual, vínculos por empregado, registro protocolo
- DctfWebService: consolidação mensal CP (INSS emp+patronal+RAT+Terceiros+PL) + IRRF, total DARF

### Commits desta sessao
- dcaef17: fix duplicatas ferias.controller/service
- d5ed524: RecessoColetivo schema+migration+service+controller
- cb7f1c0: RecessoPage frontend
- 08dd9fb: CalendarioPage visual com pontes sugeridas
- 8d51955: 13o + RAIS + DCTFWeb backend
- 3d9f120: DecimoTerceiroPage + RaisPage + DctfWebPage + rotas
- 98e3328: fix sidebar Finance icon

### Pendentes restantes
- Confirmar rescisao Raquel com saldo FGTS real + transmitir S-2299 Producao Real (aguarda cadastro KPL no eSocial)
- Reimport ECD LM (saldo abertura 31/12/2023)
- Dashboard rebuild com dados reais


## Sessao 2026-06-20 — Calendario + HR Completo + Fluxo Registro

### Calendario de Feriados
- CalendarioPage visual completo: feriados nacionais/estaduais/municipais, pontes sugeridas automaticas (qui->sex, ter->seg), recessos, ferias
- Pontes sugeridas clicaveis para Master confirmar como Recesso
- Botao Gerar Calendario aparece somente para anos sem feriados importados
- +Feriado com localidade UF+municipio, +Ponte manual
- Commits: 08dd9fb, 4f76c44, 4c88a21

### HR Completo
- 13o Salario: calculo proporcional CLT, 1a/2a parcelas, recibos PDF, DecimoTerceiroPage
- RAIS: declaracao anual, vinculos, protocolo envio, RaisPage
- DCTFWeb: consolidacao INSS+IRRF mensal, total DARF, DctfWebPage
- Rotas: /app/hr/decimo-terceiro, /app/hr/rais, /app/hr/dctfweb

### Fluxo Auto-Cadastro de Usuarios
- Rota publica /register fora do Layout (Register.tsx com CPF+nome+email+telefone+senha)
- POST /auth/register: cria User status=PENDENTE, compara CPF com Person
- Flags: OK | CPF_NAO_ENCONTRADO | DIVERGENCIA_NOME
- Badge pendentes no Header para Master Admin (polling 60s)
- PendentesPage: lista, comparacao lado a lado, modal aprovacao (perfil+nivel+empresas), rejeicao com motivo
- Fix critico: GET /users/pendentes movido antes de GET /users/:id no controller
- Fix critico: auth.service.register usava require('bcrypt') em vez de bcrypt importado
- Fix critico: metodo rejeitar() sem fechamento de chaves

### Pendentes
- Reimport ECD LM (saldo abertura 31/12/2023)
- Dashboard rebuild com dados reais
- Rescisao Raquel + S-2299 Producao Real


## Sessao 2026-06-20 (tarde) — Modulo Fiscal + Sidebar

### Entregue
- FiscalModule criado do zero (fiscal.module.ts, fiscal.controller.ts)
- NFS-e SP: nfse-sp-parser.service.ts (ABRASF 2.0, detecta Prestador/Tomador por CNPJ)
- NFS-e SP: nfse-import.service.ts (preview, import, dedup por numero+CNPJ)
- NF-e Produtos: nfe-parser.service.ts (SEFAZ nfeProc/NFe, detecta Entrada/Saida)
- NF-e Produtos: nfe-import.service.ts (preview, import, dedup por chave 44 digitos)
- Endpoints: POST /fiscal/nfse-sp/preview, /import; POST /fiscal/nfe/preview, /import
- Endpoints: GET /fiscal/documentos (filtros: tipo, competencia, status, search, paginacao)
- Endpoints: GET /fiscal/documentos/resumo (KPIs: totalNfs, totalIss, totalPis, totalCofins, pending, integrated)
- NfseImportPage.tsx: drag-drop, preview tabela, badges Prestador/Tomador, totais, dedup visual
- NfeImportPage.tsx: drag-drop, preview tabela, badges Entrada/Saida, totais, dedup visual
- DocumentosFiscaisPage.tsx: hub central, KPIs, filtros, paginacao, botao Integrar -> POST /finance/fiscal-documents/:id/integrate
- Sidebar reorganizada: secao Fiscal separada do Finance
  Finance: AP, AR, Fluxo, Fundo Fixo, Agenda, Banco, Provisoes, Fechamento
  Fiscal: NF-e, NFS-e SP, Documentos Fiscais, Apuracao, Dedutibilidade
- LedgrHome redesenhada: redireciona usuario logado para /app/dashboard
- fast-xml-parser instalado no workspace apps/api

### Commits
- af9a23a: feat(fiscal) hub + NfeImportPage + NfseImportPage + rotas + sidebar
- f3df657: refactor(sidebar) secao Fiscal separada
- 392ec18: fix(nfe) destinCnpj shorthand

### Pendentes
- Testar com XMLs reais de NFS-e SP e NF-e SEFAZ
- Consulta SEFAZ por chave de acesso (futura)
- Reimport ECD LM (saldo abertura 31/12/2023)


## Sessao 2026-06-20 (noite) — LEDGR Agent A3 + Fiscal SP

### Entregue
- LEDGR Agent (apps/agent/) — Express porta 7778, sem deps nativas
  - GET /health, GET /certificates (Windows Certificate Store via PowerShell/CNG)
  - POST /certificates/export-pem
  - POST /nfse-sp/soap (mTLS via WebClient .NET — chave A3 nunca sai do token)
  - POST /nfse-sp/buscar-tomador, /buscar-emitidas
  - Iniciar: cd apps/agent && npx tsx src/main.ts
- NfseImportPage: badge LEDGR Agent online/offline, optgroup A1/A3 no seletor
- Roteamento A1/A3 completo:
  - A1: Frontend -> Backend /fiscal/nfse-sp/buscar-tomador (certId)
  - A3: Frontend -> Agent:7778 (thumbprint+cnpj) -> Backend /fiscal/nfse-sp/import-from-xml
- Backend: endpoint POST /fiscal/nfse-sp/import-from-xml (importa XMLs retornados pelo agent)
- NfseImportService: importFromXmlStrings() para receber XMLs do agent
- URL SP atualizada para nfews.prefeitura.sp.gov.br (suporta layout v1+v2 Reforma 2026)
- CLAUDE.md: convencao de cabecalho com caminho absoluto documentada

### Pendente — LEDGR Agent A3
- TESTE REAL com token A3 fisico conectado (usuario nao tem A3 disponivel no momento)
- Validar que Windows CNG delega corretamente ao middleware do fabricante
- Verificar resposta SOAP SP com cert A3 real

### Commits desta sessao
- 65b3bba: frontend detecta agent, badge, optgroup A1/A3
- fdc3679: roteamento A1/A3 completo, /companies/me para CNPJ
- 938749b: import-from-xml endpoint + importFromXmlStrings
- 8778990: CLAUDE.md convencao cabecalho


## Sessao 2026-06-21 (madrugada) — NFS-e SP Completo + Locacao Imoveis

### Entregue
- Parser NFS-e SP v2 (Reforma Tributaria 2026):
  - Interface NfseParsed estendida: versaoLayout, valorIbs, aliquotaIbs, valorCbs, aliquotaCbs, ibsRetido, cbsRetido, valorTotalTributos, prestadorIm, codigoCnae
  - Auto-detecta v1 vs v2 por atributo Versao ou presenca de campos IBS
  - Suporta envelopes SP v1 e v2 (RetornoEnviarLoteRps, DPS, CompNfse)

- NfseSpEmissaoService (apps/api/src/modules/fiscal/services/nfse-sp-emissao.service.ts):
  - buildRpsV1: formato ABRASF 2.0 classico
  - buildRpsV2: formato Reforma Tributaria 2026 (IBS/CBS campos)
  - emitir(): assina RPS + Lote, envia SOAP EnviarLoteRps, salva FiscalDocument
  - cancelar(): assina e envia CancelaNfse, atualiza status
  - Endpoints: POST /fiscal/nfse-sp/emitir, POST /fiscal/nfse-sp/cancelar

- NfseSpEmissaoPage.tsx:
  - Formulario completo: cert, ambiente, tomador, servico LC116, valores, ISS
  - Toggle Layout v2 (IBS/CBS)
  - Historico com status e botao cancelar
  - Rota: /app/finance/nfse-sp-emissao | Sidebar: Emissao NFS-e SP (FiFilePlus)

- Locacao de Imoveis — preparacao NT 007/2026:
  - Codigos 99.03.01 (residencial), 99.03.02 (comercial), 99.04.01 (bens moveis)
  - Select agrupado por tipo no NfseNacionalPage
  - Deteccao isLocacao = cod.startsWith('99.')
  - Redutor 70%: base IBS/CBS = 30% do valor (NT 007/2026)
  - Aliquotas simbolicas 2026: IBS 0.1% + CBS 0.9%
  - Campos CIB (Cadastro Imobiliario Brasileiro) e inscricaoImobiliaria
  - Alerta visual roxo quando codigo de locacao selecionado
  - ISS sempre zero para codigos 99.xx
  - service: isLocacao detectado, vBCLoc, vIBSloc, vCBSloc calculados
  - DTO: cib, inscricaoImobiliaria, usarRedutorLocacao

### Cronograma locacao LM (para referencia)
- Hoje (2026): nada obrigatorio — SP nao tem codigo ISS para locacao
- 01/08/2026: emissao com campos IBS/CBS exigida via NFS-e Nacional RFB
- 2027: obrigatoriedade plena — NFS-e Nacional cod 99.03.xx com CIB

### Status NFS-e SP — completo
- Import XML manual (ABRASF v1 e v2): OK
- Busca repositorio SP Tomador (A1 backend + A3 agent): OK
- Busca repositorio SP Emitidas (A1 backend + A3 agent): OK  
- Emissao EnvioLoteRPS (v1 + v2): OK
- Cancelamento CancelaNfse: OK
- Parser v2 IBS/CBS: OK

### Pendentes
- Teste LEDGR Agent A3 com token fisico
- Reimport ECD LM
- CIB por imovel no modulo Ativo Imobilizado da LM (quando 08/2026 chegar)


## Sessao 2026-06-21 (continuacao) — Revisao e correcoes

### Dashboard — CONCLUIDO (tirar da lista)
- DashboardPage.tsx (502 linhas) e o componente ativo — consome dados reais
- Backend /dashboard/kpi: apTotal, apCount, arTotal, arCount, nfPending, journalCount, fechamentoStatus, docsAguardando
- Backend /dashboard/summary: employees, folhas, decimosPendentes
- Todos os KPI Cards com dados reais do banco Prisma

### Usuarios — CONCLUIDO
- Botao Ver: modal com detalhes completos
- Botao Excluir: confirmacao Swal + recarrega lista do servidor
- findAll() filtra deletedAt:null e status!=deleted

### Integracao NFS-e -> AP/AR — CORRIGIDA
- runIntegration reescrito: TOMADOR->AP, PRESTADOR->AR
- Nao duplica FiscalDocument
- Lancamento contabil correto por modo
- Status INTEGRATED apos sucesso, ERROR em falha

### Pendentes (atualizadas)
- Simples Nacional NFS-e Nacional — prazo set/2026
- Reimport ECD LM (saldo abertura 31/12/2023)
- Rescisao Raquel + S-2299 eSocial producao real
- Apuracao de Impostos com dados reais das notas
- Teste LEDGR Agent A3 com token fisico


## Revisao pendencias 2026-06-21

### Rescisao CLT — CONCLUIDA (tirar da lista)
- Modal completo em EmployeeDetailPage.tsx
- Calculo TRCT: saldo salario, aviso previo, 13o prop, ferias, FGTS, multa 40%, INSS, IRRF
- Confirmar rescisao -> status terminated
- Download TRCT HTML/PDF + Seguro Desemprego HTML/PDF
- S-2299 eSocial
- Confirmado uso real esta semana (rescisao Raquel)
- Backend: rescisao.controller.ts + rescisao.service.ts + trct-pdf.service.ts

### Dashboard — CONCLUIDO
- DashboardPage.tsx com dados reais: AP, AR, NFs pendentes, lancamentos, fechamento, docs assinatura
- /dashboard/kpi + /dashboard/summary

### Pendentes (atualizadas — removidos Dashboard e Rescisao)
- Simples Nacional NFS-e Nacional — prazo set/2026
- Reimport ECD LM (saldo abertura 31/12/2023)
- Apuracao de Impostos com dados reais das notas fiscais
- Teste LEDGR Agent A3 com token fisico


## Revisao pendencias 2026-06-21 (continuacao)

### NFS-e Nacional Simples Nacional — IMPLEMENTADO, aguardando teste
- NfseNacionalService: DPS XML + assinatura RSA-SHA256 + API RFB mTLS
- NfseNacionalPage: formulario, historico, preview, cancelamento
- Codigos locacao 99.03.xx + redutor 70% IBS/CBS
- Prazo obrigatoriedade: 01/09/2026 (CGSN 189/2026)
- PENDENTE: teste em homologacao RFB com cert A1 real

### Lista final de pendencias tecnicas
- Reimport ECD LM (saldo abertura 31/12/2023)
- Apuracao de Impostos com dados reais das notas fiscais
- Teste NFS-e Nacional em homologacao RFB
- Teste LEDGR Agent A3 com token fisico

## Sessao 2026-06-21 (tarde) — Refatoracao Sidebar + Nomenclatura PT-BR

### Entregue
- SideBar.tsx refatorado completamente (frontend/src/components/SideBar.tsx)
- PT-BR completo: Finance->Financeiro, Accounting->Contabilidade, HR->Departamento Pessoal,
  Sign Out->Sair, Dashboard->Visao Geral
- Paths do Fiscal corrigidos: todos os filhos migrados de /app/finance/ para /app/fiscal/
  (bug de auto-expansao eliminado — pai /app/fiscal com filhos em /app/finance/ causava
  highlight errado na sidebar)
- Reagrupamento Administracao: Empresas, Usuarios, Perfis, Pessoas Fisicas saem do raiz
  e ficam agrupados no final como ultimo grupo operacional
- Ativo Imobilizado -> Patrimonio: filho duplicado /app/assets removido, mantém so Manutencoes
- Arquivo -> Acervo: repositorio historico de documentos finalizados
- Novo grupo Assinaturas (/app/assinaturas): Validacao de Assinatura + Certificados Digitais
  (Certificados saem de Administracao e ficam junto ao fluxo de autenticacao)
- Visoes Contabeis (I052) movida de SPED para Contabilidade (e configuracao contabil, nao SPED)
- DHO adicionado como sub-item desabilitado em Departamento Pessoal (placeholder futuro)
- SPED renomeado para SPED / Obrigacoes

### Ordem final dos grupos
Visao Geral -> Contabilidade -> Financeiro -> Fiscal -> Departamento Pessoal ->
Societario -> Patrimonio -> SPED / Obrigacoes -> Acervo -> Assinaturas -> Administracao

### Nomenclatura decidida (historico da discussao)
- Dashboard: descartado -> Visao Geral (padrao ERP brasileiro: SAP, TOTVS, Omie)
- HR & Folha: descartado -> DHO descartado (estrategico, nao operacional) ->
  Departamento Pessoal (correto para folha, rescisao, eSocial, GPS/DARF)
- Ativo Imobilizado -> Patrimonio
- Arquivo -> Gestao Documental (descartado) -> Gestao e Registros (descartado) ->
  Acervo (elegante, juridico, unico no mercado BR)
- Assinaturas separado do Acervo: Acervo = arquivo passivo historico;
  Assinaturas = processo ativo (validacao, certificados)
- i18n por IP: descartado — LEDGR e 100% BR, fixar PT-BR; se internacionalizar no futuro
  usar react-i18next com preferencia no perfil do usuario

### Pendente pos-sidebar
- Revisar useSidebarPermissions: paths /app/finance/nfse-* mudaram para /app/fiscal/nfse-*
  verificar se permissoes cadastradas no banco precisam de migracao SQL
- Atualizar Central de Ajuda (help center) com nomenclatura final
- Commit: 7996dac (refactor sidebar Acervo + Assinaturas)

## Sessao 2026-06-21 (tarde/noite) — Auditoria & Logs + Sidebar Secoes

### Sidebar — separadores de secao
- dividerBefore adicionado na interface MenuItem
- Secoes: Operacional (Contabilidade/Financeiro/Fiscal/Depto Pessoal),
  Empresa (Societario/Patrimonio), Compliance (SPED/Acervo/Assinaturas),
  Sistema (Administracao)
- Separadores visiveis apenas com sidebar expandida (open && item.dividerBefore)
- Commit: feat(sidebar) separadores de secao

### Auditoria & Logs — IMPLEMENTADO
- Backend: audit.service.ts reescrito com findAll(filters) + paginacao
  Filtros: actorId, action, targetId, dateFrom, dateTo, page, limit
  Retorna: { data, total, page, pages, limit }
- Backend: audit.controller.ts reescrito — HTTP REST GET /audit com @UseGuards(JwtAuthGuard)
  Substituiu padrao microservico (@MessagePattern) por endpoint HTTP convencional
- AuditModule em apps/api/src/core/audit/ (nao movido para modules/ — core/ ja tem
  outros modulos de negocio: companies, users, documents; mover seria refatoracao
  sem ganho imediato)
- Frontend: AuditPage.tsx em frontend/src/pages/admin/AuditPage.tsx
  Filtros: acao, actorId, data de/ate
  Tabela: data/hora, acao (badge colorido por tipo), usuario, alvo, IP
  Detalhe expansivel: diff JSON before/after (vermelho/verde)
  Paginacao: anterior/proxima com contador de paginas
- Rota: /app/administracao/auditoria + /app/audit (alias existente reaproveitado)
- Sidebar: Auditoria & Logs adicionado em Administracao (primeiro sub-item)
- Commit: 3c30227

### Observacoes tecnicas
- AuditLog ja era gravado em 8+ servicos (accounting, AP, fechamento, integration,
  documents, clicksign, govbr, signature-validator) — dados reais disponiveis
- action e string livre — sem enum padronizado ainda (melhoria futura)
- Pendente: testar no browser com dados reais

## Sessao 2026-06-21 (tarde/noite) — fix Auditoria

### Fix
- audit.controller.ts: import JwtAuthGuard corrigido de
  '../../auth/jwt-auth.guard' para '../../auth/guards/jwt.guard'
- Endpoint GET /audit funcionando — 131 registros reais carregados
- AuditPage.tsx operacional: badges coloridos, actor, alvo, paginacao
- Sidebar secoes visiveis: OPERACIONAL/EMPRESA/COMPLIANCE/SISTEMA
- Commit: fix(audit) path JwtAuthGuard

## Sessao 2026-06-21 (noite) — Central de Ajuda

### Entregue
- helpContent.ts (33kb) — manual completo em PT-BR linguagem leiga
  Secoes: Primeiros Passos, Contabilidade, Financeiro, Fiscal,
  Departamento Pessoal, Administracao
  Tipos de bloco: text, tip, warning, list, steps, table
  contextualHelp: mapa rota -> slug (20+ rotas mapeadas)
  helpSections: indice de navegacao por secao
- HelpArticleView.tsx — renderizador de blocos com estilos visuais
- HelpCenter.tsx — painel com busca, indice por secao, navegacao, historico
- HelpButton.tsx — botao flutuante roxo canto inferior direito
  Ajuda contextual: detecta rota atual e abre artigo relevante automaticamente
- Layout.tsx — HelpButton integrado antes do Toaster
- index.css — animacao slide-in-right 0.22s cubic-bezier
- Commit: feat(help) Central de Ajuda

### Arquitetura
- frontend/src/help/helpContent.ts — unico arquivo de conteudo (editavel)
- frontend/src/components/help/ — HelpArticleView, HelpCenter, HelpButton
- Rota /app/ajuda planejada mas nao implementada (acesso via botao flutuante)

### Futuro planejado
- Integracao com IA (Claude) para orientacao dinamica
- Portal externo docs.ledgr.com (Opcao B) — fase posterior
- Mais artigos: Societario, Patrimonio, SPED, Acervo, Assinaturas
- Busca full-text no conteudo dos artigos

## Sessao 2026-06-21 (noite) — fix Help sidebar

### Ajuste
- Botao flutuante removido do Layout.tsx
- "Ajuda & Suporte" adicionado no rodape da sidebar acima do Sair
- Estilo discreto: cinza neutro, mesmo peso visual do Sair
- FiHelpCircle adicionado aos imports fi
- Fix: import useState duplicado (useHelpState) removido
- Painel lateral abre com ajuda contextual da pagina atual

## Sessao 2026-06-21 (noite) — Performance sidebar-permissions + fix isMaster

### Item 6 — Migracao SQL sidebar_items CONCLUIDO
- Removido path obsoleto /app/finance/fiscal-documents
- Atualizado /app/assets -> /app/assets/maintenances
- Inseridos 7 paths do modulo Fiscal (/app/fiscal/*)
- Inseridos 17 paths ausentes: assinaturas, acervo, auditoria, sped/efd, rh, etc
- Total: 40 -> 63 itens em sidebar_items

### Item 3 — Loop sidebar-permissions/resolve INVESTIGADO
- Causa raiz: React StrictMode executa effects 2x em dev (nao e bug real)
- Em producao: 1 chamada por carregamento (confirmado: Total sidebar calls: 1 apos 30s)
- Fix aplicado: SidebarPermissionsContext com debounce 150ms + guard !companyId
- Fix isMasterAdmin: ler de user.permissions.all OU user.profile.permissions.all
- Commit: perf(sidebar-permissions) Context unico + debounce + fix isMasterAdmin

## Sessao 2026-06-21 (noite) — fix isMasterAdmin + sidebar-permissions zero calls

### Resultado final
- Master Admin: 0 chamadas a /sidebar-permissions/resolve (retorna ['*'] localmente)
- Usuarios normais: 1 chamada apos debounce 150ms + guard !companyId
- Root cause: user.permissions.all nao existe — esta em user.profile.permissions.all
- React StrictMode executa effects 2x em dev — comportamento normal, nao e bug
- Commit: fix(sidebar-permissions) isMasterAdmin

## Sessao 2026-06-21 (noite) — Revisao AR + sidebar-permissions zero calls

### Item 4 — Contas a Receber LM — JA OPERACIONAL
- ContasAReceberPage.tsx: 341 linhas, completo
- 5 titulos reais LM: R$ 32.800 emitido, R$ 13.000 recebido, R$ 19.800 pendente
- Alugueis com locatarios, imoveis vinculados (fixedAsset), vencimentos, status
- Backend /finance/ar: create, findAll, findOne, update, receive, cancel, remove, aging
- Modal de baixa com NF obrigatoria para ALUGUEL ja implementado
- Aging por faixas: a vencer, 1-30, 31-60, 61-90, 90+ dias
- NENHUMA construcao necessaria — modulo ja funcional com dados reais

### Resumo itens backlog concluidos nesta sessao
- Item 6: sidebar_items migrado (40->63 itens, modulo fiscal adicionado)
- Item 3: SidebarPermissionsContext (1 chamada API, 0 para Master Admin)
- Item 4: AR ja operacional com dados reais LM

## Sessao 2026-06-21 (noite) — Central de Ajuda completa

### Artigos adicionados ao helpContent.ts (33kb -> 51kb)
- Societario: Estatuto/Contrato Social, Socios e QSA, Livros e Registros
- Patrimonio: Cadastro de Bens, Ordens de Servico, Depreciacao
- SPED / Obrigacoes: ECD, EFD-Contribuicoes, Calendario de Obrigacoes
- Acervo: introducao ao repositorio historico
- Assinaturas: Validacao de Assinatura, Certificados Digitais
- helpSections: 5 novas secoes adicionadas ao indice
- contextualHelp: 11 novas rotas mapeadas (assets, societario, arquivo, sped, assinaturas)
- Central de Ajuda agora cobre todos os modulos da sidebar

## Agenda proxima sessao — Limpeza e organizacao do repositorio

### Objetivo
Deixar o monorepo limpo, organizado e documentado antes de avançar em novas features.

### Escopo planejado
1. Auditoria de arquivos obsoletos:
   - apps/web/ (1 arquivo orfao DashboardPage.tsx)
   - src/ (raiz) — accounts-payable.service.ts orfao
   - libs/ (raiz) — domain/, infrastructure/, shared/ vazios
   - project_files/ — snapshot espelhado antigo
   - frontend/src/pages/Dashboard.tsx, Dashboard Mock.tsx e variantes
   - apps/api/src/auth/xxxxjwt-auth.guard.XXXXXts — arquivo morto
   - hooks/useSidebarPermissions.ts — substituido pelo Context (pode ser removido ou mantido como re-export)

2. Reorganizacao potencial:
   - Avaliar se core/ deve mover para modules/ (companies, users, persons, documents, certificates, audit)
   - Padronizar estrutura de pastas frontend/src/pages/ (algumas em finance/, outras em sistema/, admin/)

3. Documentacao da estrutura:
   - Atualizar CLAUDE.md secao "Estrutura do monorepo" com mapa detalhado e atualizado
   - Criar README.md na raiz com visao geral, stack, comandos e estrutura
   - Documentar convencoes de nomenclatura de arquivos

4. Verificar e limpar:
   - Imports nao utilizados em arquivos principais
   - Variaveis de ambiente documentadas (sem valores sensiveis)
   - Scripts em package.json organizados e documentados

### Regra
Nao deletar nada sem inspecionar primeiro — sempre confirmar o que e orfao
antes de remover. Usar git para seguranca (branch de limpeza ou commits atomicos).

## Pendencia registrada — 22/06/2026

### LM Administracao — Abertura de receitas de locacao (retroativo)
- Mare 62 e Mare 88: valores recebidos incluem condominio embutido — nao e receita tributavel
- Landmark e Conj 32: parte dos recebimentos e reembolso de IPTU — nao e receita tributavel
- Solucao adotada: separar na planilha em linhas distintas com contas contabeis diferentes
  - Receita de aluguel: conta 3301
  - Reembolso condominio/IPTU: conta passivo transitorio (a definir)
- Pendente: retroagir e corrigir todos os periodos 2025 e jan-mai/2026
- Impacto: base PIS/COFINS e IRPJ/CSLL sera reduzida nos periodos corrigidos


## Sessao 2026-06-21 (noite) — Central de Mensagens

### Entregue
- ChatModule completo: Conversation, ConversationParticipant, ChatMessage, ChatAttachment (schema Prisma)
- ChatModule NestJS: service + controller + DTOs + module
- ChatPage.tsx: UI estilo WhatsApp, mensagens diretas e grupos
- Rota: /app/chat | Sidebar: FiMessageSquare
- Registrado em AppModule

### Commits
- feat(chat) modulo mensagens internas WhatsApp-style


## Sessao 2026-06-22 (manha) — Sidebar PT-BR + Auditoria + Ajuda & Suporte

### Entregue
- SideBar.tsx refatorado completo:
  - Labels PT-BR: Finance->Financeiro, Accounting->Contabilidade, HR->Departamento Pessoal,
    Dashboard->Visao Geral, Sign Out->Sair, Ativo Imobilizado->Patrimonio
  - Arquivo dividido em: Acervo (historico passivo) + Assinaturas (processo ativo)
  - Secoes visuais com dividerBefore: OPERACIONAL, EMPRESA, COMPLIANCE, SISTEMA
  - Ajuda & Suporte: link discreto no footer acima de Sair
- Auditoria & Logs completo:
  - audit.controller.ts: REST GET /audit com JwtAuthGuard
  - audit.service.ts: filtros actorId/action/targetId/dateFrom/dateTo/page/limit
  - AuditPage.tsx: badges coloridos, diff before/after, paginacao
  - Rota: /app/administracao/auditoria
- Help Center completo:
  - helpContent.ts: artigos para todos os modulos em PT-BR (51kb)
  - HelpCenter.tsx: painel slide-in direito, busca, historico, artigos relacionados
  - HelpArticleView.tsx: renderiza blocks (text, tip, warning, list, steps, table)
  - Contextual: abre artigo relevante por rota atual
- sidebar_items: migrado de 40 para 63 itens (paths Fiscal, Assinaturas, Acervo, Auditoria)


## Sessao 2026-06-22 (tarde) — Limpeza Repositorio + Infraestrutura

### Entregue
- Limpeza repositorio: ~196 arquivos removidos
  - Diretorios: project_files/, apps/web/, libs/, src/ raiz, dist/, tools/, backend/
  - Arquivos: JSONs, context snapshots, scripts temp, PDFs/DOCXs soltos
  - 2 commits e push para origin/main
- Planejamento SERVER02 (192.168.0.10):
  - Ubuntu Server 24.04 LTS headless via SSH
  - Docker Compose: PostgreSQL + NestJS + Nginx/React
  - SSD recomendado: Kingston NV2 500GB NVMe PCIe 4.0 (150 TBW, 5 anos garantia)
  - Pendente: compra SSD + engajamento suporte TI para inventario e setup

### Pendentes SERVER02
- Compra SSD + suporte TI inventario SERVER02
- Setup Ubuntu + Docker Compose staging


## Sessao 2026-06-23 (manha) — LM Apuracao PIS/COFINS + Bank Import

### Entregue
- LM Administracao (Lucro Real, nao-cumulativo):
  - Receita aluguel mai/2026 verificada: R$ 69.502,08
  - PIS 1,65% = R$ 1.146,78 | COFINS 7,6% = R$ 5.282,16 | Total R$ 6.428,94
  - Vencimento: 25/06/2026
- Bank Import Excel Mapeado (LM):
  - uploadExcelMapped: propertyTag via regex PROPERTY_TAG_MAP, assetId via internal_code
  - Exclusao de reembolsos: refClean.includes('reembolso') apos NFD normalization
  - Validacao overlap de periodo, cascade-delete
  - ExcelPreviewModal: filtros status, KPI cards, busca
  - Limpeza: 7.122 lancamentos duplicados removidos (reimports acidentais)
  - Dados maio/2026 limpos e verificados
- Rota sidebar corrigida: /app/finance/apuracao

### Aprendizados criticos
- LM e Lucro Real -> PIS/COFINS nao-cumulativo (1,65%/7,6%) — NUNCA cumulativo
- Reembolsos (condominio, IPTU): excluir da base de receita — detectar por refClean.includes('reembolso')
- Python patch files: sempre criar diretamente como .py em D:\Temp\ — nunca via PS heredoc
- tail nao existe no PowerShell: usar Select-Object -Last
- Retroativo pendente: segregar reembolsos em todos os periodos 2025 e jan-mai/2026 (Mare 62, Mare 88, Landmark, Conj 32)

## Sessao 2026-06-24 — Reorganizacao Fiscal + Procuracao

### Aprendizado critico — ambiente Windows
- Comando Python no Windows: sempre python (nunca python3)
- Confirmar sempre no mesmo bloco PS, ao final do comando principal

### Entregue
- AccountTree.tsx: col-span-4->5 (descricao), w-20->w-28 (codigo conta)
- pages/fiscal/ criada; 9 arquivos migrados de finance/
- routes/index.tsx: imports e rotas corrigidos para /app/fiscal/
- SideBar.tsx: Fiscal reorganizado em 3 niveis (Documentos Fiscais, Config, Apuracao, Notas Fiscais > NF-e / NFS-e Nacional / NFS-e SP)
- ExcelPreviewModal.tsx restaurado (usado por BankImportPage)

### Pendente
- RedigirProcuracaoModal.tsx: criar via python (nao python3)
- RepositorioPage.tsx: adicionar botao Redigir Procuracao (so em societario/procuracoes)

## Sessao 2026-06-24/25 — UX Fiscal + Procuracao + Reorganizacao

### Entregue
- Plano de Contas: codigo conta w-20->w-28 (suporta 6 niveis), col-span-4->5 descricao
- Reorganizacao fisica: pages/fiscal/ criada, 9 arquivos migrados de pages/finance/
- routes/index.tsx: imports e rotas corrigidos para /app/fiscal/
- SideBar Fiscal: hierarquia 3 niveis (Documentos Fiscais, Config Dedutibilidade,
  Apuracao de Impostos, Notas Fiscais > NF-e / NFS-e Nacional / NFS-e SP)
- ExcelPreviewModal.tsx restaurado (usado por BankImportPage, deletado por engano)
- Modulo Procuracao completo:
  - RedigirProcuracaoModal.tsx: 4 etapas (Outorgante/Outorgado/Poderes/Revisao)
  - Selector PF/PJ por papel com busca isolada por endpoint (/persons ou /companies)
  - Multiplos outorgantes e outorgados com adicao progressiva (botao "+ Adicionar outro")
  - Texto dos poderes editavel com sugestao juridica pre-preenchida + "Restaurar sugestao"
  - Preview HTML via iframe, Imprimir (print iframe), Salvar Rascunho, Finalizar
  - Qualificacao completa: nome, CPF/CNPJ, nacionalidade, estado civil, regime bens, RG, endereco
  - buildHTML gera documento juridico formatado com assinaturas
  - RepositorioPage.tsx: botao "Redigir Procuracao" visivel apenas em societario/procuracoes
- Troca de empresa: navigate(0) no handleSelectCompany -> reload automatico sem F5
- Patrimonio: item "Bens Cadastrados" -> /app/assets restaurado no Sidebar
- Fixes: style duplicado textarea RedigirProcuracaoModal, chave duplicada helpContent.ts

### Aprendizado critico desta sessao
- Python no Windows: sempre python (nunca python3)
- Confirmacao sempre no mesmo bloco PS, ao final
- replace() PS falha com backticks/aspas duplas em JSX -> sempre Python para TSX
- Reescrita completa preferivel a patches incrementais quando arquivo tem muitas edicoes

### Commits
- refactor: move fiscal pages to pages/fiscal/, fix routes to /app/fiscal/ prefix
- feat: RedigirProcuracaoModal 4 etapas + botao Redigir Procuracao em RepositorioPage
- feat: RedigirProcuracaoModal - multiplos outorgantes/outorgados, busca PF+PJ (CPF+CNPJ)
- feat: RedigirProcuracaoModal - selector PF/PJ por papel, busca isolada por endpoint
- feat: RedigirProcuracaoModal - texto poderes editavel, modal maior etapa 3
- fix: remove style duplicado no textarea, remove chave duplicada helpContent
- fix: reload automatico ao trocar empresa ativa (navigate(0))
- fix: restaurar Bens Cadastrados no menu Patrimonio

### Pendentes (priorizados)
1. FiscalAccountConfig: SQL migration + backend CRUD + frontend config + reimport GRB CSV
2. Apuracao impostos real: PIS/COFINS/IRPJ/CSLL por competencia; ISS GRB via guia separada
3. AR (ArEntry) integrado com FiscalDocument para ALUGUEL (NF obrigatoria por lei)
4. ECD LM 2024: reimport saldo abertura 31/12/2023 + validar Balancete
5. LM retroativo 2025: segregar reembolsos (condominio/IPTU) periodos 2025 e jan-mai/2026
6. NFS-e Nacional: homologacao pendente
7. LEDGR Agent A3: node-forge ou PKCS#12 export para mTLS (PMSP bloqueado por CAPTCHA/F5)
8. SERVER02: SSD pendente -> IT inventory -> Ubuntu + Docker Compose staging


## Sessao 2026-07-07 (tarde) — Calculadora de Correcao Monetaria + UX Indicadores

### Entregue
- Nova tela: CalculadoraCorrecaoPage.tsx (/app/sistema/indicadores/calculadora)
  - Input: valor original, indicador (Selic/IPCA/IGP-M/IGP-DI/INPC/TR — CDI fora, granularidade diaria incompativel),
    mes/ano inicio, mes/ano fim, checkbox "incluir competencia inicial"
  - Regra de negocio: correcao conta a partir do mes SEGUINTE a competencia inicial por padrao
    (fiel ao uso pratico de correcao de aluguel/honorarios em atraso)
  - Avisa competencias sem taxa cadastrada no banco (nao "chuta" valor)
- Backend: TabelasLegaisService.calcularCorrecao() + POST /tabelas-legais/indicadores/calcular
  - Calcula fator acumulado composto mes a mes, retorna detalhamento + competenciasFaltantes
- IndicadoresPage.tsx: botao "Calculadora de Correcao" no header, link para nova tela
- parseTsv (importacao manual de indicadores) estendido para aceitar:
  - Formato AAAA-MM (original) E formato BCB SGS export "mmm/aa" (ex: jun/89) E mes por extenso (ex: janeiro/95)
  - Taxa com virgula ou ponto decimal, com ou sem "%" no final
  - Ignora linha de cabecalho automaticamente (nao comeca com padrao de competencia valido)
- UX: IndicadoresPage.tsx e CdiTabelaPage.tsx — maxWidth no container (900px / 1000px),
  tabelas com overflowY scroll interno (maxHeight 560px) e header sticky (todas as abas:
  Selic/IPCA/IGP-M/IGP-DI/INPC/TR + CDI mensal/diario/resultado bulk-update)

### Dados historicos importados
- IGP-M 2014-01 a 2019-12 (72 registros) via TSV — fonte FGV/IBRE cruzada entre
  dadosdemercado.com.br e debit.com.br (valores identicos nas duas fontes)

### Pendencia
- Calculadora apontou 01/2026 e 02/2026 como "sem taxa cadastrada" para IGP-M, mas a tabela
  na UI parecia mostrar esses meses preenchidos (0.42% e 1.18%) — nao investigado, verificar
  se e problema de cache do navegador ou de formato de competencia no banco (ex: espacos,
  zero-padding) antes de assumir que sao dados faltantes de fato

### Commit
- feat(indicadores) calculadora de correcao monetaria, parser flexivel de importacao e
  scroll/layout nas tabelas


## Sessao 2026-07-07 (tarde, cont.) — Fechamento pendencia IGP-M 01-02/2026

### Investigado e resolvido
- Pendencia registrada anteriormente (calculadora apontando 01/2026 e 02/2026 como "sem taxa
  cadastrada" para IGP-M, divergindo da tela) era FALSO ALARME.
- Verificacao via SQL confirmou dados limpos:
  SELECT indicador, competencia, length(competencia), taxa_mensal FROM indicadores_economicos
  WHERE indicador = 'IGPM' AND competencia LIKE '2026%'
  -> 2026-01 e 2026-02 presentes, length=7, sem espacos/caracteres invisiveis, valores corretos
  (0.41% e -0.73% respectivamente)
- Causa real: erro de leitura da mensagem de aviso da calculadora (paragrafo longo listando
  dezenas de competencias 2014-2019 quebrado em varias linhas na tela — leitura equivocada
  incluiu 2026 na lista por engano)
- Nenhuma correcao de codigo necessaria. Pendencia encerrada.

---

### Sidebar — Reorganização Cadastros/Administração + Atalho Indicadores (07/07/2026)

**Motivação:** Administração com 11 itens estava sobrecarregada; Indicadores Econômicos revisitado (mantido em Administração — é dado mestre/referência global como Tabelas Legais e Calendário de Feriados, não operação por empresa).

**Mudanças em `SideBar.tsx`:**
- Novo grupo **Cadastros** (Empresas + Pessoas Físicas), separado de Administração
- **Administração** reduzida para 8 itens (Auditoria, Usuários, Perfis, Permissões, Calendário, Tabelas Legais, Backup, Manutenção)
- **Indicadores Econômicos** permanece em Administração (não foi para Financeiro — é referência global compartilhada por todas as empresas, usada por Fiscal, Investimentos e Financeiro)
- Atalho adicionado em `RendaFixaPage.tsx` (botão "↗ Indicadores Economicos" no header, via `window.location.href` — full reload, aceito por ser navegação secundária)
- Confirmado: Renda Fixa + Simulador CDB permanecem em Contabilidade > Investimentos (regime de competência, não caixa — critério consistente com a separação Contabilidade/Financeiro)

---

### SmartMonthInput / SmartDateInput — Novos componentes (07/07/2026)

**Motivação:** `<input type="month">` e `<input type="date">` nativos do Chrome têm bug conhecido — capturam valores parciais durante a digitação do ano (ex: "0026" em vez de esperar "2026" completo), e ainda "adivinham"/clampam datas inválidas silenciosamente (ex: dia 32 virava último dia do mês). Já era princípio de projeto evitar `type="month"`; esses componentes resolvem de forma mais robusta que o padrão "dois selects".

**Componentes criados:**
- `frontend/src/components/SmartMonthInput.tsx` — competência (mês/ano), retorna/recebe `'YYYY-MM'`
- `frontend/src/components/SmartDateInput.tsx` — data completa, retorna/recebe `'YYYY-MM-DD'`

**Comportamento:**
- `<input type="text">` comum, sem máscara real-time (evita cursor pulando/"piscar")
- Parse só roda no `onBlur`/`Enter` — durante a digitação o texto fica livre
- Reconhece múltiplos formatos por contagem de dígitos, ignorando separador (`/`, `-`, ou nenhum): `MMAAAA`, `MMAA`, `MM/AAAA`, `MM/AA` (competência); `DDMMAAAA`, `DDMMAA`, `DD/MM/AAAA`, `DD/MM/AA` (data completa)
- Ano de 2 dígitos sempre expande para `20YY` (sem pivô de século — fora do domínio do LEDGR)
- Se inválido (mês fora de 1-12, dia inexistente no calendário): borda vermelha, **não commita**, mantém o último valor válido — diferente do `type="date"` nativo, que clampava silenciosamente sem o usuário perceber

**Aplicado em `RendaFixaPage.tsx`:**
- Filtro de competência (antigo `type="month"`) → `SmartMonthInput`
- `InvestimentoModal`: Data aplicação (disabled ao editar, preservado) e Vencimento → `SmartDateInput`
- `ResgateModal`: Data do resgate → `SmartDateInput`

**PENDENTE — rollout para o resto do projeto:**
Há outros `type="date"`/`type="month"` espalhados pelo sistema (não auditado ainda) com o mesmo bug. Próxima sessão: levantar todas as ocorrências via busca recursiva em `frontend/src` (`type='date'`, `type="date"`, `type='month'`, `type="month"`), priorizar telas de uso frequente (Contas a Pagar/Receber, Provisões, Fechamento, Agenda, Folha, Férias, ECD/SPED), e migrar uma a uma pro `SmartDateInput`/`SmartMonthInput`, seguindo o mesmo fluxo cirúrgico (inspecionar → bloco PS → confirmar).

---

### Inventário type="date"/type="month" — Rollout SmartDateInput/SmartMonthInput (07/07/2026)

**Total: 131 ocorrências em 61 arquivos.** Lista completa salva em `D:\Temp\inventario_date_inputs.txt` (gerar novamente se necessário: `Get-ChildItem frontend/src -Recurse -Filter *.tsx | Select-String -Pattern "type=['\"]date['\"]","type=['\"]month['\"]"`).

**Ordem de migração definida:** Financeiro → Departamento Pessoal → demais módulos.

#### PRIORIDADE 1 — Financeiro (16 ocorrências / 8 arquivos)
- [ ] `components/finance/FiscalDocumentModal.tsx` — L179 (month), L232, L240 (date) — 3
- [ ] `pages/finance/ContasAReceberPage.tsx` — L182, L183, L329 (date) — 3
- [ ] `pages/finance/PettyCashPage.tsx` — L174, L175, L236 (date) — 3
- [ ] `pages/finance/FechamentoPage.tsx` — L389, L457 (month) — 2
- [ ] `pages/finance/ProvisoesPage.tsx` — L418, L423 (month) — 2
- [ ] `components/finance/AgendaEventModal.tsx` — L242 (date) — 1
- [ ] `components/finance/APPayModal.tsx` — L143 (date) — 1
- [ ] `components/finance/APPositionReport.tsx` — L60 (date) — 1

#### PRIORIDADE 2 — Departamento Pessoal (36 ocorrências / 9 arquivos)
- [ ] `pages/hr/EsocialPage.tsx` — L185, L242, L259, L272, L293, L328, L356, L395, L460, L473, L503, L504, L533, L562 (mix date/month) — 14 **(maior arquivo do inventário — migrar com atenção redobrada, tem varios eventos S-XXXX diferentes)**
- [ ] `pages/hr/EmployeeDetailPage.tsx` — L404, L432, L459, L460, L491, L508, L558, L562 — 8
- [ ] `pages/hr/ProLabore.tsx` — L212, L216, L422, L426, L645, L649 (month) — 6
- [ ] `pages/hr/FeriasPage.tsx` — L230, L234 (date) — 2
- [ ] `pages/hr/RecessoPage.tsx` — L207, L211 (date) — 2
- [ ] `pages/hr/DctfWebPage.tsx` — L28 (month) — 1
- [ ] `pages/hr/DecimoTerceiroPage.tsx` — L93 (date) — 1
- [ ] `pages/hr/FolhaPage.tsx` — L396 (month) — 1
- [ ] `pages/hr/InformeRendimentosPage.tsx` — L367 (date) — 1

#### PRIORIDADE 3 — Demais módulos (79 ocorrências / 44 arquivos)

**Contabilidade (accounting):**
- [ ] `pages/accounting/investments/CdiTabelaPage.tsx` — L228, L229 (date), L366, L436 (month) — 4
- [ ] `components/accounting/BalanceView.tsx` — L55, L62 — 2
- [ ] `components/accounting/ReportToolbar.tsx` — L132, L139 — 2
- [ ] `pages/accounting/BalancesPage.tsx` — L75, L85 — 2
- [ ] `pages/accounting/BulkDeleteModal.tsx` — L69, L74 — 2
- [ ] `pages/accounting/DiarioGeralPage.tsx` — L96, L98 — 2
- [ ] `pages/accounting/EcdValidationPage.tsx` — L82, L93 — 2
- [ ] `pages/accounting/JournalPage.tsx` — L171, L631 — 2
- [ ] `pages/accounting/RazaoAnaliticoPage.tsx` — L124, L128 — 2
- [ ] `pages/accounting/investments/CdbProjecaoPage.tsx` — L194, L196, L242 — 3
- [ ] `pages/accounting/investments/RendaFixaPage.tsx` — L954 (bulkComp, month) — **1 restante, não pego na 1a rodada de hoje**
- [ ] `pages/accounting/AccountsPage.tsx` — L143 — 1

**Societário / Corporate:**
- [ ] `pages/corporate/shareholders/ShareMovementModal.tsx` — L419, L424, L500, L516 — 4
- [ ] `pages/corporate/shareholders/ShareholdersPage.tsx` — L760, L852, L873 — 3
- [ ] `pages/companies/corporate/statute/StatuteEdit.tsx` — L190, L199 — 2
- [ ] `pages/companies/CompanyEdit.tsx` — L183 — 1
- [ ] `pages/companies/CompanyForm.tsx` — L230 — 1
- [ ] `pages/companies/CompanyShow.tsx` — L316 — 1
- [ ] `pages/companies/corporate/atas/age/AgeEdit.tsx` — L588 — 1
- [ ] `pages/companies/corporate/contratos/ContratoEdit.tsx` — L704 — 1
- [ ] `pages/companies/corporate/meetings/MeetingForm.tsx` — L133 — 1

**Patrimônio (assets):**
- [ ] `pages/assets/AssetsList.tsx` — L432, L436 (month) — 2
- [ ] `pages/assets/modals/ImprovementModal.tsx` — L66, L69 — 2
- [ ] `pages/assets/modals/MaintenanceModal.tsx` — L83, L94 — 2
- [ ] `pages/assets/modals/RetrofitModal.tsx` — L51, L54 — 2
- [ ] `pages/assets/modals/AppraisalModal.tsx` — L51 — 1
- [ ] `pages/assets/modals/AssetFormModal.tsx` — L288 — 1
- [ ] `pages/assets/modals/WriteOffModal.tsx` — L98 — 1

**Documentos / Assinaturas:**
- [ ] `pages/documentos/ImportarDocumentoModal.tsx` — L172 — 1
- [ ] `pages/documentos/RedigirProcuracaoModal.tsx` — L302 — 1
- [ ] `pages/documents/DocumentUpload.tsx` — L246 — 1
- [ ] `pages/documents/signatures/SignatureRequest.tsx` — L109 — 1

**Fiscal (não-Financeiro):**
- [ ] `pages/fiscal/NfseImportPage.tsx` — L184, L189, L230, L233 — 4
- [ ] `pages/fiscal/DocumentosFiscaisPage.tsx` — L126 (month) — 1

**Cadastros:**
- [ ] `pages/persons/PersonForm.tsx` — L685, L804, L896, L1267 — 4

**Sistema:**
- [ ] `pages/sistema/TabelasLegaisPage.tsx` — L430, L490, L556, L560 — 4
- [ ] `pages/sistema/CalendarioPage.tsx` — L345 — 1
- [ ] `pages/sistema/IndicadoresPage.tsx` — L238 (month) — 1
- [ ] `pages/sistema/ObrigacoesPage.tsx` — L359 (month) — 1

**SPED:**
- [ ] `pages/sped/EcdPage.tsx` — L715, L720 — 2
- [ ] `pages/sped/EcdPreValidatePage.tsx` — L151, L160 — 2
- [ ] `pages/sped/EcfPage.tsx` — L837, L846 — 2

**Administração:**
- [ ] `pages/admin/AuditPage.tsx` — L138, L144 — 2

---

**Observações para a migração:**
- `EsocialPage.tsx` mistura `type="date"` e `type="month"` no mesmo arquivo — usar `SmartDateInput` e `SmartMonthInput` conforme o campo (competencia/perApur = month; datas de evento = date).
- Vários campos tem `max="9999-12-31"` no input original — esse `max` não existe mais no `SmartDateInput`/`SmartMonthInput` (não é necessário, o componente já valida ano 1900-2100 internamente).
- Padrão de import: `import { SmartDateInput } from '../../components/SmartDateInput';` ou `'../../../components/SmartDateInput'` dependendo da profundidade da pasta (ajustar por arquivo).
- Fluxo por arquivo: inspecionar (Get-Content das linhas exatas) → bloco PS cirúrgico → confirmar antes do próximo arquivo. Não converter em lote sem ver o contexto de cada input (alguns tem `disabled`, `max`, `className` em vez de `style`).

---

### Rollout SmartDateInput/SmartMonthInput — Pontos de atenção registrados (08/07/2026)

**1) Conflito Tailwind (className) vs style inline fixo**
`SmartDateInput`/`SmartMonthInput` sempre aplicam um `style` inline fixo (altura 28px, borda, padding,
`background: var(--color-background-primary)`), independente de `className` ser passado.
Em arquivos que usam Tailwind puro (ex: `BalanceView.tsx`, `BalancesPage.tsx` — `className="border rounded-lg px-3 py-2"`),
isso faz o componente sobrescrever visualmente as classes Tailwind (outra altura, outra borda, sem o
`focus:ring` azul). Decisão tomada em 08/07/2026: aceitar o visual divergente por ora (não bloquear o
rollout). **Pendente para sessão futura de UI/UX:** decidir entre (a) ajustar o componente pra respeitar
className quando presente (aplicar style minimo so pra borda vermelha de invalido), ou (b) padronizar
todo o app pro estilo do SmartDateInput e abandonar Tailwind nesses campos especificos.
Arquivos ja migrados com essa divergencia conhecida: `components/accounting/BalanceView.tsx`,
`components/accounting/ReportToolbar.tsx` (mix className+style), `pages/accounting/BalancesPage.tsx`.

**2) CdiTabelaPage.tsx — bulkComp duplicado**
O campo `bulkComp` (competencia, month) aparecia **2x com texto identico** no arquivo (L366 e L436),
usado em duas abas diferentes do modal (provavelmente "Mensal" e algo como "Atualização Mensal" — nao
confirmado o nome exato da segunda aba). Migrado com replace count=2 (ambas as ocorrencias tratadas
juntas, pois o texto era 100% identico). **Verificar em teste manual:** confirmar que as duas abas
realmente devem compartilhar a mesma logica/campo `bulkComp`, ou se sao dois estados distintos que
coincidentemente tinham o mesmo texto de input (nesse caso so uma foi migrada corretamente, a outra
pode precisar de variavel propria — revisar `CdiTabelaPage.tsx` linhas ~360-440 se o comportamento
das duas abas parecer cruzado apos o teste).

---

### Rollout SmartDateInput/SmartMonthInput — CONCLUÍDO (08/07/2026)

**Status: 100% completo.** 131 ocorrências de `type="date"`/`type="month"` migradas em 61 arquivos, 11 módulos.

| Módulo | Arquivos | Ocorrências |
|---|---|---|
| Financeiro | 8 | 16 |
| Departamento Pessoal | 9 | 36 |
| Contabilidade | 12 | 25 |
| Societário | 9 | 15 |
| Patrimônio | 7 | 11 |
| Documentos/Assinaturas | 4 | 4 |
| Fiscal (não-Financeiro) | 2 | 5 |
| Cadastros | 1 | 4 |
| Sistema | 4 | 7 |
| SPED | 3 | 6 |
| Admin | 1 | 2 |
| **Total** | **61** | **131** |

Checagem final: 0 ocorrências restantes em `frontend/src` (busca recursiva confirmada).

**Padrões consolidados:**
- Campos com `name`+`handleChange` generico: `onChange={(v) => handleChange({ target: { name: 'x', value: v } } as any)}`
- `required`, `max`, `min` estaticos nao suportados pelo componente — removidos
- Regras de negocio com `min` dinamico (data >= abertura empresa, prazo >= hoje) preservadas via bloqueio manual no `onChange` (CompanyShow.tsx, SignatureRequest.tsx)
- Divergencia visual Tailwind (`className`) vs style fixo do componente — aceita por decisao, ~15 arquivos afetados, pendente de revisao de UI futura

**Bugfix relacionado (não causado pelo rollout):** `RendaFixaPage.tsx` tinha atributo `style` duplicado no botão "Gerar retroativos" (commit `f2017d07`, 07/05/2026) — corrigido durante auditoria pós-rollout, commit `1f3d341`.

---

### Auditoria ampliada pós-rollout (08/07/2026)

Rodada além do `tsc --noEmit` do frontend (266 erros, ja mapeados por codigo TS em sessao anterior).

**Resultado por frente:**
| Auditoria | Resultado |
|---|---|
| ESLint (frontend) | 0 erros, 0 warnings |
| `tsc --noEmit` backend (apps/api) | 0 erros |
| `prisma validate` | Schema valido |
| `madge --circular` (frontend + backend) | Nenhuma dependencia circular |
| `vite build` (producao) | **FALHA** |
| `npm audit` frontend | 13 vulnerabilidades (1 low, 8 moderate, 4 high) |
| `npm audit` backend | 35 vulnerabilidades (3 low, 15 moderate, 17 high) |
| `console.log`/`debugger` | 94 ocorrencias (frontend+backend) |
| `TODO`/`FIXME`/`XXX` | 15 ocorrencias |

**CRÍTICO — Build de produção quebrado:**
`frontend/src/pages/users/PendentesPage.tsx` — `useState` com tipo inferido errado
(`companyIds` virou `never[]` em vez de `string[]`), cascateando ~30 erros
`Property 'X' does not exist on type 'never'` no mesmo arquivo. Bug pre-existente,
commit `91080fc` (19/06/2026, "feat(registro): Header badge pendentes..."), nao
relacionado ao rollout de datas. **Bloqueia deploy — prioridade maxima da proxima sessao.**
Linha de origem: `const toggle=(id)=>setForm(f=>({...f,companyIds:f.companyIds.includes(id)?...}));`
(useState inicial provavelmente sem tipo explicito em companyIds).

**Vulnerabilidades de seguranca (alta severidade) mais relevantes:**
- **Axios** (SSRF via NO_PROXY bypass, prototype pollution em validateStatus) — usado em toda chamada de API, front e back
- **form-data** (CRLF injection) — provavel via upload de documentos/certificados
- **xmldom** (XML injection, DoS) — relevante para geracao de XML eSocial/NFS-e/SPED
- **basic-ftp**, **linkify-it**, `@nestjs/core` (injection) — impacto mais indireto
- Detalhe completo salvo em `D:\Temp\audit_npm_frontend.txt` / `audit_npm_backend.txt` (json tambem disponivel)
- **Nao rodar `npm audit fix --force` sem revisao individual** — risco de breaking changes

**Ruido de baixa prioridade (nao urgente):**
- 94 `console.log`/`debugger` — poluicao de log, risco leve de vazamento de dado em console do navegador. Detalhe: `D:\Temp\audit_console_log.txt`
- 15 `TODO`/`FIXME`/`XXX` nunca centralizados. Detalhe: `D:\Temp\audit_todos.txt`
- 266 erros `tsc --noEmit` frontend (nao bloqueiam build via Vite/esbuild, mas sao divida tecnica) — distribuicao por codigo ja registrada anteriormente (TS2339=139, TS7006=32, TS2322=29, TS2345=13, TS2304=9, TS2307=9, TS2367=8, TS7053=6, TS2554=4, TS2353=4, TS7031=4, TS2741=3, TS2300=2, outros=3). 48 arquivos distintos afetados. Detalhe completo: `D:\Temp\tsc_errors_full_2026-07-08.txt`

**Ordem de prioridade sugerida para proxima sessao:**
1. `PendentesPage.tsx` — corrige build quebrado (bloqueia deploy)
2. Revisar `npm audit fix` nas dependencias de alta severidade, uma a uma (Axios primeiro — maior superficie de uso)
3. Os 266 erros de tipagem tsc restantes, categorizados por modulo/arquivo
4. Limpeza de `console.log`/`debugger` e centralizacao dos `TODO`/`FIXME`

---

### PendentesPage.tsx corrigido + limpeza de código morto (08/07/2026)

**Bug crítico resolvido:** `PendentesPage.tsx` bloqueava `npm run build` (tsc -b como gate antes
do vite build). Causa: 5 `useState` sem generic explícito — TypeScript inferia `never[]`/`never`
a partir do valor inicial vazio, cascateando ~30 erros de "Property does not exist on type never".
Corrigido com tipos explícitos (`useState<any[]>`, `useState<{...;companyIds:string[]}>` etc).
**Nota:** tipagem usada foi `any[]`/`any` pragmático, não interfaces completas — suficiente pra
destravar o build, mas há espaço para tipagem mais rigorosa numa passada futura.

**3 arquivos órfãos removidos** (movidos para `frontend/_orfaos_removidos_2026-07-08/`, não
deletados — reversível): `pages/login/Login.tsx`, `pages/persons/index.tsx`, `pages/users/index.tsx`.
Confirmado via grep recursivo: zero referências/imports no projeto inteiro, zero rotas associadas
em `routes/index.tsx`. Eram sobra de estrutura antiga. **O login real do sistema acontece embutido
diretamente no `Header.tsx`** (formulário com `useAuth().signIn()`), não existe tela dedicada de
login no fluxo ativo — só `/register` como link separado.

**Resultado:** `npm run build` caiu de 266→232 erros TS restantes (34 eliminados só com essas
duas correções). Build **ainda falha** — os 232 restantes são o próximo item de prioridade.

---

### Inventário categorizado — 232 erros TS restantes no build (08/07/2026)

Lista completa salva em `D:\Temp\audit_vite_build_v3.txt`. Amostra já revisada (primeiros ~50)
revela padrões de causa raiz distintos, não apenas "tipagem solta" genérica:

**A) Interfaces desalinhadas com uso real (investigar caso a caso, pode ser bug ativo):**
- `SideBar.tsx` — union type dos itens de menu não declara `children`/`disabled`/`isImport` como
  opcionais em todas as variantes (7+ erros no mesmo arquivo, causa raiz única — 1 fix no type
  resolve todos)
- `AuthContextData` sem `logout` (usa `signOut`? — `SideBar.tsx` L40) — confirmar nome real do metodo
- `CompanyContextData` sem `empresa` (`SignaturePanel.tsx` L50) — confirmar se propriedade existe
  com outro nome ou se é uso indevido
- `Company` sem `cnpj`/`name` em vários lugares (`DiarioGeralPage.tsx`, `RazaoAnaliticoPage.tsx`,
  `BalanceComparisonPage.tsx`) — possível campo renomeado no schema sem atualizar todos os usos
- `AccountInfo` sem `reducedCode` (`RazaoAnaliticoPage.tsx`, múltiplas ocorrências)
- `AccountNode` sem `children` (`AccountTree.tsx`)

**B) Dependência faltando / módulo não encontrado:**
- `@tanstack/react-query` — não instalado, mas importado em `ChartOfAccountsPage.tsx`
- `CertificateImportModal.tsx` → `'../../services/api'` não resolve (path pode estar errado,
  arquivo pode estar em profundidade diferente do esperado)
- `useEcdViewer` não encontrado em `EcdHistoryPage.tsx`

**C) Versão de biblioteca desalinhada com tipos:**
- `Toaster` (react-hot-toast) "cannot be used as JSX component" em `Layout.tsx` — sugere
  `@types/react` ou `react-hot-toast` desatualizado/incompatível

**D) Bugs de digitação/sintaxe reais:**
- `AccountTree.tsx` L18-19 — identificador `difference` duplicado
- `PersonForm.tsx` L78 — `Dependets` (typo, deveria ser `Dependents`)
- `RazaoAnaliticoPage.tsx` L238 — `item` não declarado (variável usada fora de escopo, 3 ocorrências
  na mesma linha)
- `JournalPage.tsx` L533 — `EcdOpeningModal` não encontrado (import faltando ou removido)
- `ObrigacoesPage.tsx` L189, `EcdViewerPage.tsx` L9 — chamada de função com número errado de argumentos

**E) Ruído de tipagem implícita (baixo risco, cosmético):**
- Múltiplos `Parameter 'x' implicitly has an 'any' type` (TS7006) — não quebra runtime
- `textAlign`/`boxSizing`/`position` como `string` genérico em vez do tipo literal do CSS
  (React.CSSProperties) — padrão recorrente em objetos de estilo inline sem `as const`

**Comando para retomar a categorização completa (todos os 232, não só a amostra de 50):**
```powershell
Get-Content "D:\Temp\audit_vite_build_v3.txt" | Select-String -Pattern "error TS" | `
    ForEach-Object { ($_ -split "\(")[0] } | Group-Object | Sort-Object Count -Descending
```
(gera contagem de erros por arquivo — usar para priorizar quais arquivos atacar primeiro)

**Recomendação de abordagem para a próxima sessão:** começar pela categoria (A), já que um
único fix de type/interface geralmente resolve vários erros simultâneos (efeito cascata
inverso do que vimos no PendentesPage.tsx). Categoria (D) tem poucos itens mas são bugs reais
— resolver em paralelo. Categorias (B) e (C) precisam de decisão (instalar dependência? fixar
versão?) antes de mexer em código. Categoria (E) é a menor prioridade — não impede nada, pode
ficar para uma "faxina" final depois que (A)-(D) estiverem resolvidas.

---

### Bug ativo — 401 em GET /finance/accounts-payable (08/07/2026, investigação parcial)

**Sintoma:** Tela "Contas a Pagar" (`/app/finance/accounts-payable`) não carrega dados nem
permite criar "+ Novo Título". Console mostra `401 (Unauthorized)` repetido em:
- `GET /finance/accounts-payable`
- `GET /finance/accounts-payable/position-report?refDate=...`

Login funciona normalmente (confirmado via log: `AuthContext.tsx` "Login realizado com sucesso",
empresas carregam, `x-company-id` é enviado em todo request). Log do backend confirma
`JwtStrategy.validate()` sendo chamado com sucesso repetidas vezes para o mesmo usuário
(Administrador Master, permissions.all=true) — ou seja, o token em si parece valido nesse ponto.

**Descartado como causa:**
- `CompanyGuard` (`multi-company.guard.ts`) sempre retorna `true` (validacao de acesso a
  empresa nao implementada ainda, ver TODO no proprio arquivo) — nao é ele barrando.
- `GLOBAL_COMPANY_ID` ('11111111-1111-1111-1111-111111111111', definido em
  `core/companies/company.service.ts`) é constante intencional do sistema ("Empresa Global
  Template", usada tambem em `accounting.service.ts`), nao um artefato acidental. Aparece no
  payload do JWT como companyId inicial antes da troca de empresa ativa — nao é a causa do
  401 (o `CompanyGuard` le do header `x-company-id`, nao do token).
- `jwt.strategy.ts` nao inclui `companyId` no objeto `user` retornado (so id/email/fullName/
  profile) — pode ou nao ser relevante, nao investigado a fundo.

**Ainda não verificado (próxima sessão):**
- Corpo exato da resposta 401 (`Response`/`Preview` na aba Network do DevTools) — não
  capturado ainda, é o proximo passo mais direto
- Confirmar se `Authorization: Bearer ...` esta presente nos Request Headers da chamada
  que falha
- Por que especificamente `accounts-payable` falha e outras rotas (users, companies) nao —
  comparar guards/decorators desse controller com outros que funcionam
- Verificar se ha algum interceptor global ou pipe de validacao de DTO (`FilterAPDto`) que
  possa estar rejeitando a query string vazia (`GET /finance/accounts-payable?` — note o
  `?` sem parametros no log, pode ser relevante)

**Bug secundário relacionado, mesma tela:** `GET /accounting/chart-of-accounts?isAnalytic=true`
retorna 404 em `ContasAReceberPage.tsx:82` — endpoint pode nao aceitar esse query param nessa
rota, ou rota errada sendo chamada. Nao investigado.

---

### Bug ativo — 401 em GET /finance/accounts-payable (08/07/2026, investigação parcial)

**Sintoma:** Tela "Contas a Pagar" (`/app/finance/accounts-payable`) não carrega dados nem
permite criar "+ Novo Título". Console mostra `401 (Unauthorized)` repetido em:
- `GET /finance/accounts-payable`
- `GET /finance/accounts-payable/position-report?refDate=...`

Login funciona normalmente (confirmado via log: `AuthContext.tsx` "Login realizado com sucesso",
empresas carregam, `x-company-id` é enviado em todo request). Log do backend confirma
`JwtStrategy.validate()` sendo chamado com sucesso repetidas vezes para o mesmo usuário
(Administrador Master, permissions.all=true) — ou seja, o token em si parece valido nesse ponto.

**Descartado como causa:**
- `CompanyGuard` (`multi-company.guard.ts`) sempre retorna `true` (validacao de acesso a
  empresa nao implementada ainda, ver TODO no proprio arquivo) — nao é ele barrando.
- `GLOBAL_COMPANY_ID` ('11111111-1111-1111-1111-111111111111', definido em
  `core/companies/company.service.ts`) é constante intencional do sistema ("Empresa Global
  Template", usada tambem em `accounting.service.ts`), nao um artefato acidental. Aparece no
  payload do JWT como companyId inicial antes da troca de empresa ativa — nao é a causa do
  401 (o `CompanyGuard` le do header `x-company-id`, nao do token).
- `jwt.strategy.ts` nao inclui `companyId` no objeto `user` retornado (so id/email/fullName/
  profile) — pode ou nao ser relevante, nao investigado a fundo.

**Ainda não verificado (próxima sessão):**
- Corpo exato da resposta 401 (`Response`/`Preview` na aba Network do DevTools) — não
  capturado ainda, é o proximo passo mais direto
- Confirmar se `Authorization: Bearer ...` esta presente nos Request Headers da chamada
  que falha
- Por que especificamente `accounts-payable` falha e outras rotas (users, companies) nao —
  comparar guards/decorators desse controller com outros que funcionam
- Verificar se ha algum interceptor global ou pipe de validacao de DTO (`FilterAPDto`) que
  possa estar rejeitando a query string vazia (`GET /finance/accounts-payable?` — note o
  `?` sem parametros no log, pode ser relevante)

**Bug secundário relacionado, mesma tela:** `GET /accounting/chart-of-accounts?isAnalytic=true`
retorna 404 em `ContasAReceberPage.tsx:82` — endpoint pode nao aceitar esse query param nessa
rota, ou rota errada sendo chamada. Nao investigado.

---

### ATUALIZAÇÃO — Padrão de Modais vira REGRA GERAL DO PROJETO (08/07/2026)

O padrão de modal registrado acima (baseado em APPayModal/APCreateModal) deixa de ser
específico do módulo Financeiro e passa a ser a convenção padrão para **qualquer modal
novo em qualquer módulo do LEDGR** (Contabilidade, Societário, Patrimônio, RH, Fiscal, etc).

Ao criar um modal novo daqui pra frente, seguir sempre:
- Cores `FIN`/`FIN_ACCENT`/`FIN_LIGHT` (ou paleta equivalente do módulo, se já existir uma
  cor de identidade própria documentada — ex: módulos podem ter suas próprias cores de
  destaque, mas a *estrutura* do modal é sempre a mesma)
- Header escuro com título + subtítulo + botão × de fechar
- Seções agrupadas com `borderLeft` na cor de destaque para o bloco principal
- Footer padrão: Cancelar (outline) + Ação (preenchido), alinhados à direita, `background:#FAFAFA`
- Componente `Label` + `const inputSt` reutilizáveis
- **SmartDateInput/SmartMonthInput sempre** para qualquer campo de data — nunca
  `<input type="date">`/`type="month">` nativo, em nenhuma circunstância
- Bloco de erro padrão (`#FCEBEB`/`#A32D2D`) para erros de API e de validação de formulário

Registrado também na memória de sessão do Claude para aplicação automática, sem precisar
ser solicitado a cada modal novo.

---

### Módulo Banco de Horas — descoberto, corrigido e melhorado (08/07/2026)

**Descoberta inicial:** funcionalidade existia desde sessão anterior (RH), mas sem item no
menu, sem página consolidada — só acessível via aba dentro de `EmployeeDetailPage.tsx`.
Criada `BancoHorasPage.tsx` (visão consolidada de todos os funcionários, usando o endpoint
`GET /hr/employees/banco-horas/relatorio` que já existia no backend mas nunca era chamado
pelo frontend). Item "Banco de Horas" adicionado ao menu Departamento Pessoal (ícone
`FiClock`), rota `/app/hr/banco-horas`.

**Bug crítico encontrado e corrigido — botão "Lançar" nunca funcionava:**
`bhDto` (estado do modal em `EmployeeDetailPage.tsx`) declarava campo `minutos`, mas o input
do formulário lia/escrevia em `bhDto.minutosOriginais` — nome divergente, então
`bhDto.minutos` nunca era preenchido. O botão checava `disabled={...||!bhDto.minutos}`,
ficando permanentemente desabilitado. Mesmo padrão de bug de "campo com nome trocado" que já
apareceu antes nesta sessão (token key, rota payBatch) — vale ficar atento a esse tipo de
erro ao revisar outros módulos ainda não auditados.

**Achado mais profundo — dois sistemas paralelos de Banco de Horas no backend:**
- `BancoHorasService` (`services/banco-horas.service.ts`) — o robusto: `creditar()`,
  `debitar()`, `ajustar()`, `getSaldo()`, `getRelatorio()`, `configurar()`. Aplica
  multiplicador por `tipoHora` (regras CLT: diurna 50%, noturna, sábado, domingo, feriado).
- `EmployeeService.addLancamentoBH()` (`services/employee.service.ts`) — o simplificado:
  ignora completamente `tipoHora`/multiplicador, só soma/subtrai minuto bruto.

O modal estava plugado no endpoint genérico (`POST /:id/banco-horas` → `addLancamentoBH`),
tornando o seletor "Tipo de Hora" decorativo — nenhum multiplicador era aplicado de verdade.
**Corrigido:** modal agora roteia por `tipo` para os endpoints certos do `BancoHorasService`:
- `CREDITO` → `POST /banco-horas/creditar` (aplica multiplicador real)
- `DEBITO` → `POST /banco-horas/debitar` (valida saldo insuficiente no backend)
- `AJUSTE` → `POST /banco-horas/ajustar` (aceita valor negativo)
- `EXPIRACAO` → **contorno**, roteada como ajuste negativo (`-Math.abs(minutos)`) via
  `/ajustar`. **Pendência real:** não existe método `expirar()` dedicado no
  `BancoHorasService` — o correto seria criar um método próprio (provavelmente com lógica de
  validade/prazo automática, não so decremento manual). Não implementado, fora do escopo
  desta sessão.

**Melhoria: tipo de hora NORMAL (sem acréscimo) adicionado:**
Até então só existiam opções com multiplicador embutido (mínimo 50% para "Diurna" — não
havia `case 'DIURNA'` explícito, caía no `default: return 1.50`). Não havia forma de
creditar hora pura 1:1 (compensação simples, art. 59 CLT — modelo mais comum de banco de
horas por acordo de compensação de jornada, sem hora extra). Adicionado:
- Migration: `ALTER TYPE tipo_hora_bh ADD VALUE 'NORMAL'`
- `getMultiplicador()`: `case 'NORMAL': return 1.00;`
- Opção "Normal (sem acréscimo)" no seletor do modal

**Endpoint órfão identificado, não corrigido:** `GET /hr/employees/banco-horas/relatorio`
existia pronto no backend antes de hoje, mas nenhuma tela do frontend o chamava — mesmo
padrão de "código pronto sem uso" já visto com arquivos órfãos (`Login.tsx`, `persons/index.tsx`,
`users/index.tsx`). Agora está em uso via `BancoHorasPage.tsx`.

**Recomendação para sessão futura:** este módulo teve 3 problemas reais descobertos numa
única investigação guiada pelo usuário ("cadê o Banco de Horas?" → "por que o botão não
funciona?" → "por que só tem hora com acréscimo?"). Vale considerar uma auditoria mais
ampla de outros módulos de RH (Férias, Recesso, 13º, Rescisão) em busca do mesmo padrão:
campos com nome divergente entre estado/formulário/backend, endpoints prontos sem uso no
frontend, e funcionalidades sem item de menu.

---

### BUILD DE PRODUÇÃO 100% CORRIGIDO — 230 → 0 erros TypeScript (08/07/2026)

**Marco importante:** `npm run build` estava quebrado desde 19/06/2026 (commit `91080fc`,
`PendentesPage.tsx`), sem que ninguém notasse — porque `npm run dev` não roda `tsc`, só
esbuild permissivo. Auditoria pós-rollout de datas revelou o problema; corrigido nesta sessão
em ~15 lotes incrementais, cada um testado e commitado separadamente.

**Progressão:** 267 (contagem inicial via tsc --noEmit) → 230 (primeira contagem real via
`npm run build`) → 121 → 116 → 100 → 63 → 44 → 40 → 17 → 8 → 3 → **0**.

**Padrão mais recorrente (7 ocorrências nesta sessão): campo com nome divergente entre
interface TypeScript e uso real no código** — sintoma de refatorações onde o campo foi
renomeado em um lugar mas não em todos:
1. `PendentesPage.tsx` — useState sem generic (ontem)
2. `RazaoAnaliticoPage.tsx` — `activeCompany.cnpj` (correto: `taxId`)
3. `AgeView.tsx` — mesmo `cnpj`/`taxId`
4. `DiarioGeralPage.tsx` — mesmo `cnpj`/`taxId` (3º arquivo distinto com esse exato bug)
5. `ContratoEdit.tsx` — `useAuth().usuario` (correto: `user`)
6. `SignaturePanel.tsx` — `useCompany().empresa` (correto: `activeCompany`)
7. `PersonForm.tsx` — `Dependents.gender` (código sempre usou `sexo`)

**Recomendação para futuras sessões:** ao criar/editar qualquer componente que consome
`useAuth()`/`useCompany()`, sempre conferir a interface real do contexto
(`AuthContextData`: `user`, `signOut`; `CompanyContextData`: `activeCompany`, `companies`)
em vez de assumir nomes de campo por convenção ou memória.

**Outros bugs reais encontrados e corrigidos (não apenas tipagem):**
- `AccountTree.tsx` — identificador `difference` duplicado na interface (erro de digitação
  puro); `children` nunca declarado (impedia recursão real da árvore de contas)
- `use-ecd-viewer.ts` — hook lia `useParams()` internamente em vez de receber `importId`
  como argumento (o componente já passava certo, o hook que ignorava) — tela de visualização
  de ECD provavelmente nunca funcionou de verdade
- `ObrigacoesPage.tsx` — `calcDue()` chamado com 1 argumento, assinatura exige 2
- `AgeEdit.tsx`/`index.tsx` (atas/age) — import com profundidade de path errada (arquivo
  copiado de `statute/`, path relativo não ajustado)
- `react-hot-toast` — **nunca estava declarado no `package.json` do frontend**, existia só
  como instalação acidental na raiz do monorepo (`D:\Projetos\Ledgr\node_modules\`). Funcionava
  em dev por resolução ascendente do Node, mas quebrava `tsc`. Instalado oficialmente via
  `npm install react-hot-toast --save` dentro de `frontend/`.
- `Certificateimportmodal.tsx` — conflito de nome por case-sensitivity (Windows tolera,
  Linux/SERVER02 não) — renomeado para `CertificateImportModal.tsx`

**Código morto removido (movido para `frontend/_orfaos_removidos_2026-07-08/`, não deletado):**
- `ChartOfAccountsPage.tsx` — zero referências, dependência `@tanstack/react-query` nem instalada
- `EcdHistoryPage.tsx` — continha código de `EcdViewerPage` colado por engano, rota comentada
- `components/CertificateImportModal.tsx` — duplicata do arquivo em `pages/certificates/`

**Divergências de arquitetura documentadas, aceitas como estão:**
- `SortKey` em `AssetsList.tsx` relaxado para `string` (o union type original não cobria
  colunas dinâmicas reais como anos de depreciação)
- `AccountTree.tsx` ganhou prop `renderBalances` real (antes era passada sem nenhum efeito)
- Diversos `Record<Enum, string>` acessados com `as any` quando o valor de índice já vem
  como string solta do backend, não como o enum estrito do frontend

**IMPORTANTE — lição de processo:** durante a consolidação final, descobrimos que vários
arquivos ficaram "staged mas não commitados" em interações anteriores da sessão (a página
`BancoHorasPage.tsx` inteira, a rota correspondente, e as deleções dos 3 arquivos órfãos
originais). Um `git status` de verificação antes de declarar "build 100% resolvido" pegou
isso a tempo — o repositório remoto estava incompleto e um clone limpo teria falhado.
**Recomendação: sempre rodar `git status` full (não só conferir o commit mais recente) antes
de encerrar uma sessão longa com múltiplos commits incrementais.**

**Verificação final:** `git status` limpo, `npm run build` com 0 erros, a partir do estado
exato commitado em `a629bb5`. `vite v5.4.21 building for production... built in 35.20s`.

**Pendências que ficaram fora do escopo desta sessão (não eram bugs de build):**
- `npm audit`: 48 vulnerabilidades de segurança (Axios SSRF, form-data, xmldom, etc.) —
  próximo item de prioridade, não corrigir com `--force` sem revisão individual
- `payBatch` (baixa em lote AP) com rota divergente `/batch/pay` vs `/batch-pay` real
- `EXPIRACAO` no Banco de Horas sem endpoint dedicado (usa contorno via `ajustar`)
- Divergência visual Tailwind vs `SmartDateInput`/`SmartMonthInput` em ~15 arquivos

---

### npm audit — Frontend liquidado, Backend registrado como pendência maior (08-09/07/2026)

**Frontend: 13 → 2 vulnerabilidades, resolvido via `npm audit fix` (sem --force).**
Corrigidas sem breaking change: Axios (23 CVEs incluindo SSRF/prototype pollution),
form-data, js-yaml, linkify-it, markdown-it, postcss, react-router, yaml,
follow-redirects, @babel/core.

**Regressão corrigida:** upgrade do Axios mudou o tipo de `res.headers['x']` (agora
`AxiosHeaders` em vez de `string`) — `EmployeeDetailPage.tsx` usava `.includes()` direto,
quebrou o build. Corrigido envolvendo em `String(...)`. Build revalidado com 0 erros TS
apos a correcao. Commit `6970ca6`.

**Restam 2 vulnerabilidades (esbuild/vite) — decisao deliberada de NÃO forçar agora:**
`npm audit fix --force` instalaria `vite@8.1.3`, mas o dry-run revelou conflito real de
peer dependencies com dois pacotes centrais do build:
- `@tailwindcss/vite@4.2.1` — declara suporte só a `vite ^5.2 || ^6 || ^7`
- `@vitejs/plugin-react@4.7.0` — declara suporte só a `vite ^4.2 a ^7`

`--force` ignoraria esses avisos, deixando o Tailwind e o plugin do React rodando em
versão de Vite que eles próprios não afirmam suportar — risco de quebra sutil em
HMR/dev-server/build que o `tsc` não pegaria.

**Avaliação de risco da vulnerabilidade em si:** o alerta do `esbuild` é sobre o
**servidor de desenvolvimento** (`npm run dev`) aceitar requisições de origem externa —
não afeta build de produção nem o app publicado. Exploração exigiria o desenvolvedor
visitar um site malicioso enquanto o dev server local está ativo. Risco prático baixo
para o cenário atual (dev local, não exposto).

**Pendência para sessão dedicada futura:** upgrade coordenado de `vite` (5→7 ou 8) +
`@tailwindcss/vite` + `@vitejs/plugin-react` juntos, com teste completo de dev server,
build de produção, e renderização de estilos/HMR em várias telas antes de aceitar.

---

**Backend: 35 vulnerabilidades, NENHUMA aplicada — bloqueado por conflito estrutural.**
`npm audit fix` (sem --force) falhou com erro `ERESOLVE`: `@nestjs/axios@^4.0.1` (fixado
no `package.json`) exige `@nestjs/common@^10 || ^11`, mas existe uma dependência
transitiva de `@nestjs/axios@3.1.3` na árvore que só aceita `@nestjs/common` até `^10`.

Resolver a vulnerabilidade principal (`@nestjs/core` — injection) exigiria subir
`@nestjs/common`/`@nestjs/core`/`@nestjs/platform-express` para `11.x` — **upgrade major
do NestJS v10 → v11 no backend inteiro**, com breaking changes potenciais espalhados por
todos os módulos (accounting, finance, hr, sped, fiscal, corporate, assets, etc — 90+
controllers mapeados).

**Vulnerabilidades mais relevantes no backend (por severidade/uso difundido):**
- `@nestjs/core` (high) — requer NestJS v11
- `xmldom` (high) — XML injection, relevante para geração de XML eSocial/NFS-e/SPED
- `axios` (high) — mesmas 23 CVEs do frontend, backend usa Axios em integrações fiscais
- `multer` (high) — DoS via upload, usado em toda importação de arquivo do sistema
- `lodash` (high) — code injection via `_.template`
- `form-data`, `basic-ftp`, `path-to-regexp`, `picomatch`, `tmp`, `webpack`, `glob`, `ws` (high) —
  a maioria transitiva de ferramentas de dev/CLI, não necessariamente em produção
- `xlsx` (high) — **sem fix disponível** (SheetJS não lançou correção), usado em
  importação/exportação de planilhas Excel — avaliar substituição da biblioteca numa
  sessão futura se o risco for considerado inaceitável

**Recomendação para a sessão dedicada ao backend:**
1. Mapear todo uso de `@nestjs/*` no projeto antes de decidir a estratégia de upgrade
2. Testar upgrade do NestJS v10→v11 em branch separada, módulo por módulo
3. Avaliar separadamente o `xlsx` sem fix — pode precisar de biblioteca alternativa
   (ex: `exceljs`) se o risco for julgado alto para dados fiscais sensíveis
4. Não usar `--force` sem entender a árvore de dependências primeiro (mesmo erro do
   `@nestjs/axios` pode se repetir em outros pacotes)

---

## Sessão 13/07/2026 — Sistema de Permissões de Sidebar (Fases A + B) + Auditoria de Segurança

**Contexto:** Pedido original era simples — "checkbox de selecionar tudo" na tela de Permissões de Sidebar. Virou uma reconstrução completa do sistema de permissões e uma auditoria de segurança que corrigiu falhas reais em produção.

### Fase A — Sidebar 100% Data-Driven
- `SidebarItem` (schema.prisma): ganhou `parentId` (self-relation, hierarquia real), `icon` (string, resolvido via registry), `dividerBefore`, `disabled`, `actionType`, `resource` (chave ligando item de menu → recurso de API).
- Reseed completo: 98 itens migrados do `SideBar.tsx` hardcoded para o banco, com hierarquia via `parent_id`. Path do path.
- **Descoberta:** o catálogo antigo (63 itens) estava desatualizado em relação ao menu real — causa raiz identificada: não havia fonte única de verdade. Agora o banco É a fonte única.
- Novo endpoint `GET /sidebar-permissions/tree` — árvore hierárquica completa do catálogo.
- `iconRegistry.ts` criado — mapa string→componente React Icon.
- `SideBar.tsx` reescrito: renderiza a partir da API (`/tree`) em vez de array hardcoded. Itens dinâmicos de Societário (dependem de `cid` da empresa ativa) injetados client-side, fora do catálogo.
- Itens problemáticos corrigidos: "NFS-e São Paulo" (path duplicado com filho), "Patrimônio" (path duplicado com filho — inofensivo pois nunca navegável).
- `resource` preenchido em todos os 98 itens (mapeamento manual para módulos sem controller óbvio ainda).

### Fase B — Níveis de Acesso (NONE/VIEW/EDIT/DELETE)
- `ProfileSidebarPermission`/`UserSidebarPermission`: `canView: Boolean` → `accessLevel: SidebarAccessLevel` (enum NONE/VIEW/EDIT/DELETE, cumulativo).
- Novo `SidebarResourceGuard` + decorator `@RequireResourceAccess(resource, level)` — guard real de API baseado no catálogo de sidebar (substitui o sistema legado `ProfileGuard`/`Profile.permissions` JSON).
- **Fallback de bootstrap:** perfil sem nenhuma linha configurada = acesso liberado (evita quebrar usuários existentes ao ativar guards novos). Assim que 1 item é configurado para um perfil, os demais não-configurados desse perfil passam a valer NONE.
- `PersonsController`: primeiro controller com guard real em produção (12 rotas: 5 VIEW, 4 EDIT, 3 DELETE/outras).
- `SidebarPermissionsPage.tsx`: reescrita completa como árvore hierárquica.
  - Checkbox por coluna (Nenhum/Visualizar/Editar/Excluir) no cabeçalho: preenche **apenas itens ainda sem definição** (não sobrescreve ajustes manuais); segundo clique desfaz só o que o próprio clique preencheu.
  - Definir nível num item pai propaga para toda a subárvore (mas não trava — filhos podem ser divergidos manualmente depois).
  - Endpoint `POST /sidebar-permissions/user/:id/bulk` criado (salvamento em lote, evitando 1 request por item).
- `SidebarPermissionsContext.tsx`: `canView`/`canEdit`/`canDelete`/`levelOf` sobre o novo `accessLevel`.
- `PersonForm.tsx`/`PersonList.tsx`: UX de bloqueio visual — botão Salvar desabilitado ("Somente leitura") quando sem EDIT; "Nova Pessoa"/editar/excluir ocultos conforme `canEdit`/`canDelete`; todos os `alert()` nativos trocados por `toast.error()`.

### Bugs críticos encontrados e corrigidos nesta sessão
1. **`SidebarPermissionsController` sem `@UseGuards(JwtAuthGuard)`** — qualquer requisição sem token retornava `userId` vazio → função de resolução de permissões nunca executava → fallback de bootstrap acionado incorretamente → parecia "liberar tudo" mesmo com restrições configuradas. Corrigido.
2. **Prisma `in: [valor, null]` inválido** para campos nullable — `resolveResourceLevel`/`resolvePermissions` quebravam com 500 ao checar override de usuário com `companyId`. Corrigido para `OR: [{companyId}, {companyId: null}]`.
3. **Auditoria completa de `@UseGuards(JwtAuthGuard)`** em todos os ~65 controllers do backend — 6 estavam sem autenticação nenhuma:
   - `backup.controller.ts` — `GET /system/backup/export` expunha backup completo do banco. Também tinha método duplicado (`export`/`handleExport` mapeados pra mesma rota) — duplicata removida.
   - `system.controller.ts` — export/import de qualquer tabela do banco, sem auth.
   - `balance-comparison.controller.ts`, `dashboard.controller.ts`, `accounting-views.controller.ts` — dados financeiros/contábeis sem auth.
   - `signatures.controller.ts` — guard aplicado rota a rota (não no controller inteiro): `clicksign/webhook` e `govbr/callback` mantidos públicos de propósito (chamados por serviços externos sem sessão LEDGR).
4. **Sistema legado (`ProfileGuard`/`RequirePermission`/`Profile.permissions` JSON) migrado** para `SidebarResourceGuard`/`RequireResourceAccess` em `UsersController`, `ProfilesController`, `CompanyController` — mesmo comportamento de acesso preservado, só o mecanismo mudou. Rota `/companies/audit` mantida sem alteração (pedido explícito). `ProfileGuard`/`RequirePermission` agora são código morto (nenhum uso real restante) — **não removidos ainda**, decisão pendente para sessão futura.
5. **Loop infinito de reload** — consequência direta da correção #1: `SideBar.tsx` chamava `GET /sidebar-permissions/tree` incondicionalmente (sem checar se `user` existe), e o `Layout` envolve todas as rotas incluindo a landing/login (`/`). Sem token → 401 → interceptor do `api.ts` redirecionava para `/login` (rota **inexistente** no app, que usa `/` como login) → fallback de rotas volta pra `/` → `Layout` remonta → `Sidebar` dispara `/tree` de novo → loop. Corrigido: `SideBar.tsx` só busca `/tree` com `user` autenticado; `api.ts` redireciona para `/` (não `/login`).

### Outras melhorias
- `main.ts`: `QuietLogger` customizado — filtra mensagens `RouterExplorer`/`InstanceLoader`/`RoutesResolver` do boot do Nest (reduz log de ~500 para ~10 linhas), mantendo erros e mensagens de negócio intactos.
- `hooks/useSidebarPermissions.ts` removido (código morto, substituído pelo Context).

### Pendências para próxima sessão
- **Antes do deploy em rede com usuários reais**, vale revisar:
  - Confirmar que `resource` em todos os 98 itens do catálogo está correto e que os módulos SEM guard real ainda (todos exceto Persons/Users/Profiles/Companies) não têm exposição indevida — hoje o nível configurado na árvore só controla visibilidade de menu nesses módulos, **não bloqueia API** ainda.
  - `ProfileGuard`/`RequirePermission`/`Profile.permissions` legado: decidir remoção ou manter documentado como código morto.
  - Dois arquivos `assets.controller.ts` (`modules/assets/assets.controller.ts` e `modules/assets/controllers/assets.controller.ts`) — suspeita de duplicação/código morto, não investigado ainda.
  - `ProfilesModule` (arquivo separado) parece não ser mais usado — `ProfilesController` está registrado dentro de `UsersModule`.
  - Usuário de teste `visualizador.teste@ledgr.local` (perfil Visualizador) reativado nesta sessão, senha resetada para `Visualizador@123` — considerar desativar ou trocar senha antes de ambiente de rede real.
- Estender o padrão de bloqueio visual (toast + botões desabilitados) aplicado em Persons para os demais módulos, conforme forem ganhando guards reais (Fase C, módulo por módulo).
- Aplicar `@UseGuards(JwtAuthGuard)` como checklist obrigatório em qualquer controller novo daqui pra frente.

---

## Convenções de senha (13/07/2026)

- **Senha padrão para novo usuário / reset manual:** `Troque@123` (sinaliza ao usuário que deve trocar no primeiro acesso). Usar esse valor sempre que resetar senha via script/banco daqui pra frente, para manter consistência.
- **Pendência identificada:** o sistema não tem rotina de recuperação de senha (esqueci minha senha). Hoje, todo reset é manual via banco (gerar hash bcrypt com Node e fazer UPDATE direto em `password_hash`). Isso não escala para usuários reais em produção/rede — precisa de um fluxo de "esqueci minha senha" (provavelmente: solicitação → e-mail com link/token de reset → tela para definir nova senha → expiração do token). Avaliar prioridade antes ou logo após o deploy em rede, dependendo de quantos usuários reais vão precisar se autenticar sem suporte manual disponível o tempo todo.

---

### Pendencia pos-deploy: tela "Editar Perfil" (JSON read/write/delete) obsoleta

Confirmado 15/07/2026: o campo Profile.permissions (JSON legado {read,write,delete}) nao
tem mais efeito algum sobre Operador/Visualizador desde a migracao de Users/Profiles/
Companies para SidebarResourceGuard. So resta 1 uso real: permissions.all === true continua
sendo o marcador de Master Admin (NAO REMOVER esse campo do schema por causa disso).
A tela /app/profiles/edit/:id ainda expoe esse JSON como se fosse funcional - editar
read/write/delete la nao muda nada na pratica, o que e enganoso para quem administra.
Tratar numa sessao futura (pos-deploy, sem pressa): esconder o editor JSON generico,
ou substituir por link para a tela real (/app/sistema/sidebar-permissions), preservando
apenas o campo "all" para identificar o Master Admin.

---

## PENDENCIA - PROXIMA SESSAO: Janela de acesso por horario/dia da semana

Feature solicitada 15/07/2026, escopo levantado mas NAO implementada ainda.

**Requisitos:**
- Horario permitido por usuario/perfil (ex: 08:00-18:00, seg-sex)
- Bloqueio total em mes(es) de ferias
- Somente Master Admin pode atribuir excecoes pontuais

**Desenho tecnico proposto:**
- Novo model AccessSchedule (ou campos direto em User): diasSemana[], horaInicio,
  horaFim, mesesBloqueados[], excecoes (tabela separada: userId, data, motivo, criadoPorId)
- Enforcement via guard GLOBAL (nao so no login) - similar ao JwtAuthGuard, roda em toda
  requisicao autenticada. Master Admin sempre bypassa (mesmo padrao de permissions.all).

**Decisoes pendentes de confirmar com o usuario antes de implementar:**
1. Bloqueia so no login, ou expulsa sessao ativa quando o horario vence?
2. Mes de ferias e fixo (ex: sempre dezembro) ou configuravel por usuario?
3. Excecao pontual e por data especifica, ou tambem permite desligar a regra
   temporariamente pro usuario inteiro?

---

## Sessão 17/07/2026 — Reorganização de Sidebar em Macro-Categorias

**Contexto:** Reorg total do posicionamento dos itens da sidebar a partir de proposta em .md do usuário (macro-categorias: Painel Principal, Gestão Operacional, Compliance & Obrigações, Configurações e Sistema).

**Achados fora do .md original:**
- 'Societário' existia duplicado: um em Arquivo (documentos) e um operacional real (Livros e Registros, Acionistas) não previsto no .md — ambos desambiguados com sufixo '· Arquivo' / '· Operação', mesmo padrão aplicado a 'Fiscal'.
- 'Administração' misturava itens estruturais (Usuários/Perfis/Auditoria/Backup) com parâmetros globais (Calendário/Indicadores/Tabelas Legais) — separados em 'Administração do Sistema' e novo item 'Parâmetros Globais'.

**Mudanças aplicadas (via UPDATE preservando IDs — zero impacto em profile_sidebar_permissions/user_sidebar_permissions já configuradas):**
- Divisores de macro-categoria adicionados: Gestão Operacional, Compliance & Obrigações, Configurações e Sistema.
- eSocial/RAIS/DCTFWeb reparentados de Departamento Pessoal -> SPED & Entregas (limpa rotina diária do DP).
- Novo item 'Parâmetros Globais' criado; Calendário/Indicadores/Tabelas Legais reparentados para ele.
- 'Acervo' renomeado para 'Arquivos Digitais' e reposicionado como item dentro de Gestão Operacional (decisão final do usuário — sem divisor próprio).

**Pendências desta sessão:**
- 'Mensagens' ainda no menu dinâmico — usuário quer fixo no header/rodapé (mudança de SideBar.tsx/Header.tsx, não feita ainda).
- SidebarPermissionsPage.tsx lista a árvore plana (depth=0 sem agrupar por divider_before) — sufixos '· Arquivo'/'· Operação' mitigam ambiguidade mas não resolvem de vez.
- SQL versionado em prisma/migrations-manuais/2026-07-17_sidebar_reorg_macro_categorias.sql.

**Atualização 17/07/2026 — Pendências da reorg de sidebar resolvidas na mesma sessão:**
- Mensagens: removida da arvore dinamica (SideBar.tsx filtra path '/app/chat'), agora e icone fixo no Header.tsx (respeita canView('/app/chat')).
- SidebarPermissionsPage.tsx: passou a exibir divider_before como cabecalho de secao, agrupando visualmente as macro-categorias e resolvendo de vez a ambiguidade Fiscal/Societario Arquivo vs Operacao.
- Commit 689544c. tsc --noEmit limpo.

**Atualização 17/07/2026 — Vite 5->7 concluido:**
- vite 5.4.21 -> 7.3.6 (pinado, nao usado npm audit fix --force que iria para 8.1.5 e quebraria peer deps do @tailwindcss/vite e @vitejs/plugin-react).
- Confirmado antes do upgrade: vite@7.3.6 exige esbuild ^0.27/^0.28, fora da faixa vulneravel <=0.24.2.
- Node v24.14.0, acima do minimo exigido pelo Vite 7 (20.19+/22.12+).
- npm audit: 0 vulnerabilidades (frontend zerado, era 2 restantes desde a sessao de 12/07).
- tsc --noEmit limpo, build de producao OK (1m55s). Dois avisos preexistentes sem relacao com o upgrade: import misto AgendaPage/ContasAPagarPage, chunk principal 2.7MB (xlsx contribui 429KB).
- Testado visualmente: dev server/HMR/Tailwind ok.

**Pendencia registrada 17/07/2026 — Revisao dos arquivos de ajuda/help:**
Usuario sinalizou intencao de revisar e reescrever integralmente os arquivos de ajuda
(contextualHelp e afins) antes da instalacao na rede para testes reais. Prioridade
alta por ser pre-requisito de UX/onboarding para os primeiros usuarios reais do sistema
fora do ambiente de desenvolvimento. Ainda nao escopado (nao sabemos quantos arquivos,
formato atual, nem se sera revisao de conteudo ou reescrita completa) - proxima sessao
dedicada deve comecar mapeando os arquivos de ajuda existentes antes de planejar.

---

## Sessão 17-18/07/2026 — Migração xlsx -> exceljs (vulnerabilidade sem fix)

**Motivo:** pacote xlsx (SheetJS) tinha 2 CVEs sem correção disponivel (Prototype Pollution, ReDoS).

**Escopo real (achado por grep completo, incluindo import() dinamico que grep inicial nao pegou):**
- apps/api/.../bank-parser.service.ts — parser Itau/Bradesco/BB/Santander + XLS generico (4 usos: XLSX.read, sheet_to_json, SSF.parse_date_code)
- apps/api/.../bank-import.service.ts — previewExcelMapped + uploadExcelMapped (Planilha Mapeada LM)
- frontend/.../AssetsList.tsx — export de depreciacao anual (unico uso no frontend, geracao nao leitura)

**Decisao de arquitetura critica:** workbook.xlsx.load() do exceljs (nao-streaming) causou
'JavaScript heap out of memory' (~4GB) com arquivo real de 46MB. Migrado para
ExcelJS.stream.xlsx.WorkbookReader (SAX-based) nos dois arquivos do backend -
resolve memoria mas exige reconstrucao manual do 'includeEmpty' (gaps de linha)
via row.number como indice.

**3 bugs REAIS encontrados e corrigidos na Planilha Mapeada (regressao da migracao,
xlsx antigo usava cellDates:true que mascarava os dois primeiros):**
1. Linha 1 da planilha LM real e um titulo ('Extrato de: Agencia...'), header
   verdadeiro esta na linha 2 - codigo assumia cegamente linha 1 = header.
   Fix: escaneia as 5 primeiras linhas procurando celula == 'data'.
2. Cabecalho tem coluna 'Data' DUPLICADA (uma mini-tabela/legenda extra mais a
   direita na mesma linha de header) - ultima ocorrencia sobrescrevia a correta.
   Fix: mantem so a 1a ocorrencia de cada nome de coluna (if (h && !(h in obj))).
3. Datas chegam como numero serial do Excel (ex: 45659), nao mais auto-convertidas
   para Date pelo exceljs streaming como o SheetJS+cellDates:true fazia.
   Fix: helper parseFlexibleDate() (Date | number serial | string DD/MM/AAAA).

**Limites de upload subidos (arquivo real de teste tem 46MB):**
- POST /bank-import/upload: 10MB -> 60MB
- POST /bank-import/preview-excel e /upload-excel: 15MB -> 60MB
- memoryStorage() do Multer mantido por ora; se precisar de arquivos >100MB no
  futuro, avaliar diskStorage (streaming para disco).

**npm overrides para uuid (exceljs depende de uuid@8.3.2, vulneravel):**
- Faixa vulneravel real e uuid <11.1.1 (nao so <9 como assumido inicialmente).
- Override deve ser ESCOPADO ('exceljs': { 'uuid': '^11.1.1' }), nunca global -
  um override global quebra o @nestjs/typeorm (que pina uuid em outra faixa).
- Projeto tem 3 arvores npm independentes (raiz do monorepo, apps/api via
  workspace, frontend como projeto standalone) - override precisa ser aplicado
  nos 3 package.json separadamente, nao propaga entre eles.

**xlsx removido de 100% dos package.json (raiz, apps/api, frontend) - confirmado
por grep de codigo-fonte E dist/ apos rebuild limpo.**

**Pendencia nao resolvida:** mensagem amigavel de erro 413 em
BankImportPage.tsx->handleConfirmUpload pode nao estar disparando corretamente
(assumi formato de erro estilo axios - e.response.status - sem confirmar contra
o hook useBankImport real). Testar/corrigir em sessao futura se o erro cru
'File too large' voltar a aparecer nesse fluxo especifico.

**Descoberta separada (fora de escopo, registrada para a sessao de NestJS v11):**
npm audit rodado a partir da RAIZ do monorepo (nunca feito antes, so dentro de
apps/api) revelou 53 vulnerabilidades reais, incluindo @nestjs/core (high,
injection) e uuid@9.0.1 pinado pelo proprio @nestjs/typeorm@10.0.2 (nao e
o mesmo uuid do exceljs, e problema dele, resolve so com upgrade para
@nestjs/typeorm@11.0.3). Tambem apareceram deps de outros workspaces nunca
antes visiveis (Prisma dev tooling, hono, effect, bcrypt/tar).

**Validacao real executada (nao so tsc/build):**
- '+Importar Extrato' com arquivo LM real de 46MB: 38 lancamentos, sem estouro
  de memoria, dados conferidos.
- 'Planilha Mapeada' com o mesmo arquivo: 38/38 OK, mesmos totais do extrato
  acima (R\.293,79 debito / R\.752,09 credito) - validacao cruzada por
  dois parsers diferentes. Confirmar Importacao testado ate o fim.
- Export de Depreciacao Anual (Patrimonio): arquivo .xlsx baixado e valido.

**Nota operacional:** processos node.exe zumbis se acumularam varias vezes
durante a sessao (rodar 'npm run build' manual enquanto 'npm run dev' watch
mode esta ativo corrompe a pasta dist e derruba o processo com MODULE_NOT_FOUND
ou ENOTEMPTY). Se acontecer de novo: Get-CimInstance Win32_Process -Filter
"Name='node.exe'" | Select ProcessId,CommandLine para identificar e matar so
os processos do backend (tsx src/main.ts), preservando o do Vite (frontend).

---

## Sessão 17-18/07/2026 (continuação) — Central de Ajuda: revisão e expansão

**Decisão tomada:** NÃO reescrever do zero. Design do HelpCenter/HelpArticleView mantido
(aprovado como está - busca, breadcrumb, blocos text/tip/warning/list/steps/table, artigos
relacionados). Trabalho é 100% de CONTEÚDO: cobertura (33/98 rotas cobertas no início) e
atualização (contextualHelp referenciava paths e categorias anteriores à reorg de hoje).

**Correção aplicada:** label '/app/arquivo' tinha revertido para 'Acervo' no banco (a
migração de sidebar desta sessão não persistiu esse campo especificamente) - corrigido
de volta para 'Arquivos Digitais' via UPDATE direto.

**Metodologia usada (repetir nos próximos lotes):** NUNCA escrever artigo por suposição.
Sempre pedir o .tsx real da tela (e componentes filhos/hooks se a página for um shell fino,
como aconteceu com AgendaPage.tsx) antes de escrever, extraindo: campos reais do formulário,
regras de negocio visíveis no código (validações, avisos, campos obrigatórios condicionais),
nomes exatos de botões/labels. Isso já rendeu descobertas que uma descrição genérica teria
errado ou omitido - ex: regra de NF obrigatória em recebimento de Aluguel (Contas a Receber),
lançamentos travados após Fechar Caixa (Fundo Fixo), 3 fontes de dado diferentes convivendo
na mesma tela (Fluxo de Caixa: previsto/realizado/bancário).

**Lote 1 CONCLUÍDO — Financeiro (5 artigos novos), commit 92d71ab:**
- financeiro/fundo-fixo — CRUD + tipos de movimento + fechamento de caixa (irreversível)
- financeiro/fluxo-caixa — views Tabela/Gráfico/Bancário, aviso sobre divergência de fontes
- financeiro/contas-a-receber — ciclo de status + regra NF obrigatória p/ Aluguel + aging
- financeiro/agenda — 6 tipos de evento, cores sugeridas, recorrência (só na criação)
- financeiro/provisoes — modelo Config->Lançamentos, PIS/COFINS/CSLL/IRPJ, status

helpContent.ts: 49KB -> 61KB. Cobertura: 33/98 -> 38/98 rotas (~39%).

**PENDENTE — próximos lotes, em ordem de prioridade (ver mapeamento completo da sessão):**
1. 🔴 Sistema/Segurança (8 artigos): Permissões de Menu, Backup e Restauração, Usuários
   (revisar o existente), Auditoria, Manutenção de Dados, Parâmetros Globais, Calendário
   de Feriados, Indicadores Econômicos, Tabelas Legais.
2. 🟡 Arquivo Digital (16 sub-rotas: Societário/Contábil/Fiscal/RH · Arquivo) - hoje só tem
   1 artigo genérico de introdução para o grupo inteiro.
3. 🟡 Fiscal · Operação (4): Config. Dedutibilidade, NFS-e Nacional, Importar CSV PMSP,
   Notas Fiscais (grupo pai de NFS-e SP/Nacional/CSV/NFe).
4. 🟡 Departamento Pessoal (9): Férias, Banco de Horas, 13º Salário, DHO, RAIS, DCTFWeb,
   Informe de Rendimentos, Recessos & Pontes, Folha (revisar o existente). Nota: artigo
   'dp/rescisao' existe no helpContent mas a rota correspondente não existe mais no
   catálogo atual - provavelmente removida; decidir se apaga o artigo ou recria a rota.
5. 🟢 Contabilidade (5): Comparativo de Saldos, Visões Contábeis, Investimentos/Renda
   Fixa/Simulador, Importação de Lançamentos, Importação de Plano de Contas.
6. 🟡 SPED & Entregas (3): ECF, ECD Histórico, Obrigações Fiscais (rota real
   /app/sistema/obrigacoes ainda não mapeada - contextualHelp aponta só para
   /app/sistema/obrigacoes -> sped/obrigacoes, conferir se bate).
7. 🟢 Societário · Operação, Patrimônio, Cadastros (4): Livros/Acionistas, Manutenções
   (já existe, revisar), Empresas, Pessoas Físicas.

Depois de cobrir as 98 rotas: revisar os 33 artigos ORIGINAIS (pré-sessão) um a um,
conferindo se os breadcrumbs internos ('Acesse Financeiro -> X') ainda batem com os nomes
atuais das macro-categorias/módulos pós-reorg de hoje (ex: 'Fiscal' agora é
'Fiscal · Operação' no menu).

---

## Sessão 17-18/07/2026 (continuação 2) — Central de Ajuda: lote Sistema/Segurança CONCLUÍDO

**Lote 2 concluído, commit 9eec579 — 8 artigos (7 novos + 1 revisado):**
- administracao/permissoes-menu (NOVO) — 4 niveis cumulativos, cascata em subarvore, override
  usuario > perfil, checkbox de coluna sobrescreve tudo (nao e fill-only-blanks, e full overwrite -
  conferir se documentacao antiga da Fase B mencionava comportamento diferente, codigo atual manda).
- administracao/backup (NOVO) — Master Key e config de servidor (.env), nao senha de usuario;
  restauracao e destrutiva/irreversivel.
- administracao/usuarios (REESCRITO) — artigo antigo estava errado (falava em convite por email,
  que nao existe). Real: senha digitada direto, CPF/CNPJ com lookup automatico em Person/User
  existente, Janela de Acesso (dias/horario por usuario, override do perfil), Status
  Ativo/Inativo/Bloqueado != Excluir (hard delete real).
- administracao/manutencao-dados (NOVO) — export/import por tabela em TXT (;), Upsert por ID,
  ordem de dependencia obrigatoria (Perfis->Empresas->Pessoas->Usuarios->Vinculos).
- parametros/calendario (NOVO) — sugestao automatica de pontes (ter/qui adjacentes), confirmar
  ponte cria Recesso real que afeta todos funcionarios (nao e so visual).
- parametros/indicadores (NOVO) — Selic/IPCA/IGP-M/IGP-DI/INPC/TR/CDI, atualizacao 100% manual
  (sistema nao busca fonte oficial sozinho), aceita import em lote TSV/CSV.
- parametros/tabelas-legais (NOVO) — IRPF/INSS/Salario Minimo por ano, deducao INSS calculada
  automaticamente (nao digitar), redutor Lei 15.270/2025 opcional, simulador embutido na aba IRPF.

**Novo grupo criado no indice (helpSections):** 'Parâmetros Globais', espelhando a reorg de
sidebar desta sessao (Calendario/Indicadores/Tabelas Legais agora sao filhos desse container).

helpContent.ts: 61KB -> 75KB. Cobertura: 38/98 -> 46/98 rotas (~47%). Passou da metade.

**Ambiguidades resolvidas nesta rodada (documentar para nao repetir a busca):**
- Auditoria: arquivo real e pages/admin/AuditPage.tsx (rota /app/administracao/auditoria e
  tambem /app/audit) - pages/audit/Audit.tsx e AuditLogs.tsx NAO sao os usados nessa rota.
- Manutencao de Dados: componente chama-se TableManager.tsx (nao "DataManagement").
- Parametros Globais (a rota /app/sistema/parametros em si) NAO tem tela propria - e so um
  container organizacional no menu, sem artigo de ajuda dedicado (correto, nao e bug).

**PENDENTE — próximos lotes (ordem de prioridade, ver sessão anterior para lista completa):**
1. 🟡 Arquivo Digital (16 sub-rotas) - so tem 1 artigo generico de introducao hoje.
2. 🟡 Fiscal · Operação (4): Config. Dedutibilidade, NFS-e Nacional, Importar CSV PMSP, Notas Fiscais.
3. 🟡 Departamento Pessoal (9): Ferias, Banco de Horas, 13o, DHO, RAIS, DCTFWeb, Informe de
   Rendimentos, Recessos & Pontes, Folha (revisar existente). Artigo orfao 'dp/rescisao' ainda
   sem decisao (rota nao existe mais no catalogo atual).
4. 🟢 Contabilidade (5): Comparativo de Saldos, Visoes Contabeis, Investimentos/Renda
   Fixa/Simulador, Importacao de Lancamentos, Importacao de Plano de Contas.
5. 🟡 SPED & Entregas (3): ECF, ECD Historico, Obrigacoes Fiscais.
6. 🟢 Societario · Operacao, Patrimonio, Cadastros (4): Livros/Acionistas, Manutencoes
   (revisar existente), Empresas, Pessoas Fisicas.

Depois: revisar os 33 artigos ORIGINAIS (pre-sessao) conferindo breadcrumbs internos contra
os nomes atuais pos-reorg (ex: 'Fiscal' -> 'Fiscal · Operação').

---

## Sessão 17-18/07/2026 (continuação 3) — Planejamento para deploy real de segunda-feira

**Decisão do usuário:** teste de segunda sera com equipe de confianca, MAS quer seguranca
EFETIVA desde ja (nao adiar), considerando que perfis diferentes e pessoas externas vao usar
o sistema no futuro. Deploy sera em Docker de producao de verdade, nao npm run dev.

**Descoberta importante — corrige confusao de sessoes anteriores:**
SERVER02 e 192.168.0.60 SAO A MESMA MAQUINA (nao dois servidores diferentes como o
contexto antigo sugeria). Nunca foi instalado Ubuntu Server — e Windows. Inventario
completo rodado hoje (17/07) numa sessao anterior:
- Windows, IP 192.168.0.60
- Intel i7-8550U (4 nucleos/8 threads), 15.9GB RAM
- SSD dedicado mapeado como H: -- 223GB livres, praticamente vazio, PRONTO para uso
- Docker 27.4.0, Node v24.14.0, npm 9.8.1, Git 2.47.1 -- TODOS JA INSTALADOS
- Disco D: quase cheio (30GB livres de ~953GB) -- NAO USAR para o projeto

**Isso significa que o setup de infraestrutura e MENOR do que se pensava** -- nao precisa
instalar SO nem ferramentas base, so configurar Docker Compose de producao e apontar pro
disco H:.

**ROADMAP para ficar pronto ate segunda-feira -- DUAS FRENTES, sessoes dedicadas:**

### Frente A — Fase C: guards de API reais (PRIORIDADE, decisao explicita do usuario)
Hoje so ~10 modulos tem SidebarResourceGuard real (Persons, Users, Profiles, Companies +
6 financeiros de alto risco: Contas a Pagar/Receber, Fundo Fixo, Fechamento Mensal,
Lancamentos, Patrimonio). Faltam guards reais em:
- Fiscal (Documentos Fiscais, NFS-e, NF-e, Apuracao, Config Dedutibilidade)
- Contabilidade (Plano de Contas, Balancete, Relatorios, Visoes Contabeis, Investimentos)
- Departamento Pessoal (Funcionarios, Folha, Ferias, Banco de Horas, eSocial, etc)
- Societario, SPED (ECD/ECF/EFD), Arquivo Digital, Patrimonio (Manutencoes)
- Proxima sessao: mapear TODOS os controllers sem @UseGuards(SidebarResourceGuard),
  priorizar por sensibilidade de dado, aplicar em lote seguindo o padrao ja usado em
  PersonsController.

### Frente B — Deploy Docker de producao no SERVER02 (192.168.0.60, disco H:)
Preparar (pode ser feito em paralelo, nao depende da Frente A):
1. Dockerfile do backend NestJS (build + run compilado, nao --watch)
2. Dockerfile do frontend (vite build + Nginx servindo estatico)
3. docker-compose.prod.yml unindo Postgres + API + Nginx, apontando volumes pro H:
4. .env.production -- JWT secret, Master Key do backup (system/backup), credenciais DB
   REAIS diferentes das de dev
5. CORS no main.ts -- hoje so libera http://localhost:5173, precisa liberar o
   IP/porta real que os clientes vao acessar na rede (ex: http://192.168.0.60:PORTA)
6. Processo persistente -- Docker Compose ja resolve isso (restart: always), nao
   precisa de pm2 separado
7. Testar de OUTRA maquina na rede (nao o SERVER02 nem o PC de dev) antes de liberar
   pra equipe -- confirma que CORS/rede/portas realmente funcionam de fora

### Checklist final antes de liberar segunda (rodar do zero, maquina limpa se possivel):
- [ ] Login funciona de outra maquina na rede
- [ ] Testar com 2+ perfis diferentes que os guards da Fase C bloqueiam de verdade
      (nao so escondem o menu -- tentar acessar rota via URL direta)
- [ ] Backup funciona no ambiente novo (Master Key configurada certo no .env.production)
- [ ] git status limpo, tudo commitado antes do deploy

**Pendencia menor tambem registrada:** confirmar se o SERVER02 tem antivirus/firewall
corporativo que pode bloquear as portas do Docker -- nao verificado ainda no inventario.
