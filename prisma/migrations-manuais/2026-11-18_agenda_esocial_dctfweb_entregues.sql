UPDATE fiscal_obligations fo
SET status = 'DONE',
    delivered_at = COALESCE(fo.delivered_at, now()),
    receipt_number = CASE WHEN fo.code = 'ESOCIAL' THEN ev.nr_recibo ELSE fo.receipt_number END,
    notes = CASE WHEN fo.code = 'DCTFWEB'
                 THEN 'Transmitida automaticamente pelo eSocial no fechamento (S-1299 recibo ' || ev.nr_recibo || ')'
                 ELSE 'Fechamento eSocial (S-1299) processado - recibo ' || ev.nr_recibo END
FROM esocial_s13_eventos ev
WHERE fo.company_id = ev.company_id AND ev.tp_amb = 1 AND ev.tipo = 'S-1299' AND ev.status = 'PROCESSADO'
  AND fo.code IN ('ESOCIAL', 'DCTFWEB')
  AND regexp_replace(fo.competence, '^(\d{2})/(\d{4})$', '\2-\1') = ev.per_apur;