# LEDGR — Módulo Ativo Imobilizado
## Roteiro de Implementação Passo a Passo

**Stack:** NestJS + Prisma + PostgreSQL | React + TypeScript + Vite  
**Versão:** 1.0 — Fase 1  
**Status:** Pronto para implementação

---

## Mapa Geral de Arquivos

### Backend — `apps/api/src/modules/assets/`

| # | Arquivo | Ação | Responsabilidade |
|---|---------|------|-----------------|
| 01 | `prisma/schema.prisma` | EDITAR | Adicionar 9 enums + 8 models ao schema existente |
| 02 | `dto/assets.dto.ts` | CRIAR | Todos os DTOs: Create, Update, Filter, Baixa, Manutenção, Benfeitoria, Retrofit, Laudo |
| 03 | `services/historico.service.ts` | CRIAR | Registro imutável de eventos do ativo (linha do tempo) |
| 04 | `services/depreciacao.service.ts` | CRIAR | Engine mensal com @Cron, Linear, SYD, recálculo manual |
| 05 | `services/manutencao.service.ts` | CRIAR | CRUD de ordens de serviço, alertas de vencimento |
| 06 | `services/benfeitoria.service.ts` | CRIAR | Registro e capitalização de benfeitorias (CPC 27) |
| 07 | `services/retrofit.service.ts` | CRIAR | Projetos de retrofit com fases, % físico e financeiro |
| 08 | `services/laudo.service.ts` | CRIAR | Laudos de avaliação, atualiza valor de mercado no ativo |
| 09 | `assets.service.ts` | CRIAR | CRUD principal: listagem com KPIs, detalhe, criar, ativar, baixa, projeção |
| 10 | `assets.controller.ts` | CRIAR | 20 endpoints REST com JwtAuthGuard + CompanyInterceptor |
| 11 | `assets.module.ts` | CRIAR | Module NestJS com ScheduleModule.forRoot() e providers |
| 12 | `app.module.ts` | EDITAR | Importar AssetsModule no array imports |

### Frontend — `frontend/src/pages/Assets/`

| # | Arquivo | Ação | Responsabilidade |
|---|---------|------|-----------------|
| 13 | `types/asset.types.ts` | CRIAR | Interfaces, enums, labels e color maps |
| 14 | `hooks/useAssets.ts` | CRIAR | 3 hooks: useAssetsList, useAssetDetail, useAssetMutations |
| 15 | `AssetList.tsx` | CRIAR | Listagem com KPIs, filtros, tabela paginada |
| 16 | `AssetShow.tsx` | CRIAR | Detalhe com 7 tabs |
| 17 | `modals/AssetFormModal.tsx` | CRIAR | Modal 3 steps: Identificação / Financeiro / Específico |
| 18 | `modals/ManutencaoModal.tsx` | CRIAR | Modal de OS: criação e edição |
| 19 | `modals/BenfeitoriaModal.tsx` | CRIAR | Modal de benfeitoria com justificativa CPC 27 |
| 20 | `modals/RetrofitModal.tsx` | CRIAR | Modal de projeto de retrofit |
| 21 | `modals/LaudoModal.tsx` | CRIAR | Modal de laudo de avaliação |
| 22 | `modals/BaixaModal.tsx` | CRIAR | Modal destrutivo de baixa/alienação |
| 23 | `components/ManutencaoTab.tsx` | CRIAR | Tab com alertas de vencimento e OS em aberto |
| 24 | `components/BenfeitoriaTab.tsx` | CRIAR | Tab com botão capitalizar |
| 25 | `components/RetrofitTab.tsx` | CRIAR | Tab com progresso visual de fases |
| 26 | `components/LaudoTab.tsx` | CRIAR | Tab com diferença valor apurado x contábil |
| 27 | `components/DepreciacaoTab.tsx` | CRIAR | Tab com gráfico Recharts + tabela histórica |
| 28 | `components/HistoricoTab.tsx` | CRIAR | Timeline vertical de eventos |

### Infraestrutura

