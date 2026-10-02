# LEDGR - Domínio Projetos | Recife Ocean Residences

**Documento bússola** - referência obrigatória para qualquer sessão de trabalho neste domínio.

| Campo | Valor |
|---|---|
| Versão | 1.0 |
| Data | 02/10/2026 |
| Responsável | Hpontes |
| Documento de origem | `Plataforma_Gestao_Recife_Ocean_Residences.md` (referência funcional e de dados) |
| Caminho no repo | `docs/LEDGR-OceanProject.md` |
| Leitura obrigatória junto com | `CLAUDE.md` e `LEDGR-contexto.md` |

> Este documento registra **decisões**, **regras** e **fases**. O documento de origem descreve **o que** o sistema deve fazer; esta bússola define **como** e **em que ordem** isso será construído dentro do LEDGR. Em caso de conflito, prevalece a decisão mais recente registrada na seção 13 (Registro de alterações).

---

## 1. Propósito

Construir, dentro do LEDGR, o centro de controle do empreendimento Recife Ocean Residences: uma base única, rastreável e multiusuário capaz de responder de onde veio cada valor, para onde foi, qual obrigação ou contrato o suporta, qual empresa é responsável, qual documento comprova o fato, qual o impacto contábil, quem validou e quais pendências permanecem.

A Operação Âncora é o primeiro caso completo e o modelo de rastreabilidade para os demais módulos.

---

## 2. Decisões de arquitetura registradas

| # | Decisão | Motivo |
|---|---|---|
| D1 | O projeto é um **novo domínio dentro do LEDGR**, não um sistema separado nem um apêndice solto | Sunrise, Hotelsys e Sunsys já estão no LEDGR com plano de contas, ECD, Razão, extratos e documentos. Sistema separado duplicaria a fonte de verdade |
| D2 | O domínio tem **fronteira própria** (módulo, modelos, rotas, menu, permissões) | Permite evolução independente e desmembramento futuro barato |
| D3 | Acesso **restrito à equipe**, porém com membros **remotos** | Exige controle de acesso rigoroso e infraestrutura de acesso remoto segura |
| D4 | Acesso controlado por **perfil + escopo + nível de visibilidade**, configurável, nunca fixo no código | Profundidade de acesso varia por pessoa e por operação |
| D5 | Usuário **nunca** acessa empresa que não participa de operação à qual ele tenha concessão | Isolamento entre clientes do LEDGR e entre operações |
| D6 | Desmembramento futuro é possível, mas de longo prazo | Construir com dependência unidirecional desde o primeiro commit |
| D7 | Escrituração oficial (ECD/ECF) só recebe lançamentos do domínio **após aprovação** | Proteger a contabilidade validada em PVA |

---

## 3. Princípios inegociáveis

1. **Fonte única**: cada fato relevante é registrado uma única vez e alimenta painéis, relatórios e conciliações.
2. **Rastreabilidade total**: todo valor exibido possui drill-down até os registros de origem.
3. **Dado bruto intocado**: movimentos bancários importados nunca são sobrescritos por classificação manual.
4. **Saldos derivados**: saldos calculáveis vêm das transações, nunca de digitação.
5. **Sem exclusão física**: fatos financeiros, documentos e auditoria só são cancelados/estornados, com justificativa.
6. **Versionamento**: alteração em registro aprovado gera nova versão ou ajuste, preservando a anterior.
7. **Negação por padrão**: sem concessão explícita, sem acesso.
8. **Parametrização**: o que depende de definição jurídica, contábil ou comercial é configurável (ver seção 10).
9. **Operações não se misturam**: a Operação Âncora nunca é convertida automaticamente em Series #1 ou outra operação.

---

## 4. Fronteira do domínio

### 4.1 Regras de isolamento

| Regra | Aplicação |
|---|---|
| Dependência unidirecional | O domínio Projetos referencia o núcleo; o núcleo **nunca** referencia o domínio. Nenhum `operationId`/`projetoId` em `BankTransaction`, `JournalEntry`, `Document` etc. |
| Vínculos no domínio | Ligações com o núcleo ficam em tabelas do próprio domínio (ex.: vínculo crédito → `BankTransaction`) |
| Módulo próprio | `apps/api/src/modules/projects/` (NestJS). Outros módulos não importam services dele |
| Prefixo de tabelas | `proj_*` no banco |
| Prefixo de modelos | `Proj*` no Prisma (nomes finais definidos na Fase 1.1) |
| Rotas | Backend `/projects/...` · Frontend `/app/projetos/...` |
| Menu | Seção própria no `SidebarItem`, com `resource` próprio por item |
| Cor do módulo | A definir na Fase 1 (nova entrada no Design System, sem reutilizar cores de status) |
| Ponte contábil | Lançamentos sugeridos em tabela do domínio → `JournalEntry` apenas via service do Contábil, após aprovação |

