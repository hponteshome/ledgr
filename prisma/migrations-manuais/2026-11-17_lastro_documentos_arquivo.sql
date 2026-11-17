-- LASTRO-03 (17/11/2026): lastro a partir dos documentos ja ligados no Arquivo Digital
-- 1. Liga o documento do contrato 40148.002/04 (Ecoville) que estava "sem vinculo" (so se houver exatamente 1)
UPDATE rental_contracts rc SET document_id = d.id
FROM documents d
WHERE rc.contract_number = '40148.002/04' AND rc.document_id IS NULL AND rc.deleted_at IS NULL
  AND d.company_id = rc.company_id AND d.deleted_at IS NULL AND d.type = 'CONTRATO_LOCACAO'
  AND d.title LIKE '%40148.002/04%'
  AND (SELECT count(*) FROM documents d2 WHERE d2.company_id = rc.company_id AND d2.deleted_at IS NULL
       AND d2.type = 'CONTRATO_LOCACAO' AND d2.title LIKE '%40148.002/04%') = 1;
-- 2. Documento ligado com situacao ASSINADO vale como contrato assinado
UPDATE rental_contracts rc SET signed_document_id = rc.document_id
FROM documents d
WHERE d.id = rc.document_id AND d.status = 'ASSINADO' AND rc.signed_document_id IS NULL AND rc.deleted_at IS NULL;
-- Resultado
SELECT rc.contract_number AS num, fa.internal_code AS imovel, rc.status, d.status AS doc_status,
       (rc.signed_document_id IS NOT NULL) AS lastro_pdf, (rc.lastro_ressalva IS NOT NULL) AS ressalva
FROM rental_contracts rc JOIN fixed_assets fa ON fa.id = rc.fixed_asset_id
LEFT JOIN documents d ON d.id = rc.document_id
WHERE rc.deleted_at IS NULL AND rc.status = 'ATIVO' ORDER BY fa.internal_code;