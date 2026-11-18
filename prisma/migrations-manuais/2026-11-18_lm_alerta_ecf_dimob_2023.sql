-- ARQ-DIMOB-02 (18/11/2026) - LM: alerta travado (bloqueia a ECF) atualizado - so falta a DIMOB 2023. Trava, bloqueio e autor mantidos.
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS cid FROM companies WHERE tax_id = '17970759000108' \gset
UPDATE company_alerts
   SET title = 'LM NÃO PODE GERAR ECF antes de regularizar a DIMOB 2023',
       message = 'Desde 13/11/2026 10:34:24 a última declaração apresentada é a ECF 2022 (Lucro Presumido), o que sustenta a faixa de R$ 500/mês da multa das DIMOBs em atraso (MP 2.158-35, art. 57, I, "a"). '
              || 'DIMOB 2024 (recibo 06.94.80.85.92-03) e 2025 (recibo 01.03.52.74.36-11) entregues em 18/11/2026. Falta a DIMOB 2023 (Curitiba ago-dez/2023, Quatro Ventos). '
              || 'Uma ECF de Lucro Real (original ou retificadora de 2023-2025) ou a MIT transmitida antes dela move a faixa para R$ 1.500/mês. DIMOB 2021 fora do escopo (decisão de 10/11/2026).'
 WHERE company_id = :'cid' AND resolved_at IS NULL AND locked = true
   AND title = 'LM NÃO PODE GERAR ECF antes de regularizar as DIMOBs 2023, 2024 e 2025';
COMMIT;
\echo == Alertas abertos com DIMOB ==
SELECT left(title, 75) AS alerta, locked, blocks_action FROM company_alerts
 WHERE company_id = :'cid' AND resolved_at IS NULL AND (title ILIKE '%DIMOB%' OR message ILIKE '%DIMOB%') ORDER BY locked DESC, created_at;