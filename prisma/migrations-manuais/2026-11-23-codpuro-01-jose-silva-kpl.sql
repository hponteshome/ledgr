-- prisma/migrations-manuais/2026-11-23-codpuro-01-jose-silva-kpl.sql
-- CODPURO-01 (23/11/2026) - Regra: codigo de conta contabil sempre puro (so digitos); mascara so na exibicao.
-- Jose Silva: unifica os pares nativa (codigo puro, lancamentos/saldos/vinculos da ECD 2025) x Matriz (com ponto,
--   reduzido): referencias da nativa passam para a Matriz (Regra 13), sped_code da nativa copiado se a Matriz nao tiver,
--   nativa soft-delete, codigo da Matriz vira puro.
-- Kipstone: remove os pontos dos codigos (sem colisao, sem lancamentos).
-- Conferencia: por codigo puro, quantidade + hash das linhas (sem a coluna da conta) antes = depois; senao, excecao (rollback).
BEGIN;
SET client_encoding = 'UTF8';

CREATE TEMP TABLE cp_emp (id uuid) ON COMMIT DROP;
INSERT INTO cp_emp VALUES ('ca9ba513-06ae-4579-b546-ebc457f33452'), ('7100666c-1e74-4480-b533-4675ea90a774');

CREATE TEMP TABLE cp_par ON COMMIT DROP AS
  SELECT a.id AS mat_id, b.id AS nat_id
  FROM chart_of_accounts a
  JOIN chart_of_accounts b ON b.company_id = a.company_id AND b.id <> a.id
   AND replace(a.code, '.', '') = b.code AND b.code NOT LIKE '%.%'
  WHERE a.company_id IN (SELECT id FROM cp_emp) AND a.code LIKE '%.%'
    AND a.deleted_at IS NULL AND b.deleted_at IS NULL;

CREATE TEMP TABLE cp_foto_antes ON COMMIT DROP AS
  SELECT 'lancamentos' AS tab, c.company_id, replace(c.code, '.', '') AS pc, count(*) AS n,
         md5(string_agg(md5((to_jsonb(x) - 'account_id')::text), ',' ORDER BY md5((to_jsonb(x) - 'account_id')::text))) AS h
  FROM journal_entry_items x JOIN chart_of_accounts c ON c.id = x.account_id
  WHERE c.company_id IN (SELECT id FROM cp_emp) GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'saldos', c.company_id, replace(c.code, '.', ''), count(*),
         md5(string_agg(md5((to_jsonb(x) - 'account_id')::text), ',' ORDER BY md5((to_jsonb(x) - 'account_id')::text)))
  FROM account_balances x JOIN chart_of_accounts c ON c.id = x.account_id
  WHERE c.company_id IN (SELECT id FROM cp_emp) GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'vinculos_ecd', c.company_id, replace(c.code, '.', ''), count(*),
         md5(string_agg(md5((to_jsonb(x) - 'account_id')::text), ',' ORDER BY md5((to_jsonb(x) - 'account_id')::text)))
  FROM chart_of_accounts_ecd_imports x JOIN chart_of_accounts c ON c.id = x.account_id
  WHERE c.company_id IN (SELECT id FROM cp_emp) GROUP BY 1, 2, 3;

DO $$
DECLARE r record; n bigint; total bigint := 0;
BEGIN
  RAISE NOTICE 'pares nativa x Matriz: %', (SELECT count(*) FROM cp_par);
  FOR r IN (
    SELECT DISTINCT kcu.table_name::text AS t, kcu.column_name::text AS c
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'chart_of_accounts' AND tc.table_schema = 'public'
    UNION
    SELECT table_name::text, column_name::text
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'uuid' AND column_name ILIKE '%account%id%' AND table_name <> 'chart_of_accounts'
  ) LOOP
    EXECUTE format('UPDATE %I x SET %I = p.mat_id FROM cp_par p WHERE x.%I = p.nat_id', r.t, r.c, r.c);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE 'repontado % . % : %', r.t, r.c, n; END IF;
    total := total + n;
  END LOOP;
  RAISE NOTICE 'total de referencias repontadas: %', total;
END $$;

UPDATE chart_of_accounts m SET sped_code = n.sped_code
  FROM cp_par p JOIN chart_of_accounts n ON n.id = p.nat_id
  WHERE m.id = p.mat_id AND m.sped_code IS NULL AND n.sped_code IS NOT NULL;

UPDATE chart_of_accounts SET deleted_at = now(), is_active = false WHERE id IN (SELECT nat_id FROM cp_par);

UPDATE chart_of_accounts SET code = replace(code, '.', ''), updated_at = now()
  WHERE company_id IN (SELECT id FROM cp_emp) AND code LIKE '%.%';

CREATE TEMP TABLE cp_foto_depois ON COMMIT DROP AS
  SELECT 'lancamentos' AS tab, c.company_id, replace(c.code, '.', '') AS pc, count(*) AS n,
         md5(string_agg(md5((to_jsonb(x) - 'account_id')::text), ',' ORDER BY md5((to_jsonb(x) - 'account_id')::text))) AS h
  FROM journal_entry_items x JOIN chart_of_accounts c ON c.id = x.account_id
  WHERE c.company_id IN (SELECT id FROM cp_emp) GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'saldos', c.company_id, replace(c.code, '.', ''), count(*),
         md5(string_agg(md5((to_jsonb(x) - 'account_id')::text), ',' ORDER BY md5((to_jsonb(x) - 'account_id')::text)))
  FROM account_balances x JOIN chart_of_accounts c ON c.id = x.account_id
  WHERE c.company_id IN (SELECT id FROM cp_emp) GROUP BY 1, 2, 3
  UNION ALL
  SELECT 'vinculos_ecd', c.company_id, replace(c.code, '.', ''), count(*),
         md5(string_agg(md5((to_jsonb(x) - 'account_id')::text), ',' ORDER BY md5((to_jsonb(x) - 'account_id')::text)))
  FROM chart_of_accounts_ecd_imports x JOIN chart_of_accounts c ON c.id = x.account_id
  WHERE c.company_id IN (SELECT id FROM cp_emp) GROUP BY 1, 2, 3;

DO $$
DECLARE d bigint; dup bigint;
BEGIN
  SELECT count(*) INTO d FROM (
    (SELECT * FROM cp_foto_antes EXCEPT SELECT * FROM cp_foto_depois)
    UNION ALL
    (SELECT * FROM cp_foto_depois EXCEPT SELECT * FROM cp_foto_antes)) z;
  IF d > 0 THEN RAISE EXCEPTION 'CODPURO-01: conferencia falhou (% grupos diferentes) - nada foi gravado', d; END IF;
  IF EXISTS (SELECT 1 FROM chart_of_accounts WHERE company_id IN (SELECT id FROM cp_emp) AND code LIKE '%.%') THEN
    RAISE EXCEPTION 'CODPURO-01: ainda ha codigo com ponto - nada foi gravado';
  END IF;
  SELECT count(*) INTO dup FROM (SELECT company_id, code FROM chart_of_accounts
    WHERE company_id IN (SELECT id FROM cp_emp) AND deleted_at IS NULL GROUP BY 1, 2 HAVING count(*) > 1) z;
  IF dup > 0 THEN RAISE EXCEPTION 'CODPURO-01: % codigos ativos duplicados - nada foi gravado', dup; END IF;
  RAISE NOTICE 'CODPURO-01: conferencia OK (lancamentos, saldos e vinculos ECD identicos por codigo puro)';
END $$;

COMMIT;