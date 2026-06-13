# LEDGR — Base de Conhecimento ECD (Escrituração Contábil Digital)

> Documento atualizado em 13/06/2026 a partir de múltiplas sessões de desenvolvimento e validação.
> Base para geração de ECD, ECF e outros regimes SPED.

---

## 1. ESTRUTURA DO ARQUIVO ECD (Leiaute 9)

### 1.1 Blocos obrigatórios e ordem

```
Bloco 0  → Identificação, abertura
Bloco C  → (vazio para ECD — |C001|1| + |C990|2|)
Bloco I  → Plano de contas, saldos, lançamentos
Bloco J  → Demonstrações contábeis (BP, DRE)
Bloco K  → (vazio — |K001|1| + |K990|2|)
Bloco 9  → Encerramento, hashes
```

### 1.2 Registros críticos por bloco

#### Bloco 0
| Registro | Descrição | Atenção |
|---|---|---|
| 0000 | Identificação da escrituração | `COD_PLAN_REF` deve ser preenchido APENAS se há I051 para TODAS as analíticas |
| 0001 | Abertura do bloco | `|0001|0|` se há conteúdo |
| 0007 | Identificação dos responsáveis | UF obrigatório |
| 0990 | Encerramento do bloco 0 | Qtd de linhas incluindo 0990 |

#### Bloco I
| Registro | Descrição | Atenção |
|---|---|---|
| I001 | Abertura | `|I001|0|` se há lançamentos; `|I001|1|` se bloco vazio |
| I010 | Identificação do livro | `IND_ESC` (G=Diário Geral, R=Razão, B=Balancete) |
| I030 | Termo de abertura | `DT_EX_SOCIAL` = data de encerramento do exercício — obrigatório quando há Bloco J com DT_FIN no período |
| I050 | Plano de contas | `COD_CTA` = código real da conta (nunca o reduced_code) |
| I051 | Referencial RFB | Obrigatório para TODAS as analíticas quando `COD_PLAN_REF` informado no 0000 |
| I052 | Código de aglutinação | Mapeia conta analítica → código de aglutinação do Bloco J |
| I075 | Histórico padronizado | Mínimo: `|I075|1|Livre|` |
| I150 | Identificação do período | Cabeçalho para cada mês |
| I155 | Saldos periódicos | Saldo inicial, movimentação D/C, saldo final por conta analítica |
| I200 | Lançamento contábil | Cabeçalho do lançamento (data, valor total, histórico) |
| I250 | Partidas do lançamento | Débitos e créditos individuais |
| I350 | Identificação encerramento | `DT_RES` = data do encerramento — APENAS quando há lançamento de encerramento real |
| I355 | Saldos de resultado antes encerramento | Contas REVENUE/EXPENSE com saldo antes do zerramento |

#### Bloco J
| Registro | Descrição | Atenção |
|---|---|---|
| J001 | Abertura | `|J001|0|` se há conteúdo |
| J005 | Identificação da demonstração | DT_INI, DT_FIN, tipo (1=BP, 2=DRE) |
| J100 | Balanço Patrimonial | Linhas detalhes (D) + totalizadores (T) por código RFB |
| J150 | DRE | Uma linha por COD_AGL (agregado), nunca uma por conta analítica |
| J900 | Termo de encerramento | `NR_LIVRO` deve ser igual ao informado no I030 |
| J930 | Assinaturas | COD_QUALIF: 001=e-CNPJ, 900=Contador, 205=Administrador |
| J990 | Encerramento do bloco J | |

---

## 2. ERROS CRÍTICOS E CORREÇÕES — Validação PGE

### 2.1 COD_NAT incorreto no I050 (EXPENSE → 05)

**Erro PGE:** "Conta cadastrada no plano de contas não é conta de resultado"

**Causa:** O manual ECD leiaute 9 define:
- `01` = Ativo
- `02` = Passivo
- `03` = Patrimônio Líquido
- `04` = Contas de Resultado (**REVENUE E EXPENSE**)
- `05` = Contas de Compensação
- `09` = Outras

**EXPENSE deve retornar `04`, não `05`.**