### 4.2 Reuso do núcleo do LEDGR

| Necessidade do projeto | Núcleo existente |
|---|---|
| Empresas e estrutura societária | `Company`, `CompanyShareholder`, `Person`, `ShareholderRecord`, `ShareTransfer` |
| Usuários, perfis, permissões | `User`, `Profile`, `UserCompany`, `SidebarItem`, `ProfileSidebarPermission`, `UserSidebarPermission`, `SidebarResourceGuard` |
| 2FA, bloqueio, janela de acesso | `User.twoFactorSecret`, `isTwoFactorActive`, `failedAttempts`, `blockedUntil`, `AccessSchedule` |
| Extratos bancários | `BankStatement`, `BankTransaction`, `BankImportRule` (OFX/CSV/XLS) |
| Contas a pagar/receber, obrigações | `ApEntry`, `AccountsPayable`, `APPayment`, `ArEntry`, `ARPayment`, `FiscalObligation` |
| Contabilidade | `ChartOfAccounts`, `JournalEntry`, `JournalEntryItem`, Razão, Balancete, ECD |
| Documentos | `Document`, `DocumentVersion`, assinaturas |
| Fechamento de período | `FechamentoMensal`, `FechamentoItem` (referência de padrão) |
| Auditoria | `AuditLog` (a ser ampliado, ver 5.6) |
| Relatórios | `ReportToolbar`, exportação CSV com `|` |
| Projetos com fases | `AssetRetrofitProject`/`AssetRetrofitPhase` (referência de padrão para cronograma) |

---

## 5. Modelo de segurança e acesso

### 5.1 Três dimensões do acesso

O acesso efetivo resulta da combinação das três dimensões, prevalecendo sempre a **mais restritiva**:

| Dimensão | Pergunta | Mecanismo |
|---|---|---|
| **Perfil** | O que pode fazer? | Ações por recurso: visualizar, criar, editar, conciliar, aprovar, exportar, administrar |
| **Escopo** | Sobre o quê? | Concessões explícitas por projeto, operação ou empresa |
| **Nível de visibilidade** | Com que profundidade? | Definido no perfil ou na concessão (tabela 5.2) |

### 5.2 Níveis de visibilidade

| Nível | O que enxerga |
|---|---|
| `OPERACAO` | Apenas registros vinculados à operação (créditos, aplicações, obrigações, documentos ligados a ela) |
| `EMPRESA_PROJETO` | Todos os dados da empresa dentro do domínio Projetos, inclusive ainda não vinculados |
| `EMPRESA_COMPLETA` | Também os módulos gerais do LEDGR daquela empresa (Razão, balancetes, ECD) |

As empresas visíveis a um usuário no domínio são **derivadas** das operações em que ele tem concessão. Se uma empresa deixa a operação, o acesso cai automaticamente.

### 5.3 Perfis padrão (ajustáveis)

| Perfil | Ações típicas | Visibilidade padrão |
|---|---|---|
| Administrador | Configurar, conceder acessos, cadastros mestres | Restrito ao Hpontes |
| Financeiro | Importar, classificar, vincular comprovantes | `EMPRESA_PROJETO` |
| Contabilidade | Classificar, conciliar, sugerir lançamentos, intercompany | `EMPRESA_COMPLETA` |
| Jurídico/Societário | Contratos, atos, documentos | `EMPRESA_PROJETO` |
| Gestão do Projeto | Orçamento, cronograma, marcos, pendências | `OPERACAO` |
| Aprovador | Aprovar/reprovar com justificativa | Conforme concessão |
| Sócio/Consulta | Somente leitura de dashboards e relatórios | `OPERACAO` |
| Auditoria | Leitura ampla, trilha, exportação | Conforme concessão, **com prazo** |

### 5.4 Defesa em camadas

Cada camada deve bloquear sozinha, de modo que a falha de uma não exponha dados.

