# Hotelsys - Recomposição contábil a partir das ECDs (status em 30/10/2026)

## Bases
- `ledgr_clone`: cópia de `ledgr_app` (pg_dump de 30/10/2026). É a base da recomposição e dos lotes para a JS Contabilidade. API na porta 3001 e front na 5174 (`D:\LedgrClone\iniciar-clone.ps1`).
- `ledgr_app` (oficial): só leitura na recomposição, com uma exceção autorizada: os ajustes de 2024 movidos para 01/01/2024 (backup em `D:\Backup\ledgr_app_antes_aj2024_20261030_1639.dump`).

## Regras
- Balanço de abertura: 31/12/2017, igual aos saldos finais da ECD 2017. Conta Corrente Matriz x Filial (16.890.513,66) eliminada.
- Lotes para a JS: sem contas de resultado. A perna de resultado vai para 23401010001 Apuração de Resultado (8888). Do encerramento entram só os lançamentos entre contas do PL. Partidas de valor zero ficam fora. Os códigos são os do Ledgr, convertidos pelo `De-para_Hotelsys_LEDGR_x_contador_30-10.xlsx`.
- Os saldos de 31/10/2025 e a movimentação de 2025 têm que ser iguais aos razões divulgados no processo da Real Mouchão, ou seja, ao Ledgr oficial.
- Os ajustes ficam em 01/01/2024, para que nenhum razão emitido a partir do segundo semestre de 2024 contenha lançamento de ajuste.

## Correções feitas no clone
- 2018: enviado à JS como estava no Ledgr.
- 01/01/2019:
  - RETIF-2018-CIM: D Ajustes de Exercícios Anteriores / C CIM a Pagar, 5.755,36.
  - RETIF-2018-FGTS: D Outras Contas a Pagar / C FGTS a Recolher, 1.448.838,90.
- CIM de 2019 a 2023: a despesa da ECD (4.2.01.003.405) foi lançada em 42103010034 Taxas Diversas.
- 01/01/2024: TRANSICAO-2024-CIM estorna as correções de CIM de 2018 a 2023 e alinha o clone ao saldo do oficial.
  - D CIM a Pagar 29.298,38.
  - C Prejuízos Acumulados 17.488,08.
  - C Prejuízo do Exercício 6.054,94.
  - C Ajustes de Exercícios Anteriores 5.755,36.
- Encerramento de 2024 no clone: a transferência do prejuízo de 2023 foi ajustada para 2.116.708,62. **Não refazer esse encerramento no clone.**
- Lote HotelsysAjustesDez2024 renomeado para Ajustes2024 (no clone e no oficial). Os 36 ajustes de 31/12/2024 estão em 01/01/2024 nas duas bases.
- Ajuste de 2024 do FGTS: no clone, o débito está dividido entre FGTS a Recolher (1.448.838,90) e Outras Contas a Pagar (649.019,48).

## Situação clone x oficial
- 2018: igual.
- 2019 a 2023: diferem só em CIM a Pagar, FGTS a Recolher, Outras Contas a Pagar e nas contas do PL (correções enviadas à JS).
- A partir de 01/01/2024: contas patrimoniais iguais. O [B-COMP-3110] deu IDENTICOS em 31/12/2024, 31/10/2025 e 31/12/2025.

## Envio à JS
- Enviados: 2018 e 2019.
- Prontos: `Conciliacao_Hotelsys_2020.xlsx` a `Conciliacao_Hotelsys_2025.xlsx`. Cada arquivo tem a aba de saldos ECD x Ledgr, com a explicação de cada diferença, e a aba de lançamentos sem contas de resultado.

## Blocos nomeados
- [B-EXP-ANO]: exporta as partidas da ECD e os lançamentos do Ledgr de um ano (do clone).
- [B-RETIF-2019]: correções de CIM e FGTS em 01/01/2019 (só no clone).
- [B-CONF-ENC]: confere se as contas de resultado estão zeradas em 31/12 de cada ano.
- [B-AJ-0101-2024], [B-AJ-0101-2024-FIX], [B-AJ-0101-2024-FIX2]: ajustes de 2024 em 01/01/2024 e alinhamento do PL (no clone).
- [B-AJ-0101-2024-OFICIAL]: ajustes de 2024 em 01/01/2024 no oficial, com backup.
- [B-COMP-3110]: compara clone x oficial em 31/12/2024, 31/10/2025 e 31/12/2025.
- [B-COMP-ANOS]: compara clone x oficial nas contas patrimoniais em 31/12 de 2018 a 2025.