```typescript
private typeToNat(type: string): string {
  switch (type) {
    case "ASSET":     return "01";
    case "LIABILITY": return "02";
    case "EQUITY":    return "03";
    case "REVENUE":   return "04";
    case "EXPENSE":   return "04"; // ← CORRETO (não 05)
    default:          return "09";
  }
}
```

---

### 2.2 COD_CTA no I050 usando reducedCode

**Erro PGE:** "Conta informada deve existir no plano de contas e ser analítica" — `|I355|000000|`

**Causa:** O `reduced_code` é um atalho de digitação para lançamentos manuais, **não é o código contábil**. O I050, I155 e I355 devem usar sempre `acc.code`.

```typescript
// ERRADO:
const reducedCode = (acc as any).reducedCode || acc.code;

// CORRETO:
const reducedCode = acc.code;
if (!reducedCode) continue;
```

---

### 2.3 I350/I355 gerado sem lançamento de encerramento real

**Erro PGE:** "Contas de resultado devem ter saldo zero nos meses de encerramento" / "Saldo da conta antes do encerramento não corresponde ao total dos lançamentos de encerramento"

**Causa:** Emitir I350 sem lançamentos de zeramento correspondentes. O PGE valida que se I350 existe, as contas de resultado nos I155 do mês devem ter saldo zero — o que só é verdade se houver lançamentos reais de encerramento.

**Regra DEFINITIVA:** I350 só deve ser gerado quando há lançamentos de encerramento reais (partidas zerando as contas de resultado contra Resultado do Exercício). Emitir I350 incondicional gera MAIS erros, não menos.

```typescript
const hasEncerramento = entries.some(e =>
  e.description?.toLowerCase().includes("encerr") ||
  e.description?.toLowerCase().includes("zeramento")
);
const dreAccounts = (hasEncerramento ? accounts : []).filter(a => {
  if (!a.isAnalytic || !dreTypes.has(a.type.toString())) return false;
  const mv = dreMap.get(a.id);
  return mv ? (mv.cre - mv.deb) !== 0 : false;
});
if (dreAccounts.length > 0) {
  add(P+"I350"+P+dtFin+P);
  // ... I355 por conta
}
```

**⚠️ ATENÇÃO:** Os 2 erros de I350 que persistem (I030 com DT_EX_SOCIAL sem I350 correspondente) são **problema de dados do contador** — a empresa não lançou o encerramento. NÃO resolver no código.

---

### 2.4 I030 — DT_EX_SOCIAL obrigatório quando há Bloco J

**Erro PGE:** "Campo obrigatório não preenchido — DT_EX_SOCIAL"

**Regra:** Quando o Bloco J tem `J005.DT_FIN` dentro do período da escrituração, o PGE exige `DT_EX_SOCIAL` no I030. Se preenchido, exige também I350 na mesma data.

**Consequência:** Se a empresa não fez o encerramento contábil, há conflito irresolvível — o I030 com DT_EX_SOCIAL exige I350 que exige lançamento de encerramento inexistente. Solução: o contador deve lançar o encerramento antes de gerar o ECD.

---

### 2.5 Hierarquia de níveis no I050

**Erro PGE:** "O nível da conta de nível superior deve ser imediatamente anterior ao nível da conta de nível inferior"

**Regra:** O ECD exige hierarquia contínua — nível 1 → 2 → 3 → 4 → 5. Saltos de nível são proibidos.

**Causa comum:** Plano de contas importado com estrutura 1 → 3 → 4 → 5 → 6 (sem nível 2). Solução: reindexar os níveis no banco.

```sql
-- Reindexar níveis (exemplo: plano com nível 3 como pai de nível 1)
UPDATE chart_of_accounts SET level = 2 WHERE company_id = '...' AND level = 3;
UPDATE chart_of_accounts SET level = 3 WHERE company_id = '...' AND level = 4;
UPDATE chart_of_accounts SET level = 4 WHERE company_id = '...' AND level = 5;
UPDATE chart_of_accounts SET level = 5 WHERE company_id = '...' AND level = 6;
```

---

### 2.6 I051 — Natureza divergente da conta pai

**Erro PGE:** "A natureza da conta referencial informada no I051 é diferente da natureza da conta pai"

**Causa:** O automapping mapeou contas ASSET para códigos RFB de DRE (prefixo `3.xx`), ou contas LIABILITY para códigos de ATIVO (prefixo `1.xx`).

