-- prisma/migrations-manuais/20261003_proj_1_6b_vinculos.sql
-- Fase 1.6b - vinculo do credito a Conta Individual do Adquirente, com historico imutavel.
-- O credito e o fato bancario (intocado); o vinculo e a interpretacao que a auditoria pode rever:
-- vincular, alterar (encerra o atual e cria outro) ou desvincular (credito de coisa diversa da operacao).
BEGIN;
CREATE TABLE IF NOT EXISTS proj_credito_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credito_id uuid NOT NULL REFERENCES proj_creditos(id),
  situacao varchar(15) NOT NULL CHECK (situacao IN ('VINCULADO', 'DESVINCULADO')),
  adquirente_id uuid REFERENCES proj_contrapartes(id),
  motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por_id uuid,
  cancelado_em timestamp(6),
  cancelado_por_id uuid,
  motivo_cancelamento text,
  CONSTRAINT proj_credito_vinculos_situacao_ck CHECK ((situacao = 'VINCULADO' AND adquirente_id IS NOT NULL) OR (situacao = 'DESVINCULADO' AND adquirente_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS proj_credito_vinculos_vigente_uq ON proj_credito_vinculos (credito_id) WHERE cancelado_em IS NULL;
CREATE INDEX IF NOT EXISTS proj_credito_vinculos_adquirente_id_idx ON proj_credito_vinculos (adquirente_id);

CREATE OR REPLACE FUNCTION proj_credito_vinculos_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.adquirente_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM proj_creditos c
      JOIN proj_participacoes pp ON pp.operacao_id = c.operacao_id
      JOIN proj_papeis pa ON pa.id = pp.papel_id
      WHERE c.id = NEW.credito_id AND pp.contraparte_id = NEW.adquirente_id AND pa.codigo = 'ADQUIRENTE' AND pp.cancelado_em IS NULL
    ) THEN
      RAISE EXCEPTION 'O titular do vinculo precisa ser Adquirente da operacao do credito';
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: o vinculo e imutavel; so pode ser encerrado, uma unica vez, com motivo
  IF OLD.cancelado_em IS NOT NULL OR NEW.cancelado_em IS NULL
     OR NEW.credito_id IS DISTINCT FROM OLD.credito_id OR NEW.situacao IS DISTINCT FROM OLD.situacao
     OR NEW.adquirente_id IS DISTINCT FROM OLD.adquirente_id OR NEW.motivo IS DISTINCT FROM OLD.motivo
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Vinculo de credito e imutavel: so pode ser encerrado, com motivo';
  END IF;
  IF NEW.motivo_cancelamento IS NULL OR length(trim(NEW.motivo_cancelamento)) < 10 THEN
    RAISE EXCEPTION 'Encerramento de vinculo exige motivo (minimo 10 caracteres)';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_credito_vinculos_validar_trg ON proj_credito_vinculos;
CREATE TRIGGER proj_credito_vinculos_validar_trg BEFORE INSERT OR UPDATE ON proj_credito_vinculos FOR EACH ROW EXECUTE FUNCTION proj_credito_vinculos_validar();

ALTER TABLE proj_credito_vinculos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_credito_vinculos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_credito_vinculos_ler ON proj_credito_vinculos;
DROP POLICY IF EXISTS proj_credito_vinculos_inserir ON proj_credito_vinculos;
DROP POLICY IF EXISTS proj_credito_vinculos_encerrar ON proj_credito_vinculos;
CREATE POLICY proj_credito_vinculos_ler ON proj_credito_vinculos FOR SELECT USING (EXISTS (SELECT 1 FROM proj_creditos c WHERE c.id = credito_id));
CREATE POLICY proj_credito_vinculos_inserir ON proj_credito_vinculos FOR INSERT WITH CHECK (proj_ctx_master());
CREATE POLICY proj_credito_vinculos_encerrar ON proj_credito_vinculos FOR UPDATE USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
-- sem politica de DELETE e sem o privilegio: apagar vinculo e negado
REVOKE DELETE, TRUNCATE ON proj_credito_vinculos FROM ledgr_api;

INSERT INTO proj_credito_vinculos (credito_id, situacao, adquirente_id, motivo, criado_por_id)
SELECT c.id, 'VINCULADO', adq.contraparte_id,
       'Vinculo inicial (03/10/2026): credito de terceiro em favor do Adquirente Ancora, conforme decisao do Hpontes', hp.id
FROM proj_creditos c
JOIN proj_operacoes o ON o.id = c.operacao_id AND o.codigo = 'ANCORA'
JOIN (SELECT pp.operacao_id, pp.contraparte_id FROM proj_participacoes pp JOIN proj_papeis pa ON pa.id = pp.papel_id
      WHERE pa.codigo = 'ADQUIRENTE' AND pp.cancelado_em IS NULL) adq ON adq.operacao_id = c.operacao_id
CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE c.cancelado_em IS NULL AND NOT EXISTS (SELECT 1 FROM proj_credito_vinculos v WHERE v.credito_id = c.id);

INSERT INTO audit_logs (actor_id, acao, target_id, depois)
SELECT hp.id, 'PROJ_CREDITOS_VINCULADOS', o.id::text,
       jsonb_build_object('adquirente', 'VAL INVESTIMENTOS S/A', 'vinculos_vigentes', (SELECT count(*) FROM proj_credito_vinculos WHERE cancelado_em IS NULL), 'item', 'Fase 1.6b')
FROM proj_operacoes o CROSS JOIN (SELECT id FROM users WHERE email = 'hpontes@ledgr.com') hp
WHERE o.codigo = 'ANCORA' AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.acao = 'PROJ_CREDITOS_VINCULADOS' AND a.target_id = o.id::text);
COMMIT;
SELECT v.situacao, ct.nome AS titular, count(*) AS creditos, sum(c.valor) AS total
FROM proj_credito_vinculos v JOIN proj_creditos c ON c.id = v.credito_id LEFT JOIN proj_contrapartes ct ON ct.id = v.adquirente_id
WHERE v.cancelado_em IS NULL GROUP BY 1, 2;