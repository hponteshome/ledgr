# LEDGR — Base de Conhecimento ECD (Escrituração Contábil Digital)

> Documento gerado em 31/05/2026 a partir de múltiplas sessões de desenvolvimento e validação.
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
| I052 | Código de aglutinação | Mapeia conta analítica → código RFB do Bloco J |
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

**Erro PGE:** "Contas de resultado devem ter saldo zero nos meses de encerramento"

**Causa:** O exporter gerava I350/I355 baseado em saldo nas contas de resultado, mesmo sem lançamento de encerramento no banco.

**Regra:** I350 só deve ser gerado quando há lançamentos de encerramento reais (partidas zerando as contas de resultado contra Resultado do Exercício).

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
```

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

O `indCta` deve ser determinado pelo **prefixo do COD_AGL**, não pelo tipo da conta:
```typescript
const indCta = aglCode.startsWith("1") ? "A" : "P";
```

---

### 2.9 J150 — Linhas duplicadas por COD_AGL

**Erro PGE:** "Registro duplicado em relação à chave COD_AGL"

**Causa:** O exporter gerava uma linha J150 por conta analítica. O J150 deve ter **uma linha por COD_AGL**, com o saldo agregado de todas as contas mapeadas para aquele código.

**Solução — agregar antes de emitir:**
```typescript
const j150Agg = new Map<string, { val: number; nome: string }>();
for (const acc of accounts) {
  const aglCode = i052Map.get(acc.id);
  if (!aglCode) continue;
  const mv = dreRollup.get(acc.id) ?? { deb: 0, cre: 0 };
  const vlOri = mv.deb - mv.cre; // mesmo sentido do I155
  const cur = j150Agg.get(aglCode) ?? { val: 0, nome: rfbDREMap.get(aglCode)?.descricao ?? acc.name };
  j150Agg.set(aglCode, { val: cur.val + vlOri, nome: cur.nome });
}
// Depois emitir uma linha por entrada do Map
```

---

### 2.10 J150 — IND_DC incorreto para receitas

**Erro PGE:** "O valor do saldo informado na linha de detalhe da DRE é diferente do resultado calculado"

**Causa:** O campo `IND_COD_AGL` do J150 só aceita `D` (detalhe) ou `T` (totalizador) — nunca `C`. O IND_DC dos campos de valor deve refletir o saldo contábil real:
- EXPENSE (saldo devedor) → `IND_DC = D`, valor positivo
- REVENUE (saldo credor) → `IND_DC = C`, valor positivo
- Deduções de receita (saldo devedor em conta de receita) → `IND_DC = D`, valor positivo

```typescript
const dcVal = vlSigned >= 0 ? "D" : "C";
j150Lines.push(
  P+"J150"+P+indEncerr+P+dreCode+P+"D"+P+"2"+P+TITULO_DRE+P+
  nome+P+fmtDec(Math.abs(vlSigned))+P+dcVal+P+
  fmtDec(Math.abs(vlSigned))+P+dcVal+P+"D"+P+P
);
```

---

### 2.11 J900 — NR_LIVRO diferente do I030

**Erro PGE:** "Número da ordem deverá ser igual ao informado no Registro I030"

**Causa:** O `NR_LIVRO` do J900 deve ser idêntico ao do I030. Ambos devem usar a variável `bookNumber` do parâmetro de geração.

---

### 2.12 NR_LIVRO conflitando com escrituração existente no PGE

**Erro PGE (ao importar):** "Esta escrituração já existe na base local do PVA e seu estado não permite importação"

**Causa:** O PGE tem no banco interno uma escrituração com o mesmo CNPJ/período/NR_LIVRO. Soluções:
1. Usar "Editar Escrituração" no menu antes de reimportar
2. Excluir a escrituração antiga no PGE
3. Gerar com NR_LIVRO diferente (ex: 25 em vez de 1)

---

### 2.13 I001 vazio quando sem lançamentos

**Erro PGE (ao tentar substituição):** "A importação de arquivos sem o bloco I pressupõe a existência de uma escrituração nas bases do sistema"

**Regra:**
- `|I001|0|` = bloco I tem conteúdo (há lançamentos)
- `|I001|1|` = bloco I vazio (sem lançamentos no período)

Quando não há lançamentos, o PGE interpreta o arquivo como **substituição** e procura escrituração anterior. Sem ela, rejeita a importação.

---

## 3. PLANO DE CONTAS — Boas Práticas para ECD

### 3.1 reduced_code vs code

- `reduced_code`: atalho de digitação para lançamentos manuais (ex: `001001`, `003001`). **Nunca usar no ECD.**
- `code`: código contábil real da conta (ex: `11102010001`). **Sempre usar no ECD.**

### 3.2 Dois planos sobrepostos — padrão de importação

Empresas frequentemente têm dois planos no banco após importação de ECD externo:
- Plano real: `11`, `111`, `11102010001`... (códigos longos sem pontos)
- Plano importado RFB sintético: `1`, `1.1`, `1.1.1`... (códigos com pontos, `reduced_code = '000000'`)

**Limpeza necessária:**
```sql
-- Soft-delete plano RFB sintético (reduced_code = '000000')
UPDATE chart_of_accounts SET deleted_at = NOW()
WHERE company_id = '...' AND reduced_code = '000000';