**Solução:** O automatch deve filtrar por tipo da visão:
- BP: apenas ASSET, LIABILITY, EQUITY
- DRE: apenas REVENUE, EXPENSE

```typescript
const bpTypes = new Set(["ASSET","LIABILITY","EQUITY"]);
const dreTypes = new Set(["REVENUE","EXPENSE"]);
const allowedTypes = view.tipo === "BP" ? bpTypes : dreTypes;
const analytics = allAccounts.filter(a => a.isAnalytic && allowedTypes.has(a.type));
```

---

### 2.7 I052 — Código totalizador não permitido

**Erro PGE:** "Código de aglutinação de linha totalizadora de demonstração contábil não deve constar no registro I052"

**Regra:** O I052 deve referenciar apenas códigos **folha** da tabela RFB — aqueles que não têm filhos (nivel máximo disponível). Códigos intermediários/totalizadores são proibidos.

**Como identificar folhas:**
```sql
-- Códigos que NÃO são pai de nenhum outro = folhas
SELECT codigo FROM rfb_aglutination_codes r1
WHERE NOT EXISTS (
  SELECT 1 FROM rfb_aglutination_codes r2
  WHERE r2.codigo_pai = r1.codigo
    AND r2.leiaute = r1.leiaute AND r2.ano_base = r1.ano_base
)
AND r1.leiaute = 9 AND r1.ano_base = 2025 AND r1.tipo = 'BP';
```

**Nota importante:** O leiaute RFB 2025 BP tem nível máximo 5 para a maioria dos grupos. O leiaute RFB 2025 DRE tem nível máximo 6. Usar nível 3 ou 4 como COD_AGL no I052 gera erro.

---

### 2.8 J100 — IND_GRP_BAL incorreto

**Erro PGE:** "O código de aglutinação e o código de aglutinação superior da linha sendo validada não pertencem ao mesmo grupo"

**Causa:** Contas LIABILITY/EQUITY mapeadas para códigos RFB de ATIVO (prefixo `1.xx`), ou o exporter calculando `indCta` incorretamente.

**Regra:** `IND_GRP_BAL`:
- `A` = Ativo (códigos RFB começando com `1.`)
- `P` = Passivo + PL (códigos RFB começando com `2.`)

**SEMPRE** derivar `IND_GRP_BAL` do primeiro dígito do `COD_AGL`, nunca do tipo da conta:

```typescript
const indGrp = aglCode.startsWith("1") ? "A" : "P";
```

---

### 2.9 J100 — COD_AGL_SUP vazio nos registros D

**Erro PGE:** "Não existe nenhum registro na demonstração com código de aglutinação igual ao código de aglutinação superior sendo validado" / "Somente código de aglutinação de linha totalizadora pode ser código de aglutinação superior" / "Campo obrigatório não preenchido"

**Causa raiz:** Os `aglutination_code` do `accounting_view_mappings` são códigos do plano L100A (ex: `2.01.01.03`, `2.01.01.07.02`) que **não existem** na tabela `rfb_aglutination_codes` (que contém apenas os códigos de aglutinação curtos como `2.01`). O exporter busca `rfbRow?.codigoPai` e recebe `undefined`, deixando `COD_AGL_SUP` vazio.

**Natureza do erro:** **DADOS DO CONTADOR** — os mapeamentos nas Visões Contábeis precisam usar códigos de aglutinação (ex: `2.01`) e não códigos do plano referencial (ex: `2.01.01.03`). NÃO corrigir no código.

**Distinção fundamental:**
| Campo | Registro | Fonte | Formato |
|---|---|---|---|
| COD_CTA_REF | I051 | Plano referencial L100A/L300A | `1.01.01.02.01` (5 níveis, termina em `.01`) |
| COD_AGL | I052/J100/J150 | Tabela aglutinação curta | `1.01.08` (3-4 níveis) |

**A tabela `rfb_aglutination_codes` contém APENAS os códigos de aglutinação (I052/J100).** O plano referencial L100A/L300A (732 BP + 213 DRE códigos) NÃO está importado — e deve ser uma tabela separada quando implementado.

---

### 2.10 COD_PLAN_REF no 0000 — Armadilha crítica