| # | Arquivo | Ação | O que mudar |
|---|---------|------|------------|
| 29 | `frontend/src/router/index.tsx` | EDITAR | Adicionar 2 rotas: `/app/assets` e `/app/assets/:id` |
| 30 | `frontend/src/components/Layout/Sidebar.tsx` | EDITAR | Adicionar item "Ativo Imobilizado" com ícone Building2 |
| 31 | `frontend/src/utils/format.ts` | CRIAR/VERIFICAR | formatCurrency, formatDate, formatPercent, formatMeses |
| 32 | `apps/api/package.json` | VERIFICAR | Confirmar @nestjs/schedule instalado |

---

## Roteiro Passo a Passo

---

### PASSO 1 — Instalar dependência de agendamento

O serviço de depreciação usa `@Cron` do NestJS Schedule para rodar todo mês.

```bash
cd apps/api
npm install @nestjs/schedule

# Verificar se já estava instalado:
cat package.json | grep schedule
```

> **Validação:** `"@nestjs/schedule"` aparece no `package.json` de `apps/api`

---

### PASSO 2 — Schema Prisma — Adicionar models

**Arquivo:** `apps/api/prisma/schema.prisma`

**O que adicionar:**
- 9 enums: `GrupoAtivo`, `StatusAtivo`, `MetodoDepreciacao`, `TipoManutencao`, `StatusManutencao`, `TipoBenfeitoria`, `TipoLaudo`, `StatusRetrofit`, `TipoEventoAtivo`
- 8 models: `AtivoImobilizado`, `Manutencao`, `Benfeitoria`, `RetrofitProjeto`, `RetrofitFase`, `LaudoAvaliacao`, `LancamentoDeprec`, `AtivoHistorico`
- Relação no model `Company`: adicionar `ativos AtivoImobilizado[]`

**Convenções obrigatórias LEDGR:**
- PK: `@id @default(dbgenerated("gen_random_uuid()")) @db.Uuid`
- Snake_case no banco: `@map("nome_campo")`
- Datas: `@db.Timestamp(6)` ou `@db.Date`
- Soft delete: `deletedAt DateTime? @map("deleted_at")`
- Decimais monetários: `@db.Decimal(15, 2)`

```bash
cd apps/api
npx prisma generate
npx prisma migrate dev --name add-assets-module

# Verificar tabelas criadas:
npx prisma studio
```

> **Validação:** 8 novas tabelas visíveis no Prisma Studio

---

### PASSO 3 — Criar estrutura de pastas

```bash
# Backend
mkdir -p apps/api/src/modules/assets/dto
mkdir -p apps/api/src/modules/assets/services

# Resultado esperado:
# apps/api/src/modules/assets/
#   ├── dto/
#   │   └── assets.dto.ts
#   ├── services/
#   │   ├── historico.service.ts
#   │   ├── depreciacao.service.ts
#   │   ├── manutencao.service.ts
#   │   ├── benfeitoria.service.ts
#   │   ├── retrofit.service.ts
#   │   └── laudo.service.ts
#   ├── assets.service.ts
#   ├── assets.controller.ts
#   └── assets.module.ts

# Frontend
mkdir -p frontend/src/pages/Assets/types
mkdir -p frontend/src/pages/Assets/hooks
mkdir -p frontend/src/pages/Assets/modals
mkdir -p frontend/src/pages/Assets/components
```

---

### PASSO 4 — Criar DTOs

**Arquivo:** `apps/api/src/modules/assets/dto/assets.dto.ts`

Arquivo único com todos os DTOs, cada classe exportada individualmente.

**Classes a exportar:**
- `CreateAssetDto` — campos obrigatórios e opcionais do ativo principal
- `UpdateAssetDto` — `extends PartialType(CreateAssetDto)`
- `FilterAssetDto` — filtros de listagem com paginação
- `CreateManutencaoDto` + `UpdateManutencaoDto`
- `CreateBenfeitoriaDto`
- `CreateRetrofitDto` + `CreateRetrofitFaseDto`
- `CreateLaudoDto`
- `BaixaAssetDto`

**Decorators obrigatórios:**
- `@IsString()`, `@IsNumber()`, `@IsEnum()`, `@IsDateString()` — validação básica
- `@IsOptional()` — para campos não obrigatórios
- `@Type(() => Number)` — em **todos** os campos numéricos (transformação body)
- `@MaxLength(n)` — em strings, compatível com `@db.VarChar(n)`

---

### PASSO 5 — Criar Services de suporte

