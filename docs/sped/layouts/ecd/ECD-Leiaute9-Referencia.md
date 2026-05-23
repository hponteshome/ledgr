# ECD — Escrituracao Contabil Digital
# Referencia tecnica LEDGR — Historico de Leiautes

## IMPORTANTE
> O layout da ECD muda a cada exercicio. Sempre confirmar o manual vigente
> para o ano-calendario a ser entregue antes de gerar ou validar qualquer arquivo.
> Fonte oficial: http://sped.rfb.gov.br/pasta/show/1569

---

## Historico de Leiautes ECD (a partir de 2015)

| Leiaute | Ano-Calendario | Ato | Link Manual |
|---------|----------------|-----|-------------|
| Leiautes 1 a 4 | 2008–2017 | ADE Cofis 29/2017 | http://sped.rfb.gov.br/arquivo/show/1640 |
| Leiaute 5 | 2018 | ADE Cofis 34/2016 + atualizacoes | http://sped.rfb.gov.br/pasta/show/1569 |
| Leiaute 6 | 2019 | ADE Cofis (nov/2019) | http://sped.rfb.gov.br/pagina/show/4199 |
| Leiaute 7 | 2019–2020 | ADE Cofis 34/2016 atualizado | http://sped.rfb.gov.br/pasta/show/1569 |
| Leiaute 8 | — | — | http://sped.rfb.gov.br/pasta/show/1569 |
| Leiaute 9 | 2020 | ADE Cofis 79/2020 | http://sped.rfb.gov.br/arquivo/show/5705 |
| Leiaute 9 | 2021 | ADE Cofis 104/2021 | http://sped.rfb.gov.br/pasta/show/1569 |
| Leiaute 9 | 2022 | ADE Cofis 114/2022 | http://sped.rfb.gov.br/pasta/show/1569 |
| Leiaute 9 | 2023 | ADE Cofis 57/2023 | http://sped.rfb.gov.br/estatico/2D/9C01A0E619B48BAB27486D63FF9E4E750025D0/Manual_de_Orienta%C3%A7%C3%A3o_da_ECD_Leiaute9_2023_12_21.pdf |
| Leiaute 9 | 2024 | ADE Cofis 57/2023 + Nov/2024 | https://www.dinamicasistemas.com.br/upload/files/Manual_de_Orienta%C3%A7%C3%A3o_da_ECD_Leiaute_9_Atualiza%C3%A7%C3%A3o_Nov_2024.pdf |
| Leiaute 9 | 2025+ | ADE Cofis 1/2026 | http://sped.rfb.gov.br/pasta/show/1569 |

### Principais mudancas por versao

| Ano | Mudancas relevantes |
|-----|---------------------|
| 2015 | Leiaute 4 — obrigatoriedade Lucro Real |
| 2016 | Leiaute 5 — IND_FIN_ESC e COD_HASH_SUB obrigatorios |
| 2019 | Leiaute 6 — IND_CENTRALIZADA, IND_MUDANCA_PC, COD_PLAN_REF adicionados ao 0000 |
| 2020 | Leiaute 9 — reestruturacao completa, novos registros I052, I053, I157 |
| 2023 | Leiaute 9 atualizado — modificacoes em I051, I155, I157 |
| 2024 | Leiaute 9 Nov/2024 — ajustes menores em regras de validacao |

---

## Registro 0000 — Layout validado (Leiaute 9, ano-base 2024)
|0000|LECD|DT_INI|DT_FIN|NOME|CNPJ|UF|IE|COD_MUN|NRE|NAT_LIV|IND_SIT_ESP|IND_SIT_INI_PER|IND_NIRE|IND_FIN_ESC|COD_HASH_SUB|COD_SCP|TIP_ECD|ID_SCP|IND_MOEDA_FUNC|IND_ESC_CONS|IND_CENTRALIZADA|IND_MUDANCA_PC|COD_PLAN_REF|

**23 campos | 24 pipes**

| Pos | Campo | Valor padrao LEDGR | Dominio |
|-----|-------|--------------------|---------|
| 1 | LECD | LECD | fixo |
| 2 | DT_INI | ddmmaaaa | data |
| 3 | DT_FIN | ddmmaaaa | data |
| 4 | NOME | legalName | alfanum max 100 |
| 5 | CNPJ | sem formatacao | 14 digitos |
| 6 | UF | state | sigla 2 chars |
| 7 | IE | vazio | — |
| 8 | COD_MUN | vazio | IBGE 7 digitos |
| 9 | NRE | vazio | num registro empresa |
| 10 | NAT_LIV | vazio | nat. do livro |
| 11 | IND_SIT_ESP | vazio | 0=normal, 1=extincao... |
| 12 | IND_SIT_INI_PER | 0 | 0=normal, 1=abertura |
| 13 | IND_NIRE | 0 | 0=nao, 1=sim |
| 14 | IND_FIN_ESC | 0 | 0=original, 1=substituta |
| 15 | COD_HASH_SUB | vazio | hash 40 chars (substituta) |
| 16 | COD_SCP | vazio | CNPJ SCP |
| 17 | TIP_ECD | 0 | 0=normal, 1=SCP |
| 18 | ID_SCP | vazio | |
| 19 | IND_MOEDA_FUNC | N | S=sim, N=nao |
| 20 | IND_ESC_CONS | N | S=sim, N=nao |
| 21 | IND_CENTRALIZADA | 0 | 0=centralizada |
| 22 | IND_MUDANCA_PC | 0 | 0=sem mudanca, 1=mudou |
| 23 | COD_PLAN_REF | vazio | codigo plano referencial |

> Adicionados no Leiaute 6/2019: campos 21 (IND_CENTRALIZADA), 22 (IND_MUDANCA_PC), 23 (COD_PLAN_REF)

