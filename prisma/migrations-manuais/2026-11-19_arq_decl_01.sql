-- ARQ-DECL-01 (19/11/2026): declaracoes por competencia no Arquivo Digital; .REC/.DEC pelo padrao de nome da Receita;
-- titulos com extensao; remocao de copias identicas (mesmo SHA-256) de arquivos importados.
\set ON_ERROR_STOP on
begin;

-- 1. Padrao do nome dos arquivos da Receita e se ela fornece copia direta (ReceitanetBX); sem copia -> guardar o .DEC
alter table recibo_padroes add column if not exists re_arquivo text;
alter table recibo_padroes add column if not exists tem_copia_receita boolean not null default false;
update recibo_padroes
   set re_arquivo = $re$^(\d{14})-DIMOB-(\d{4})-(ORIGI|RETIF)\.(REC|DEC)$$re$, tem_copia_receita = false
 where code = 'DIMOB';

-- 2. Titulos de .REC/.DEC enviados sem a extensao (antes do ALERTA-AUTO-01)
update documents set title = original_file_name, updated_at = now()
 where deleted_at is null and original_file_name ~* '\.(rec|dec)$'
   and title = regexp_replace(original_file_name, '\.[^.]+$', '');

-- 3. Copias identicas de arquivos importados (Contabil, Fiscal e Trabalhista): fica o mais antigo; nao remove documento ligado a contrato ou imovel
create temp table dup_arq on commit drop as
select d.id, d.company_id, d.title, d.created_at,
       (select k.id from documents k
         where k.company_id = d.company_id and k.content_hash = d.content_hash and k.deleted_at is null and k.file_url is not null
           and (k.created_at, k.id) < (d.created_at, d.id)
         order by k.created_at, k.id limit 1) as manter
  from documents d
 where d.deleted_at is null and d.file_url is not null and d.content_hash is not null and d.content = '[PDF importado]'
   and d.type::text in ('FISCAL', 'CONTABIL', 'TRABALHISTA');
delete from dup_arq where manter is null
   or exists (select 1 from rental_contracts r where r.document_id = dup_arq.id or r.signed_document_id = dup_arq.id)
   or exists (select 1 from asset_documents v where v.document_id = dup_arq.id and v.deleted_at is null);
update fiscal_obligations f set document_id = x.manter from dup_arq x where f.document_id = x.id;
\echo == copias identicas removidas (fica o arquivo mais antigo) ==
select left(title, 60) as documento, to_char(created_at, 'DD/MM/YYYY HH24:MI') as enviado_em from dup_arq order by created_at;
update documents d set deleted_at = now(), updated_at = now() from dup_arq x where d.id = x.id;

commit;

\echo == recibo_padroes ==
select code, re_arquivo, tem_copia_receita from recibo_padroes order by code;