**Erro PGE:** "O registro I051 é obrigatório quando existe código do plano de contas referencial informado no registro 0000 (COD_PLAN_REF)" — gerado para TODAS as contas analíticas (centenas de erros)

**Regra ABSOLUTA:** `COD_PLAN_REF` no registro 0000 **só deve ser preenchido** quando:
1. O plano referencial L100A/L300A está importado na base
2. TODAS as contas analíticas têm I051 com COD_CTA_REF válido desse plano

**Estado atual do LEDGR:** O plano referencial L100A/L300A **NÃO está importado**. Portanto `COD_PLAN_REF` deve ficar **vazio** no 0000.

**Proteção no backend** (`ecd-exporter.service.ts`):
```typescript
// COD_PLAN_REF apenas quando ha mapeamento referencial (i051Map preenchido)
const codPlanRefFinal = (codPlanRef && i051Map.size > 0) ? codPlanRef : "";
add(P+"0000"+P+"LECD"+P+...+P+codPlanRefFinal+P+...);
```

**Proteção no frontend** (`EcdPage.tsx`): Aviso laranja exibido quando o campo é preenchido, alertando que só deve ser usado com mapeamento L100A completo.

**⚠️ NUNCA** preencher `COD_PLAN_REF = 60959347` sem ter o plano referencial mapeado. Isso gera 200+ erros em massa.

---

### 2.11 i051Map — Não copiar i052Map

**Erro anterior:** `const i051Map = new Map<string, string>(i052Map)` — copiava os códigos de aglutinação como se fossem referenciais RFB, gerando I051 com `1.01.08` (aglutinação) em vez de `1.01.01.01.01` (referencial real).

**Regra:** `i051Map` deve ser populado via JOIN entre `AccountingViewMapping.aglutinationCode` e `RfbAglutinationCode` do plano L100A/L300A — que **ainda não está implementado**. Por ora, `i051Map` fica vazio e I051 não é emitido (correto quando COD_PLAN_REF também está vazio).

---

### 2.12 Nome do arquivo gerado

**Formato correto:** `ECD_ANO_CNPJRAIZ.txt` — ex: `ECD_2024_17970759.txt`

**Implementação:** O nome é gerado no **backend** (`ecd.controller.ts`) a partir do CNPJ da empresa buscado do banco — não hardcoded no frontend.

```typescript
// ecd.controller.ts
const companyForName = await this.prisma.company.findUnique({
  where: { id: companyId }, select: { taxId: true }
});
const cnpj = companyForName?.taxId?.replace(/\D/g, '') || 'ECD';
const year = new Date(periodEnd).getFullYear();
const raiz = cnpj.substring(0, 8);
const filename = `ECD_${year}_${raiz}.txt`;
res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
```

**CORS obrigatório:** O header `Content-Disposition` deve estar em `exposedHeaders` no `main.ts`:
```typescript
app.enableCors({ exposedHeaders: ['Content-Disposition', 'X-Ecd-Warnings'] });
```

**Frontend** lê o nome do header da resposta:
```typescript
const cd = r.headers['content-disposition'] || '';
const fnMatch = cd.match(/filename="([^"]+)"/);
a.download = fnMatch ? fnMatch[1] : `ECD_${year}.txt`;
```

**⚠️ PROTEGER:** O Chrome renomeia automaticamente para `ECD_2024_17970759 (1).txt` quando já existe arquivo com mesmo nome — isso é comportamento do browser, não bug do LEDGR.

---

### 2.13 Tipo de retorno do exporter

**Assinatura correta** (`ecd-exporter.service.ts`):
```typescript
async export(options: EcdExportOptions): Promise<{ buffer: Buffer; warnings: string[] }> {
  // ...
  const warnings: string[] = [];
  return { buffer: Buffer.from(content, "latin1"), warnings };
}
```

**⚠️ NUNCA** usar `Promise<Buffer>` — o controller espera `{ buffer, warnings }`.

---

## 3. ARQUITETURA DO EXPORTER

### 3.1 Mapas principais

