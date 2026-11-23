-- FICHA-CDB-01 (23/11/2026) - Jose Silva: fichas dos 7 CDBs do Banco do Brasil
-- Fontes: Diario Geral 10/2019-12/2023, ECDs 2024/2025 e CDI diario (96% CDI, IOF e IR regressivos).
-- Rendimento bruto = base do IR (ja liquido de IOF). Recebido = principal + rendimento liquido.
do $$
declare
  v_js   uuid := 'ca9ba513-06ae-4579-b546-ebc457f33452';
  v_inv  uuid := 'bc44b359-7174-4182-a52e-086005e829ee';   -- CDB 3600889897272
  v_rec  uuid := '62ddf8ae-0516-4a58-bee6-30f8c6f884bc';   -- 32101010001 Receitas Aplic Financeiras
  v_irrf uuid := '87f33b97-d093-4712-a873-63f68231be88';   -- 11309010010 IRRF a Recuperar
  v_n int; v_p numeric; v_r numeric; v_i numeric; v_y numeric;
begin
  -- 1. datas de aplicacao (Diario e nome da conta; vencimento ja estava certo - prazo de 1.799 dias)
  update fixed_income_investments f set application_date = x.d, updated_at = now()
    from (values ('1600890985631', date '2022-08-11'), ('1500908586930', date '2022-12-20'), ('3600901425272', date '2023-02-01'),
                 ('0500905755609', date '2023-02-10'), ('4500911443590', date '2023-03-13'), ('0100950505802', date '2023-12-27')) x(cdb, d)
   where f.company_id = v_js and f.deleted_at is null and f.description = x.cdb;
  get diagnostics v_n = row_count;
  if v_n <> 6 then raise exception 'FICHA-CDB-01: esperadas 6 datas corrigidas, foram %', v_n; end if;

  -- 2. contas e codigo externo das 7 fichas
  update fixed_income_investments f
     set asset_account_id = f.accounting_account_id, revenue_account_id = v_rec, irrf_account_id = v_irrf,
         external_code = f.description, updated_at = now()
   where f.company_id = v_js and f.deleted_at is null and f.accounting_account_id is not null;
  get diagnostics v_n = row_count;
  if v_n <> 7 then raise exception 'FICHA-CDB-01: esperadas 7 fichas com contas, foram %', v_n; end if;

  -- 3. evento de aplicacao das 7 fichas (so se nao existir)
  insert into fixed_income_events (investment_id, company_id, event_type, event_date, gross_amount, net_amount, irrf_amount, balance_after, notes)
  select f.id, v_js, 'APLICACAO'::fixed_income_event_type, f.application_date, 0, 0, 0, f.capital_initial,
         'Aplicacao inicial - Banco do Brasil (conferido com o Diario)'
    from fixed_income_investments f
   where f.company_id = v_js and f.deleted_at is null
     and not exists (select 1 from fixed_income_events e where e.investment_id = f.id and e.event_type::text = 'APLICACAO');

  -- 4. os 17 resgates do CDB 3600889897272
  update fixed_income_events e
     set redemption_yield = x.bruto, irrf_amount = x.ir, irrf_rate = x.aliq,
         gross_amount = x.principal + x.bruto, net_amount = x.principal + x.liq, redemption_total = x.principal + x.liq,
         notes = 'Conferido - ' || x.fonte
    from (values
    (date '2022-09-01', 209500.00, 1215.31, 272.56, 942.75, 0.2250, 'Diario: rendimento e IR de set/22 (20.426,72 / 4.584,17) rateados pelo CDI'),
    (date '2022-09-06', 1864000.00, 15621.03, 3505.03, 12116.00, 0.2250, 'Diario: rendimento e IR de set/22 (20.426,72 / 4.584,17) rateados pelo CDI'),
    (date '2022-09-16', 7500.00, 95.58, 21.48, 74.10, 0.2250, 'Diario: rendimento e IR de set/22 (20.426,72 / 4.584,17) rateados pelo CDI'),
    (date '2022-09-30', 197500.00, 3494.80, 785.10, 2709.70, 0.2250, 'Diario: rendimento e IR de set/22 (20.426,72 / 4.584,17) rateados pelo CDI'),
    (date '2022-10-10', 5000.00, 103.44, 23.24, 80.20, 0.2250, 'Diario: out/22 (5.123,69 / 1.152,13) rateado pelo CDI'),
    (date '2022-10-31', 181500.00, 5020.25, 1128.89, 3891.36, 0.2250, 'Diario: out/22 (5.123,69 / 1.152,13) rateado pelo CDI'),
    (date '2022-11-10', 38000.00, 1184.84, 266.00, 918.84, 0.2250, 'Diario: nov/22 (1.184,84 / 266,00)'),
    (date '2022-12-01', 206000.00, 7877.52, 1771.68, 6105.84, 0.2250, 'Diario: dez/22 (9.841,10 / 2.213,40) rateado pelo CDI'),
    (date '2022-12-12', 47000.00, 1963.58, 441.72, 1521.86, 0.2250, 'Diario: dez/22 (9.841,10 / 2.213,40) rateado pelo CDI'),
    (date '2023-01-02', 289500.00, 14312.78, 3219.14, 11093.64, 0.2250, 'Diario: 31/03/23 (15.161,20 / 3.409,96) rateado pelo CDI'),
    (date '2023-01-11', 16000.00, 848.42, 190.82, 657.60, 0.2250, 'Diario: 31/03/23 (15.161,20 / 3.409,96) rateado pelo CDI'),
    (date '2023-06-12', 500.00, 53.35, 10.67, 42.68, 0.2000, 'Diario: 30/06/23 (53,35 / 10,67)'),
    (date '2024-07-31', 150000.00, 37476.00, 5619.00, 31857.00, 0.1500, 'ECD 2024 lanc. 11 (valores do banco)'),
    (date '2025-12-01', 143000.00, 66503.58, 9972.82, 56530.76, 0.1500, 'ECD 2025 lanc. 53/54'),
    (date '2025-12-09', 7500.00, 3522.90, 528.30, 2994.60, 0.1500, 'ECD 2025 lanc. 55'),
    (date '2025-12-18', 19000.00, 9028.42, 1353.94, 7674.48, 0.1500, 'ECD 2025 lanc. 57/58'),
    (date '2025-12-30', 192500.00, 92527.05, 13875.40, 78651.65, 0.1500, 'ECD 2025 lanc. 61/65')
    ) x(d, principal, bruto, ir, liq, aliq, fonte)
   where e.investment_id = v_inv and e.event_type::text = 'RESGATE_ANTECIPADO'
     and e.event_date = x.d and e.redemption_principal = x.principal;
  get diagnostics v_n = row_count;
  if v_n <> 17 then raise exception 'FICHA-CDB-01: esperados 17 resgates atualizados, foram % - nada gravado', v_n; end if;

  -- 5. totais da ficha 3600889897272
  select sum(redemption_principal), sum(redemption_total), sum(irrf_amount), sum(redemption_yield)
    into v_p, v_r, v_i, v_y
    from fixed_income_events where investment_id = v_inv and event_type::text = 'RESGATE_ANTECIPADO';
  if v_p <> 3574000.00 or v_r <> 3791863.06 or v_i <> 42985.79 or v_y <> 260848.85 then
    raise exception 'FICHA-CDB-01: totais nao conferem - principal %, recebido %, IR %, bruto % - nada gravado', v_p, v_r, v_i, v_y;
  end if;
  update fixed_income_investments
     set total_redeemed = v_r, total_redeemed_principal = v_p, irrf_accumulated = v_i, updated_at = now()
   where id = v_inv;
  raise notice 'FICHA-CDB-01: ok - 6 datas, 7 fichas com contas, 17 resgates (principal 3.574.000,00 / bruto 260.848,85 / IR 42.985,79 / recebido 3.791.863,06)';
end $$;