| Camada | Controle |
|---|---|
| 1. Rede | Nenhuma porta pública. Acesso remoto por VPN (WireGuard/Tailscale) ou túnel com autenticação prévia (Cloudflare Access) |
| 2. Autenticação | 2FA obrigatório para todo usuário do domínio; sessão curta com expiração por inatividade; rotação de refresh token; revogação imediata ao desativar |
| 3. Empresa | Todo `x-company-id` validado no servidor contra `UserCompany`. Empresas fora de concessão não aparecem nem respondem por API |
| 4. Operação | Concessão usuário × operação × perfil × nível. Filtro aplicado nos services do domínio |
| 5. Módulo | Perfil do domínio exibe apenas Projetos; dados do núcleo chegam somente pelos services do domínio, já filtrados |
| 6. Banco | Row-Level Security do PostgreSQL nas tabelas `proj_*`, com usuário da sessão definido por transação (extensão do Prisma Client) |
| 7. Auditoria | Escritas **e** leituras sensíveis **e** exportações registradas |
| 8. Testes | Testes automatizados de negação de acesso como critério de aceite |

### 5.5 Regras de governança

1. **Exportar ≠ visualizar**: exportação XLSX/CSV/PDF é permissão separada, desligada por padrão para Consulta.
2. **Segregação de funções**: o mesmo usuário não cria e aprova o mesmo registro.
3. **Concessões com validade**: Auditoria e acessos temporários expiram automaticamente.
4. **Mudanças de permissão auditadas**: concessão, revogação e troca de perfil vão para a trilha, com relatório periódico "quem acessa o quê".
5. **Mascaramento**: CPF, dados bancários e dados pessoais exibidos parcialmente para perfis que não precisam deles (LGPD).
6. **Resposta 404, não 403**, para recurso fora do escopo (não confirmar existência).
7. **`User.level` não decide acesso**: a decisão vem das concessões explícitas.

### 5.6 Achados no LEDGR atual que condicionam o domínio

Registrados em `LEDGR-contexto.md` e a confirmar no código na Fase 0:

| Achado | Origem | Risco |
|---|---|---|
| `CompanyGuard` (`multi-company.guard.ts`) sempre retorna `true`; validação de acesso à empresa com TODO | Sessão de jul/2026 | Usuário poderia trocar `x-company-id` e ler outra empresa |
| Módulos sem guard real de API: nível da árvore controla só o menu | Sessão 13/07/2026 | Bloqueio apenas visual em boa parte dos módulos |
| `ProfileGuard`/`RequirePermission` legado como código morto | Sessão 13/07/2026 | Confusão de mecanismo de autorização |
| Usuário de teste `visualizador.teste@ledgr.local` ativo | Sessão 13/07/2026 | Credencial conhecida em ambiente de rede |
| Varredura de `@SkipCompanyCheck()` em nível de método pendente | Sessão 21/07/2026 | Rotas com bypass indevido ou inesperado |
| `AuditLog` sem `companyId`, `operationId`, user-agent | Schema atual | Trilha insuficiente para o domínio |
| Scripts recentes de hard delete (F5, Sunrise) | Set/2026 | Aceitável na reconstrução contábil; **proibido** neste domínio |

---

## 6. Regras de negócio críticas - Operação Âncora

### 6.1 Papéis (parametrizáveis por operação)

| Empresa/Parte | Papel na Operação Âncora |
|---|---|
| HOTELSYS | Beneficiária econômica; responsável pela relação de antecipações para futura aquisição |
| SUNSYS | Recebedora financeira; pagadora de obrigações por conta da HOTELSYS |
| SUNRISE | Controladora/interveniente |
| Adquirente Âncora | Titular da Conta Individual |

Estrutura societária: Sunrise → Hotelsys → Sunsys. Controle societário **não** se confunde com titularidade econômica da operação.

### 6.2 Regras

1. Marco inicial: saldo consolidado de **R$ 3.495.791,15 em 31/12/2025**, formado por **58 créditos bancários individualizados**.
2. **Saldo contratual** (reconhecido perante o Adquirente) ≠ **saldo financeiro** (não aplicado ou não conciliado).
3. Pagamento de obrigação da HOTELSYS com recursos recebidos **não reduz** o saldo contratual do Adquirente; é aplicação do recurso e liquidação de obrigação.
4. Remetente bancário, Adquirente Âncora, recebedor bancário e beneficiário econômico são **campos distintos**.
5. Conciliação crédito × aplicação é **muitos-para-muitos**, com rateio e conciliação parcial.
6. Nenhum vínculo é presumido por proximidade de datas.
7. Total vinculado nunca excede o valor do crédito nem o da aplicação (trava no backend e no banco).
8. Fechamentos de período bloqueáveis; reabertura somente por perfil autorizado.

