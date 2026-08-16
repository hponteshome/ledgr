# ECF — Referência de Leiautes por Ano-Calendário

**Fonte oficial:** Portal SPED/RFB — https://sped.rfb.gov.br/pasta/show/1644
**Metodologia deste projeto:** erro real do PVA > documentação. Este arquivo
registra o que já foi *confirmado por rodada real de validação* (marcado
✅) e o que vem *só da documentação oficial*, ainda não testado no PVA real
(marcado 📄). Nunca assumir campo por documentação sem cruzar com um teste
real antes de considerar "pronto para produção".

Atualizar este arquivo sempre que uma nova rodada revelar algo novo — é
mais rápido conferir aqui do que recaçar no PVA ou nos manuais de novo.

---

## Tabela oficial de leiautes (fonte: Manual de Orientação do Leiaute 12 da ECF, Cap. 1)

| Leiaute | Ano-calendário | Situações especiais | ADE Cofis |
|---|---|---|---|
| 1  | 2014 | 2015 | 60/2015 |
| 2  | 2015 | 2016 | 46/2016 |
| 3  | 2016 | 2017 | 30/2017 |
| 4  | 2017 | 2018 | 52/2018 |
| 5  | 2018 | 2019 | 84/2018, 9/2019 |
| 6  | 2019 | 2020 | 70/2019 |
| 7  | 2020 | 2021 | 86/2020 |
| 8  | 2021 | 2022 | 001/2022 |
| 9  | 2022 | 2023 | 133/2022 |
| 10 | 2023 | 2024 | 59/2023 |
| 11 | 2024 | 2025 | 38/2024 |
| 12 | 2025 | 2026 | 2/2026 |

Manuais completos por leiaute (todos em sped.rfb.gov.br/pasta/show/1644):
- Leiaute 12: Manual_ECF_Leiaute_12_28_04_2026_AC_2025_SIT_ESP_2026.pdf (620 páginas, tem Anexo II "Alterações do Manual" com changelog campo a campo)
- Leiaute 11: Manual_ECF_Leiaute_11_05_02_2025.pdf

**Nota estrutural (16/08/2026):** a pasta local do PVA (`recursos\tabelas\SPEDECF_DINAMICO_*`)
só tem tabelas dinâmicas para os leiautes 2014-2021. A partir do leiaute
~10/11, a RFB passou a compilar a estrutura direto no programa — não existe
mais fonte de dados local pra ler automaticamente. Por isso, pra leiautes
recentes, o único caminho confiável é: manual oficial (referência) + PVA real
(confirmação definitiva).

---

## Ano-calendário 2024 (Leiaute 0011) — ✅ validado contra PVA real (GRB)

| Campo | Valor confirmado | Como foi confirmado |
|---|---|---|
| Registro 0000, campo 3 (COD_VER) | `0011` | ✅ PVA 12.2.2, GRB 2024, 15/08/2026 |
| Registro 0020 — total de campos | 31 | ✅ erro real "Quantidade de campos incorreta" (32→31), corrigido |
| Registro 0020 — pipes finais após os 27 flags "N" | 2 | ✅ mesmo teste acima |
| P200/P300/P400/P500 | Estrutura leiaute 11, sem as mudanças do L12 | Não testado a fundo — GRB 2024 passou limpo (0 erros, mesmas advertências cosméticas) |

## Ano-calendário 2025 (Leiaute 0012) — ✅ validado contra PVA real (GRB)

| Campo | Valor confirmado | Como foi confirmado |
|---|---|---|
| Registro 0000, campo 3 (COD_VER) | `0012` | ✅ PVA 12.2.2, GRB 2025, 15/08/2026 |
| Registro 0020 — total de campos | 32 (**+1 em relação ao leiaute 11**) | ✅ erro real "Quantidade de campos incorreta" (2 rodadas: 31→32→correto) |
| Registro 0020 — pipes finais após os 27 flags "N" | 3 | ✅ mesmo teste acima |
| Registro K156/K356 (referencial) | Não deve reaproveitar o `rest` do K155/K355 (falta campo COD_CCUS) | ✅ erro real "Quantidade de campos incorreta" (9 vs 8 esperados), corrigido |
| P200/P300/P400/P500 | Estrutura alterada — RFB reformulou esses blocos no L12 | 📄 confirmado pelo manual oficial (blocos L100B, L300B, P100B, P150B, P200, P400, U100B, U150B alterados) + ✅ advertências cosméticas confirmadas no PVA real |
| Registro Y730 (novo no L12) | "Identificação de donatários/destinatários de deduções do IRPJ/CSLL" — obrigatório se a empresa usa deduções (ex: PAT) | 📄 só documentação — **não implementado no exporter, pendência real para empresa Lucro Real com deduções** |

---

## Anos ainda não mapeados (2026+, leiaute 13 esperado)

Quando a RFB publicar o leiaute 13 (esperado para ano-calendário 2026,
manual provavelmente sai no início de 2027):

1. Adicionar uma linha nova em `ECF_LAYOUT_BY_YEAR` (`ecf-exporter.service.ts`)
2. Testar geração real contra o PVA atualizado, registro por registro que der erro
3. Atualizar este arquivo com o que for confirmado
4. Não assumir que os campos são iguais ao leiaute 12 só porque "geralmente muda pouco" — confirmar cada divergência real

---

## Empresas/regimes ainda não testados neste projeto

- Lucro Real (blocos L/M/N do ECF) — GRB é Presumido, nunca exercitamos essas trilhas
- Imunes/Isentas (bloco U) — não testado
- TEF/SAF (bloco S) — não testado
- Qualquer empresa com deduções que exijam Y730