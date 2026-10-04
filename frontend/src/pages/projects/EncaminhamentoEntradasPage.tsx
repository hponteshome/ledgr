// frontend/src/pages/projects/EncaminhamentoEntradasPage.tsx
// Fase 1.8 revista (03/10/2026): triagem do extrato NO LEDGR (empresa ativa). O Financeiro encaminha ao projeto
// so o que pertence a ele; o restante nunca sai do LEDGR. Modais no padrao APPayModal.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';
const fmtBRL = (v: any) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso?: string | null) => { if (!iso) return '-'; const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const thSt: React.CSSProperties = { padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px', textAlign: 'left', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' };
const tdSt: React.CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top' };
const inputSt: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', background: '#fff' };

interface Entrada { id: string; data: string; valor: string; lancamento: string; pagadorNome: string | null; pagadorDocumento: string | null; remetenteConhecido: boolean; }
interface Destino { operacaoId: string; nome: string; }

function AcaoModal({ tipo, entrada, destinos, onClose, onFeito }: { tipo: 'encaminhar' | 'nao-pertence'; entrada: Entrada; destinos: Destino[]; onClose: () => void; onFeito: () => void }) {
  const [operacaoId, setOperacaoId] = useState(destinos[0]?.operacaoId || '');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  const valido = motivo.trim().length >= 10 && (tipo === 'nao-pertence' || !!operacaoId);
  const confirmar = async () => {
    if (!valido) return;
    setErro(''); setEnviando(true);
    try {
      await api.post(`/projects-financeiro/entradas/${entrada.id}/${tipo}`, { operacaoId, motivo: motivo.trim() });
      toast.success(tipo === 'encaminhar' ? 'Entrada encaminhada ao projeto.' : 'Decisão registrada.');
      onFeito();
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Falha ao registrar.');
    } finally {
      setEnviando(false);
    }
  };
  const secao: React.CSSProperties = { background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` };
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 520, maxWidth: '94vw', maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{tipo === 'encaminhar' ? 'Encaminhar ao projeto' : 'Não pertence a projeto'}</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>{fmtData(entrada.data)} · {fmtBRL(entrada.valor)} · {entrada.pagadorNome || 'pagador não identificado no extrato'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>⚠ {erro}</div>}
          <div style={{ ...secao, fontSize: 12, color: '#374151' }}>
            {tipo === 'encaminhar'
              ? 'O projeto recebe esta entrada como crédito, já comprovado por ela. A decisão sobre a Conta Individual do Adquirente fica com o projeto.'
              : 'A entrada sai da triagem de projetos e permanece apenas no LEDGR. A decisão fica registrada com o motivo e pode ser revista.'}
          </div>
          {tipo === 'encaminhar' && (
            <div style={secao}>
              <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>OPERAÇÃO DE DESTINO *</div>
              <select style={inputSt} value={operacaoId} onChange={(e) => setOperacaoId(e.target.value)}>
                {destinos.map((d) => <option key={d.operacaoId} value={d.operacaoId}>{d.nome}</option>)}
              </select>
            </div>
          )}
          <div style={secao}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>MOTIVO *</div>
            <textarea style={{ ...inputSt, minHeight: 72, resize: 'vertical' }} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 caracteres. Fica registrado na trilha de auditoria." />
          </div>
        </div>
        <div style={{ background: '#FAFAFA', borderTop: '0.5px solid #E5E7EB', padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: '#fff', color: '#374151', border: '0.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={confirmar} disabled={!valido || enviando}
            style={{ padding: '8px 16px', background: FIN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: valido ? 'pointer' : 'default', opacity: valido && !enviando ? 1 : 0.6 }}>
            {enviando ? 'Aguarde...' : tipo === 'encaminhar' ? 'Encaminhar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EncaminhamentoEntradasPage() {
  const { user } = useAuth() as any;
  const master = user?.profile?.permissions?.all === true;
  const [dados, setDados] = useState<{ destinos: Destino[]; entradas: Entrada[] } | null>(null);
  const [erro, setErro] = useState('');
  const [ano, setAno] = useState('TODOS');
  const [soConhecidos, setSoConhecidos] = useState(false);
  const [acao, setAcao] = useState<{ tipo: 'encaminhar' | 'nao-pertence'; entrada: Entrada } | null>(null);

  const carregar = useCallback(() => {
    setErro('');
    api.get('/projects-financeiro/entradas')
      .then((r) => setDados(r.data))
      .catch((e) => setErro(e?.response?.data?.message || 'Falha ao carregar as entradas.'));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const anos = useMemo(() => [...new Set((dados?.entradas || []).map((e) => e.data.slice(0, 4)))].sort(), [dados]);
  const lista = useMemo(() => (dados?.entradas || []).filter((e) => (ano === 'TODOS' || e.data.startsWith(ano)) && (!soConhecidos || e.remetenteConhecido)), [dados, ano, soConhecidos]);
  const total = lista.reduce((s, e) => s + Number(e.valor), 0);
  const semDestino = !!dados && dados.destinos.length === 0;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>Encaminhar entradas aos projetos</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 14 }}>Empresa ativa · o extrato completo fica no LEDGR; o projeto recebe só o que for encaminhado aqui</div>
      {erro && <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>⚠ {erro}</div>}
      {semDestino && <div style={{ background: '#F3F4F6', color: '#374151', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>A empresa ativa não é recebedora de nenhuma operação de projeto.</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={ano} onChange={(e) => setAno(e.target.value)} style={{ padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13 }}>
          <option value="TODOS">Todos os anos</option>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={soConhecidos} onChange={(e) => setSoConhecidos(e.target.checked)} /> Só remetentes já conhecidos em projetos
        </label>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: '#374151' }}>{lista.length} entrada(s) · <b>{fmtBRL(total)}</b></div>
      </div>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={thSt}>Data</th><th style={{ ...thSt, textAlign: 'right' }}>Valor</th><th style={thSt}>Lançamento</th><th style={thSt}>Pagador (extrato)</th><th style={thSt}></th>{master && !semDestino && <th style={thSt}></th>}</tr></thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} style={{ ...tdSt, textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Nenhuma entrada para triagem.</td></tr>}
            {lista.map((e) => (
              <tr key={e.id}>
                <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>{fmtData(e.data)}</td>
                <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtBRL(e.valor)}</td>
                <td style={{ ...tdSt, fontSize: 12 }}>{e.lancamento}</td>
                <td style={tdSt}>
                  {e.pagadorNome ? <div>{e.pagadorNome}</div> : <i style={{ color: '#9CA3AF' }}>extrato sem pagador</i>}
                  {e.pagadorDocumento && <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>{e.pagadorDocumento}</div>}
                </td>
                <td style={tdSt}>{e.remetenteConhecido && <span style={{ fontSize: 11, fontWeight: 600, color: '#134E4A', background: '#F0FDFA', border: '0.5px solid #99F6E4', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>Remetente conhecido</span>}</td>
                {master && !semDestino && (
                  <td style={{ ...tdSt, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setAcao({ tipo: 'encaminhar', entrada: e })} style={{ padding: '4px 10px', fontSize: 12, border: 'none', borderRadius: 7, background: FIN, color: '#fff', cursor: 'pointer', marginRight: 6 }}>Encaminhar</button>
                    <button onClick={() => setAcao({ tipo: 'nao-pertence', entrada: e })} style={{ padding: '4px 10px', fontSize: 12, border: '0.5px solid #E5E7EB', borderRadius: 7, background: '#fff', color: '#374151', cursor: 'pointer' }}>Não pertence</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {acao && dados && (
        <AcaoModal tipo={acao.tipo} entrada={acao.entrada} destinos={dados.destinos} onClose={() => setAcao(null)} onFeito={() => { setAcao(null); carregar(); }} />
      )}
    </div>
  );
}