---

## 7. Protocolos de desenvolvimento

### 7.1 Protocolos do LEDGR (vigentes, aplicados com sucesso)

**Entrega de código**
- Fluxo consolidado (regra fixa desde 20/09/2026, **não alterar**): um único bloco PowerShell copiável, com `cls` antes do output, que grava o script Python em `D:\Temp\` (here-string de aspas simples + `WriteAllText` sem BOM), executa e mostra `OK`/`ERRO` + `git --no-pager diff --stat`. A confirmação é o usuário colar essa saída.
- Fluxo: inspecionar → entregar bloco → confirmar. Edições cirúrgicas, mínimo de tokens.
- Sempre ler o arquivo antes de editar; nunca reconstruir de memória ou de busca no projeto.
- Arquivos existentes: `Select-String` para localizar linhas → validar âncoras por índice → `InsertRange` com `[string[]]` → `WriteAllText` com `UTF8Encoding($false)`. `.Replace()` multilinha nunca como primeira estratégia.
- `.ts`/`.tsx` com backticks ou JSX: sempre via script Python em `D:\Temp\`.
- Patches pequenos: confirmar com `git --no-pager diff --stat`; `git diff` completo apenas para features novas/complexas.
- Primeira linha de cada arquivo: comentário com nome e caminho completo.
- Ao propor alteração: indicar entre quais trechos/linhas implementar.

**Prisma e banco**
1. Editar `schema.prisma` via script Python em `D:\Temp\` (nunca heredoc PowerShell).
2. `npx prisma generate --schema=prisma/schema.prisma` com `DATABASE_URL` definido, a partir de `D:\Projetos\Ledgr`.
3. Confirmar client em `node_modules\.prisma\client\index.d.ts`.
4. Migração manual: `docker cp` + `psql -f`; arquivo guardado em `prisma/migrations-manuais/`.
5. Convenções: PK `gen_random_uuid()` + `@db.Uuid`; `snake_case` via `@map()`; `@db.Timestamp(6)`; `Decimal` para valores (nunca `Float`); `deletedAt` para soft delete; comentários `///`.
6. `companyId` nunca em filtro global: sempre via `request.companyId` (CompanyInterceptor).
7. Datas `@db.Date`: `Date.UTC(..., 12)` por causa do fuso no Windows.
8. Números, CPF, CEP e telefone armazenados crus; máscara só na exibição.

**Interface**
- Modais no padrão APPayModal/APCreateModal: header escuro com título + subtítulo + ×, seções com `borderLeft` no accent, rodapé Cancelar/Ação em `#FAFAFA`, `Label` + `const inputSt`, `SmartDateInput`/`SmartMonthInput` (nunca `input type=date/month`), bloco de erro `#FCEBEB`, `maxHeight: 90vh`, fechar com Escape/clique fora.
- Relatórios com `ReportToolbar`; "fixar barra/bloco" = wrapper `position: sticky` no padrão existente.
- Design System do LEDGR (radius 10px, borda `0.5px #E5E7EB`, botões e tabelas padrão); verde/vermelho somente para status.
- Alertas Sweetalert2 com `confirmButtonColor: '#111111'`; erros com `toast.error()`.
- CSV com separador `|` (Regra 12).
- Usar sempre hífen "-" em vez de travessão em respostas, títulos de modais e textos gerados.

**Segurança**
- Todo controller novo com `@UseGuards(JwtAuthGuard)` (checklist obrigatório) + `SidebarResourceGuard`/`@RequireResourceAccess`.

**Higiene de sessão**
- Commit após cada feature/fix concluído, com mensagem detalhada.
- Notas de sessão anexadas ao `LEDGR-contexto.md` via `Add-Content` (nunca sobrescrever).
- `git status` completo antes de declarar a sessão encerrada.
- Registrar aprendizados para evitar regressão.
- Sem perguntas de confirmação para passos já cobertos por protocolo (Regra 11).
- Ao se aproximar do limite de contexto: encerrar organizado, com resumo, pendências claras e o que colar na próxima sessão.

