-- LASTRO-04 (17/11/2026): contrato sem documento principal, com PDF assinado -> o PDF vira o documento do contrato
UPDATE rental_contracts SET document_id = signed_document_id
WHERE document_id IS NULL AND signed_document_id IS NOT NULL AND deleted_at IS NULL;
SELECT rc.contract_number AS num, fa.internal_code AS imovel, rc.status, d.title
FROM rental_contracts rc JOIN fixed_assets fa ON fa.id = rc.fixed_asset_id JOIN documents d ON d.id = rc.document_id
WHERE rc.document_id = rc.signed_document_id AND rc.deleted_at IS NULL ORDER BY fa.internal_code, rc.start_date;