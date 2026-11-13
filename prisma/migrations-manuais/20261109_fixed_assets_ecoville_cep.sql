-- 20261109_fixed_assets_ecoville_cep.sql - Ecoville conforme contrato Galvao 40148.002/04 e comprovante DIMOB AC 2025
UPDATE fixed_assets SET street = 'Rua Professor Pedro Viriato Parigot de Souza', number = '1609', complement = 'Ap 1602 - Garagens 34 e 51 - Ed. Casablanca da Ecoville',
       neighborhood = 'Campina do Siqueira', zip_code = '80740050', city = 'Curitiba', state = 'PR', updated_at = now()
WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = 'Ecoville';