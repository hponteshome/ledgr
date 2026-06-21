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
