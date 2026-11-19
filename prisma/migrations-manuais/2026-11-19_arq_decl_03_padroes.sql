-- ARQ-DECL-03 (19/11/2026): padroes de leitura dos recibos de EFD-Contribuicoes e ECF (PVA/ReceitaNet) e da
-- notificacao de multa da DCTF mensal (traz o recibo, a competencia e a data de entrega). Releitura dos PDFs sem recibo encontrado.
\set ON_ERROR_STOP on
begin;
insert into recibo_padroes (code, nome, detecta, re_recibo, re_cnpj, re_competencia, formato_comp, re_tipo, re_recebido_em, tem_copia_receita)
values
 ('EFD_CONTRIB', 'Recibo de entrega da EFD-Contribuições (PVA)',
  $re$RECIBO\s+DE\s+ENTREGA\s+DE\s+ESCRITURA[ÇC][ÃA]O\s+FISCAL\s+DIGITAL\s*-\s*CONTRIBUI[ÇC][ÕO]ES$re$,
  $re$((?:[0-9A-F]\s*[0-9A-F]\s*\.\s*){19}[0-9A-F]\s*[0-9A-F]\s*-\s*\d)$re$,
  $re$CNPJ:?\s*(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})$re$,
  $re$Per[ií]odo\s+de\s+apura[çc][ãa]o:\s*\d{2}/(\d{2})/(\d{4})$re$, 'MES_ANO',
  $re$Tipo:\s*(Original|Retificadora)$re$,
  $re$em\s+(\d{2})/(\d{2})/(\d{4})\s+[àa]s\s+(\d{2}):(\d{2})(?::(\d{2}))?$re$, true),
 ('ECF', 'Recibo de entrega da ECF (PVA)',
  $re$RECIBO\s+DE\s+ENTREGA\s+DE\s+ESCRITURA[ÇC][ÃA]O\s+FISCAL\s+DIGITAL\s+Imposto\s+de\s+Renda\s+de\s+Pessoa\s+Jur[íi]dica\s*-\s*ECF$re$,
  $re$((?:[0-9A-F]\s*[0-9A-F]\s*\.\s*){19}[0-9A-F]\s*[0-9A-F]\s*-\s*\d)$re$,
  $re$CNPJ:?\s*(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})$re$,
  $re$\d{2}/\d{2}/\d{4}\s+a\s+\d{2}/\d{2}/(\d{4})$re$, 'ANO',
  $re$ECF\s+(Original|Retificadora)$re$,
  $re$em\s+(\d{2})/(\d{2})/(\d{4})\s+[àa]s\s+(\d{2}):(\d{2})(?::(\d{2}))?$re$, true),
 ('DCTF', 'Notificação de multa por atraso da DCTF mensal (traz o recibo)',
  $re$MULTA\s+POR\s+ATRASO\s+NA\s+ENTREGA\s+DA\s+DECLARA[ÇC][ÃA]O\s+DE\s+D[ÉE]BITOS\s+E\s+CR[ÉE]DITOS$re$,
  $re$Recibo\s+de\s+Entrega\s+da\s+Declara[çc][ãa]o:\s*(\d{2}(?:\.\d{2}){4}\s*-\s*\d{2})$re$,
  $re$CNPJ:\s*(\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2})$re$,
  $re$M[êe]s:\s*([A-Za-zÇç]{3})\w*\s+Ano:\s*(\d{4})$re$, 'MESNOME',
  null,
  $re$Data\s+Entrega:\s*(\d{2})/(\d{2})/(\d{4})$re$, true)
on conflict (code, nome) do nothing;

-- PDFs ja lidos sem nenhum recibo encontrado: ler de novo com os padroes novos (na proxima abertura do Dashboard)
update documents set recibo_lido_em = null
 where recibo_lido_em is not null and coalesce(jsonb_array_length(recibo_dados->'recibos'), 0) = 0;
commit;
\echo == padroes de recibo ==
select code, nome, formato_comp from recibo_padroes where ativo order by code, nome;