Criar na ordem abaixo (do mais simples ao mais complexo).

---

#### `services/historico.service.ts`

Service mais simples — apenas 2 métodos. Sem dependências de outros services do módulo.

- `registrar(ativoId, companyId, tipo, descricao, valorAnterior?, valorNovo?, usuarioId?)` — cria `AtivoHistorico`
- `findByAtivo(companyId, ativoId)` — retorna timeline ordenada por `createdAt DESC`

**Injetar:** `PrismaService`

---

#### `services/depreciacao.service.ts`

Contém a lógica mais crítica do módulo.

- `@Cron('0 2 1 * *')` — executa todo dia 1 às 02:00
- `depreciarEmpresa(companyId)` — processa todos os ativos com `status = ATIVO` e `vidaUtilRestante > 0`
- `calcularQuota(ativo)` — suporta `LINEAR`, `SOMA_DIGITOS` e `ACELERADA_2X`
- `recalcularManual(companyId, competencia)` — deleta e reprocessa o período
- `historicoAtivo(companyId, ativoId)` — retorna `LancamentoDeprec` ordenado
- Usa `prisma.$transaction` para garantir atomicidade do lançamento + atualização do ativo

**Injetar:** `PrismaService` + `AtivoHistoricoService`

---

#### `services/manutencao.service.ts`

CRUD de ordens de serviço com lógica de status no ativo pai.

- `create()` — ao criar OS tipo `CORRETIVA` ou `EMERGENCIAL`, muda ativo para `EM_MANUTENCAO`
- `update()` — ao marcar `status = CONCLUIDA`, restaura ativo para `ATIVO` se estava `EM_MANUTENCAO`
- `vencidas()` — retorna OS com `status = AGENDADA` e `dataPrevista < hoje`

**Injetar:** `PrismaService` + `AtivoHistoricoService`

---

#### `services/benfeitoria.service.ts`

Registro e capitalização seguindo NBC TG 27 / CPC 27.

- `create()` — cria benfeitoria sem capitalizar automaticamente
- `capitalizar(id)` — usa `prisma.$transaction` para: marcar `capitalizada = true` + atualizar `valorContabil` e `vidaUtilRestante` do ativo
- Lança `BadRequestException` se já capitalizada

**Injetar:** `PrismaService` + `AtivoHistoricoService`

---

#### `services/retrofit.service.ts`

Projetos de reforma complexa com progresso por fases.

- `create()` — cria projeto e fases em uma única operação (nested write Prisma)
- `atualizarFase()` — ao marcar `fase.concluida = true`, recalcula `percFisico` e `valorExecutado` do projeto pai
- `concluir()` — marca `status = CONCLUIDO` e registra `dataFimReal`

**Injetar:** `PrismaService` + `AtivoHistoricoService`

---

#### `services/laudo.service.ts`

Laudos com atualização automática do valor de mercado no ativo.

- `create()` — salva o valor contábil atual como `valorAnterior` no laudo
- Após criar o laudo, atualiza `valorMercado` e `dataUltimoLaudo` no `AtivoImobilizado`
- Se `vidaUtilRestante` foi informado no laudo, também atualiza no ativo

**Injetar:** `PrismaService` + `AtivoHistoricoService`

---

### PASSO 6 — Criar AssetsService principal

**Arquivo:** `apps/api/src/modules/assets/assets.service.ts`

| Método | Observações críticas |
|--------|---------------------|
| `findAll()` | Retorna `data` + `meta` (paginação) + `kpis` (aggregate). Filtros: `grupo`, `status`, `localizacao`, `search` (OR em 4 campos) |
| `findOne()` | Include completo: manutencoes, benfeitorias, retrofits+fases, depreciacoes (últimos 36), avaliacoes, historico (últimos 50) |
| `create()` | Valida código único, calcula `valorTerrenoAbs`, taxa anual automática, chama `historico.registrar('AQUISICAO')` |
| `ativar()` | Muda status para `ATIVO`. Lança `BadRequestException` se já `ATIVO`. Registra histórico |
| `baixar()` | Calcula ganho/perda `(valorAlienacao - valorContabil)`. Define `deletedAt = dataBaixa`. Retorna `ganhoPerda` |
| `projecaoDepreciacao()` | Simula curva futura mês a mês até vida útil zero ou valor residual. Suporta `LINEAR` e `SOMA_DIGITOS` |

