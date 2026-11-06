-- B-FA-ENDERECOS - 20261106_fixed_assets_enderecos.sql
BEGIN;
UPDATE fixed_assets f SET
  street       = COALESCE(NULLIF(f.street,''), v.rua),
  number       = COALESCE(NULLIF(f.number,''), v.num),
  complement   = COALESCE(NULLIF(f.complement,''), v.compl),
  neighborhood = COALESCE(NULLIF(f.neighborhood,''), v.bairro)
FROM (VALUES
  ('Mare62',      'Passeio do Pontal', '499', 'Apartamento 62 - Ed. Mare - Modulo 08', 'Riviera de Sao Lourenco'),
  ('Mare88',      'Passeio do Pontal', '499', 'Apartamento 88 - Ed. Mare - Modulo 08', 'Riviera de Sao Lourenco'),
  ('Mare92',      'Passeio do Pontal', '499', 'Apartamento 92 - Ed. Mare - Modulo 08', 'Riviera de Sao Lourenco'),
  ('Conj32',      'Rua Bandeira Paulista', '600', 'Conjunto 32 - Ed. Acyr Andrade', 'Itaim Bibi'),
  ('Conj33',      'Rua Bandeira Paulista', '600', 'Conjunto 33 - Ed. Acyr Andrade', 'Itaim Bibi'),
  ('NorthYork',   'Rua Pedro Nicco', '225', 'SB 25 - Residencial North York', NULL),
  ('Ecoville',    'Rua Professor Pedro Viriato Parigot de Souza', '2511', 'Apartamento 1602 - Ed. Casa Blanca', NULL),
  ('StParis',     'Rua Lamenha Lins', '439', 'Apartamento 1101', 'Centro'),
  ('PalaysRoyal', 'Rua Dom Armando Lombardi', '819', 'Apartamento 31-A', 'Vila Progredior'),
  ('Campos',      'Avenida Pedro Paulo', '7400', 'Casa 57 - Condominio Iporanga', NULL),
  ('Guarujá',     'Rua 7', '124', 'Loteamento Iporanga', 'Iporanga'),
  ('Cotia',       'Estrada Pedreira Eldorado', '11', NULL, NULL)
) AS v(cod, rua, num, compl, bairro)
WHERE f.company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND f.internal_code = v.cod;

-- hifen "suave" (U+00AD) colado nas inscricoes de Curitiba -> hifen normal
UPDATE fixed_assets SET iptu_registration = replace(iptu_registration, U&'\00AD', '-')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND iptu_registration LIKE '%' || U&'\00AD' || '%';

-- descricao do Conj33 dizia "nº 32"
UPDATE fixed_assets SET description = replace(description, 'nº 32', 'nº 33')
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND internal_code = 'Conj33' AND description LIKE '%nº 32%';
COMMIT;

SELECT internal_code AS imovel, street AS logradouro, number AS num, complement AS compl, neighborhood AS bairro,
       iptu_registration AS inscricao, length(regexp_replace(COALESCE(iptu_registration,''), '\D', '', 'g')) AS dig_insc
  FROM fixed_assets
 WHERE company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a' AND deleted_at IS NULL AND "group" = 'REAL_ESTATE'
   AND COALESCE(country,'Brasil') = 'Brasil'
 ORDER BY internal_code;