### 7.2 Protocolos adicionais do domínio Projetos

1. **Scripts de manutenção sem `DELETE`**: correções são sempre estorno/cancelamento com justificativa.
2. **Todo controller do domínio** tem três guards: autenticação, recurso (perfil) e escopo (operação/empresa).
3. **Todo endpoint de leitura** tem teste de negação de acesso correspondente.
4. **Toda escrita relevante** gera `AuditLog` com `companyId` e `operationId`.
5. **Toda importação** é idempotente (hash/identificador externo); reimportar o mesmo arquivo não cria duplicidade silenciosa.
6. **Nenhum valor monetário** calculado no frontend para fins de registro: o backend é a fonte dos totais.
7. **Notas de sessão** do domínio usam o marcador `[PROJETOS]` no título dentro do `LEDGR-contexto.md`, para busca estreita.
8. **Esta bússola** é atualizada ao final de cada fase concluída (seção 13).

---

## 8. Fases de implementação

Cada fase só começa após o **critério de saída** da anterior ser atendido. Dentro de cada fase, as entregas seguem a ordem numérica.

### Fase 0 - Fundação de segurança (pré-requisito)

**Objetivo:** garantir que o LEDGR suporte usuários remotos sem exposição entre empresas, antes de qualquer tela do domínio.

**0A - Segurança de aplicação**

| # | Entrega |
|---|---|
| 0A.1 | Auditar `company.interceptor.ts` e `multi-company.guard.ts`: confirmar se `x-company-id` é validado contra `UserCompany` |
| 0A.2 | Implementar a validação de empresa no servidor (se ausente), com bypass apenas para Master Admin real |
| 0A.3 | Varredura de `@SkipCompanyCheck()` em nível de método |
| 0A.4 | Concluir a Fase C de guards reais (`SidebarResourceGuard`) nos módulos que hoje só controlam menu, priorizando Financeiro, Contábil, Documentos, Societário e Bank Import |
| 0A.5 | Remover `ProfileGuard`/`RequirePermission`/`Profile.permissions` legados (ou documentar formalmente como código morto) |
| 0A.6 | 2FA obrigatório configurável por perfil; expiração de sessão por inatividade; revogação de refresh token |
| 0A.7 | Ampliar `AuditLog` (`companyId`, `operationId`, user-agent) e registrar leituras sensíveis e exportações |
| 0A.8 | Desativar/trocar credenciais de usuários de teste |
| 0A.9 | Suite de testes de negação de acesso entre empresas |

**0B - Infraestrutura de acesso remoto**

| # | Entrega |
|---|---|
| 0B.1 | Definir servidor de produção (ThinkServer TS150 ou alternativa) |
| 0B.2 | Acesso remoto por VPN ou túnel com autenticação prévia, sem porta pública |
| 0B.3 | TLS em todo o tráfego |
| 0B.4 | Separação de ambientes: desenvolvimento, teste e produção |
| 0B.5 | Backup automático no servidor de produção + **teste de restauração documentado** |
| 0B.6 | Monitoramento do container `ledgr-postgres` e da API (alerta de queda) |
| 0B.7 | Gestão de segredos fora do repositório (`DATABASE_URL`, chaves JWT, certificados) |

**Critério de saída:** um usuário de teste vinculado só à Hotelsys não consegue, por nenhuma rota de API, ler dados de outra empresa; acesso remoto funcionando via VPN/túnel com 2FA; restauração de backup testada.

---

### Fase 1 - Base confiável (Operação Âncora)

**Objetivo:** reproduzir com exatidão a Operação Âncora e entregar a conciliação crédito × aplicação com rastreabilidade completa.

