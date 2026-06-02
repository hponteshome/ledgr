// frontend/src/pages/finance/LalurConfigPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const fmtBR = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const S = {
  page:  { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)' } as React.CSSProperties,
  card:  { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 } as React.CSSProperties,
  secTit:{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', letterSpacing: '.3px', marginBottom: 12 },
  input: { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 9px', fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  select:{ height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 9px', fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%' },
  btn:   (c='#111') => ({ height: 32, border: 'none', borderRadius: 6, padding: '0 16px', fontSize: 12, cursor: 'pointer', background: c, color: '#fff', fontWeight: 500 } as React.CSSProperties),
  btnO:  { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' } as React.CSSProperties,
  th:    { background: 'var(--color-background-secondary)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const, padding: '7px 12px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', color: 'var(--color-text-secondary)' },
  td:    { padding: '8px 12px', fontSize: 12, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  badge: (c: string) => ({ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: c + '22', color: c } as React.CSSProperties),
};

const DEDU_OPTS = [
  { value: 'DEDUTIVEL',                label: 'Dedutível (100%)',         color: '#15803D' },
  { value: 'PARCIALMENTE_DEDUTIVEL',   label: 'Parcialmente Dedutível',   color: '#EA580C' },
  { value: 'NAO_DEDUTIVEL',            label: 'Não Dedutível',            color: '#DC2626' },
];

interface Conta {
  id: string; code: string; name: string; type: string;
  dedutibilidade?: string; percDeducao?: number;
  lalurTipoAjuste?: string; lalurDescricao?: string;
}

interface EditState {
  dedutibilidade: string;
  percDeducao: number;
  lalurTipoAjuste: string;
  lalurDescricao: string;
}

export default function LalurConfigPage() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('EXPENSE');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string|null>(null);
  const [editId, setEditId] = useState<string|null>(null);
  const [editState, setEditState] = useState<EditState>({ dedutibilidade:'DEDUTIVEL', percDeducao:100, lalurTipoAjuste:'ADICAO', lalurDescricao:'' });
  const [configuradas, setConfiguradas] = useState<Conta[]>([]);

  const loadContas = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/chart-of-accounts', { params: { type: filtroTipo, onlyAnalytic: true, limit: 500 } });
      setContas(Array.isArray(data) ? data : (data.items ?? data.data ?? []));
    } catch {} finally { setLoading(false); }
  }, [filtroTipo]);

  const loadConfiguradas = useCallback(async () => {
    try {
      const { data } = await api.get('/chart-of-accounts/deducibilidade/nao-dedutiveis');
      setConfiguradas(data);
    } catch {}
  }, []);

  useEffect(() => { loadContas(); loadConfiguradas(); }, [loadContas, loadConfiguradas]);

  const contasFiltradas = contas.filter(c =>
    !busca || c.code.includes(busca) || c.name.toLowerCase().includes(busca.toLowerCase())
  );

  function startEdit(c: Conta) {
    setEditId(c.id);
    setEditState({
      dedutibilidade: c.dedutibilidade ?? 'DEDUTIVEL',
      percDeducao: c.percDeducao ?? 100,
      lalurTipoAjuste: c.lalurTipoAjuste ?? 'ADICAO',
      lalurDescricao: c.lalurDescricao ?? '',
    });
  }

  async function salvar(id: string) {
    setSaving(id);
    try {
      await api.patch('/chart-of-accounts/' + id + '/deducibilidade', editState);
      setEditId(null);
      await loadContas();
      await loadConfiguradas();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    finally { setSaving(null); }
  }

  const deduColor = (d?: string) => d === 'NAO_DEDUTIVEL' ? '#DC2626' : d === 'PARCIALMENTE_DEDUTIVEL' ? '#EA580C' : '#15803D';
  const deduLabel = (d?: string) => DEDU_OPTS.find(o => o.value === d)?.label ?? 'Dedutível';

  return (
    <div style={S.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#7C3AED', background:'#F5F3FF', padding:'2px 8px', borderRadius:4 }}>LALUR / FISCAL</span>
            <h1 style={{ fontSize:18, fontWeight:500, margin:0 }}>Configuração de Dedutibilidade</h1>
          </div>
          <p style={{ fontSize:12, color:'var(--color-text-secondary)', margin:0 }}>
            Marque contas de despesa como não dedutíveis para geração automática de sugestões no LALUR/LACS
          </p>
        </div>
      </div>

      {/* Contas ja configuradas */}
      {configuradas.length > 0 && (
        <div style={S.card}>
          <div style={S.secTit}>Contas Configuradas ({configuradas.length})</div>
          <div style={{ overflowX:'auto', border:'0.5px solid var(--color-border-tertiary)', borderRadius:8 }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                <th style={S.th}>Código</th>
                <th style={S.th}>Nome</th>
                <th style={S.th}>Dedutibilidade</th>
                <th style={S.th}>% Dedutível</th>
                <th style={S.th}>Ajuste LALUR</th>
                <th style={S.th}>Descrição Padrão</th>
                <th style={S.th}></th>
              </tr></thead>
              <tbody>
                {configuradas.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...S.td, fontFamily:'monospace', fontSize:11 }}>{c.code}</td>
                    <td style={S.td}>{c.name}</td>
                    <td style={S.td}><span style={S.badge(deduColor(c.dedutibilidade))}>{deduLabel(c.dedutibilidade)}</span></td>
                    <td style={{ ...S.td, textAlign:'center' as const }}>{c.percDeducao}%</td>
                    <td style={S.td}><span style={S.badge('#7C3AED')}>{c.lalurTipoAjuste ?? 'ADICAO'}</span></td>
                    <td style={{ ...S.td, fontSize:11, color:'var(--color-text-secondary)' }}>{c.lalurDescricao ?? '-'}</td>
                    <td style={S.td}>
                      <button style={{ ...S.btnO, fontSize:11, height:26 }} onClick={() => startEdit(c)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Busca e filtro */}
      <div style={S.card}>
        <div style={S.secTit}>Configurar Dedutibilidade por Conta</div>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <input style={{ ...S.input, maxWidth:300 }} placeholder="Buscar por código ou nome..." value={busca} onChange={e=>setBusca(e.target.value)} />
          <select style={{ ...S.select, width:160 }} value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)}>
            <option value="EXPENSE">Despesas</option>
            <option value="REVENUE">Receitas</option>
            <option value="ASSET">Ativo</option>
          </select>
        </div>

        {loading ? <div style={{ textAlign:'center', padding:40, color:'var(--color-text-secondary)' }}>Carregando...</div> : (
          <div style={{ overflowX:'auto', border:'0.5px solid var(--color-border-tertiary)', borderRadius:8, maxHeight:500, overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead style={{ position:'sticky', top:0, zIndex:1 }}><tr>
                <th style={S.th}>Código</th>
                <th style={S.th}>Nome</th>
                <th style={S.th}>Status Atual</th>
                <th style={S.th}>Configuração</th>
                <th style={S.th}></th>
              </tr></thead>
              <tbody>
                {contasFiltradas.map(c => (
                  <React.Fragment key={c.id}>
                    <tr style={{ background: editId===c.id ? 'var(--color-background-secondary)' : 'transparent' }}>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:11 }}>{c.code}</td>
                      <td style={S.td}>{c.name}</td>
                      <td style={S.td}>
                        <span style={S.badge(deduColor(c.dedutibilidade))}>
                          {deduLabel(c.dedutibilidade)}
                        </span>
                      </td>
                      <td style={S.td}>
                        {editId === c.id ? (
                          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                            <select style={{ ...S.select, width:200 }} value={editState.dedutibilidade}
                              onChange={e=>setEditState(s=>({...s, dedutibilidade:e.target.value}))}>
                              {DEDU_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {editState.dedutibilidade === 'PARCIALMENTE_DEDUTIVEL' && (
                              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                                <span style={{ fontSize:11 }}>% Dedutível:</span>
                                <input style={{ ...S.input, width:70 }} type="number" min={0} max={100}
                                  value={editState.percDeducao}
                                  onChange={e=>setEditState(s=>({...s, percDeducao:Number(e.target.value)}))} />
                              </div>
                            )}
                            <select style={{ ...S.select, width:130 }} value={editState.lalurTipoAjuste}
                              onChange={e=>setEditState(s=>({...s, lalurTipoAjuste:e.target.value}))}>
                              <option value="ADICAO">Adição</option>
                              <option value="EXCLUSAO">Exclusão</option>
                            </select>
                            <input style={{ ...S.input, width:220 }} placeholder="Descrição LALUR..."
                              value={editState.lalurDescricao}
                              onChange={e=>setEditState(s=>({...s, lalurDescricao:e.target.value}))} />
                          </div>
                        ) : (
                          <span style={{ fontSize:11, color:'var(--color-text-secondary)' }}>
                            {c.dedutibilidade && c.dedutibilidade !== 'DEDUTIVEL'
                              ? (c.percDeducao + '% dedutível — ' + (c.lalurTipoAjuste ?? 'ADICAO'))
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td style={S.td}>
                        {editId === c.id ? (
                          <div style={{ display:'flex', gap:6 }}>
                            <button style={S.btn()} onClick={()=>salvar(c.id)} disabled={saving===c.id}>
                              {saving===c.id ? '...' : 'Salvar'}
                            </button>
                            <button style={S.btnO} onClick={()=>setEditId(null)}>✕</button>
                          </div>
                        ) : (
                          <button style={{ ...S.btnO, fontSize:11, height:26 }} onClick={()=>startEdit(c)}>
                            Configurar
                          </button>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