| Mapa | Chave | Valor | Uso |
|---|---|---|---|
| `i052Map` | accountId (UUID) | aglutinationCode | I052, J100/J150 |
| `i051Map` | accountId (UUID) | COD_CTA_REF L100A | I051 (vazio até L100A importado) |
| `rfbBPMap` | codigo aglutinação | RfbAglutinationCode | J100 totalizadores |
| `rfbDREMap` | codigo aglutinação | RfbAglutinationCode | J150 |
| `j100Det` | codigo aglutinação | {ini, fin, nome, indCta} | Detalhes J100 (tipo D) |
| `j100Tot` | codigo aglutinação | {ini, fin, nome, nivel, pai} | Totalizadores J100 (tipo T) |

### 3.2 Regra D/T no J100

- Códigos presentes no `i052Map` (contas mapeadas) → sempre tipo **D** (detalhe)
- Códigos ancestrais calculados → tipo **T** (totalizador)
- **NUNCA** emitir como T um código que consta no I052

```typescript
const codigosI052 = new Set<string>([...i052Map.values()]);
for (const [aglCode, t] of [...j100Tot.entries()]) {
  if (codigosI052.has(aglCode)) {
    // Mover para D
    j100Det.set(aglCode, { ... });
    j100Tot.delete(aglCode);
  }
}
```

### 3.3 IND_GRP_BAL

Sempre derivado do **primeiro dígito do COD_AGL**:
```typescript
const indGrp = r.codigo.startsWith("1") ? "A" : "P";
```

### 3.4 DC dos saldos

```typescript
// saldo = deb - cre (positivo = devedor = D, negativo = credor = C)
const dcIni = saldoIniVal >= 0 ? "D" : "C";
const dcFin = saldoFin >= 0 ? "D" : "C";
```

---

## 4. VISÕES CONTÁBEIS (accounting_view_mappings)

### 4.1 Estrutura

```
AccountingView (BP ou DRE, por empresa e ano_base)
  └── AccountingViewMapping (account_id → aglutination_code)
```

### 4.2 Filtro no exporter

```typescript
const viewsI052 = await this.prisma.accountingView.findMany({
  where: { companyId, isActive: true }, // SEM filtro de anoBase
  include: { mappings: { select: { accountId: true, aglutinationCode: true } } },
});
```

**⚠️ NÃO filtrar por `anoBase`** — causa `i052Map` vazio quando a view tem `ano_base` diferente do período da ECD.

### 4.3 Distinção entre planos

| Tabela | Conteúdo | Formato código | Qtd (leiaute 9, 2024) |
|---|---|---|---|
| `rfb_aglutination_codes` | Plano de aglutinação (Bloco J) | `1.01.08` | 50 BP + 26 DRE = 76 |
| *(não importado)* | Plano referencial L100A/L300A (I051) | `1.01.01.02.01` | 732 BP + 213 DRE |

---

## 5. VISÕES CONTÁBEIS — ERROS DE MAPEAMENTO (responsabilidade do contador)

Os erros abaixo são de **dados**, não de código. O código está correto:

| Erro PGE | Causa | Ação |
|---|---|---|
| J100 COD_AGL_SUP vazio | `aglutination_code` usa código L100A em vez de código de aglutinação | Contador deve corrigir nas Visões Contábeis |
| BP desbalanceado | Ativo ≠ Passivo+PL | Contador deve lançar encerramento/ajuste |
| I350 faltando | Empresa não tem lançamento de encerramento | Contador deve lançar zeramento de resultado |
| J150 valor divergente | Saldo I155 ≠ saldo J150 | Verificar mapeamento DRE nas Visões Contábeis |

---

## 6. SALDO INICIAL E PERÍODO

### 6.1 Filtro de AccountingView

Não filtrar por `anoBase` — o filtro causava `i052Map` vazio:

```typescript
// CORRETO — sem anoBase:
where: { companyId, isActive: true }

// ERRADO — anoBase pode não bater com o período da ECD:
where: { companyId, isActive: true, anoBase }
```

### 6.2 Saldo inicial entre anos (I155 fallback)

O registro I155 do primeiro período usa como saldo inicial o saldo final do último período do ano anterior. Quando não há I155 de abertura explícito, buscar via `accountBalance` com `referenceDate < periodStart`.

