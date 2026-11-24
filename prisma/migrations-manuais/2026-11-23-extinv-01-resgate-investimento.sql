-- EXTINV-01 (23/11/2026): resgate de investimento a partir do extrato bancario
do $$
declare t text;
begin
  select ty.typname into t from pg_type ty join pg_enum e on e.enumtypid = ty.oid where e.enumlabel = 'ALREADY_POSTED' limit 1;
  if t is null then raise exception 'EXTINV-01: enum de destino nao encontrado'; end if;
  if not exists (select 1 from pg_enum e join pg_type ty on ty.oid = e.enumtypid where ty.typname = t and e.enumlabel = 'INVEST_REDEMPTION') then
    execute format('alter type %I add value %L', t, 'INVEST_REDEMPTION');
  end if;
end $$;
alter table bank_transactions
  add column if not exists investment_id uuid,
  add column if not exists invest_split jsonb,
  add column if not exists fixed_income_event_id uuid;