-- 2026-11-16 - Agenda de Obrigacoes (Fase 1): flags do perfil fiscal da empresa e limpeza das obrigacoes geradas pelas regras antigas.
\pset pager off
BEGIN;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tem_folha boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tem_pro_labore boolean NOT NULL DEFAULT false;
\echo === obrigacoes geradas pelas regras antigas (a apagar) ===
SELECT c.legal_name, o.code, COUNT(*) FROM fiscal_obligations o JOIN companies c ON c.id = o.company_id
 WHERE o.status = 'PENDING' AND o.notes IS NULL AND o.receipt_number IS NULL AND o.competence >= '2025'
   AND o.code IN ('FGTS','GPS_INSS','ESOCIAL','DARF_PIS','DARF_COFINS','DARF_CSLL','DARF_IRPJ','DAS','DCTF','SPED_FISCAL','DIRF','DEFIS','RAIS')
 GROUP BY 1, 2 ORDER BY 1, 2;
DELETE FROM fiscal_obligations o
 WHERE o.status = 'PENDING' AND o.notes IS NULL AND o.receipt_number IS NULL AND o.competence >= '2025'
   AND o.code IN ('FGTS','GPS_INSS','ESOCIAL','DARF_PIS','DARF_COFINS','DARF_CSLL','DARF_IRPJ','DAS','DCTF','SPED_FISCAL','DIRF','DEFIS','RAIS');
COMMIT;
\echo === restante por empresa ===
SELECT c.legal_name, o.status, COUNT(*) FROM fiscal_obligations o JOIN companies c ON c.id = o.company_id GROUP BY 1, 2 ORDER BY 1, 2;