# CLAUDE.md - LEDGR

> Referencia estatica do projeto, lida automaticamente por sessoes de IA (Claude Code, etc).
> Estado da sessao / pendencias / historico: ver LEDGR-contexto.md (raiz, append-only).
> Aprendizados especificos de SPED/ECD: ver LEDGR-ECD-Aprendizado (1).md.

## 1. Visao geral

LEDGR e uma plataforma SaaS brasileira de gestao contabil e empresarial multi-empresa, cobrindo
contabilidade, RH/folha de pagamento, compliance fiscal (SPED: ECD, EFD-Contribuicoes, eSocial),
ativo imobilizado, financeiro (AP/AR, fluxo de caixa, fechamento mensal, agenda) e gestao
documental com assinatura eletronica (ClickSign).

### Empresas de teste (UUIDs confirmados em 27/07/2026, apos recriacao do banco)
- LM  = LM Administracao de Bens Imoveis Ltda (ea4a443c-a351-4243-ae00-e7d70f126d5a), CNPJ 17970759000108
- KPL = Kipstone Servicos e Tecnologia Ltda (7100666c-1e74-4480-b533-4675ea90a774), CNPJ 28300920000144
- Advocacia Gomes, Rossetti e Barelli (d0d70dc6-446c-430b-9f62-3f6e73db3874), CNPJ 06190032000183, Lucro Presumido cumulativo
- Jose Silva Sociedade Individual de Advocacia (ca9ba513-06ae-4579-b546-ebc457f33452), CNPJ 35416962000100
- Pontes Contabilidade (632ce73b-5024-4fee-97bb-70d27b0cce51), CNPJ 07705010000171

NOTA: KSA (Kipstone Tecnologia S/A) NAO existe mais neste banco - removida do
registro. Se precisar recriar, o UUID antigo (9047fcd8-...) e historico, invalido.
Antes de usar qualquer UUID de empresa citado em sessoes anteriores a 24/07/2026,
confirmar contra o banco atual (SELECT id, legal_name, tax_id FROM companies) -
o banco foi recriado nessa data e todos os UUIDs anteriores ficaram invalidos.

## 2. Estrutura do monorepo - ATIVO vs OBSOLETO

Este repo acumulou varios snapshots/tentativas antigas. So usar/editar o que esta marcado ATIVO.
Antes de criar arquivo novo, verificar se ja existe versao antiga (mock, FINAL, melhorado etc.)
para nao reativar codigo morto nem duplicar.