| # | Entrega |
|---|---|
| 1.1 | Desenho do schema do domínio: Projeto, Operação, Participantes/Papéis por operação (nomes finais dos modelos `Proj*`) |
| 1.2 | Modelo de acesso: concessões (usuário × escopo × perfil × nível), guard de escopo, RLS nas tabelas `proj_*` |
| 1.3 | Tela de administração de concessões (padrão de modal LEDGR) |
| 1.4 | Cadastro do projeto Recife Ocean Residences e da Operação Âncora com seus papéis |
| 1.5 | Contrapartes: Adquirente Âncora e remetentes terceiros (reuso de `Person`/`Company`) |
| 1.6 | Importação idempotente dos **58 créditos históricos**, individualizados, totalizando **R$ 3.495.791,15** |
| 1.7 | Vínculo dos créditos com `BankTransaction` (extratos SUNSYS), sem alterar o dado bruto |
| 1.8 | Reconhecimento dos créditos pelo Adquirente (saldo contratual) |
| 1.9 | Cadastro de aplicações SUNSYS e obrigações/despesas HOTELSYS |
| 1.10 | Conciliação muitos-para-muitos com rateio, parcial e travas de excesso (backend + constraint no banco) |
| 1.11 | Vínculo de documentos comprobatórios a créditos, aplicações e obrigações |
| 1.12 | Fluxo de aprovação com segregação (quem cria não aprova) e versionamento de registros aprovados |
| 1.13 | Dashboard da Operação Âncora com drill-down: saldo histórico, novos créditos, saldo contratual, aplicado, conciliado, pendente, divergências |
| 1.14 | Relatórios prioritários: Conta Individual, Demonstrativo dos Recebimentos, Aplicação dos Recursos, Conciliação Crédito × Aplicação, Pendências de Conciliação (XLSX/CSV/PDF) |
| 1.15 | Trilha de auditoria do domínio consultável |

**Critério de saída:** critérios de aceite da seção 9 aplicáveis à Fase 1 atendidos, com destaque para o total exato dos 58 créditos e conciliação parcial sem alterar o dado bancário.

---

### Fase 2 - Gestão financeira e contábil

**Objetivo:** ligar a operação ao financeiro e à contabilidade das empresas participantes.

| # | Entrega |
|---|---|
| 2.1 | Contas a pagar/receber do projeto integradas a `ApEntry`/`ArEntry` existentes |
| 2.2 | Fluxo de caixa realizado e projetado por empresa e por operação |
| 2.3 | Transferências entre empresas e conta corrente intercompany HOTELSYS × SUNSYS |
| 2.4 | Passivos/obrigações completos: natureza, credor, competência, vencimento, atualização, pagamentos, saldo |
| 2.5 | Classificação contábil sugerida (mapeamento para o plano de contas de cada empresa) |
| 2.6 | Lançamentos sugeridos → aprovação → `JournalEntry` via service do Contábil |
| 2.7 | Conciliação com balancetes/Razão; painel de divergências banco × sistema × contabilidade |
| 2.8 | Fechamento de período do domínio com bloqueio e reabertura por perfil autorizado |
| 2.9 | Alertas de vencimento e pendências |
| 2.10 | Relatórios: Intercompany, Lançamentos Contábeis, Passivos, Fluxo de Caixa |

**Critério de saída:** nenhum lançamento entra na escrituração oficial sem aprovação; intercompany conciliado com o Razão das duas empresas.

---

### Fase 3 - Gestão integral do projeto

**Objetivo:** ampliar do controle financeiro para a gestão do empreendimento.

| # | Entrega |
|---|---|
| 3.1 | Orçamento por categoria/fase; comprometido, contratado, realizado, pago |
| 3.2 | Contratos e instrumentos jurídicos vinculados a lançamentos (reuso de `Document`/`DocumentVersion`) |
| 3.3 | Fornecedores e compromissos |
| 3.4 | Cronograma, marcos, dependências e evidências |
| 3.5 | Comercial: contrapartes, propostas, unidades/direitos quando individualizados |
| 3.6 | Estrutura societária e veículos (sem presumir SPE existente) |
| 3.7 | Data room com metadados, versões, hash e permissões |
| 3.8 | Pendências, tarefas e escalonamento |
| 3.9 | Dashboard executivo consolidado e painéis Projeto e Documental/Jurídico |
| 3.10 | Relatórios: Orçamento × Realizado × Pago, Contratos e vencimentos, Documentos faltantes, Cronograma e marcos |

**Critério de saída:** dashboard executivo com drill-down completo em todos os indicadores.

---

### Fase 4 - Automação e integrações

| # | Entrega |
|---|---|
| 4.1 | Conectores desacoplados com registro de fonte, horário, status, erro e identificador externo |
| 4.2 | APIs bancárias / Open Finance quando disponíveis e autorizadas |
| 4.3 | Importações recorrentes e reprocessamento sem duplicidade |
| 4.4 | Notificações e automação documental |
| 4.5 | APIs internas documentadas |
| 4.6 | Exibição da data/hora da última atualização de cada fonte externa |