**Injetar:** `PrismaService` + `AtivoHistoricoService`

---

### PASSO 7 — Criar Controller e Module

**Arquivo:** `apps/api/src/modules/assets/assets.controller.ts`

20 endpoints REST. Todos com `@UseGuards(JwtAuthGuard)` + `@UseInterceptors(CompanyInterceptor)`.

| Endpoint | Método | Ação |
|----------|--------|------|
| `GET /assets` | findAll | Lista com KPIs e filtros |
| `GET /assets/:id` | findOne | Detalhe completo com todos os relacionamentos |
| `POST /assets` | create | Criar ativo com status `EM_AQUISICAO` |
| `PATCH /assets/:id` | update | Atualizar dados |
| `POST /assets/:id/ativar` | @HttpCode(200) | Mudar status para `ATIVO` |
| `POST /assets/:id/baixa` | @HttpCode(200) | Baixa com motivo e valor de alienação |
| `GET /assets/:id/depreciacao` | histórico | `LancamentoDeprec` do ativo |
| `GET /assets/:id/depreciacao/projecao` | projeção | Curva futura |
| `POST /assets/depreciacao/processar` | manual | Reprocessar período |
| `POST /assets/manutencoes` | create | Nova OS |
| `PATCH /assets/manutencoes/:id` | update | Atualizar / concluir OS |
| `DELETE /assets/manutencoes/:id` | delete | Cancelar OS |
| `POST /assets/benfeitorias` | create | Registrar benfeitoria |
| `POST /assets/benfeitorias/:id/capitalizar` | capitalizar | Capitalizar ao ativo |
| `POST /assets/retrofits` | create | Criar projeto de retrofit |
| `PATCH /assets/retrofits/:id/fases/:faseId` | update | Atualizar fase |
| `POST /assets/retrofits/:id/concluir` | concluir | Concluir projeto |
| `POST /assets/laudos` | create | Registrar laudo |
| `GET /assets/:ativoId/historico` | findAll | Timeline de eventos |
| `GET /assets/manutencoes/vencidas` | vencidas | OS com data vencida |

> **ATENCAO — Conflito de rota:** rotas estáticas (`/manutencoes/vencidas`) devem ser declaradas **antes** das rotas com parâmetro dinâmico (`/:id`), ou o NestJS vai tentar resolver "manutencoes" como um `:id`.

---

**Arquivo:** `apps/api/src/modules/assets/assets.module.ts`

```typescript
@Module({
  imports: [PrismaModule, ScheduleModule.forRoot()],
  controllers: [AssetsController],
  providers: [
    AssetsService, DepreciacaoService,
    ManutencaoService, BenfeitoriaService,
    RetrofitService, LaudoService,
    AtivoHistoricoService,
  ],
  exports: [AssetsService, DepreciacaoService],
})
export class AssetsModule {}
```

> **ATENCAO:** Se `ScheduleModule.forRoot()` já estiver no `AppModule`, remover daqui e manter apenas lá. O `@Cron` continuará funcionando.

---

### PASSO 8 — Registrar no AppModule

**Arquivo:** `apps/api/src/app.module.ts`

```typescript
// 1. Adicionar import no topo:
import { AssetsModule } from './modules/assets/assets.module';

// 2. Adicionar no array imports:
@Module({
  imports: [
    ...modulosExistentes,
    AssetsModule,  // <-- ADICIONAR
  ],
})
export class AppModule {}
```

```bash
# Testar compilação:
cd apps/api
npm run build

# Testar rota básica:
curl -H "Authorization: Bearer <token>" \
     -H "x-company-id: <id>" \
     http://localhost:3000/assets
```

> **Validação backend:** `GET /assets` retorna `{ data: [], meta: {...}, kpis: {...} }` com status 200

---

### PASSO 9 — Criar tipos TypeScript

**Arquivo:** `frontend/src/pages/Assets/types/asset.types.ts`

Arquivo centralizado com tudo do módulo:

