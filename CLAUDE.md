# CLAUDE.md - LEDGR

> Referencia estatica do projeto, lida automaticamente por sessoes de IA (Claude Code, etc).
> Estado da sessao / pendencias / historico: ver LEDGR-contexto.md (raiz, append-only).
> Aprendizados especificos de SPED/ECD: ver LEDGR-ECD-Aprendizado (1).md.

## 1. Visao geral

LEDGR e uma plataforma SaaS brasileira de gestao contabil e empresarial multi-empresa, cobrindo
contabilidade, RH/folha de pagamento, compliance fiscal (SPED: ECD, EFD-Contribuicoes, eSocial),
ativo imobilizado, financeiro (AP/AR, fluxo de caixa, fechamento mensal, agenda) e gestao
documental com assinatura eletronica (ClickSign).

### Empresas de teste
- LM  = LM Administracao de Bens Imoveis Ltda (f00af1b1-d50b-4ae6-aa17-4c2262e058db)
- KPL = Kipstone Servicos e Tecnologia Ltda (671d09ef-bb23-4159-a360-fd1d37466a1a)
- KSA = Kipstone Tecnologia S/A (9047fcd8-...)
- Advocacia Gomes = d85731d7-..., CNPJ 06190032000183, Lucro Presumido cumulativo

"Kipstone" sem sigla e ambiguo -> sempre confirmar KPL ou KSA.

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

---
Manter este arquivo atualizado quando convencoes/arquitetura mudarem. Estado de sessao e
pendencias ficam em LEDGR-contexto.md (append-only).
