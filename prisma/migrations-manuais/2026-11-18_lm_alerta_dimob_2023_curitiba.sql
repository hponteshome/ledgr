-- ARQ-DIMOB-03 (18/11/2026) - LM: alerta da DIMOB 2023 sem o LoftSP (contrato 200002 cadastrado pelo DIMOB-B-03)
\set ON_ERROR_STOP on
BEGIN;
SELECT id AS cid FROM companies WHERE tax_id = '17970759000108' \gset
UPDATE company_alerts
   SET title = 'DIMOB 2023: falta Curitiba ago-dez/2023 (Quatro Ventos)',
       message = 'Aguardando a DIMOB 2023 da Quatro Ventos: aluguel e comissão de ago a dez/2023 dos contratos 40148.001 e 40148.002 (código 40148, em nome da LM). '
              || 'O restante da DIMOB 2023 já está no LEDGR: 328.676,40 (Takara, Focus, Mare 62, Douglas e LoftSP 200002). Se não chegar até ~27/11, decidir entre entregar sem Curitiba e retificar depois, ou atrasar a MIT de out/2026.'
 WHERE company_id = :'cid' AND resolved_at IS NULL AND title = 'DIMOB 2023: faltam Curitiba ago-dez/2023 e o contrato LoftSP de 2020';
COMMIT;
SELECT left(title, 80) AS alerta FROM company_alerts WHERE company_id = :'cid' AND resolved_at IS NULL AND title ILIKE 'DIMOB 2023%';