- **Types:** `GrupoAtivo`, `StatusAtivo`, `MetodoDepreciacao`, `TipoManutencao`, `StatusManutencao`, `TipoBenfeitoria`, `TipoLaudo`, `StatusRetrofit`, `TipoEventoAtivo`
- **Labels:** `GRUPO_LABELS`, `STATUS_LABELS`, `METODO_DEPREC_LABELS`, `BENFEITORIA_TIPO_LABELS`, `LAUDO_TIPO_LABELS`
- **Cores:** `STATUS_COLORS` — strings de classe Tailwind por status
- **Interfaces:** `AtivoImobilizado`, `Manutencao`, `Benfeitoria`, `RetrofitProjeto`, `RetrofitFase`, `LaudoAvaliacao`, `LancamentoDeprec`, `AtivoHistorico`
- **Form types:** `CreateAssetForm` com campos `number | string` para compatibilidade com inputs HTML
- **Response types:** `AssetsListResponse`, `AssetsKpis`

---

### PASSO 10 — Criar hooks de API

**Arquivo:** `frontend/src/pages/Assets/hooks/useAssets.ts`

Toda a lógica de comunicação com a API em 3 hooks separados:

| Hook | Estado / Métodos |
|------|-----------------|
| `useAssetsList()` | `data`, `loading`, `error` + `fetch(filters)` |
| `useAssetDetail()` | `ativo`, `loading`, `error` + `fetch(id)` |
| `useAssetMutations()` | apenas `loading` + todos os métodos de escrita |

`useAssetMutations` expõe: `create`, `update`, `ativar`, `baixar`, `createManutencao`, `updateManutencao`, `deleteManutencao`, `createBenfeitoria`, `capitalizar`, `createRetrofit`, `atualizarFase`, `createLaudo`, `projecaoDepreciacao`.

> **Padrao LEDGR:** headers com `Authorization: Bearer ${token}` e `x-company-id: ${empresaAtiva.id}` consumidos de `AuthContext` e `EmpresaContext`.

---

### PASSO 11 — Criar página AssetList

**Arquivo:** `frontend/src/pages/Assets/AssetList.tsx`

**Componentes e comportamentos:**
- 4 KPI cards: Total de Ativos, Valor Bruto, Valor Contábil, Depreciação Acumulada
- Filtros: `search` (OR em código/descrição/marca/município), `grupo` (select), `status` (select)
- Busca ao pressionar Enter ou clicar em "Filtrar"
- Tabela: Código, Descrição, Grupo, Localização, Valor Contábil, % Deprec. (mini barra), Status, OS abertas
- Click na linha navega para `/app/assets/:id`
- Barra de depreciação: verde < 50%, laranja 50–79%, vermelho >= 80%
- Estado vazio: ilustração + botão "Cadastrar primeiro ativo" abre modal
- Paginação numérica no rodapé

---

### PASSO 12 — Criar página AssetShow

**Arquivo:** `frontend/src/pages/Assets/AssetShow.tsx`

**Seções fixas (acima das tabs):**
- Header: breadcrumb, código, badge de status, badge de OS abertas, botões Editar / Ativar / Baixa
- 4 value cards: Valor de Aquisição, Valor Contábil (highlight azul), Depreciação Acumulada, Vida Útil Restante
- Barra de progresso da depreciação com datas de início e fim

**7 Tabs:**

| Tab | Ícone | Conteúdo |
|-----|-------|----------|
| Resumo | `Building2` | Dados gerais + depreciação + campos de imóvel (se grupo = IMOVEL) |
| Depreciação | `TrendingDown` | KPIs de quota mensal, gráfico Recharts curva real + projeção, tabela histórica |
| Manutenção | `Wrench` | OS abertas (alertas de vencimento), histórico de OS concluídas |
| Benfeitorias | `Layers` | Lista com badge capitalizada/pendente, botão Capitalizar |
| Retrofit | `RefreshCw` | Projetos com barra de progresso físico, financeiro e fases |
| Laudos | `FileText` | Lista com diferença entre valor apurado e contábil |
| Histórico | `History` | Timeline vertical de todos os eventos |

```bash
# Instalar recharts se necessário:
cd frontend
npm install recharts
```

---

### PASSO 13 — Criar modais

**Padrao de layout:** todos os modais seguem a estrutura `header + body (scroll) + footer`.

---

#### `modals/AssetFormModal.tsx` — 3 steps