---

## Registro I030 — Termo de Abertura (Leiaute 9)
|I030|DNRC_ABERT|NUM_ORD|NAT_LIV|QTD_LIN|NOME|COD_INS|CNPJ|CPF|NIRE|COD_MUN|DT_EX_SOCIAL|DT_ENT_ENT|

**12 campos | 13 pipes**

| Pos | Campo | Valor LEDGR |
|-----|-------|-------------|
| 1 | DNRC_ABERT | dtIni (data abertura livro) |
| 2 | NUM_ORD | bookNumber |
| 3 | NAT_LIV | bookNature |
| 4 | QTD_LIN | 0 (calculado pelo PGE) |
| 5 | NOME | legalName |
| 6 | COD_INS | vazio |
| 7 | CNPJ | cnpj |
| 8 | CPF | vazio |
| 9 | NIRE | vazio |
| 10 | COD_MUN | vazio |
| 11 | DT_EX_SOCIAL | dtFin |
| 12 | DT_ENT_ENT | dtFin |

---

## Registro I050 — Plano de Contas
|I050|DT_ALT|COD_NAT|IND_CTA|NIVEL|COD_CTA|COD_CTA_SUP|NOME_CTA|

**7 campos | 8 pipes**

| COD_NAT | AccountType LEDGR |
|---------|------------------|
| 01 | ASSET |
| 02 | LIABILITY |
| 03 | EQUITY |
| 04 | REVENUE |
| 05 | EXPENSE |

| IND_CTA | isAnalytic |
|---------|-----------|
| A | true |
| S | false |

---

## Registro I155 — Saldos Periodicos (Leiaute 9)
|I155|COD_CTA|COD_CTA_SUP|VL_SLD_INI|IND_DC_INI|VL_DEB|VL_CRE|VL_SLD_FIN|IND_DC_FIN|

**8 campos | 9 pipes**

> ATENCAO: Leiautes anteriores tinham VL_SLD_360 e IND_DC_360 (campos 9 e 10).
> No Leiaute 9 esses campos foram REMOVIDOS. Sempre verificar o manual do ano.

Regras de equilibrio:
- Soma VL_SLD_INI D = Soma VL_SLD_INI C (balancos fecham)
- Soma VL_SLD_FIN D = Soma VL_SLD_FIN C
- VL_SLD_FIN = VL_SLD_INI +/- VL_DEB - VL_CRE (conforme natureza)

Fonte do saldo inicial LEDGR: exclusivamente `account_balance` (importado via ECD anterior).
NAO usar journal_entry_items historicos — divergencia causara desequilibrio.

---

## Registro I200 — Lancamento Contabil
|I200|NUM_LCTO|DT_LCTO|VL_LCTO|IND_LCTO|DT_LCTO_ORI|

**5 campos | 6 pipes**

| IND_LCTO | Significado |
|----------|-------------|
| N | Normal |
| X | Extemporaneo |

---

## Registro I250 — Partidas do Lancamento
|I250|COD_CTA|COD_CCUS|VL_DC|IND_DC|NUM_ARQL|DESC_DOC|HIST|COD_HIST|

**8 campos | 9 pipes**

Restricoes campo HIST:
- Maximo 40 caracteres
- Apenas ASCII — sem acentos, sem : / | \
- Normalizacao LEDGR: NFD + remove diacriticos + replace chars invalidos + trim

---

## Bloco J — Status de Implementacao LEDGR

| Registro | Status | Observacao |
|----------|--------|------------|
| J001 | Gerado | Abertura |
| J005 | Pendente | Requer visoes contabeis |
| J100 | Pendente | Requer I052 (aglutinacao) |
| J150 | Pendente | Requer I052 + I355 |
| J210 | Pendente | DLPA/DMPL |
| J215 | Pendente | Totais DLPA/DMPL |
| J900 | Gerado | Encerramento |

### Dependencias para implementar Bloco J completo

1. **Registro I052** — mapeamento conta analitica → codigo de aglutinacao
2. **Registro I350/I355** — saldo de resultado antes do encerramento
3. **Modulo Visoes Contabeis** — cadastro das linhas do BP e DRE por empresa
4. **J005** — identificacao das demonstracoes (periodicidade, moeda, escala)
5. **J100** — BP usando codigos de aglutinacao
6. **J150** — DRE usando codigos de aglutinacao
7. **J930** — signatarios da escrituracao

> O PGE confronta os valores do J100/J150 com os saldos do I155 via I052.
> Sem I052, qualquer valor no J100 sera rejeitado.

---

## Erros conhecidos no PGE e solucoes

| Erro PGE | Causa | Solucao |
|----------|-------|---------|
| 0000: numero de campos diferente | Layout mudou entre exercicios | Sempre validar contra manual do ano |
| I155: soma devedores != credores | Saldo inicial nao equilibrado | Usar exclusivamente account_balance como fonte |
| I250: conteudo campo invalido | Caracteres especiais no historico | Normalizar ASCII antes de gerar |
| J900: registro obrigatorio | Bloco J sem demonstracoes | Implementar I052 e visoes contabeis |
| I030: DT_EX_SOCIAL invalido | Campo 12 vazio | Preencher com DT_FIN do periodo |
| COD_ENT_REF no 0007 | CNPJ entidade registral vazio | Cadastrar orgao de registro na empresa |

---

## Historico de validacoes PGE — LEDGR

| Data | Empresa | Ano-base | Leiaute | Erros | Status |
|------|---------|----------|---------|-------|--------|
| 23/05/2026 | LM Administracao de Bens Imoveis | 2024 | 9 (Nov/2024) | 6 (Bloco J pendente) | Importado com sucesso |