```typescript
const i155Rows = await this.prisma.accountBalance.findMany({
  where: { companyId, referenceDate: { lt: new Date(periodStart) } },
  orderBy: { referenceDate: "desc" },
});
const saldoIni = new Map<string, number>();
for (const row of i155Rows) {
  if (!saldoIni.has(row.accountId) && analyticIds.has(row.accountId))
    saldoIni.set(row.accountId, Number(row.balance));
}
```

### 6.3 Datas UTC

Usar sempre `.getUTC*()` para evitar desvio de fuso:
```typescript
// ERRADO: getDate(), getMonth(), getFullYear()
// CORRETO: getUTCDate(), getUTCMonth(), getUTCFullYear()
```

---

## 7. SIGNATÁRIOS (J930)

### 7.1 COD_QUALIF válidos

| Código | Qualificação |
|---|---|
| 001 | Pessoa Jurídica (e-CNPJ) |
| 203 | Diretor |
| 204 | Conselheiro |
| 205 | Sócio-Administrador |
| 801 | Empresário |
| 900 | Contador/Contabilista |
| 999 | Outros |

**Obrigatório:** pelo menos um contador (900) e um representante legal.

### 7.2 Layout J930 (leiaute 9)

```
|J930|NOME|CPF_CNPJ|QUALIFICACAO|COD_QUALIF|CRC|EMAIL|FONE|UF|CRC_FORMATADO||IND_AUD|
```

**Atenção:** Códigos `005`, `010`, `016` **não existem** no validador PGE — causam erro "valor diferente dos valores válidos".

---

## 8. ECD POR TIPO DE EMPRESA

### 8.1 Prestadora de Serviços (Lucro Presumido / Simples)

**Contas de resultado específicas:**
- Receita Bruta → `3.01.01.01.01.06` (Prestação Serviços Mercado Interno)
- ISS (dedução) → `3.01.01.01.02.06`
- PIS (dedução) → `3.01.01.01.02.05`
- COFINS (dedução) → `3.01.01.01.02.04`
- Salários → `3.01.01.07.01.02`
- INSS → `3.01.01.07.01.05`
- Despesas Gerais → `3.01.01.07.01.16`
- Despesas Financeiras → `3.01.01.09.01.08`
- IRPJ → `3.02.01.01.01.02`
- CSLL → `3.02.01.01.01.01`

**Observação:** Contas de EXPENSE com saldo devedor no I155 aparecem no J150 com `IND_DC = D` e valor positivo. Contas de REVENUE com saldo credor aparecem com `IND_DC = C` e valor positivo.

### 8.2 Holding / Participações (ex: LM Administração)

- Investimentos → `1.02.02.01.xx` (Participações Permanentes)
- Mútuos Ativo → `1.02.01.xx` (Realizável LP)
- Mútuos Passivo → `2.02.01.xx` ou `2.01.01.xx`
- Resultado de Equivalência → `3.01.01.05.01.06`

### 8.3 Escritório de Advocacia (OAB)

- Campo `NIRE` vazio (OAB não tem NIRE)
- `indNireVal = "0"` quando `registerOrg` contém "OAB"
- Plano de contas específico sem conta de estoque/ICMS

### 8.4 Lucro Real vs Lucro Presumido

- Ambos usam o mesmo plano de aglutinação (rfb_aglutination_codes)
- O plano referencial L100A (quando implementado) é o mesmo para ambos
- A diferença está nas contas DRE obrigatórias e no leiaute ECF associado
- `forma_tributacao` na tabela `company_tax_regimes` ('L'=Lucro Real, 'P'=Lucro Presumido)

---

## 9. IMPORTAÇÃO DE ECD EXTERNO (ecd-importer)

### 9.1 Tipos de conteúdo ECD

| Tipo | Registros | Comportamento |
|---|---|---|
| FULL | I050 + I155 + I200/I250 | Importar plano + saldos + lançamentos |
| BALANCES_ONLY | I050 + I155 (sem I200/I250) | Importar plano + saldos; não reportar "0 lançamentos" como erro |
| STATEMENTS_ONLY | I200/I250 sem I155 | Importar apenas lançamentos |

### 9.2 Saldo inicial entre anos

O `openingBalance` importado do I155 deve ser salvo com `referenceDate = periodStart - 1 dia` (dia anterior ao início do período), para que seja encontrado como saldo anterior no próximo período.

