-- prisma/migrations-manuais/20261009_proj_anexo_v_e_anexo_i.sql
-- Anexo V (18 credores da cl. 2.A.2 da confissao de 31/10/2025), vinculo aplicacao -> item do Anexo V e
-- Anexo I (58 aportes da VAL, planilha do Nei). So Master; imutaveis; vinculo so encerra com motivo.
\set ON_ERROR_STOP on
BEGIN;
DO $$ DECLARE n int; BEGIN
  SELECT count(DISTINCT operacao_id) INTO n FROM proj_creditos WHERE cancelado_em IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'Esperava 1 operacao com creditos vigentes, achei %', n; END IF;
END $$;

CREATE TABLE IF NOT EXISTS proj_anexo_v_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  ordem int NOT NULL, credor varchar(160) NOT NULL, valor_face numeric(18,2) NOT NULL CHECK (valor_face > 0),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (operacao_id, ordem));
CREATE TABLE IF NOT EXISTS proj_anexo_i_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operacao_id uuid NOT NULL REFERENCES proj_operacoes(id),
  numero int NOT NULL, data date NOT NULL, remetente varchar(200) NOT NULL, forma varchar(60), valor numeric(18,2) NOT NULL CHECK (valor > 0),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (operacao_id, numero));
CREATE TABLE IF NOT EXISTS proj_aplicacao_anexo_v (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), aplicacao_id uuid NOT NULL REFERENCES proj_aplicacoes(id),
  item_id uuid REFERENCES proj_anexo_v_itens(id), fora_anexo boolean NOT NULL DEFAULT false,
  consta_reconciliacao varchar(3) CHECK (consta_reconciliacao IN ('Sim', 'Não')),
  motivo text NOT NULL CHECK (length(trim(motivo)) >= 10),
  criado_em timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, criado_por_id uuid,
  cancelado_em timestamp(6), cancelado_por_id uuid, motivo_cancelamento text,
  CONSTRAINT proj_aplicacao_anexo_v_destino_ck CHECK ((fora_anexo AND item_id IS NULL) OR (NOT fora_anexo AND item_id IS NOT NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS proj_aplicacao_anexo_v_vigente_uq ON proj_aplicacao_anexo_v (aplicacao_id) WHERE cancelado_em IS NULL;

CREATE OR REPLACE FUNCTION proj_anexos_imutavel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Anexo: registro imutavel'; END $$;
DROP TRIGGER IF EXISTS proj_anexo_v_itens_imutavel_trg ON proj_anexo_v_itens;
CREATE TRIGGER proj_anexo_v_itens_imutavel_trg BEFORE UPDATE ON proj_anexo_v_itens FOR EACH ROW EXECUTE FUNCTION proj_anexos_imutavel();
DROP TRIGGER IF EXISTS proj_anexo_i_imutavel_trg ON proj_anexo_i_lancamentos;
CREATE TRIGGER proj_anexo_i_imutavel_trg BEFORE UPDATE ON proj_anexo_i_lancamentos FOR EACH ROW EXECUTE FUNCTION proj_anexos_imutavel();

CREATE OR REPLACE FUNCTION proj_aplicacao_anexo_v_validar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a record; i record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.cancelado_em IS NOT NULL OR ROW(NEW.aplicacao_id, NEW.item_id, NEW.fora_anexo, NEW.consta_reconciliacao, NEW.motivo)
       IS DISTINCT FROM ROW(OLD.aplicacao_id, OLD.item_id, OLD.fora_anexo, OLD.consta_reconciliacao, OLD.motivo) THEN
      RAISE EXCEPTION 'Anexo V: o vinculo e imutavel; so pode ser encerrado (com motivo)'; END IF;
    IF NEW.cancelado_em IS NOT NULL AND COALESCE(length(trim(NEW.motivo_cancelamento)), 0) < 10 THEN
      RAISE EXCEPTION 'Anexo V: o encerramento do vinculo exige motivo'; END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO a FROM proj_aplicacoes WHERE id = NEW.aplicacao_id;
  IF a.id IS NULL OR a.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Anexo V: a aplicacao precisa estar vigente'; END IF;
  IF NEW.item_id IS NOT NULL THEN
    SELECT * INTO i FROM proj_anexo_v_itens WHERE id = NEW.item_id;
    IF i.operacao_id <> a.operacao_id THEN RAISE EXCEPTION 'Anexo V: item e aplicacao precisam ser da mesma operacao'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS proj_aplicacao_anexo_v_validar_trg ON proj_aplicacao_anexo_v;
CREATE TRIGGER proj_aplicacao_anexo_v_validar_trg BEFORE INSERT OR UPDATE ON proj_aplicacao_anexo_v FOR EACH ROW EXECUTE FUNCTION proj_aplicacao_anexo_v_validar();

INSERT INTO proj_anexo_v_itens (operacao_id, ordem, credor, valor_face)
SELECT (SELECT DISTINCT operacao_id FROM proj_creditos WHERE cancelado_em IS NULL), v.* FROM (VALUES
 (1,'Dívidas Bancárias - Crefipar',17000000.00),(2,'Ação Trabalhista Josi',1778310.00),(3,'Banco Máxima',2800000.00),
 (4,'Outras Trabalhista Demais',6272441.00),(5,'Impostos Federais',8320898.00),(6,'Impostos Municipais',7200000.00),
 (7,'Confissão de Dívida Advogado Fernando Galvão',3000000.00),(8,'Tempo de Trabalho Josi 07/2019 à 04/24',934080.00),
 (9,'Aportes 2018 - Avia Sports',3720722.00),(10,'Ação Natal - Escandinavos',1400000.00),(11,'Escritório Contabilidade',70000.00),
 (12,'Contador Diego',18000.00),(13,'Lauro Advogado',289000.00),(14,'Paulo Gouveia',50000.00),(15,'Prime Yeld - Avaliação',15000.00),
 (16,'Paulo Bonadie',250000.00),(17,'Victor Paes Barreto',100000.00),(18,'Fornecedores Diversos',1200000.00)
) AS v(ordem, credor, valor_face)
ON CONFLICT (operacao_id, ordem) DO NOTHING;

INSERT INTO proj_anexo_i_lancamentos (operacao_id, numero, data, remetente, forma, valor)
SELECT (SELECT DISTINCT operacao_id FROM proj_creditos WHERE cancelado_em IS NULL), v.numero, v.data::date, v.remetente, v.forma, v.valor FROM (VALUES
(1,'2024-08-05','CARLOS JOSE BRITO ALVES','TED',10000.00),
(2,'2024-08-06','ELIANE DE ALMEIDA','TED',140000.00),
(3,'2024-08-30','ROMEU FRANCIOSI','SISPAG ROMEU',360000.00),
(4,'2024-09-20','JJ2 COBRANCA E','TED 274.JJ2 C E I',32000.00),
(5,'2024-10-14','MARIA MANUELA DE ARAUJO','TED',20000.00),
(6,'2024-10-14','MARIA MANUELA DE ARAUJO','TED',10000.00),
(7,'2024-10-16','MARIA MANUELA DE ARAUJO','TED',30000.00),
(8,'2024-10-17','MARIA MANUELA DE ARAUJO','TED',29827.00),
(9,'2024-10-22','MARIA MANUELA DE ARAUJO','TED',100000.00),
(10,'2024-10-22','MARIA MANUELA DE ARAUJO','TED',4829.00),
(11,'2024-10-22','MARIA MANUELA DE ARAUJO','TED',8400.00),
(12,'2024-10-24','RAFAEL MESQUITA BARROS','PIX TRANSF RAFAEL',45000.00),
(13,'2024-10-25','CELSO RAMALHOSO','TBI 3751.08232-6',19843.74),
(14,'2024-10-25','UEFA COMERCIAL LTDA EPP','TED 237.0132.UEFA',24160.00),
(15,'2024-10-25','CELSO RAMALHOSO','TED',22142.06),
(16,'2024-10-25','(sem remetente identificado)','DEP DISP CX AG',2554.20),
(17,'2024-10-29','T3 PAGAMENTOS LTDA','TED 001.2414.T3 P',94000.00),
(18,'2024-12-03','J.A.A.H. EMPREENDIMENTOS','PIX TRANSF',208706.41),
(19,'2024-12-13','J.A.A.H. EMPREENDIMENTOS','PIX TRANSF',100000.00),
(20,'2024-12-16','CARLOS HENRIQUE BEZERRA','PIX TRANSF CARLOS',200.00),
(21,'2025-01-10','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',255349.00),
(22,'2025-01-10','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',10500.00),
(23,'2025-02-13','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',208904.55),
(24,'2025-02-26','CARLOS HENRIQUE BEZERRA','ENTRADA PIX',10.00),
(25,'2025-02-27','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',24000.00),
(26,'2025-03-10','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',209000.00),
(27,'2025-04-03','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',25000.00),
(28,'2025-04-10','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',209000.00),
(29,'2025-05-02','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',25000.00),
(30,'2025-05-13','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',208893.45),
(31,'2025-05-29','CINESE EVENTOS','ENTRADA PIX',11872.02),
(32,'2025-05-29','CINESE EVENTOS E VIAGENS','ENTRADA PIX',6184.59),
(33,'2025-05-29','CARLOS HENRIQUE BEZERRA','ENTRADA PIX',8935.13),
(34,'2025-06-02','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',70500.00),
(35,'2025-06-04','MARYA ALLICE SILVA','ENTRADA PIX',13314.43),
(36,'2025-06-05','LEANDRO CORDEIRO DE','ENTRADA PIX',11685.57),
(37,'2025-06-25','JOSE APARECIDO GRANJA','ENTRADA PIX',57000.00),
(38,'2025-06-25','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',152000.00),
(39,'2025-06-30','CINESE EVENTOS E VIAGENS','ENTRADA PIX',8000.00),
(40,'2025-07-04','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',25000.00),
(41,'2025-07-09','(sem remetente identificado)','SISPAG',36000.00),
(42,'2025-07-09','(sem remetente identificado)','SISPAG',30000.00),
(43,'2025-07-11','CINESE EVENTOS','ENTRADA PIX',1408.37),
(44,'2025-07-11','CINESE EVENTOS E VIAGENS','ENTRADA PIX',689.86),
(45,'2025-07-11','CARLOS HENRIQUE BEZERRA','ENTRADA PIX',3000.00),
(46,'2025-07-11','CARLOS HENRIQUE BEZERRA','ENTRADA PIX',10901.77),
(47,'2025-07-30','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',210000.00),
(48,'2025-08-05','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',25000.00),
(49,'2025-09-05','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',9000.00),
(50,'2025-09-08','ENAC EMPREENDIMENTO','ENTRADA PIX',16000.00),
(51,'2025-10-06','FRANCISCA A A DE SA LTDA','ENTRADA PIX',20000.00),
(52,'2025-10-06','FRANCISCA AUREA ARAUJO','ENTRADA PIX',7000.00),
(53,'2025-11-05','GIOVANNI DUCCESCHI','ENTRADA PIX',25280.00),
(54,'2025-11-18','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',61500.00),
(55,'2025-12-02','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',28200.00),
(56,'2025-12-05','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',106500.00),
(57,'2025-12-19','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',53500.00),
(58,'2025-12-23','J.A.A.H. EMPREENDIMENTOS','ENTRADA PIX',50000.00)
) AS v(numero, data, remetente, forma, valor)
ON CONFLICT (operacao_id, numero) DO NOTHING;

ALTER TABLE proj_anexo_v_itens ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_anexo_v_itens FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_anexo_i_lancamentos ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_anexo_i_lancamentos FORCE ROW LEVEL SECURITY;
ALTER TABLE proj_aplicacao_anexo_v ENABLE ROW LEVEL SECURITY; ALTER TABLE proj_aplicacao_anexo_v FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proj_anexo_v_itens_master ON proj_anexo_v_itens;
DROP POLICY IF EXISTS proj_anexo_i_master ON proj_anexo_i_lancamentos;
DROP POLICY IF EXISTS proj_aplicacao_anexo_v_master ON proj_aplicacao_anexo_v;
CREATE POLICY proj_anexo_v_itens_master ON proj_anexo_v_itens FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
CREATE POLICY proj_anexo_i_master ON proj_anexo_i_lancamentos FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
CREATE POLICY proj_aplicacao_anexo_v_master ON proj_aplicacao_anexo_v FOR ALL USING (proj_ctx_master()) WITH CHECK (proj_ctx_master());
GRANT SELECT ON proj_anexo_v_itens, proj_anexo_i_lancamentos TO ledgr_api;
GRANT SELECT, INSERT, UPDATE ON proj_aplicacao_anexo_v TO ledgr_api;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON proj_anexo_v_itens, proj_anexo_i_lancamentos FROM ledgr_api;
REVOKE DELETE, TRUNCATE ON proj_aplicacao_anexo_v FROM ledgr_api;
COMMIT;