- **Step 1 — Identificação:** código, grupo, descrição, subgrupo, marca, modelo, nº série, localização
- **Step 2 — Financeiro:** valor aquisição, datas, valor residual, checkbox "não depreciável", método, vida útil, taxa (calculada auto)
- **Step 3 — Específico:** campos de imóvel para `grupo = IMOVEL`; mensagem informativa para outros grupos

**Lógica automática:**
- Ao mudar grupo → preenche vida útil sugerida (IMOVEL=300, VEICULO=60, TI=60, MAQUINA=120...)
- Ao mudar vida útil → calcula taxa: `(1 / anos) * 100`
- Grupo IMOVEL sem `ativoNaoDepreciavel` → exige `valorTerrenoPerc` no Step 3

---

#### `modals/ManutencaoModal.tsx`

- **Obrigatórios:** título, descrição, tipo, dataPrevista
- **Opcionais:** prestador, CNPJ, contato, valor orçado, nº OS, capitalizável
- **Modo edição:** adiciona campo de status; se `status = CONCLUIDA`, exibe valor realizado e data de conclusão

---

#### `modals/BenfeitoriaModal.tsx`

- Tipo, valor, descrição, justificativa (critério CPC 27), datas, ampliação de vida útil

---

#### `modals/RetrofitModal.tsx`

- Projeto base sem fases (fases adicionadas separadamente via tab de detalhe)

---

#### `modals/LaudoModal.tsx`

- Mostra valor contábil atual em destaque para facilitar comparação com valor apurado

---

#### `modals/BaixaModal.tsx` — modal destrutivo

- Alerta em vermelho com valor contábil atual
- Campo "Valor de Alienação" aparece condicionalmente se `motivoBaixa = ALIENACAO`
- Botão de confirmação em vermelho

---

### PASSO 14 — Registrar rotas

**Arquivo:** `frontend/src/router/index.tsx`

```typescript
import AssetList from '../pages/Assets/AssetList';
import AssetShow from '../pages/Assets/AssetShow';

// Dentro do bloco /app (com Layout):
<Route path="assets"     element={<AssetList />} />
<Route path="assets/:id" element={<AssetShow />} />
```

> **Atencao:** pasta deve ser `Assets` (A maiúsculo) conforme padrão LEDGR de `pages/`

---

### PASSO 15 — Adicionar link na Sidebar

**Arquivo:** `frontend/src/components/Layout/Sidebar.tsx`

```typescript
// 1. Import:
import { Building2 } from 'lucide-react';

// 2. NavLink (formato padrão LEDGR):
<NavLink
  to="/app/assets"
  className={({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-[#1A3A5C] text-white font-medium'
        : 'text-gray-600 hover:bg-gray-100'
    }`
  }
>
  <Building2 className="w-4 h-4" />
  Ativo Imobilizado
</NavLink>

// OU, se o Sidebar usa array de navItems:
{ to: '/app/assets', label: 'Ativo Imobilizado', icon: Building2 }
```

---

### PASSO 16 — Verificar utilitários

**Arquivo:** `frontend/src/utils/format.ts`

Verificar se já existem. Se não, criar:

```typescript
export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
  }).format(Number(value));
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export function formatPercent(value: number | string | null | undefined): string {
  if (value == null) return '0%';
  return `${Number(value).toFixed(2).replace('.', ',')}%`;
}