-- Soft-delete contas pontilhadas (formato antigo)
UPDATE chart_of_accounts SET deleted_at = NOW()
WHERE company_id = '...' AND code LIKE '%.%';

-- Soft-delete reduced_codes gravados como code (6 dígitos, formato 001001)
UPDATE chart_of_accounts SET deleted_at = NOW()
WHERE company_id = '...' AND is_analytic = true
  AND length(code) <= 6 AND code NOT LIKE '%.%';
```

### 3.3 Hierarquia após limpeza

Após remover contas duplicadas, verificar que:
1. Contas raiz (level=1) têm `parent_id = NULL`
2. Níveis são contínuos: 1→2→3→4→5
3. Nenhum `parent_id` aponta para conta deletada

### 3.4 Partidas órfãs após limpeza

Quando contas são deletadas, `journal_entry_items` ficam com `account_id` apontando para contas com `deleted_at IS NOT NULL`. Resolver por remap:

```sql
-- Verificar partidas órfãs
SELECT COUNT(*) FROM journal_entry_items jei
JOIN chart_of_accounts ca ON ca.id = jei.account_id
WHERE ca.deleted_at IS NOT NULL;

-- Remap por nome + type (mais seguro que só por nome — evita confundir ativo/passivo)
UPDATE journal_entry_items jei
SET account_id = (
  SELECT id FROM chart_of_accounts
  WHERE company_id = '...' AND deleted_at IS NULL AND is_analytic = true
    AND name = ca_old.name AND type = ca_old.type
  ORDER BY length(code) DESC LIMIT 1
)
FROM journal_entries je, chart_of_accounts ca_old
WHERE jei.journal_entry_id = je.id
  AND je.company_id = '...'
  AND jei.account_id = ca_old.id
  AND ca_old.deleted_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM chart_of_accounts
    WHERE company_id = '...' AND deleted_at IS NULL AND is_analytic = true
      AND name = ca_old.name AND type = ca_old.type
  );
```

**Atenção:** Contas com mesmo nome em ativo e passivo (ex: mútuo, fornecedor/cliente) — usar `type` como discriminador. Criar novas contas com códigos sequenciais quando não houver correspondência.

---

## 4. VISÕES CONTÁBEIS (I051/I052) — Automapping

### 4.1 Estrutura

```
AccountingView    → visão por empresa (BP ou DRE, por ano)
  AccountingViewMapping → conta analítica → código RFB
