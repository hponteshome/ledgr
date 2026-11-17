-- 17/11/2026 - eSocial S-1.3 (reconstrucao): parametros por empresa, lotes, eventos e pagamentos do pro-labore
CREATE TABLE IF NOT EXISTS esocial_s13_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES companies(id),
  class_trib varchar(2) NOT NULL,
  ini_valid_s1000 varchar(7) NOT NULL,
  fpas varchar(3) NOT NULL,
  cod_tercs varchar(4) NOT NULL,
  cod_lotacao varchar(30) NOT NULL DEFAULT '001',
  ide_tab_rubr varchar(8) NOT NULL DEFAULT 'LEDGR',
  created_at timestamp(6) NOT NULL DEFAULT now(),
  updated_at timestamp(6) NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS esocial_s13_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  tp_amb smallint NOT NULL, grupo smallint NOT NULL, etapa smallint NOT NULL,
  protocolo varchar(60), status varchar(20) NOT NULL DEFAULT 'CRIADO',
  cd_resposta int, desc_resposta text, tempo_estimado int,
  xml_envio text, xml_retorno_envio text, xml_retorno_proc text,
  enviado_em timestamp(6), consultado_em timestamp(6),
  created_at timestamp(6) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS esocial_s13_lotes_company_id_tp_amb_status_idx ON esocial_s13_lotes(company_id, tp_amb, status);
CREATE TABLE IF NOT EXISTS esocial_s13_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  tp_amb smallint NOT NULL, tipo varchar(6) NOT NULL, per_apur varchar(7), chave varchar(120) NOT NULL,
  evento_id varchar(40) NOT NULL, grupo smallint NOT NULL, etapa smallint NOT NULL,
  xml text NOT NULL, status varchar(20) NOT NULL DEFAULT 'GERADO', validacao text,
  lote_id uuid REFERENCES esocial_s13_lotes(id), nr_recibo varchar(60), cd_resposta int, desc_resposta text,
  ocorrencias jsonb, retorno_xml text,
  created_at timestamp(6) NOT NULL DEFAULT now(), updated_at timestamp(6) NOT NULL DEFAULT now(),
  CONSTRAINT esocial_s13_eventos_company_id_tp_amb_chave_key UNIQUE (company_id, tp_amb, chave)
);
CREATE INDEX IF NOT EXISTS esocial_s13_eventos_company_id_tp_amb_status_idx ON esocial_s13_eventos(company_id, tp_amb, status);
CREATE TABLE IF NOT EXISTS pro_labore_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  config_id uuid REFERENCES pro_labore_configs(id),
  person_id uuid NOT NULL REFERENCES persons(id),
  tipo varchar(15) NOT NULL DEFAULT 'PRO_LABORE',
  competencia varchar(7), dt_pagamento date NOT NULL, valor_liquido numeric(15,2) NOT NULL,
  observacao varchar(300), created_at timestamp(6) NOT NULL DEFAULT now(), deleted_at timestamp(6)
);
CREATE INDEX IF NOT EXISTS pro_labore_pagamentos_company_id_dt_pagamento_idx ON pro_labore_pagamentos(company_id, dt_pagamento);

-- LM: parametros (classTrib e iniValid do S-1000 aceito em 2023; FPAS/terceiros aprovados em 17/11/2026)
INSERT INTO esocial_s13_config (company_id, class_trib, ini_valid_s1000, fpas, cod_tercs, cod_lotacao, ide_tab_rubr)
SELECT id, '99', '2023-01', '515', '0115', '001', 'LEDGR' FROM companies WHERE tax_id = '17970759000108'
ON CONFLICT (company_id) DO NOTHING;

-- LM: pagamentos do pro-labore 2026 (mapa confirmado em 17/11/2026) e adiantamentos a liquidar
INSERT INTO pro_labore_pagamentos (company_id, config_id, person_id, tipo, competencia, dt_pagamento, valor_liquido, observacao)
SELECT c.id,
  (SELECT plc.id FROM pro_labore_configs plc WHERE plc.company_id = c.id AND plc.person_id = p.id AND plc.deleted_at IS NULL
     AND v.comp IS NOT NULL AND plc.competencia_ini <= v.comp AND (plc.competencia_fim IS NULL OR plc.competencia_fim >= v.comp) LIMIT 1),
  p.id, v.tipo, v.comp, v.dt::date, v.liq, v.obs
FROM companies c, persons p,
 (VALUES ('PRO_LABORE','2026-03','2026-05-06',1442.69,'Extrato - pro-labore 03/2026'),
         ('PRO_LABORE','2026-04','2026-05-07',1442.69,'Extrato - pro-labore 04/2026'),
         ('PRO_LABORE','2026-05','2026-06-05',1442.69,'Extrato - pro-labore 05/2026'),
         ('PRO_LABORE','2026-06','2026-07-06',1442.69,'Extrato - pro-labore 06/2026'),
         ('PRO_LABORE','2026-07','2026-08-06',1442.69,'Extrato - pro-labore 07/2026'),
         ('PRO_LABORE','2026-08','2026-09-28',2670.00,'Extrato - pro-labore 08/2026'),
         ('PRO_LABORE','2026-09','2026-10-06',2670.00,'Extrato - pro-labore 09/2026'),
         ('PRO_LABORE','2026-10','2026-11-06',2670.00,'Extrato - pro-labore 10/2026'),
         ('ADIANTAMENTO',NULL,'2026-09-28',2300.00,'Adiantamento de pro-labore - liquidar em 2026'),
         ('ADIANTAMENTO',NULL,'2026-10-05',1442.69,'Adiantamento de pro-labore - liquidar em 2026')
 ) AS v(tipo, comp, dt, liq, obs)
WHERE c.tax_id = '17970759000108' AND p.cpf = '65483065972'
  AND NOT EXISTS (SELECT 1 FROM pro_labore_pagamentos x WHERE x.company_id = c.id AND x.person_id = p.id
                  AND x.dt_pagamento = v.dt::date AND x.valor_liquido = v.liq AND x.deleted_at IS NULL);