ATIVO:
- apps/api/              -> Backend NestJS (workspace apps/*)
- frontend/               -> Frontend React + TS + Vite (porta 5173)
- prisma/schema.prisma    -> Schema Prisma (raiz). Migrations em prisma/migrations
- prisma.config.ts        -> Config Prisma (raiz)
- infra/docker/           -> docker-compose do Postgres (container ledgr-postgres) + scripts de
                              diagnostico/reset
- infra/prisma/seed.ts    -> Seed (referenciado no package.json raiz)

DADOS DE TESTE (nao e codigo):
- LM/                     -> Extratos bancarios, lotes de lancamentos (LOTD*.txt) e plano de
                              contas usados para testar a empresa LM

OBSOLETO - nao editar nem usar como referencia:
- apps/web/                -> 1 arquivo orfao (DashboardPage.tsx, 23/05), sem rota apontando
                               pra ele
- src/ (raiz)               -> src/modules/finance/accounts-payable.service.ts orfao (20/03),
                               fora do workspace
- libs/ (raiz)              -> domain/, infrastructure/, shared/ vazios
- project_files/            -> snapshot espelhado de apps/, frontend/, prisma/, infra/, libs/,
                               etc. (backup antigo)
- frontend/src/pages/Dashboard.tsx, Dashboard Mock.tsx e variantes Dashboard-*.tsx em
  project_files/ -> versoes experimentais antigas. O Dashboard ativo e SEMPRE
  frontend/src/pages/DashboardPage.tsx (importado por frontend/src/routes/index.tsx)

Outras pastas na raiz (auxiliares, baixa prioridade de mapeamento): backups/, docs/sped/,
env_files/frontend/, scripts/, tools/, uploads/.

Observacao tsconfig (apps/api): path alias "@shared/*" -> "../../shared/*" aponta para uma
pasta shared/ que NAO existe na raiz. Alias provavelmente morto/sem uso - confirmar antes
de usar.

## 3. Stack e execucao

- Backend: NestJS 10 + Prisma 7 (@prisma/adapter-pg) + PostgreSQL via Docker
  (container ledgr-postgres)
- Frontend: React 18 + TypeScript + Vite (porta 5173)
- API: porta 3000. CORS restrito a http://localhost:5173, credentials true.
    allowedHeaders: Content-Type, Authorization, x-company-id
    exposedHeaders: x-company-id, Content-Disposition (necessario p/ downloads SPED/ECD)
    methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Uploads servidos estaticamente em /uploads (NestExpressApplication.useStaticAssets)
- Body limit: 10mb (json e urlencoded)

### Comandos (raiz D:\\Projetos\\Ledgr)

    npm run start:dev     -> nest start api --watch
    npm run dev:fresh     -> clean + prisma generate + start:dev
    npm run generate      -> prisma generate (schema: prisma/schema.prisma)
    npm run seed          -> prisma db seed (infra/prisma/seed.ts)

### Frontend (cd frontend)

    npm run dev      -> vite (porta 5173)
    npm run build    -> tsc && vite build

## 4. Banco de dados / Prisma - fluxo obrigatorio

1. Editar prisma/schema.prisma via script Python em D:\\Temp\\ - nunca heredoc PS direto
2. Gerar client:
     $env:DATABASE_URL="postgresql://ledgr:ledgr123@localhost:5432/ledgr_app"
     npx prisma generate --schema=prisma/schema.prisma
3. Confirmar client em node_modules\\.prisma\\client\\index.d.ts
4. Migration manual via container:
     docker cp file.sql ledgr-postgres:/tmp/
     docker exec ledgr-postgres psql -U ledgr -d ledgr_app -f /tmp/file.sql
5. prisma.config.ts (raiz) deve ter schema: 'prisma/schema.prisma'

## 5. Modulos do backend (apps/api/src/modules/)

    accounting            Plano de contas, lancamentos, balancete, visoes contabeis, DRE/Balanco
    apuracao              Apuracao de impostos (LALUR/LACS)
    assets                Ativo imobilizado (depreciacao, manutencao, retrofit, avaliacao)
    calendar              Calendario de feriados (BrasilAPI)
    corporate             Societario (empresas, socios, documentos institucionais)
    dashboard             KPIs do dashboard (/dashboard/kpi)
    finance               AP/AR, fluxo de caixa, fechamento, agenda, fundo fixo, provisoes,
                          obrigacoes
    fiscal                Documentos fiscais (NF)
    hr                    RH, folha de pagamento, eSocial, pro-labore
    rfb                   Integracao Receita Federal (CNPJ sync, codigos de aglutinacao)
    sidebar-permissions   Permissoes de menu por perfil/usuario/empresa
    signatures            Assinatura eletronica (ClickSign)
    sped                  SPED: ECD, EFD-Contribuicoes, ECF
    tabelas-legais        Tabelas IRRF/INSS/salario minimo (dinamicas, por ano)

## 6. Multi-tenancy

- Toda chamada autenticada carrega a empresa ativa via header x-company-id.
- Master Admin (profile.permissions.all = true) pode acessar qualquer empresa via header
  explicito; o interceptor do frontend NAO deve sobrescrever esse header quando definido
  manualmente.
- Sidebar: permissoes em 3 camadas (perfil -> usuario -> empresa), resolvidas via
  GET /sidebar-permissions/resolve. Master Admin recebe ['*'] sem consulta ao banco.

## 7. Convencoes criticas de codigo (nao quebrar)

- Nunca deduzir nomes de campo Prisma/SPED/RFB - sempre consultar schema/leiaute antes
  (ex: codAgl -> aglutinationCode, entryDate -> date, amount -> value)
- Analisar antes de agir: "Sempre analise, avalie, planeje, so depois aja!"
- Relatorios sempre a partir de journal_entry_items - nunca misturar saldos importados da
  ECD com calculos baseados em lancamentos
- CPF, datas e numericos: armazenar crus (so digitos) no banco; formatacao so na exibicao
  (fmtBR/parseBR, fmtCpf/fmtPhone/fmtCep)
- Decimais BR: String(v).replace(',', '.') antes de new Prisma.Decimal()
- DTOs com UUID opcional: dto.field || null (nao ?? null) para strings vazias
- Rotas NestJS: estaticas sempre antes de :id
- Toda pessoa (funcionario/estagiario/prestador) precisa de Person antes do vinculo de emprego
- Imoveis da LM ficam em fixed_assets (grupo REAL_ESTATE), nao em properties
- AccountingView / I051: nunca filtrar por anoBase (esvazia i052Map se ano_base != periodo ECD)
- Sem lancamentos no periodo: I001 deve ser |I001|1| (nunca |I001|0|)
- I350: emitir somente quando houver lancamentos reais de encerramento (incondicional gera
  50+ erros)
- Assinatura do exporter ECD: Promise<{ buffer: Buffer; warnings: string[] }> (nunca
  Promise<Buffer>)
- Erros de Mapeamento/Visoes Contabeis = correcao de dados do usuario, nao bug de codigo
- Campos de cadastro faltantes (contador, signatarios, regime, NIRE) -> warning na geracao
- input type="month" e BANIDO - usar 2 selects (mes + ano) com lista dinamica via endpoint
  minYear
- PGE COD_PLAN_REF=60959347 -> formato L100A/L300A (codigos terminando em .01), nao confundir
  com plano historico ECD (.00)
- EFD M205/M605 sao filhos de nivel 3 de M200/M600 (nao de M210/M610); M400/M800 omitidos
  p/ CST=01


- Primeira linha de cada arquivo de codigo: comentario com caminho absoluto completo
  ex: `// apps/api/src/modules/fiscal/services/nfse-sp-consulta.service.ts`
  ex: `// frontend/src/pages/finance/NfseImportPage.tsx`


- Primeira linha de cada arquivo de codigo: comentario com caminho absoluto completo
  ex: `// apps/api/src/modules/fiscal/services/nfse-sp-consulta.service.ts`
  ex: `// frontend/src/pages/finance/NfseImportPage.tsx`

## 8. Fluxo de trabalho (TDD/PowerShell)

- Tudo entregue como blocos PowerShell para execucao manual. NUNCA usar bash_tool,
  create_file ou present_files para arquivos do projeto.
- Fluxo: inspecionar -> entregar bloco PS -> confirmar. Tokens minimos, edicoes cirurgicas.
- JSX/TSX e qualquer conteudo com aspas duplas, backticks ou template literals: script
  Python em D:\\Temp\\ via heredoc PS, com r\"\"\"...\"\"\".
- Escrita de arquivo: [System.IO.File]::WriteAllText + UTF8Encoding($false)
  (nunca WriteAllLines - reinsere BOM e quebra Prisma)
- Edicao por indice de linha: cuidado com $idx-1 em PowerShell (usar inteiros literais)
- Verificar apos cada edicao com comando de confirmacao
- Commit por grupo logico de funcionalidade, push para main
- Arquivo corrompido por edicoes incrementais -> reescrita completa em vez de patch continuado
- Sessao travada num problema especifico: pular e seguir ("vamos pular esta fase")
- Scripts de append ao contexto/md: sempre incluir a confirmacao (Get-Content -Tail 10
  ou Select-String) no mesmo bloco PS, logo apos o comando principal. Nao entregar
  confirmacao separada em bloco distinto.


## 9. Seguranca

- .env (raiz) contem: DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, BACKUP_MASTER_KEY,
  LEDGR_MASTER_KEY (AES-256-GCM, certificados - Fase 1.1), credenciais ClickSign
  (CLICKSIGN_*) e Gov.br OAuth2 (GOVBR_*), FRONTEND_URL. Nunca commitar.
- .gitignore reforcado (14/06/2026): *masterkey*, *.pem, *.p12, *.pfx adicionados para
  evitar reincidencia.
- RESOLVIDO (14/06/2026): infra/docker/ledgrmasterkey <64-hex>.txt (valor de
  LEDGR_MASTER_KEY gerado no setup da Fase 1.1, nunca configurado em .env, sem dados
  dependentes - tabela certificates vazia, modulo nao registrado) foi removido do working
  tree E de todo o historico git (filter-branch, 182 commits reescritos, force-push).
  Nova LEDGR_MASTER_KEY gerada e adicionada ao .env local.
- Backup pre-reescrita (historia antiga com o arquivo sensivel) preservado em
  D:\\Projetos\\Ledgr-backup-mirror-20260614-114707 - apagar/proteger apos confirmacao final.

## 10. Recursos de referencia

- Validador SPED: PGE/SpedContabil (PVA); EFD-Contribuicoes PVA em
  C:\\Arquivos de Programas RFB\\Programas SPED\\EFD-Contribuicoes\\
- Tabelas de aglutinacao RFB:
  C:\\Arquivos de Programas RFB\\Programas SPED\\SpedContabil\\recursos\\tabelas\\
- Guia EFD: C:\\Temp\\Guia_EFD_Contrib_1.35.pdf
- Token de auth no localStorage: @ledgr:token
- Tabelas legais (IRRF 2026, Lei 15.270/2025): em banco (tabela_irrf, tabela_inss,
  salario_minimo), simulador dinamico em TabelasLegaisPage.tsx

## 11. Por onde comecar numa sessao nova

1. LEDGR-contexto.md (raiz) - pendencias, ultimas alteracoes, estado por modulo
2. Este arquivo (CLAUDE.md) - convencoes e mapa do repo
3. LEDGR-ECD-Aprendizado (1).md - armadilhas especificas de ECD/SPED


## 0. PROTOCOLO DE INICIO DE SESSAO (OBRIGATORIO)

Antes de qualquer acao, ler nesta ordem:
1. LEDGR-contexto.md - pendencias, ultimas alteracoes, estado atual
2. CLAUDE.md (este arquivo) - convencoes, mapa do repo, padroes
3. LEDGR-ECD-Aprendizado (1).md - se a sessao envolver ECD/SPED
4. prisma/schema.prisma - se a sessao criar/alterar modelos
5. frontend/src/components/SideBar.tsx - se a sessao alterar menu/rotas
6. frontend/src/routes/index.tsx - se a sessao criar novas paginas

Nunca solicitar ao usuario informacoes ja disponiveis nesses arquivos.
Nunca repetir perguntas de sessoes anteriores.

## 12. Padroes de UI - Paginas de Lista

Toda pagina de lista deve ter 3 botoes por linha: Ver (FiEye) + Editar (FiEdit2) + Excluir (FiTrash2)
Ver: abre modal inline. Excluir: confirmacao Swal + recarrega lista do servidor (loadItems).
Ja implementado em: UserList.tsx, ProfileList.tsx

## 13. Icones react-icons/fi - Confirmados vs Inexistentes

Existem: FiEye FiEdit2 FiTrash2 FiPlus FiUpload FiDownload FiFileText FiFilePlus
         FiPackage FiSettings FiPercent FiCheckCircle FiAlertCircle FiLock FiUsers
         FiShield FiTrendingUp FiTrendingDown FiBarChart2 FiPieChart FiCalendar
NAO EXISTEM (causam erro): FiSend FiMoney FiReceipt

## 14. Modulo Fiscal - Arquivos e Endpoints

Servicos em apps/api/src/modules/fiscal/services/:
  nfse-sp-parser.service.ts     Parser ABRASF 2.0 v1+v2 (IBS/CBS NT007/2026)
  nfse-import.service.ts        Import NFS-e SP + importFromXmlStrings()
  nfse-sp-consulta.service.ts   Busca repositorio SP (Tomador+Emitidas, SOAP mTLS)
  nfse-sp-emissao.service.ts    Emissao NFS-e SP EnvioLoteRPS v1+v2 + cancelamento
  nfse-nacional.service.ts      Emissao NFS-e Nacional RFB (DPS+mTLS) + cancelamento
  nfe-parser.service.ts         Parser NF-e SEFAZ (Entrada/Saida)
  nfe-import.service.ts         Import NF-e produtos

Integracao NFS-e->AP/AR (integration.service.ts):
  TOMADOR (nota recebida) -> cria ApEntry + lancamento Debito Despesa/Credito Fornecedores
  PRESTADOR (nota emitida) -> cria ArEntry + lancamento Debito Clientes/Credito Receitas
  Deteccao: campo notes contem TOMADOR ou PRESTADOR

Locacao de Imoveis NT007/2026: codigos 99.03.01, 99.03.02, 99.04.01
  Redutor 70% (base = 30% do valor). Sem ISS. IBS 0,1% + CBS 0,9% em 2026.
  Obrigatoriedade plena: 2027.

LEDGR Agent (apps/agent/src/main.ts): porta 7778
  Acessa Windows Certificate Store via PowerShell/CNG para tokens A3.
  Iniciar: cd apps/agent && npx tsx src/main.ts
  Necessario apenas para operacoes com certificado A3 fisico.

## 15. Arquivos Recomendados no Projeto claude.ai

CLAUDE.md, LEDGR-contexto.md, prisma/schema.prisma,
frontend/src/components/SideBar.tsx, frontend/src/routes/index.tsx,
frontend/src/components/Layout.tsx, frontend/src/components/Header.tsx

---
Manter este arquivo atualizado quando convencoes/arquitetura mudarem. Estado de sessao e
pendencias ficam em LEDGR-contexto.md (append-only).

---

## Sistema de Permissões (atualizado 13/07/2026)

- **Fonte única de verdade do menu:** tabela `sidebar_items` no banco. NUNCA hardcode itens de menu no frontend — o SideBar.tsx renderiza via `GET /sidebar-permissions/tree`.
- **Padrão de guard obrigatório para controllers novos:** todo controller novo DEVE ter `@UseGuards(JwtAuthGuard)` na classe, sem exceção. Checklist de sessão: rodar a auditoria de guards ausentes antes de considerar uma feature "pronta" (ver histórico 13/07/2026 no LEDGR-contexto.md).
- **Controle de acesso fino (View/Edit/Delete):** usar `SidebarResourceGuard` + `@RequireResourceAccess(resource, nivel)` por rota — NÃO usar mais `ProfileGuard`/`RequirePermission` (legado, mantido só por compatibilidade, sem uso ativo).
- **Fallback de bootstrap:** perfil sem nenhuma linha configurada em `profile_sidebar_permissions` = acesso liberado. Isso é intencional (evita quebrar usuários existentes), mas significa que qualquer perfil novo criado precisa ser configurado na tela de Permissões de Menu antes de restringir acesso.
- **Comando de start do backend:** `npm run dev` (de dentro de `apps\api`) OU `npm run start:dev` (da raiz do monorepo) — ambos válidos, mesmo resultado, terminais diferentes.
- **UX de bloqueio visual:** ao adicionar guard real de API a um módulo (`RequireResourceAccess`), replicar o padrão do Persons — botão de ação principal desabilitado com texto "Somente leitura" quando sem EDIT, ações de editar/excluir ocultas conforme `canEdit`/`canDelete` do `SidebarPermissionsContext`, `alert()` nativo trocado por `toast.error()`.

## Padrao de avisos/erros (toast vs inline) — atualizado 15/07/2026

- **Regra geral:** `toast.error()` (react-hot-toast) e o padrao para feedback de acoes do
  sistema — erros de permissao (403), falhas de salvamento, confirmacoes. NUNCA usar
  `alert()`/`confirm()` nativos do navegador em codigo novo ou ao tocar em codigo existente.
- **Excecao deliberada — erros de validacao vinculados a um campo especifico:** quando o erro
  esta contextualmente preso a um input (ex: login invalido, campo obrigatorio nao preenchido),
  um banner inline proximo ao campo pode ser mais claro que um toast no canto da tela. Exemplo
  ja implementado: Header.tsx, erro de login aparece como caixinha vermelha abaixo do form,
  nao como toast.
- **Ao revisar/criar qualquer tela nova:** se houver `alert()`/`confirm()` nativo, avaliar se e
  claramente contextual (fica inline) ou geral (vira toast) antes de decidir o padrao a aplicar.
- **Pendencia registrada:** ~36 arquivos ainda usam alert() nativo fora dos modulos ja
  padronizados (Persons, e os 6 modulos financeiros/contabeis com guard real de 14/07). Tratar
  por modulo, priorizando conforme cada um ganhar guard real de API (mesmo criterio de risco
  usado ate agora).

---

## Protocolo de Sessão — Licoes de 16/07/2026 (sessao lenta, para nao repetir)

**Regra 1 — Reler antes de editar.** Se um arquivo ja foi editado nesta sessao (mesmo que so uma vez), SEMPRE pedir o conteudo atual real (Get-Content) imediatamente antes de escrever o proximo patch. Nunca reconstruir de memoria ou de busca anterior. Isso vale mesmo quando parecer redundante — sai mais barato que um script falhando por ancora desatualizada.

**Regra 2 — Verificar contrato de API antes de escrever a chamada.** Antes de qualquer chamada nova do frontend a um endpoint, ler o controller/service real primeiro (rota exata, nome dos parametros, formato do retorno — array puro vs paginado). Nunca assumir por convencao/semelhanca com outro endpoint.

**Regra 3 — Preferir patches pequenos e independentes a scripts grandes.** Para qualquer arquivo com mais de ~3 pontos de edicao, aplicar um de cada vez com verificacao entre eles (grep/tsc), em vez de um script Python so com todas as substituicoes. Se uma ancora falhar no meio de um script grande, ele aborta SEM escrever nada — e isso pode nao ficar claro na hora.

**Regra 4 — Nao investigar problema cosmetico como se fosse funcional.** Se um sintoma (ex: encoding de terminal, emoji quebrado) for confirmado como nao afetando o funcionamento real, encerrar a investigacao e seguir — nao gastar turnos em polimento sem valor prático.

**Regra 5 — Sinalizar quando o escopo cresce.** Se uma tarefa que parecia pequena (ex: "travar lancamento") evoluir para algo estrutural maior (ex: integracao contabil completa) no meio da conversa, dizer isso explicitamente e propor checkpoints, em vez de simplesmente seguir em frente.

**Regra 6 — Nunca usar bash_tool neste projeto**, sob nenhuma circunstancia, nem por engano/teste. Toda edicao de arquivo do projeto passa por PowerShell (blocos que o usuario executa) ou Python via script gerado — nunca por chamada direta de ferramenta.

## Licao adicional — project_knowledge_search pode ficar desatualizado (17/07/2026)

Para arquivos editados MUITAS vezes na mesma sessao (ex: Header.tsx sofreu 4+ patches num unico
dia), o `project_knowledge_search` (busca nos arquivos do projeto) pode retornar conteudo
DESATUALIZADO mesmo apos o usuario re-subir o arquivo atualizado. Confirmado nesta sessao: a
busca trouxe 3 vezes seguidas uma versao antiga do Header.tsx (sem o bloco loginError/unlock que
ja estava aplicado e confirmado via Select-String no arquivo real).

**Regra pratica:** para arquivos que ja sofreram edicao HOJE (nesta sessao), nao confiar no
project_knowledge_search como fonte de verdade — ir direto ao Select-String/Get-Content no
terminal real do usuario. A busca do projeto continua sendo o primeiro passo correto para
arquivos AINDA NAO tocados na sessao atual (evita pedir de novo algo que ja esta disponivel),
mas perde confiabilidade a partir da primeira edicao do dia.


## Licao — Regra 7 (27/07/2026): nunca colocar JSON/aspas escapadas em mensagem de commit -m inline

Um `git commit -m "..."` com um trecho de exemplo tipo `{\"0\":37,\"1\":80,...}` dentro da
mensagem quebrou o parser de string do PowerShell (aspas escapadas com \" nao sao
interpretadas como o esperado dentro de uma string de aspas duplas do PowerShell -
diferente de bash). O `git commit` recebeu um pathspec invalido em vez da mensagem
completa e FALHOU SILENCIOSAMENTE (sem erro visualmente alarmante, so uma linha de
"did not match any file(s) known to git" facil de nao perceber no meio de um output
grande). O `git add` anterior, porem, tinha funcionado - os arquivos ficaram staged
sem commit. O commit seguinte (de outro bloco de trabalho) acabou absorvendo esses
arquivos junto, resultando num commit com 7 arquivos mas mensagem descrevendo so
metade do conteudo real.

**Regra pratica adotada:**
1. NUNCA usar -m "..." inline no PowerShell quando a mensagem contiver: aspas duplas
   aninhadas/escapadas, chaves {}/JSON literal, colchetes, ou qualquer caractere
   especial de shell.
2. Para qualquer mensagem de commit com mais de ~3 linhas OU qualquer caractere
   especial, usar sempre o padrao: heredoc @'...'@ -> Set-Content num arquivo .txt em
   D:\Temp\ -> git commit -F <arquivo>. Nunca -m inline para mensagens longas,
   independente de conterem caractere especial ou nao (reduz a chance de erro por
   padrao, nao so quando ja se sabe que tem risco).
3. Apos qualquer `git commit`, SEMPRE conferir a saida antes de seguir - um commit
   que falha silenciosamente nao gera nenhum erro auto-evidente se o -m
   simplesmente virou um pathspec: aparece so como "did not match any file(s) known
   to git", facil de rolar pra baixo sem notar quando ha muito output de -m
   multi-linha acima. Verificar sempre `git log --oneline -1` logo apos qualquer
   commit para confirmar o hash mudou e a mensagem bate com o esperado, antes de
   seguir para o proximo passo (push, etc).


## Licao — Regra 8 (27/07/2026): sempre detectar separador de linha automaticamente

Confirmado repetidas vezes nesta sessao: o separador de linha (CRLF vs LF) NAO e
uniforme no repositorio - cada arquivo pode ter o seu, dependendo de qual
ferramenta/editor o criou ou tocou por ultimo (schema.prisma e a maioria dos
arquivos legados = CRLF; varios arquivos criados/editados via Claude Code ou npm
scripts recentes = LF puro). Assumir um dos dois sem checar causou pelo menos 5
abortos de script nesta sessao (rental-contracts.service.ts, RepositorioPage.tsx,
DocumentViewModal.tsx, documents.service.ts, entre outros).

**Regra pratica adotada:** todo script Python de edicao de arquivo deve SEMPRE
detectar o separador real antes de montar qualquer ancora multi-linha:

```python
with open(path, "rb") as f:
    raw = f.read()
nl = "\r\n" if b"\r\n" in raw else "\n"
```

E usar `nl.join([...])` para montar `old`/`new` de ancoras multi-linha - nunca
`"\n".join(...)` ou `"\r\n".join(...)` fixo. Ancoras de uma linha so nao sofrem
com isso (nao ha separador envolvido), mas ancoras de 2+ linhas SEMPRE precisam
dessa deteccao. Aplica-se tambem ao escrever o arquivo de volta:
`open(path, "w", encoding="utf-8", newline="")` preserva o que foi lido, mas so
funciona corretamente se o conteudo interno (o `content` em memoria) usar o
separador certo de forma consistente - dai a necessidade de usar `nl` tambem nos
literais `new_lines` que estao sendo inseridos, nao so nos `old_lines` de busca.


## Licao — Regra 9 (27/07/2026): Puppeteer headerTemplate/footerTemplate tem
## comportamento de margem proprio, INDEPENDENTE do @page CSS e do margin do page.pdf()

Ao implementar papel timbrado (logo+endereco+CNPJ no cabecalho, nome+paginacao no
rodape) via `page.pdf({ displayHeaderFooter: true, headerTemplate, footerTemplate,
margin })`, varias rodadas de tentativa-erro foram necessarias ate entender a
mecanica real (confirmada via issue oficial do repo puppeteer/puppeteer #3672):

1. **Tres fontes de margem coexistem e NAO se cancelam automaticamente:**
   - A regra `@page { margin: ... }` no `<style>` do HTML - e IGNORADA pelo
     Chromium sempre que a opcao `margin` e passada para `page.pdf()`. Vira
     codigo morto, sem efeito, mas nao gera erro nem aviso - facil de esquecer
     que esta la e ficar tentando debugar algo que nunca mais roda.
   - A opcao `margin: {top,bottom,left,right}` do `page.pdf()` - controla o
     recuo do CORPO do documento (a area onde `doc.content` e renderizado).
   - O CSS `margin`/`padding` inline dentro do proprio `headerTemplate`/
     `footerTemplate` - controla o recuo do cabecalho/rodape. Esses templates
     SEMPRE ocupam a largura total da pagina fisica (nao respeitam left/right
     de `page.pdf()`), entao o alinhamento com o corpo tem que ser replicado
     manualmente aqui.

2. **Bug documentado do Chromium: `margin` dentro do header/footer template tem
   valores padrao embutidos que nao sao totalmente sobrescritos** por um
   `margin` inline declarado no HTML - o valor customizado SOMA com o default
   em vez de substituir, causando desalinhamentos de poucos milimetros dificeis
   de diagnosticar so olhando o codigo. Fix: usar `padding` em vez de `margin`
   no elemento raiz do header/footer template, com `box-sizing: border-box` e
   `margin: 0` explicito - `padding` nao tem esse comportamento problemático.

3. **`position: fixed` dentro do BODY do documento (nao do header/footer
   template) e medido relativo a AREA DE CONTEUDO** (depois da margem definida
   em `page.pdf({margin})`), nao a borda fisica da pagina - diferente do que se
   intuiria por analogia com CSS normal de navegador. Confirmado empiricamente:
   a marca d'agua (`top:50%; left:50%`) sempre ficou centralizada corretamente
   porque 50% e proporcional e nao depende dessa distincao, mas um valor fixo
   tipo `left: 2cm` para uma tarja lateral caiu em lugares diferentes dependendo
   de qual das duas margens (page.pdf ou @page, veja item 1) estava efetivamente
   ativa no momento.

**Regra pratica adotada:** ao posicionar qualquer elemento fixo relativo a
margem/borda em PDF gerado via Puppeteer, testar SEMPRE com um print real do
resultado (nunca assumir matematicamente sem confirmar visualmente) - a mecanica
de margens do Puppeteer tem comportamento suficientemente contraintuitivo
(3 fontes de margem, 2 delas com pegadinhas documentadas) para tornar calculo
por raciocinio puro pouco confiavel nesse caso especifico.

**Regra de grafia adotada para todos os templates futuros:** enderecos
(logradouro, bairro, cidade) sempre em Title Case (primeira letra maiuscula de
cada palavra) via helper `toTitleCase()`, nao em CAIXA ALTA nem minusculo puro.
UF mantida em maiusculas (abreviacao padrao). Razao Social mantida como
cadastrada (convencao juridica).


## Licao — Extensao da Regra 8 (28/07/2026): separadores de linha podem ser MISTOS
## dentro do MESMO arquivo, nao so diferentes entre arquivos

A Regra 8 (27/07) assumia que cada ARQUIVO tem um separador uniforme (CRLF ou LF),
bastando detectar uma vez no inicio do script. Confirmado hoje que isso e falso em
alguns casos: DocumentViewModal.tsx tem b'\r\n' em algumas partes E b'\n' puro em
outras, DENTRO do mesmo arquivo (provavelmente resultado de edicoes por
ferramentas/sessoes diferentes ao longo do tempo, cada uma preservando o separador
que encontrou localmente em vez de normalizar o arquivo inteiro).

Sintoma: uma ancora multi-linha que devia bater (cada linha individual confere,
count()==1 para cada uma isoladamente) falha com count()==0 quando as linhas sao
juntadas com nl.join(), mesmo com nl "corretamente" detectado no topo do arquivo -
porque a deteccao pegou o separador PREDOMINANTE do arquivo todo, nao o da REGIAO
especifica que esta sendo editada.

**Regra pratica adotada:** quando uma ancora multi-linha falhar mesmo com cada linha
individualmente confirmada (count()==1 para cada uma via teste separado), NAO
assumir erro de digitacao - testar o PAR de linhas adjacentes com os dois
separadores (nl.join dessas duas linhas em CRLF e em LF, count() dos dois) para
descobrir qual separador vale NAQUELA regiao especifica antes de reconstruir a
ancora completa. Nao confiar na deteccao global de separador do arquivo para
prever o separador de uma regiao especifica quando ha evidencia de edicoes
historicas heterogeneas no mesmo arquivo (arquivos tocados por muitas sessoes/
ferramentas diferentes ao longo do tempo sao os mais suscetiveis a isso).


## Licao — Regra 11 (28/07/2026): nao pedir confirmacao para passos que ja seguem
## protocolo estabelecido - so perguntar decisoes realmente importantes

Pedir "posso seguir?" antes de cada patch mecanico (que ja segue o padrao Regra 8:
detectar separador, testar ancora, abortar com seguranca se nao bater) e ruido
desnecessario - o script ja e seguro por construcao (aborta sem gravar se a ancora
nao bater). Perguntar confirmacao deveria ser reservado para decisoes de
arquitetura/escopo genuinas (ex: schema novo, endpoint novo, mudanca de
comportamento visivel ao usuario) - nao para "vou editar o arquivo X da forma Y que
ja alinhamos".