RfbAglutinationCode → tabela de códigos padronizados RFB
```

### 4.2 Regras do automapping

**Prioridade:** prefixo do código contábil > match semântico por nome

**Filtro por tipo da visão (obrigatório):**
- BP: filtrar apenas ASSET, LIABILITY, EQUITY
- DRE: filtrar apenas REVENUE, EXPENSE

**Prefixos BP (leiaute 9, plano padrão brasileiro):**
| Prefixo conta | COD_AGL RFB | Descrição |
|---|---|---|
| 111 | 1.01.01.02.01 | Bancos Conta Movimento |
| 113 | 1.01.02.02.01 | Duplicatas a Receber |
| 121 | 1.02.01.01.01 | Realizável LP |
| 151 | 1.02.03.01.01 | Imobilizado |
| 211 | 2.01.01.01.01 | Obrigações CP |
| 221 | 2.02.01.01.01 | Obrigações LP |
| 231 | 2.03.01.01.01 | Capital Social |
| 233 | 2.03.04.01.01 | Lucros/Prejuízos Acumulados |

**Prefixos DRE (leiaute 9, prestadora de serviços):**
| Prefixo conta | COD_AGL RFB | Descrição |
|---|---|---|
| 311 | 3.01.01.01.01.06 | Receita Prestação Serviços |
| 312 | 3.01.01.01.02.09 | Deduções Impostos |
| 321 | 3.01.01.05.01.05 | Receitas Financeiras |
| 421 | 3.01.01.07.01.02 | Despesas com Pessoal |
| 423 | 3.01.01.09.01.08 | Despesas Financeiras |
| 431 | 3.02.01.01.01.02 | Provisão IRPJ |
| 441 | 3.02.01.01.01.01 | Provisão CSLL |

### 4.3 Erros comuns de mapeamento

- **ISS, PIS, COFINS** como contas de REVENUE ou EXPENSE com saldo devedor → são **deduções da receita bruta** → COD_AGL correto: `3.01.01.01.02.06` (ISS), `3.01.01.01.02.05` (PIS), `3.01.01.01.02.04` (COFINS)
- **Provisão IRPJ/CSLL** como LIABILITY → não mapear para `1.01.02.04.xx` (ATIVO) → usar `2.01.01.09.13` / `2.01.01.09.14`
- **Lucros Distribuídos** como EQUITY → não mapear para `1.02.02.01.40` → usar `2.03.04.01.01`

### 4.4 findMappingsGrouped — filtro por tipo

O endpoint que retorna os grupos para a tela de visões deve filtrar contas por tipo da visão, senão exibe contas de BP na tela DRE e vice-versa:

```typescript
const allowedTypes = view.tipo === "BP" ? bpTypes : dreTypes;
const analytics = allAccounts.filter(a => a.isAnalytic && allowedTypes.has(a.type));
```

---

## 5. BLOCO J — Geração do Balanço e DRE

### 5.1 J100 — Balanço Patrimonial

**Fluxo correto:**
1. Buscar todos os `rfb_aglutination_codes` do BP (leiaute, anoBase, tipo='BP')
2. Para cada conta analítica com `i052Map`, acumular saldo ini/fin por COD_AGL
3. Propagar saldos para todos os ancestrais na hierarquia RFB (totalizadores)
4. Emitir totalizadores (T) na ordem RFB, depois detalhes (D)

**IND_CTA:** determinado pelo prefixo do COD_AGL:
- Começa com `1.` → `A` (Ativo)
- Começa com `2.` → `P` (Passivo/PL)

**IND_DC:** saldo positivo → `D` (devedor), negativo → `C` (credor)

### 5.2 J150 — DRE

**Fluxo correto:**
1. Buscar `rfb_aglutination_codes` da DRE
2. Agregar saldos por COD_AGL (Map → uma entrada por código)
3. Calcular saldo: `mv.deb - mv.cre` (mesmo sentido do I155)
4. Emitir uma linha J150 por COD_AGL, com `IND_COD_AGL = "D"` sempre
5. `IND_DC_INI` e `IND_DC_FIN`: `D` se saldo ≥ 0, `C` se saldo < 0

**J150 linha totalizadora:**
```
|J150|N|COD_AGL_TOTALIZADOR|T|1|...|RESULTADO LIQUIDO|VL|DC|VL|DC|D||
```

### 5.3 Relação J005 ↔ I350

Quando `J005.DT_FIN` está dentro do período da escrituração, o PGE **obriga** a existência de `I350` com `DT_RES = J005.DT_FIN`. Isso significa que toda empresa que gera Bloco J deve ter lançamento de encerramento contábil.

**Empresas sem encerramento:** não gerar Bloco J, ou aceitar os erros do PGE como pendência contábil.

---

## 6. ENCODING E DATAS

### 6.1 Encoding do arquivo ECD

O arquivo ECD deve ser gerado em **ISO-8859-1** (latin1), não UTF-8. Caracteres especiais (ç, ã, é) devem ser encoding nativo.

```typescript
// Ao ler/escrever arquivo ECD
const encoding = 'iso-8859-1';
```

### 6.2 Datas no ECD

Formato: `DDMMAAAA` (sem separadores)

```typescript
private fmtDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return dd + mm + yyyy;
}
```

### 6.3 Problema de fuso horário no Windows (UTC-3)

Em ambiente Windows (fuso -3), `new Date('2025-01-01')` produz `2025-01-01T03:00:00.000Z` — **3 horas após** a meia-noite UTC onde os registros `@db.Date` estão armazenados.

**Sempre usar helpers UTC:**
```typescript
private toUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

