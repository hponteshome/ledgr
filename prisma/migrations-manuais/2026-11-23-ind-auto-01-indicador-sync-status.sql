-- IND-AUTO-01 (23/11/2026): status da atualizacao automatica dos indicadores economicos (SGS/BCB)
create table if not exists indicador_sync_status (
  serie             varchar(20)  primary key,
  codigo_sgs        integer      not null,
  destino           varchar(12)  not null,
  ultimo_dado       varchar(10),
  ultima_execucao   timestamp(6),
  ultimo_sucesso    timestamp(6),
  falhas_seguidas   integer      not null default 0,
  ultimo_erro       text,
  registros_ultima  integer      not null default 0,
  origem_ultima     varchar(20),
  updated_at        timestamp(6) not null default now()
);