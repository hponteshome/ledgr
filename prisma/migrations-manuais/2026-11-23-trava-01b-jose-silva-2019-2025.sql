-- TRAVA-01B (23/11/2026) - Jose Silva Sociedade Individual de Advocacia
-- Pre-condicoes: Diario 10/2019-12/2023 importado (550 lancamentos IMP-DJS*, 1.236 partidas,
-- D = C = 257.449.840,66), nenhuma ABERTURA-2024 ativa e razao = saldos ECD em todas as datas
-- de 31/12/2023 a 31/12/2025. Falhou -> nada e gravado.
-- Trava: competencias de v_de ate 2025-12 gravadas como FECHADO, sem itens e sem lancamentos.
do $$
declare
  v_js   uuid := 'ca9ba513-06ae-4579-b546-ebc457f33452';
  v_de   date := '2019-10-01';
  v_n    int;
  v_it   int;
  v_d    numeric;
  v_c    numeric;
  v_u    text;
  v_dif  int;
  v_ins  int;
begin
  select count(distinct je.id), count(i.id),
         coalesce(sum(case when i.type::text = 'DEBIT' then i.value end), 0),
         coalesce(sum(case when i.type::text = 'CREDIT' then i.value end), 0)
    into v_n, v_it, v_d, v_c
    from journal_entries je join journal_entry_items i on i.journal_entry_id = je.id
   where je.company_id = v_js and je.deleted_at is null and je.reference like 'IMP-DJS%';
  if v_n <> 550 or v_it <> 1236 or v_d <> 257449840.66 or v_c <> 257449840.66 then
    raise exception 'TRAVA-01B: Diario importado nao confere - lancamentos %, partidas %, D %, C %', v_n, v_it, v_d, v_c;
  end if;
  raise notice 'TRAVA-01B: Diario ok - 550 lancamentos, 1.236 partidas, D = C = 257.449.840,66';

  select count(*) into v_n from journal_entries where company_id = v_js and reference = 'ABERTURA-2024' and deleted_at is null;
  if v_n > 0 then raise exception 'TRAVA-01B: existe ABERTURA-2024 ativa - com o Diario ela duplicaria os saldos'; end if;

  with dt as (select distinct ab.reference_date::date d from account_balances ab join chart_of_accounts c on c.id = ab.account_id
              where c.company_id = v_js and ab.reference_date::date >= date '2023-12-31'),
  ecd as (select ab.reference_date::date d, c.code, sum(ab.balance) v from account_balances ab join chart_of_accounts c on c.id = ab.account_id
          where c.company_id = v_js and ab.reference_date::date >= date '2023-12-31' group by 1, 2),
  mov as (select dt.d, c.code, sum(case when i.type::text = 'DEBIT' then i.value else -i.value end) v
          from dt join journal_entries je on je.company_id = v_js and je.deleted_at is null and je.date::date <= dt.d
          join journal_entry_items i on i.journal_entry_id = je.id join chart_of_accounts c on c.id = i.account_id group by 1, 2),
  ks as (select dt.d, k.code from dt cross join (select code from ecd union select code from mov) k)
  select count(*) into v_dif from ks
    left join ecd e on e.d = ks.d and e.code = ks.code left join mov m on m.d = ks.d and m.code = ks.code
   where abs(coalesce(m.v, 0) - coalesce(e.v, 0)) > 0.004;
  if v_dif > 0 then raise exception 'TRAVA-01B: razao x ECD com % diferenca(s) - nada foi travado', v_dif; end if;
  raise notice 'TRAVA-01B: razao = ECD em todas as datas de 31/12/2023 a 31/12/2025';

  select to_jsonb(je)->>'created_by_id' into v_u from journal_entries je
   where je.company_id = v_js and je.reference like 'IMP-DJS%' and je.deleted_at is null limit 1;

  insert into fechamentos_mensais (company_id, competencia, status, fechado_em, fechado_por_id, motivo_reabertura)
  select v_js, to_char(g, 'YYYY-MM'), 'FECHADO'::status_fechamento, now(), nullif(v_u, '')::uuid,
         'Trava geral - periodo coberto pelos livros oficiais (Diario 2019-2023 e ECDs 2024/2025)'
    from generate_series(v_de, date '2025-12-01', interval '1 month') g
  on conflict (company_id, competencia) do update
     set status = excluded.status, fechado_em = excluded.fechado_em, fechado_por_id = excluded.fechado_por_id,
         motivo_reabertura = excluded.motivo_reabertura, updated_at = now()
   where fechamentos_mensais.status not in ('FECHADO', 'FECHADO_PREVIO');
  get diagnostics v_ins = row_count;
  raise notice 'TRAVA-01B: % competencia(s) gravadas como FECHADO', v_ins;
end $$;