private toUTCEnd(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
}
```

### 6.4 Datas no formato ECD (fmtDate)

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

### 8.2 Holding / Participações

- Investimentos → `1.02.02.01.xx` (Participações Permanentes)
- Mútuos Ativo → `1.02.01.xx` (Realizável LP)
- Mútuos Passivo → `2.02.01.xx` ou `2.01.01.xx`
- Resultado de Equivalência → `3.01.01.05.01.06`

### 8.3 Escritório de Advocacia (OAB)

- Campo `NIRE` vazio (OAB não tem NIRE)
- `indNireVal = "0"` quando `registerOrg` contém "OAB"
- Plano de contas específico sem conta de estoque/ICMS

---

## 9. IMPORTAÇÃO DE ECD EXTERNO (ecd-importer)

### 9.1 Tipos de conteúdo ECD

| Tipo | Registros | Comportamento |
|---|---|---|
| FULL | I050 + I155 + I200/I250 | Importar plano + saldos + lançamentos |
| BALANCES_ONLY | I050 + I155 (sem I200/I250) | Importar plano + saldos; não reportar "0 lançamentos" como erro |
| STATEMENTS_ONLY | I200/I250 sem I155 | Importar apenas lançamentos |

### 9.2 Saldo inicial entre anos (I155 fallback)

O registro I155 do primeiro período do ano seguinte usa como saldo inicial o saldo final do último período do ano anterior. Quando não há I155 de abertura explícito, buscar via `accountBalance` com `referenceDate < periodStart`.

```typescript
// Fallback para saldo inicial via account_balance
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

### 9.3 openingBalance — data correta

O `openingBalance` importado do I155 deve ser salvo com `referenceDate = periodStart - 1 dia` (dia anterior ao início do período), para que seja encontrado como saldo anterior no próximo período.

### 9.4 Planos incompatíveis entre anos

Planos de contas de anos diferentes podem ter codificações estruturalmente incompatíveis (não apenas formatação diferente). Requer mapeamento configurável pelo usuário, não hardcoded.

---

## 10. WORKFLOW DE GERAÇÃO E VALIDAÇÃO ECD

### 10.1 Pré-condições obrigatórias

1. ✅ Plano de contas limpo (sem reduced_codes como code, sem hierarquia quebrada)
2. ✅ Todas as partidas apontando para contas ativas (sem órfãs)
3. ✅ Visões contábeis BP e DRE configuradas com códigos RFB folha (nível 5 ou 6)
4. ✅ Lançamento de encerramento lançado (se empresa fez encerramento)
5. ✅ Cadastro da empresa com: CNPJ, UF, CRC do contador, assinantes

### 10.2 Sequência de geração

