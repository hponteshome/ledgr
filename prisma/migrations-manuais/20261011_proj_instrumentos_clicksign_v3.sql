-- prisma/migrations-manuais/20261011_proj_instrumentos_clicksign_v3.sql
-- ClickSign API 3.0 nos instrumentos: canal CLICKSIGN_V3 e ID do documento na ClickSign (necessario para cancelar).
BEGIN;
ALTER TABLE proj_instrumento_envios ADD COLUMN IF NOT EXISTS documento_externo varchar(80);
ALTER TABLE proj_instrumento_envios DROP CONSTRAINT IF EXISTS proj_instrumento_envios_canal_check;
ALTER TABLE proj_instrumento_envios ADD CONSTRAINT proj_instrumento_envios_canal_check CHECK (canal IN ('CLICKSIGN','CLICKSIGN_V3'));
CREATE OR REPLACE FUNCTION proj_instr_envios_validar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.situacao <> 'ENVIADO' THEN RAISE EXCEPTION 'Envio nasce como ENVIADO'; END IF;
    IF NOT EXISTS (SELECT 1 FROM proj_instrumentos i WHERE i.id = NEW.instrumento_id AND i.situacao = 'EM_ASSINATURA') THEN
      RAISE EXCEPTION 'Envio para assinatura so com o instrumento Em assinatura';
    END IF;
    IF NEW.canal = 'CLICKSIGN_V3' AND NEW.documento_externo IS NULL THEN RAISE EXCEPTION 'Envio pela API 3.0 exige o ID do documento'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.instrumento_id IS DISTINCT FROM OLD.instrumento_id OR NEW.versao_id IS DISTINCT FROM OLD.versao_id
     OR NEW.canal IS DISTINCT FROM OLD.canal OR NEW.chave_externa IS DISTINCT FROM OLD.chave_externa
     OR NEW.documento_externo IS DISTINCT FROM OLD.documento_externo
     OR NEW.prazo IS DISTINCT FROM OLD.prazo OR NEW.criado_em IS DISTINCT FROM OLD.criado_em
     OR NEW.criado_por_id IS DISTINCT FROM OLD.criado_por_id THEN
    RAISE EXCEPTION 'Dados do envio sao imutaveis';
  END IF;
  IF OLD.situacao <> 'ENVIADO' THEN RAISE EXCEPTION 'Envio encerrado nao pode ser alterado'; END IF;
  IF NEW.situacao = 'CANCELADO' AND length(trim(coalesce(NEW.motivo_cancelamento, ''))) < 10 THEN
    RAISE EXCEPTION 'Cancelamento do envio exige motivo (minimo 10 caracteres)';
  END IF;
  IF NEW.situacao = 'CONCLUIDO' AND NEW.versao_assinada_id IS NULL THEN
    RAISE EXCEPTION 'Conclusao do envio exige a versao assinada';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
SELECT column_name FROM information_schema.columns WHERE table_name = 'proj_instrumento_envios' AND column_name = 'documento_externo';
