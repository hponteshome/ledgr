// frontend/src/pages/projects/workspace/ContasFluxoCard.tsx
// Contas do Fluxo (13/10/2026), so o Master: mapa papel -> conta do plano de cada empresa, usado nos cards do Fluxo e na geracao
// dos lancamentos. Cada troca de conta fica no historico (proj_fluxo_contas_hist).
import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { cardSt } from './projetoTema';

export default function ContasFluxoCard({ projetoId, onAlterado }: { projetoId: string; onAlterado?: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [erro, setErro] = useState('');
  const [edit, setEdit] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);
  const carregar = () => api.get(`/projects-relatorios/projetos/${projetoId}/fluxo-contas`).then((r) => setRows(r.data || [])).catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar as contas.'));
  useEffect(() => { carregar(); }, [projetoId]);
  const salvar = (papel: string) => {
    setBusy(true); setErro('');
    api.post(`/projects-relatorios/projetos/${projetoId}/fluxo-contas/${papel}`, { codigo })
      .then((r) => { setRows(r.data || []); setEdit(null); if (onAlterado) onAlterado(); })
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao salvar a conta.'))
      .finally(() => setBusy(false));
  };
  const TD: React.CSSProperties = { padding: '4px 8px', borderTop: '0.5px solid #E5E7EB', verticalAlign: 'top' };
  const btnP: React.CSSProperties = { padding: '3px 10px', fontSize: 12, border: 'none', borderRadius: 6, background: '#1A4A3A', color: '#fff', cursor: 'pointer' };
  const btnS: React.CSSProperties = { padding: '3px 10px', fontSize: 12, border: '0.5px solid #D1D5DB', borderRadius: 6, background: '#fff', color: '#134E4A', cursor: 'pointer' };
  const semConta = rows.filter((r) => !r.code && !r.rotina).length;
  return (
    <div style={{ ...cardSt, padding: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F2747' }}>Contas do projeto (mapa por empresa)</div>
      <div style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 8px' }}>Conta analítica do plano de cada empresa para cada papel do Fluxo. As contas do projeto são exclusivas; as de rotina são indicadas pelo contador. Toda troca de conta fica no histórico.</div>
      {semConta > 0 && <div style={{ fontSize: 12, background: '#FFFBEB', border: '1px solid #FCD34D', color: '#78350F', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>⚠ {semConta} papel(is) sem conta.</div>}
      {erro && <div style={{ fontSize: 12, background: '#FCEBEB', color: '#7F1D1D', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>{erro}</div>}
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: '#6B7280', textAlign: 'left' }}><th style={TD}>Empresa</th><th style={TD}>Papel</th><th style={TD}>Conta</th><th style={{ ...TD, textAlign: 'right' }}>Itens na conta</th><th style={TD}></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.papel}>
            <td style={TD}>{r.empresa}</td>
            <td style={TD}>{r.descricao}{r.rotina ? <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 7px', background: '#EEF2FF', color: '#3730A3', marginLeft: 6 }}>rotina</span> : null}</td>
            <td style={TD}>{edit === r.papel
              ? <input autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código da conta" style={{ padding: '4px 8px', fontSize: 12, border: '0.5px solid #D1D5DB', borderRadius: 6, width: 160 }} />
              : r.code ? <span><b>{r.code}</b> {r.name}</span> : <span style={{ color: '#B45309' }}>{r.rotina ? 'a indicar pelo contador' : 'sem conta'}</span>}</td>
            <td style={{ ...TD, textAlign: 'right' }}>{r.code ? r.itens : '-'}</td>
            <td style={{ ...TD, whiteSpace: 'nowrap' }}>{edit === r.papel
              ? <><button disabled={busy} onClick={() => salvar(r.papel)} style={btnP}>Salvar</button> <button onClick={() => setEdit(null)} style={btnS}>Cancelar</button></>
              : <button onClick={() => { setEdit(r.papel); setCodigo(r.code || ''); setErro(''); }} style={btnS}>Alterar</button>}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
