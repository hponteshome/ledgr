-- 2026-11-18_js_ago2026_fechamento.sql
-- JS-AGO-03: Jose Silva Sociedade Individual de Advocacia.
-- Agosto/2026: S-1200 do pro-labore ja existia (lancado fora do LEDGR); folha fechada pelo portal eSocial em 18/11/2026,
-- DCTFWeb 08/2026 entregue (omissao resolvida). Empregadas admitidas em 01/09/2026: Tem Folha volta a ser ligado.
\set ON_ERROR_STOP on
\set js 'ca9ba513-06ae-4579-b546-ebc457f33452'
BEGIN;
UPDATE companies SET tem_folha = true, updated_at = now() WHERE id = :'js' AND tem_folha = false;

UPDATE fiscal_obligations SET status = 'DONE', done_at = now(), delivered_at = coalesce(delivered_at, now()),
       notes = 'Fechado pelo portal eSocial em 18/11/2026 (S-1200 do pro-labore lancado fora do LEDGR; LEDGR enviou S-1000, S-1005, S-1020, S-1010 e S-2300). DCTFWeb 08/2026 entregue - omissao baixada no Relatorio de Situacao Fiscal. MIT 08/2026 pendente.'
 WHERE company_id = :'js' AND competence = '2026-08' AND code IN ('ESOCIAL', 'DCTFWEB') AND status <> 'DONE';

INSERT INTO company_alerts (company_id, severity, title, message, locked, created_by_name, action_url, action_label)
SELECT :'js'::uuid, 'WARNING', v.t, v.m, false, 'Regularizacao Jose Silva (JS-AGO-03)', NULL, NULL
FROM (VALUES
  ('MIT 08/2026 (DCTFWeb): tributos de agosto a declarar',
   'Lucro Real: PIS 0,65% e Cofins 4% sobre a receita financeira de agosto/2026 (Decreto 8.426/2015) e IRPJ/CSLL conforme a forma de apuracao (trimestral: nada em agosto; anual: estimativa, com deducao do IRRF retido nas aplicacoes). Declarar no MIT de 08/2026 (gera DCTFWeb retificadora) e emitir o DARF. Base: extratos/informes das aplicacoes.'),
  ('INSS 08/2026: DARF da DCTFWeb a pagar (R$ 930,00 + encargos)',
   'Pro-labore de agosto/2026 (R$ 3.000,00): INSS do socio 11% R$ 330,00 + patronal 20% R$ 600,00. Emitir o DARF no e-CAC (DCTFWeb > Emitir guia), com multa e juros de mora.')
) v(t, m)
WHERE NOT EXISTS (SELECT 1 FROM company_alerts a WHERE a.company_id = :'js'::uuid AND a.title = v.t AND a.resolved_at IS NULL);
COMMIT;
\echo == conferencia ==
SELECT legal_name, tem_folha FROM companies WHERE id = :'js';
SELECT code, competence, status FROM fiscal_obligations WHERE company_id = :'js' AND competence = '2026-08' ORDER BY code;
SELECT left(title, 70) AS alerta FROM company_alerts WHERE company_id = :'js' AND resolved_at IS NULL ORDER BY created_at;