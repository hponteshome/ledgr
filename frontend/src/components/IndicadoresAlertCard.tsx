// frontend/src/components/IndicadoresAlertCard.tsx
// NOVO 23/11/2026 (IND-AUTO-02): aviso do Dashboard para indicadores economicos com falha na atualizacao
// automatica ou indisponiveis/atrasados (GET /indicadores-sync/status). Some quando tudo esta em dia.
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiRefreshCw, FiChevronRight } from 'react-icons/fi';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

type Serie = {
  serie: string; descricao: string; codigoSgs: number; ultimoDado: string | null; esperado: string;
  situacao: 'OK' | 'ATRASADO' | 'ERRO'; mensagem: string; ultimaExecucao: string | null; ultimoSucesso: string | null;
};
type Status = { hoje: string; executando: boolean; series: Serie[]; alertas: Serie[] };

const COR = {
  ERRO:     { bg: '#FEE2E2', fg: '#991B1B', dot: '#EF4444', borda: '#FECACA', txt: 'Erro' },
  ATRASADO: { bg: '#FEF3C7', fg: '#92400E', dot: '#F59E0B', borda: '#FCD34D', txt: 'Atrasado' },
};
const fmtHora = (s: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
const pill = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 9999,
  fontSize: 11, fontWeight: 500, background: bg, color, whiteSpace: 'nowrap',
});

function cabecalhos() {
  const token = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (company?.id) h['x-company-id'] = company.id;
  return h;
}

export const IndicadoresAlertCard: React.FC<{ refreshKey?: unknown }> = ({ refreshKey }) => {
  const navigate = useNavigate();
  const [st, setSt] = useState<Status | null>(null);
  const [rodando, setRodando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = useCallback(() => {
    fetch(`${API}/indicadores-sync/status`, { headers: cabecalhos() })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: Status) => setSt(d))
      .catch(() => setSt(null));
  }, []);

  useEffect(() => { carregar(); }, [carregar, refreshKey]);

  const atualizar = async () => {
    setRodando(true); setMsg('');
    try {
      const r = await fetch(`${API}/indicadores-sync/executar`, { method: 'POST', headers: cabecalhos() });
      if (r.status === 403) setMsg('Somente o usuário Master pode disparar a atualização.');
      else if (!r.ok) setMsg('Não foi possível executar a atualização agora.');
      else {
        const d = await r.json();
        const falhas = (d?.resultados ?? []).filter((x: any) => !x.ok).length;
        setMsg(d?.mensagem ?? (falhas ? `${falhas} série(s) ainda com falha.` : 'Atualização concluída.'));
      }
    } catch { setMsg('Não foi possível executar a atualização agora.'); }
    setRodando(false);
    carregar();
  };

  if (!st || st.alertas.length === 0) return null;
  const erros = st.alertas.filter(a => a.situacao === 'ERRO').length;
  const atrasos = st.alertas.length - erros;
  const tom = erros ? COR.ERRO : COR.ATRASADO;
  const ultimaExec = st.series.map(s => s.ultimaExecucao).filter(Boolean).sort().pop() ?? null;

  return (
    <div style={{ margin: '0.75rem 0 8px' }}>
      <div style={{ background: '#fff', border: `0.5px solid ${tom.borda}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem', background: tom.bg, borderBottom: `0.5px solid ${tom.borda}`, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: tom.fg }}>
            <FiAlertTriangle size={14} /> Indicadores econômicos
            <span style={{ fontSize: 11, fontWeight: 400 }}>
              ({erros ? `${erros} com erro` : ''}{erros && atrasos ? ' · ' : ''}{atrasos ? `${atrasos} indisponíve${atrasos > 1 ? 'is' : 'l'}` : ''})
            </span>
          </div>
          <button onClick={atualizar} disabled={rodando}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: '#fff', border: `0.5px solid ${tom.borda}`, fontSize: 12, color: tom.fg, cursor: rodando ? 'wait' : 'pointer' }}>
            <FiRefreshCw size={12} style={{ animation: rodando ? 'spin 1s linear infinite' : 'none' }} />
            {rodando ? 'Atualizando...' : 'Atualizar agora'}
          </button>
        </div>
        {st.alertas.map((a, i) => {
          const c = COR[a.situacao as 'ERRO' | 'ATRASADO'];
          const destino = a.serie === 'CDI_DIARIO' ? '/app/accounting/investimentos/cdi' : '/app/sistema/indicadores';
          return (
            <div key={a.serie} onClick={() => navigate(destino)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1rem', cursor: 'pointer', borderBottom: i === st.alertas.length - 1 ? 'none' : '0.5px solid #F3F4F6' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{a.descricao} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>SGS {a.codigoSgs}</span></div>
                <div style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.mensagem}</div>
              </div>
              <span style={pill(c.bg, c.fg)}>{c.txt}</span>
              <FiChevronRight size={12} color="#D1D5DB" />
            </div>
          );
        })}
        <div style={{ padding: '0.5rem 1rem', fontSize: 11, color: '#6B7280', background: '#F9FAFB', borderTop: '0.5px solid #E5E7EB' }}>
          Atualização automática pelo Banco Central (SGS) nos dias úteis às 08:40 e 18:10 · última execução {fmtHora(ultimaExec)}
          {msg && <span style={{ marginLeft: 8, color: tom.fg, fontWeight: 500 }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
};