### 9.3 Planos incompatíveis entre anos

Planos de contas de anos diferentes podem ter codificações estruturalmente incompatíveis (não apenas formatação diferente). Requer mapeamento configurável pelo usuário, não hardcoded.

---

## 10. WORKFLOW DE GERAÇÃO E VALIDAÇÃO ECD

### 10.1 Pré-condições obrigatórias

1. ✅ Plano de contas limpo (sem reduced_codes como code, sem hierarquia quebrada)
2. ✅ Todas as partidas apontando para contas ativas (sem órfãs)
3. ✅ Visões contábeis BP e DRE configuradas com códigos de aglutinação folha (nível 4-5)
4. ✅ Lançamento de encerramento lançado (se empresa fez encerramento)
5. ✅ Cadastro da empresa com: CNPJ, UF, CRC do contador, assinantes
6. ✅ Campo `COD_PLAN_REF` vazio no formulário de geração (até L100A ser importado)

### 10.2 Sequência de geração

1. Executar pré-validação (`/app/sped/ecd/pre-validate`) — corrigir erros críticos
2. Gerar ECD pelo frontend (endpoint `/sped/ecd/export`) — SEM preencher COD_PLAN_REF
3. Salvar arquivo `ECD_ANO_CNPJRAIZ.txt` em Downloads
4. Abrir PGE (Sped Contábil)
5. Excluir escrituração anterior do CNPJ (se existir)
6. Importar o novo arquivo
7. Validar
8. Analisar relatório de erros

### 10.3 Interpretação de erros do PGE

| Tipo de erro | Natureza | Ação |
|---|---|---|
| I050 conta inválida | Técnico | Corrigir exporter ou plano de contas |
| I051 obrigatório (em massa) | **COD_PLAN_REF preenchido sem L100A** | Deixar COD_PLAN_REF vazio |
| I051 natureza divergente | Mapeamento | Corrigir COD_AGL no accounting_view_mappings |
| I052 totalizador | Mapeamento | Usar código folha (nível máximo) |
| J100 COD_AGL_SUP vazio | Mapeamento (dados) | Contador corrigir Visões Contábeis |
| J100 IND_GRP_BAL | Mapeamento | Corrigir contas mapeadas para grupo errado |
| J150 duplicado | Técnico | Agregar por COD_AGL no exporter |
| J150 saldo divergente | Mapeamento/Técnico | Verificar sinal e agregação |
| I350 faltando | Contábil | Lançar encerramento ou remover Bloco J |
| I355 saldo não zero | **I350 emitido sem encerramento real** | NÃO emitir I350 sem lançamento real |
| BP desequilibrado | Contábil | Lançar encerramento (transferir resultado para PL) |
| Assinatura contador | Não técnico | Configurar J930 com CRC/CPF do contador |
| NR_LIVRO conflito | Operacional | Excluir escrituração anterior no PGE |

---

## 11. TABELA RFB — Leiaute 9

### 11.1 Estrutura

```sql
rfb_aglutination_codes:
  leiaute  INT      -- ex: 9
  ano_base INT      -- ex: 2024 ou 2025
  tipo     VARCHAR  -- 'BP' ou 'DRE'
  codigo   VARCHAR  -- ex: '1.01.08'
  descricao VARCHAR
  nivel    INT      -- 1 a 5 (BP) ou 1 a 6 (DRE)
  codigo_pai VARCHAR
  ordem    INT
```

### 11.2 Importação dos JSONs RFB

```
POST /sped/visoes/rfb-codes/import
Body: { codes: [...] }  -- array de objetos com os campos acima
```

### 11.3 Contagem por ano (leiaute 9)

| Tipo | 2024 | 2025 |
|---|---|---|
| BP | 50 | 50 |
| DRE | 26 | 26 |
| **Total** | **76** | **76** |

### 11.4 Nível máximo por grupo (leiaute 9)

| Grupo | Tipo | Nível máximo |
|---|---|---|
| 1.01.01 Disponibilidades | BP | 5 |
| 1.01.02 Créditos | BP | 5 |
| 1.02.03 Imobilizado | BP | 5 |
| 2.01.01 Obrigações CP | BP | 5 |
| 2.03 Patrimônio Líquido | BP | 5 |
| 3.01.01.01 Receita/Deduções | DRE | 6 |
| 3.01.01.07 Despesas Operacionais | DRE | 6 |
| 3.02 Provisão IR/CSLL | DRE | 6 |

