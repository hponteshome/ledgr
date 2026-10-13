// frontend/src/pages/projects/workspace/GerarLancamentosCard.tsx
// Gerar lancamentos do Fluxo (13/10/2026), so o Master: candidatos por chave, geracao no Contabil com confirmacao em dois passos e
// estorno com motivo. Nada e excluido: o estorno gera o lancamento inverso pelo proprio Contabil.
import React, { useEffect, useState } from 'react';
import api from '../../../services/api';
import { cardSt } from './projetoTema';

export default function GerarLancamentosCard({ projetoId, rev, onAlterado }: { projetoId: string; rev?: number; onAlterado?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [estornando, setEstornando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const base = `/projects-relatorios/projetos/${projetoId}/fluxo-lancamentos`;
  const carregar = () => api.get(base).then((r) => setD(r.data)).catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar os lançamentos.'));
  useEffect(() => { carregar(); }, [projetoId, rev]);
  const marcar = (k: string) => { setConfirmar(false); setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k])); };
  const gerar = () => {
    setBusy(true); setErro(''); setOk('');
    api.post(`${base}/gerar`, { chaves: sel })
      .then((r) => { setOk(`${(r.data?.gerados || []).length} lançamento(s) gravado(s) no Contábil.`); setSel([]); setConfirmar(false); carregar(); if (onAlterado) onAlterado(); })
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao gerar os lançamentos.'))
      .finally(() => setBusy(false));
  };
  const estornar = (id: string) => {
    setBusy(true); setErro(''); setOk('');
    api.post(`${base}/${id}/estornar`, { motivo })
      .then(() => { setOk('Estorno gravado no Contábil.'); setEstornando(null); setMotivo(''); carregar(); if (onAlterado) onAlterado(); })
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao estornar.'))
      .finally(() => setBusy(false));
  };
  const brl = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fd = (s: any) => String(s || '').slice(0, 10).split('-').reverse().join('/');
  const TD: React.CSSProperties = { padding: '4px 8px', borderTop: '0.5px solid #E5E7EB', verticalAlign: 'top' };
  const btnP: React.CSSProperties = { padding: '5px 12px', fontSize: 12, border: 'none', borderRadius: 7, background: '#1A4A3A', color: '#fff', cursor: 'pointer' };
  const btnS: React.CSSProperties = { padding: '3px 10px', fontSize: 12, border: '0.5px solid #D1D5DB', borderRadius: 6, background: '#fff', color: '#134E4A', cursor: 'pointer' };
  const cand: any[] = d?.candidatos || [];
  const total = cand.filter((c) => sel.includes(c.chave)).reduce((s, c) => s + Number(c.valor), 0);
  return (
    <div style={{ ...cardSt, padding: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F2747' }}>Gerar lançamentos no Contábil</div>
      <div style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 8px' }}>Cada chave grava um lançamento pelo Contábil (referência PROJ-FLUXO-chave), com as contas do mapa. Uma chave só pode estar ativa uma vez; para desfazer, estorno com motivo.</div>
      {erro && <div style={{ fontSize: 12, background: '#FCEBEB', color: '#7F1D1D', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>{erro}</div>}
      {ok && <div style={{ fontSize: 12, background: '#E1F5EE', color: '#085041', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>{ok}</div>}
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead><tr style={{ color: '#6B7280', textAlign: 'left' }}><th style={TD}></th><th style={TD}>Chave</th><th style={TD}>Data</th><th style={TD}>Débito</th><th style={TD}>Crédito</th><th style={{ ...TD, textAlign: 'right' }}>Valor</th><th style={TD}>Situação</th></tr></thead>
        <tbody>{cand.map((c) => (
          <tr key={c.chave} style={{ opacity: c.habilitado || c.gerado ? 1 : 0.55 }}>
            <td style={TD}>{c.habilitado && !c.gerado ? <input type="checkbox" checked={sel.includes(c.chave)} onChange={() => marcar(c.chave)} /> : null}</td>
            <td style={{ ...TD, whiteSpace: 'nowrap' }}>{c.chave}</td>
            <td style={TD}>{fd(c.data)}</td>
            <td style={TD}>{c.debito?.code ? <span><b>{c.debito.code}</b> {c.debito.name}</span> : '-'}</td>
            <td style={TD}>{c.credito?.code ? <span><b>{c.credito.code}</b> {c.credito.name}</span> : '-'}</td>
            <td style={{ ...TD, textAlign: 'right', whiteSpace: 'nowrap' }}>{brl(c.valor)}</td>
            <td style={TD}>{c.gerado
              ? (estornando === c.gerado.id
                ? <span><input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo do estorno" style={{ padding: '3px 8px', fontSize: 12, border: '0.5px solid #D1D5DB', borderRadius: 6, width: 200 }} /> <button disabled={busy || motivo.trim().length < 10} onClick={() => estornar(c.gerado.id)} style={btnS}>Confirmar estorno</button> <button onClick={() => { setEstornando(null); setMotivo(''); }} style={btnS}>Cancelar</button></span>
                : <span style={{ color: '#085041' }}>Gerado em {new Date(c.gerado.criadoEm).toLocaleString('pt-BR')} <button onClick={() => { setEstornando(c.gerado.id); setMotivo(''); }} style={btnS}>Estornar</button></span>)
              : c.habilitado ? <span>Pronto para gerar</span> : <span style={{ color: '#B45309' }}>{c.motivo}</span>}</td>
          </tr>))}</tbody>
      </table>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        {!confirmar
          ? <button disabled={!sel.length || busy} onClick={() => setConfirmar(true)} style={{ ...btnP, opacity: sel.length ? 1 : 0.5 }}>Gerar selecionados ({sel.length})</button>
          : <><span style={{ fontSize: 12, color: '#78350F' }}>Gravar {sel.length} lançamento(s) no Contábil, total {brl(total)}?</span>
             <button disabled={busy} onClick={gerar} style={btnP}>{busy ? 'Gravando...' : 'Confirmar'}</button>
             <button onClick={() => setConfirmar(false)} style={btnS}>Cancelar</button></>}
      </div>
    </div>
  );
}