1. Gerar ECD pelo frontend (endpoint `/sped/ecd/export`)
2. Salvar arquivo `.TXT` em Downloads
3. Abrir PGE (Sped Contábil)
4. Excluir escrituração anterior do CNPJ (se existir)
5. Importar o novo arquivo
6. Validar
7. Analisar relatório de erros
8. Corrigir e repetir

### 10.3 Interpretação de erros do PGE

| Tipo de erro | Natureza | Ação |
|---|---|---|
| I050 conta inválida | Técnico | Corrigir exporter ou plano de contas |
| I051 obrigatório | Técnico | Configurar COD_PLAN_REF e visões contábeis |
| I051 natureza divergente | Mapeamento | Corrigir COD_AGL no accounting_view_mappings |
| I052 totalizador | Mapeamento | Usar código folha (nível máximo) |
| J100 IND_GRP_BAL | Mapeamento | Corrigir contas mapeadas para grupo errado |
| J150 duplicado | Técnico | Agregar por COD_AGL no exporter |
| J150 saldo divergente | Mapeamento/Técnico | Verificar sinal e agregação |
| I350 faltando | Contábil | Lançar encerramento ou remover Bloco J |
| BP desequilibrado | Contábil | Lançar encerramento (transferir resultado para PL) |
| Assinatura contador | Não técnico | Configurar J930 com CRC/CPF do contador |
| NR_LIVRO conflito | Operacional | Excluir escrituração anterior no PGE |

---

## 11. TABELA RFB — Leiaute 9 (2025)

### 11.1 Estrutura

```sql
rfb_aglutination_codes:
  leiaute  INT      -- ex: 9
  ano_base INT      -- ex: 2025
  tipo     VARCHAR  -- 'BP' ou 'DRE'
  codigo   VARCHAR  -- ex: '1.01.01.02.01'
  descricao VARCHAR
  nivel    INT      -- 1 a 6
  codigo_pai VARCHAR
  ordem    INT
```

### 11.2 Importação dos JSONs RFB

```
POST /sped/visoes/rfb-codes/import
Body: { codes: [...] }  -- array de objetos com os campos acima
```

Os JSONs RFB para leiaute 9 (2024 e 2025) BP e DRE devem ser importados antes de usar as visões contábeis.

### 11.3 Nível máximo por grupo (leiaute 9, 2025)

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

1. **NestJS watch não recompila:** Matar processo (Stop-Process) e reiniciar `npm run start:dev`. O dist antigo pode estar em uso por horas sem recompilar alterações.

2. **PGE com cache interno:** Ao reimportar o mesmo CNPJ/período, o PGE usa dados do banco interno. Sempre excluir a escrituração anterior antes de reimportar.

3. **`(acc as any).reducedCode`:** Antipadrão — o `reducedCode` não deve ser usado para COD_CTA, apenas como atalho de tela.

4. **`Math.abs()` no `fmtDec`:** O método sempre retorna valor positivo. Para emitir com sinal, usar os campos `IND_DC_INI`/`IND_DC_FIN`, nunca valor negativo no campo numérico.

5. **Dois planos sobrepostos:** Após importar ECD externo, verificar se há contas com `reduced_code = '000000'` ou código pontilhado convivendo com o plano real.

6. **Partidas órfãs após limpeza:** Sempre verificar `journal_entry_items` após deletar contas do plano.

7. **Automapping DRE exibindo contas de ativo:** O `findMappingsGrouped` sem filtro de tipo retorna todas as contas da empresa para qualquer visão.

8. **Contas com mesmo nome em tipos diferentes:** No remap de partidas, usar `name + type` como chave — nunca só `name`.

9. **J930 COD_QUALIF inválido:** Códigos `005`, `010`, `016` não existem no PGE. Usar apenas os listados na seção 7.1.

10. **I001 = 1 quando sem lançamentos + tentativa de substituição:** O PGE interpreta como substituição e rejeita sem escrituração anterior. Sempre excluir e reimportar do zero.

---

*Documento mantido incrementalmente. Atualizar após cada sessão de desenvolvimento/validação.*