export function formatMeses(meses: number): string {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${meses} meses`;
  return `${anos} ano${anos !== 1 ? 's' : ''}${resto > 0 ? ` e ${resto} meses` : ''}`;
}
```

---

### PASSO 17 — Checklist de validação E2E

Execute nesta ordem após implementar tudo:

**Backend:**
- [ ] `GET /assets` retorna 200 com estrutura `{ data, meta, kpis }`
- [ ] `POST /assets` cria ativo e retorna 201 com o objeto completo
- [ ] `POST /assets/:id/ativar` muda status para `ATIVO`
- [ ] `POST /assets/manutencoes` cria OS e muda status do ativo (se CORRETIVA)
- [ ] `POST /assets/benfeitorias/:id/capitalizar` aumenta `valorContabil` e vida útil
- [ ] `GET /assets/:id/depreciacao/projecao` retorna array com curva futura

**Frontend:**
- [ ] `/app/assets` carrega sem erros e exibe tabela vazia ou com dados
- [ ] Modal "Novo Ativo" abre, preenche 3 steps e cria com sucesso
- [ ] Click na linha navega para `/app/assets/:id` e carrega as 7 tabs
- [ ] Tab Depreciação exibe gráfico Recharts com curva
- [ ] Criar OS → ativar → concluir → verificar histórico na tab Histórico
- [ ] Registrar benfeitoria → capitalizar → verificar aumento em Valor Contábil
- [ ] Baixa de ativo navega de volta para `/app/assets`
- [ ] Link "Ativo Imobilizado" aparece na Sidebar e fica ativo ao navegar

---

## Pontos de Atenção

### Conflito de Rota no Controller

```typescript
// CORRETO — estático antes de dinâmico:
@Get('manutencoes/vencidas')  // <- declarar primeiro
@Get(':id')                   // <- depois o dinâmico

// ERRADO — NestJS tentará capturar "manutencoes" como :id:
@Get(':id')
@Get('manutencoes/vencidas')  // nunca alcançado
```

---

### Depreciação de Imóveis — Segregação Terreno

Regra **NBC TG 27 / IN RFB 1.700/2017**: terrenos não se depreciam.

```
baseDepreciavel = valorAquisicao - valorTerrenoAbs - valorResidual
valorTerrenoAbs = valorAquisicao * (valorTerrenoPerc / 100)

Exemplo:
  Imóvel:          R$ 2.000.000
  Terreno (30%):   R$ 600.000
  Residual:        R$ 0
  Base depreciável: R$ 1.400.000
  Taxa RFB (4% a.a.): vida útil 300 meses
  Quota mensal:    R$ 4.666,67
```

---

### CompanyInterceptor — Padrão LEDGR

```typescript
// No controller, o companyId vem de:
req.companyId  // injetado pelo CompanyInterceptor

// No frontend, o company-id vai no header:
'x-company-id': empresaAtiva?.id ?? ''

// Sem o header, o interceptor retornará 400
```

---

### ScheduleModule — Evitar duplo registro

Se `ScheduleModule.forRoot()` já estiver no `AppModule`, remover do `AssetsModule`:

```typescript
// AssetsModule — manter apenas:
@Module({
  imports: [PrismaModule],  // sem ScheduleModule.forRoot()
  ...
})
export class AssetsModule {}
// O @Cron funciona porque o módulo global está no AppModule
```

---

## Roadmap — Próximas Fases

| Fase | Nome | Escopo | Dependências |
|------|------|--------|-------------|
| **1.0** | Fundação | Módulo completo conforme este roteiro | Schema Prisma, AppModule |
| **1.1** | Integração Contábil | Lançamentos automáticos para depreciação, ativação e baixa | Módulo Lançamentos Contábeis |
| **1.2** | SPED ECD/ECF | Exportação Bloco I (ECD), Fichas 24/25 (ECF), diferenças temporárias | Módulo SPED (EcdPage) |
| **1.3** | Documentos | Upload de NF de aquisição, laudos, ART via módulo Documentos | Módulo Documents |
| **1.4** | Relatórios | PDF: inventário patrimonial, extrato de depreciação, benfeitorias | Fase 1.0 |
| **2.0** | Multi-empresa | Transferência de ativos entre empresas, consolidação de patrimônio | Módulo Companies |

---

## Referências Normativas

| Norma | Aplicação no Módulo |
|-------|---------------------|
| NBC TG 27 / CPC 27 | Reconhecimento, mensuração e depreciação de ativo imobilizado |
| NBC TG 01 / CPC 01-R1 | Redução ao valor recuperável (impairment) — base para `LaudoAvaliacao` |
| IN RFB 1.700/2017 | Taxas de depreciação fiscal aceitas pela RFB — tabela em `getTaxaPadrao()` |
| Lei 12.973/2014 | Tributação do ganho/perda em baixa/alienação de ativos |
| ABNT NBR 14653 | Metodologia de avaliação de bens imóveis |
| IAS 16 | Standard internacional equivalente ao CPC 27 (conformidade IFRS) |

---

*LEDGR Platform — Documento técnico confidencial*
