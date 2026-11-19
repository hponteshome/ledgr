-- PONTES-ESOC-01 (19/11/2026): Pontes Contabilidade (Lucro Presumido) - parametros do eSocial e pro-labore do socio-administrador.
-- S-1000 ja existe no eSocial desde 07/2018 (classTrib 99, natJur 2232): nao e reenviado. Tabelas do LEDGR a partir de 09/2026.
-- Pro-labore R$ 2.000,00 (set e out/2026; pagos por PIX em 01/10 e 05/10, liquido R$ 1.780,00 = bruto - INSS 11%).
\set ON_ERROR_STOP on
begin;
do $$
declare
  emp constant uuid := '632ce73b-5024-4fee-97bb-70d27b0cce51';
  pes constant uuid := '9e42a465-a58c-482b-a48d-75c2c2c4e1b2';   -- Helenilto Aureliano Pontes (CPF 565.240.219-91)
  fk text; sh uuid;
begin
  if exists (select 1 from esocial_s13_config where company_id = emp) then raise exception 'Pontes ja tem configuracao do eSocial - nada alterado'; end if;
  if exists (select 1 from pro_labore_configs where company_id = emp and deleted_at is null) then raise exception 'Pontes ja tem pro-labore configurado - nada alterado'; end if;

  insert into esocial_s13_config (company_id, fpas, cod_tercs, class_trib, cod_lotacao, ide_tab_rubr, ini_valid_s1000)
  values (emp, '515', '0115', '99', '001', 'LEDGR', '2026-09');

  -- socio (shareholder_id): mesma tabela que a José Silva usa, achada pela chave estrangeira; vinculo pela pessoa ou pelo CPF
  select c.confrelid::regclass::text into fk
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'pro_labore_configs'::regclass and c.contype = 'f' and a.attname = 'shareholder_id' limit 1;
  if fk is not null then
    execute format('select t.id from %s t where to_jsonb(t)::text like %L and (to_jsonb(t)::text like %L or to_jsonb(t)::text like %L) limit 1',
                   fk, '%' || emp::text || '%', '%' || pes::text || '%', '%56524021991%') into sh;
  end if;
  raise notice 'socio: tabela %, id %', coalesce(fk, '(sem FK)'), coalesce(sh::text, '(nao encontrado - vincular em Pro-labore > Configurar)');

  insert into pro_labore_configs (company_id, person_id, shareholder_id, cargo, valor_bruto, competencia_ini, competencia_fim, ativo, categoria_esocial, cbo, created_at, updated_at)
  values (emp, pes, sh, 'Sócio-administrador', 2000.00, '2026-09', '2026-12', true, '723', '121010', now(), now());
end $$;
commit;
\echo == Pontes: configuracao do eSocial ==
select fpas, cod_tercs, class_trib, cod_lotacao, ide_tab_rubr, ini_valid_s1000 from esocial_s13_config where company_id = '632ce73b-5024-4fee-97bb-70d27b0cce51';
\echo == Pontes: pro-labore ==
select cargo, valor_bruto, competencia_ini, competencia_fim, categoria_esocial, cbo, shareholder_id is not null as socio_vinculado
  from pro_labore_configs where company_id = '632ce73b-5024-4fee-97bb-70d27b0cce51' and deleted_at is null;