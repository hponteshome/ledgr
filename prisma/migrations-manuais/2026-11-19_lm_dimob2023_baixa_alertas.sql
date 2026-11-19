-- DIMOB-BAIXA-01 (19/11/2026): DIMOB 2023 da LM transmitida (original) em 19/11/2026 09:31.
-- Baixa da trava da ECF e do alerta "entregar antes da MIT". Os demais alertas (ajustes AJ-D, Curitiba, caucao) continuam abertos.
\set ON_ERROR_STOP on
begin;
do $$
begin
  if (select count(*) from documents
       where company_id = 'ea4a443c-a351-4243-ae00-e7d70f126d5a'
         and subtipo = 'DIMOB' and title ilike '%DIMOB-2023%') < 1 then
    raise exception 'Documentos da DIMOB 2023 nao encontrados no Arquivo - nada alterado';
  end if;
end $$;
update company_alerts
   set resolved_at = now(),
       resolution_note = 'DIMOB ano-base 2023 transmitida (original) em 19/11/2026 as 09:31, conforme recibo eletronico .REC. Declaracao e recibo arquivados no Arquivo Digital (FISCAL/DIMOB). Multa por atraso: art. 57 da MP 2.158-35 - recolher quando notificada.'
 where id in ('5ddbe1cb-19dc-44ba-92ec-94558fef5c14', '822e99c0-e247-401c-831b-fea4a9881311')
   and resolved_at is null;
commit;
\echo == alertas baixados ==
select left(title,70) as title, resolved_at from company_alerts
 where id in ('5ddbe1cb-19dc-44ba-92ec-94558fef5c14', '822e99c0-e247-401c-831b-fea4a9881311');
\echo == colunas de documents ==
select column_name, data_type from information_schema.columns where table_name = 'documents' order by ordinal_position;
\echo == colunas de agenda_events ==
select column_name, data_type from information_schema.columns where table_name = 'agenda_events' order by ordinal_position;
\echo == eventos de DIMOB na agenda (todas as empresas) ==
select to_jsonb(a) from agenda_events a where to_jsonb(a)::text ilike '%dimob%' limit 10;