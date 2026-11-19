-- ALERTA-AUTO-01 (19/11/2026): leitura automatica de recibos (PDF) e alertas com regra de baixa
\set ON_ERROR_STOP on
begin;

-- 1. Documento: recibo ja lido (cada PDF e lido uma vez) e o que foi encontrado nele
alter table documents add column if not exists recibo_lido_em timestamp(6);
alter table documents add column if not exists recibo_dados jsonb;

-- 2. Obrigacao: documento (recibo) que deu a baixa
alter table fiscal_obligations add column if not exists document_id uuid;
create index if not exists fiscal_obligations_document_id_idx on fiscal_obligations (document_id);

-- 3. Alerta: condicao que o resolve sozinho (sem regra = manual, como hoje)
alter table company_alerts add column if not exists regra_baixa jsonb;

-- 4. Padroes de leitura de recibo, um por declaracao. Regex (JavaScript) sobre o texto de cada pagina do PDF.
--    re_competencia: ANO -> grupo 1 = ano; MES_ANO -> grupo 1 = mes, grupo 2 = ano.
--    re_recebido_em: grupos dia, mes, ano, hora, minuto, segundo.
create table if not exists recibo_padroes (
  id             uuid primary key default gen_random_uuid(),
  code           varchar(30)  not null,
  nome           varchar(120) not null,
  detecta        text not null,
  re_recibo      text not null,
  re_cnpj        text not null,
  re_competencia text not null,
  formato_comp   varchar(10) not null default 'ANO',
  re_tipo        text,
  re_recebido_em text,
  ativo          boolean not null default true,
  created_at     timestamp(6) not null default now(),
  unique (code, nome)
);

insert into recibo_padroes (code, nome, detecta, re_recibo, re_cnpj, re_competencia, formato_comp, re_tipo, re_recebido_em)
values ('DIMOB', 'Recibo de entrega da DIMOB (ReceitaNet)',
  $re$RECIBO\s+DE\s+ENTREGA\s+DA\s+DIMOB$re$,
  $re$N[uú]mero\s+do\s+Recibo\s+de\s+Entrega:\s*(\d{2}(?:\.\d{2}){4}\s*-\s*\d{2})$re$,
  $re$CNPJ\s+do\s+Declarante:\s*([\d./-]{14,18})$re$,
  $re$Ano-calend[aá]rio:\s*(\d{4})$re$,
  'ANO',
  $re$Tipo\s+de\s+Declara[cç][aã]o:\s*(Original|Retificadora)$re$,
  $re$em\s+(\d{2})/(\d{2})/(\d{4})\s+[àa]s\s+(\d{2}):(\d{2})(?::(\d{2}))?$re$)
on conflict (code, nome) do nothing;

-- 5. Regras de baixa dos alertas calculaveis ja abertos
update company_alerts set regra_baixa = '{"tipo":"obrigacoes","itens":[{"code":"EFD_CONTRIB","competence":"2023-12"}],"descricao":"EFD-Contribuições de dez/2023 retificada e entregue"}'::jsonb
 where id = '973caef3-e924-41e7-8944-91e8b600ac20' and regra_baixa is null;
update company_alerts set regra_baixa = '{"tipo":"lancamentos","data":"2026-01-02","referencias":["AJ-D1","AJ-D2","AJ-D3","AJ-D4","AJ-D5","AJ-D6","AJ-D7","AJ-D8"],"descricao":"ajustes AJ-D1 a AJ-D8 lançados em 02/01/2026"}'::jsonb
 where id = 'b66dcda0-ba6b-44b5-a470-025bc9320e09' and regra_baixa is null;
update company_alerts set regra_baixa = '{"tipo":"esocial_evento","evento":"1200","per_apur":"2025-07","xml_contem":"<codCateg>701</codCateg>","tp_amb":1,"descricao":"S-1200 de 07/2025 (contribuinte individual, cat. 701) aceito em produção"}'::jsonb
 where id = '79298abe-5020-43e4-be7c-4c509a2e035a' and regra_baixa is null;
update company_alerts set regra_baixa = '{"tipo":"obrigacoes","itens":[{"code":"INSS_DARF","competence":"2026-08"}],"descricao":"INSS de 08/2026 pago (obrigação baixada)"}'::jsonb
 where id = '2fc1c5d4-0203-47a6-9f6f-ab2fbc212e49' and regra_baixa is null;

commit;

\echo == padroes de recibo ==
select code, nome, formato_comp, ativo from recibo_padroes order by code;
\echo == alertas abertos e regra de baixa ==
select left(title, 70) as alerta, coalesce(regra_baixa->>'tipo', '(manual)') as regra
  from company_alerts where resolved_at is null order by company_id, created_at;