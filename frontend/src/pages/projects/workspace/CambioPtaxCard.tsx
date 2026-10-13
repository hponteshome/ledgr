// frontend/src/pages/projects/workspace/CambioPtaxCard.tsx
// Cambio (13/10/2026), so o Master: PTAX do euro gravada no LEDGR (Banco Central, boletim de fechamento, taxa de venda), com data
// e hora da consulta e SHA-256 da resposta. Busca so as datas que faltam; cotacao gravada nao muda.
import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { cardSt, fmtData } from './projetoTema';

export default function CambioPtaxCard({ projetoId }: { projetoId: string }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const carregar = () => api.get(`/projects-relatorios/projetos/${projetoId}/cambio`).then((r) => { setD(r.data); setErro(''); }).catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar o câmbio.'));
  useEffect(() => { carregar(); }, [projetoId]);
  const atualizar = () => {
    setBusy(true);
    api.post(`/projects-relatorios/projetos/${projetoId}/cambio/atualizar`)
      .then(async (r) => { await carregar(); const f = (r.data?.falhas || []) as any[]; if (f.length) setErro(f.map((x) => `${fmtData(x.data)}: ${x.erro}`).join(' · ')); })
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao consultar o Banco Central.'))
      .finally(() => setBusy(false));
  };
  const TD: React.CSSProperties = { padding: '3px 10px', whiteSpace: 'nowrap' };
  const n4 = (x: any) => Number(x).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  return (
    <div style={{ ...cardSt, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#0F2747' }}>Câmbio - PTAX do euro (Banco Central)</div>
        <button disabled={busy} onClick={atualizar} style={{ padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 7, background: '#1A4A3A', color: '#fff', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Consultando...' : 'Atualizar cotações'}</button>
      </div>
      <div style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 8px' }}>Boletim de fechamento, taxa de venda (CPC 02). Fim de semana ou feriado: último fechamento até a data. Cotação gravada não muda; vale a primeira consulta de cada data.</div>
      {erro && <div style={{ fontSize: 12, background: '#FCEBEB', color: '#7F1D1D', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>{erro}</div>}
      {d && d.faltando && d.faltando.length > 0 && <div style={{ fontSize: 12, color: '#78350F', marginBottom: 6 }}>Sem cotação: {d.faltando.map((x: string) => fmtData(x)).join(', ')}</div>}
      {d && (
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: '#6B7280', textAlign: 'left' }}><th style={TD}>Data de referência</th><th style={TD}>Boletim</th><th style={{ ...TD, textAlign: 'right' }}>Venda</th><th style={{ ...TD, textAlign: 'right' }}>Compra</th><th style={TD}>Consultado em</th><th style={TD}>SHA-256 da resposta</th></tr></thead>
          <tbody>{(d.cotacoes || []).map((c: any) => (
            <tr key={c.id} style={{ borderTop: '0.5px solid #E5E7EB' }}>
              <td style={TD}>{fmtData(c.dataReferencia)}</td><td style={TD}>{c.dataHoraBoletim}</td><td style={{ ...TD, textAlign: 'right' }}>{n4(c.taxaVenda)}</td><td style={{ ...TD, textAlign: 'right' }}>{n4(c.taxaCompra)}</td>
              <td style={TD}>{new Date(c.consultadoEm).toLocaleString('pt-BR')}</td><td style={{ ...TD, fontFamily: 'monospace', fontSize: 11 }}>{String(c.sha256).slice(0, 16)}...</td>
            </tr>))}</tbody>
        </table>
      )}
    </div>
  );
}