---

## 12. ARMADILHAS FREQUENTES

1. **NestJS watch não recompila:** Matar processo e reiniciar `npm run start:dev`. O dist antigo pode estar em uso por horas sem recompilar alterações. Sempre confirmar compilação antes de gerar arquivo.

2. **PGE com cache interno:** Ao reimportar o mesmo CNPJ/período, o PGE usa dados do banco interno. **Sempre excluir a escrituração anterior** antes de reimportar.

3. **`(acc as any).reducedCode`:** Antipadrão — o `reducedCode` não deve ser usado para COD_CTA, apenas como atalho de tela.

4. **`Math.abs()` no `fmtDec`:** O método sempre retorna valor positivo. Para emitir com sinal, usar os campos `IND_DC_INI`/`IND_DC_FIN`, nunca valor negativo no campo numérico.

5. **Dois planos sobrepostos:** Após importar ECD externo, verificar se há contas com `reduced_code = '000000'` ou código pontilhado convivendo com o plano real.

6. **Partidas órfãs após limpeza:** Sempre verificar `journal_entry_items` após deletar contas do plano.

7. **Automapping DRE exibindo contas de ativo:** O `findMappingsGrouped` sem filtro de tipo retorna todas as contas da empresa para qualquer visão.

8. **Contas com mesmo nome em tipos diferentes:** No remap de partidas, usar `name + type` como chave — nunca só `name`.

9. **J930 COD_QUALIF inválido:** Códigos `005`, `010`, `016` não existem no PGE. Usar apenas os listados na seção 7.1.

10. **I001 = 1 quando sem lançamentos + tentativa de substituição:** O PGE interpreta como substituição e rejeita sem escrituração anterior. Sempre excluir e reimportar do zero.

11. **COD_PLAN_REF preenchido no frontend:** O campo aceita digitação livre. Se o usuário digitar `60959347` sem ter o plano L100A importado, gera 200+ erros I051 em massa. O backend tem proteção (`codPlanRefFinal`) mas o frontend exibe aviso laranja.

12. **Restaurar exporter via git show:** Ao restaurar `ecd-exporter.service.ts` de um commit anterior, a assinatura do método pode ser `Promise<Buffer>` em vez de `Promise<{ buffer: Buffer; warnings: string[] }>`. Sempre verificar e corrigir a assinatura após restauração.

13. **Edições incrementais por índice de linha:** Edições múltiplas por índice de linha corrompem o arquivo quando o número de linhas muda entre edições. Preferir reescrita de blocos completos via Python `lines[a:b] = [new_block]`.

14. **I350 incondicional gera mais erros:** Emitir I350 sempre (sem lançamento de encerramento) gera 25+ erros "contas de resultado devem ter saldo zero" e "saldo não corresponde". **Nunca emitir I350 sem lançamentos reais de zeramento.**

---

## 13. ESTADO ATUAL (13/06/2026) — LM 2024

**Resultado após sessão de correção:**
- 307 erros → **41 erros residuais**
- Todos os 41 erros são de **dados/mapeamento** (responsabilidade do contador)
- Código do exporter está **estável e correto**

**Erros residuais classificados:**

| Qtd | Erro | Tipo | Responsável |
|---|---|---|---|
| 2 | I350 faltando (DT_EX_SOCIAL sem encerramento) | Dados | Contador: lançar zeramento |
| 3 | BP desbalanceado (Ativo ≠ Passivo+PL) | Dados | Contador: lançar ajuste |
| 36 | J100 COD_AGL_SUP vazio (códigos L100A no mapeamento) | Mapeamento | Contador: corrigir Visões Contábeis usando códigos de aglutinação |

**Commits desta sessão:**
- `45ac30a` — restaurar exporter + assinatura Promise<{buffer,warnings}> + aviso COD_PLAN_REF frontend
- `919f88f` — EcdPreValidatePage ajustes
- `d667970` — I350 apenas com lançamentos encerramento reais

---

*Documento mantido incrementalmente. Atualizar após cada sessão de desenvolvimento/validação.*