### Fase futura (condicionada a aprovação) - Series e captação

Módulo parametrizável para séries/operações de captação: aportes, quotas, participação econômica, waterfall, distribuições, Conta REAL. Só será especificado após aprovação formal das regras, e nunca misturado automaticamente com a Operação Âncora.

---

## 9. Critérios de aceite

**Funcionais (documento de origem, seção 16)**
- [ ] O sistema reproduz exatamente os 58 créditos históricos e totaliza R$ 3.495.791,15.
- [ ] Cada total do dashboard possui drill-down até os registros de origem.
- [ ] Conciliação parcial não altera o dado bancário original.
- [ ] Rateios muitos-para-muitos funcionam sem exceder valores disponíveis.
- [ ] Alterações e aprovações aparecem na trilha de auditoria.
- [ ] Usuários sem permissão não conseguem alterar dados restritos.
- [ ] Reimportar o mesmo arquivo não cria duplicidade silenciosa.
- [ ] Relatórios exportados reconciliam com os dados exibidos.
- [ ] Backups e restauração testados antes da produção.
- [ ] Fechamentos bloqueáveis e reabertos apenas por perfil autorizado.

**Segurança (desta bússola)**
- [ ] Usuário sem concessão a uma empresa recebe 404 em qualquer rota que a envolva.
- [ ] Usuário com nível `OPERACAO` não vê registros da mesma empresa fora da operação.
- [ ] Usuário que criou um registro não consegue aprová-lo.
- [ ] Exportação bloqueada para perfis sem permissão de exportar.
- [ ] Concessão expirada deixa de dar acesso sem intervenção manual.
- [ ] Toda mudança de permissão aparece na trilha de auditoria.
- [ ] RLS bloqueia leitura mesmo com filtro ausente no service (teste direto no banco).

---

## 10. Decisões que permanecem parametrizáveis

Não cristalizar como regra de código:
- Papéis das empresas em cada operação.
- Individualização de futuras unidades/direitos.
- Condições definitivas de aquisição e de liquidação.
- Eventual criação de SPE dedicada.
- Regras de futuras Series e percentuais de participação.
- Contas contábeis definitivas de cada classificação.
- Integrações ainda não contratadas.
- Perfis, ações e níveis de visibilidade.

---

## 11. Insumos a receber (documento de origem, seção 15)

- [ ] Termo da Operação Âncora e Anexo I definitivo
- [ ] Base dos 58 créditos históricos (total R$ 3.495.791,15)
- [ ] Extratos bancários SUNSYS e modelos de importação
- [ ] Plano de contas e balancetes/Razões relevantes da HOTELSYS e SUNSYS (já disponíveis no LEDGR - confirmar períodos)
- [ ] Relação de contas bancárias participantes
- [ ] Relação de passivos/obrigações e comprovantes
- [ ] Contratos e documentos societários a controlar
- [ ] Orçamento e cronograma, quando disponíveis
- [ ] Usuários, perfis e aprovadores
- [ ] Critérios de aprovação, fechamento, cancelamento e correção

---

## 12. Glossário

| Termo | Definição |
|---|---|
| Conta Individual | Registro dos créditos atribuídos ao Adquirente Âncora |
| Saldo contratual | Valor reconhecido perante o Adquirente; não é reduzido pela aplicação dos recursos |
| Saldo financeiro | Recursos recebidos ainda não aplicados ou não conciliados |
| Crédito | Entrada atribuída a uma operação (antecipação ou outro) |
| Aplicação | Saída/pagamento e sua destinação econômica |
| Conciliação | Vínculo, total ou parcial, entre créditos e aplicações |
| Beneficiário econômico | Empresa titular econômica da operação (HOTELSYS na Operação Âncora) |
| Recebedor financeiro | Empresa titular da conta que recebe os recursos (SUNSYS na Operação Âncora) |
| Concessão | Autorização explícita usuário × escopo × perfil × nível |
| Nível de visibilidade | Profundidade de acesso: `OPERACAO`, `EMPRESA_PROJETO`, `EMPRESA_COMPLETA` |

---

## 13. Registro de alterações

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | 02/10/2026 | Criação: decisões D1-D7, modelo de acesso, protocolos e fases 0 a 4 |
