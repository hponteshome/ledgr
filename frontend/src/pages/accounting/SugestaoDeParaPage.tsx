// frontend/src/pages/accounting/SugestaoDeParaPage.tsx
// CRIADO 28/08/2026: reconstroi como ferramenta real e reutilizavel a tela
// de sugestao/confirmacao de mapeamento ECD -> Matriz, motivada pela nova
// empresa Sunrise (holding) precisando do mesmo de/para que a Hotelsys ja
// tinha, mas que nunca virou funcionalidade permanente (era script Python
// pontual, sessao 23/08/2026).
import React, { useState, useCallback, useEffect } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';

interface Sugestao {
  sourceId: string; sourceCode: string; sourceName: string;
  targetId: string | null; targetCode: string | null; targetName: string | null;
  confidence: number;
  matchType: 'REAPROVEITADO' | 'SIMILARIDADE' | 'SEM_SUGESTAO' | 'CONFIRMADO_AUTOMATICO' | 'CONFIRMADO_MANUAL';
  confirmado: boolean;
}
interface ContaOpcao { id: string; code: string; name: string; type: string; nature: string; }

const matchTypeStyle: Record<string, { bg: string; color: string; label: string }> = {
  REAPROVEITADO: { bg: '#F0F9FF', color: '#0369A1', label: 'Reaproveitado' },
  SIMILARIDADE: { bg: '#ECFDF5', color: '#059669', label: 'Similaridade' },
  SEM_SUGESTAO: { bg: '#FEF2F2', color: '#B91C1C', label: 'Sem sugestão' },
  CONFIRMADO_AUTOMATICO: { bg: '#EEF2FF', color: '#4338CA', label: '✓ Confirmado (auto)' },
  CONFIRMADO_MANUAL: { bg: '#FFFBEB', color: '#B45309', label: '✓ Confirmado (manual)' },
};

// CRIADO 28/08/2026: autocomplete simples, filtro no cliente (ja temos as
// contas carregadas) - motivado por achado real (sugestao errada de INSS vs
// IRRF), usuario precisa poder buscar e corrigir QUALQUER linha, nao so
// escolher de uma lista de 444 opcoes num <select> gigante.
const ContaAutocomplete: React.FC<{
  contas: ContaOpcao[];
  valorAtual: string;
  onSelecionar: (id: string) => void;
  destaque?: boolean;
}> = ({ contas, valorAtual, onSelecionar, destaque }) => {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const contaAtual = contas.find(c => c.id === valorAtual);
  const label = contaAtual ? `${contaAtual.code} — ${contaAtual.name}` : '';

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const termoBusca = busca.toLowerCase();
  const filtradas = termoBusca
    ? contas.filter(c => c.code.toLowerCase().includes(termoBusca) || c.name.toLowerCase().includes(termoBusca))
    : contas;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={aberto ? busca : label}
        placeholder="Buscar código ou nome…"
        onFocus={() => { setAberto(true); setBusca(''); }}
        onChange={e => setBusca(e.target.value)}
        style={{
          padding: '5px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, width: '100%',
          color: destaque ? '#B45309' : '#374151',
        }}
      />
      {aberto && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: '#fff',
          border: '1px solid #E5E7EB', borderRadius: 6, marginTop: 2, maxHeight: 240, overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          {filtradas.length === 0 ? (
            <div style={{ padding: 10, fontSize: 12, color: '#9CA3AF' }}>Nenhuma conta encontrada.</div>
          ) : filtradas.map(c => (
            <div
              key={c.id}
              onClick={() => { onSelecionar(c.id); setAberto(false); }}
              style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '0.5px solid #F5F5F5' }}
              onMouseDown={e => e.preventDefault()}
            >
              <span style={{ fontFamily: 'monospace', color: '#2563EB', marginRight: 6 }}>{c.code}</span>
              {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const SugestaoDeParaPage: React.FC = () => {
  const { activeCompany } = useCompany();
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // sourceId -> targetId escolhido manualmente
  const [contasDisponiveis, setContasDisponiveis] = useState<ContaOpcao[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'pendentes' | 'confirmados'>('todos');

  const carregar = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    setResultado(null);
    try {
      // CORRIGIDO 28/08/2026: usa destinosDisponiveis do proprio endpoint de
      // sugestao (so contas Matriz, sem vinculo ECD) em vez de carregar a
      // arvore inteira - achado real: autocomplete oferecia contas ECD
      // nativas tambem, quando so Matriz faz sentido como destino.
      const sugResp = await api.get('/accounting/de-para/sugerir');
      setSugestoes(sugResp.data?.sugestoes || []);
      setContasDisponiveis(sugResp.data?.destinosDisponiveis || []);
    } catch (e: any) {
      setResultado({ ok: false, mensagem: e?.response?.data?.message || 'Erro ao carregar sugestões.' });
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleConfirmar = async () => {
    const mapeamentos = sugestoes
      .map(s => {
        const targetId = overrides[s.sourceId] ?? s.targetId;
        if (!targetId) return null;
        const matchType = s.matchType === 'SEM_SUGESTAO' || overrides[s.sourceId] ? 'MANUAL' : 'SUGGESTED_CONFIRMED';
        return { sourceId: s.sourceId, targetId, matchType: matchType as 'SUGGESTED_CONFIRMED' | 'MANUAL' };
      })
      .filter(Boolean) as { sourceId: string; targetId: string; matchType: 'SUGGESTED_CONFIRMED' | 'MANUAL' }[];

    if (mapeamentos.length === 0) {
      setResultado({ ok: false, mensagem: 'Nenhum mapeamento com destino definido para confirmar.' });
      return;
    }
    if (!confirm(`Confirma o registro de ${mapeamentos.length} mapeamento(s)?`)) return;

    setConfirmando(true);
    setResultado(null);
    try {
      const r = await api.post('/accounting/de-para/confirmar', { mapeamentos });
      setResultado({ ok: true, mensagem: `${r.data.criados} mapeamento(s) registrado(s) com sucesso.` });
      await carregar();
    } catch (e: any) {
      setResultado({ ok: false, mensagem: e?.response?.data?.message || 'Erro ao confirmar mapeamentos.' });
    } finally {
      setConfirmando(false);
    }
  };

  const listaExibida =
    filtro === 'pendentes' ? sugestoes.filter(s => !s.confirmado && s.matchType === 'SEM_SUGESTAO' && !overrides[s.sourceId]) :
    filtro === 'confirmados' ? sugestoes.filter(s => s.confirmado) :
    sugestoes;
  const qtdConfirmados = sugestoes.filter(s => s.confirmado).length;

  const thSt: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6B7280', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left' };
  const selSt: React.CSSProperties = { padding: '5px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, width: '100%' };

  const qtdReaproveitado = sugestoes.filter(s => s.matchType === 'REAPROVEITADO').length;
  const qtdSimilaridade = sugestoes.filter(s => s.matchType === 'SIMILARIDADE').length;
  const qtdSemSugestao = sugestoes.filter(s => s.matchType === 'SEM_SUGESTAO' && !overrides[s.sourceId]).length;

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F0F9FF', color: '#0369A1', marginBottom: 6 }}>
          ◆ Contábil
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: 0 }}>Sugestão de De/Para (ECD → Matriz)</h1>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          Filtro por tipo/natureza + grupo do Balanço + similaridade de nome. Contas sem sugestão precisam de escolha manual antes de confirmar.
        </p>
      </header>

      {resultado && (
        <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13, background: resultado.ok ? '#ECFDF5' : '#FEF2F2', color: resultado.ok ? '#059669' : '#B91C1C' }}>
          {resultado.mensagem}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Calculando sugestões…</div>
      ) : sugestoes.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          Nenhuma conta de origem ECD encontrada para esta empresa.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, padding: 14, background: '#F0F9FF', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' }}>Reaproveitado</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0369A1' }}>{qtdReaproveitado}</div>
            </div>
            <div style={{ flex: 1, padding: 14, background: '#ECFDF5', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' }}>Similaridade</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#059669' }}>{qtdSimilaridade}</div>
            </div>
            <div style={{ flex: 1, padding: 14, background: '#FEF2F2', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase' }}>Sem sugestão (pendente)</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#B91C1C' }}>{qtdSemSugestao}</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setFiltro('todos')} style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, background: filtro === 'todos' ? '#111827' : '#fff', color: filtro === 'todos' ? '#fff' : '#374151', cursor: 'pointer' }}>Todos ({sugestoes.length})</button>
              <button onClick={() => setFiltro('pendentes')} style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, background: filtro === 'pendentes' ? '#111827' : '#fff', color: filtro === 'pendentes' ? '#fff' : '#374151', cursor: 'pointer' }}>Só pendentes ({qtdSemSugestao})</button>
              <button onClick={() => setFiltro('confirmados')} style={{ padding: '6px 12px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, background: filtro === 'confirmados' ? '#111827' : '#fff', color: filtro === 'confirmados' ? '#fff' : '#374151', cursor: 'pointer' }}>Confirmados ({qtdConfirmados})</button>
            </div>
            <button onClick={handleConfirmar} disabled={confirmando} style={{ padding: '9px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: confirmando ? 0.6 : 1 }}>
              {confirmando ? 'Confirmando…' : 'Confirmar Mapeamentos'}
            </button>
          </div>

          <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 600 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={thSt}>Origem (ECD)</th>
                  <th style={thSt}>Destino sugerido (Matriz)</th>
                  <th style={{ ...thSt, textAlign: 'center' }}>Confiança</th>
                  <th style={{ ...thSt, textAlign: 'center' }}>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {listaExibida.map((s, idx) => {
                  const st = matchTypeStyle[overrides[s.sourceId] ? 'SIMILARIDADE' : s.matchType];
                  const opcoesCompatíveis = contasDisponiveis; // simples: todas as analiticas, usuario escolhe manualmente
                  return (
                    <tr key={s.sourceId} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>
                        <span style={{ fontFamily: 'monospace', color: '#2563EB', marginRight: 6 }}>{s.sourceCode}</span>
                        {s.sourceName}
                      </td>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>
                        {/* CORRIGIDO 28/08/2026: sempre editavel, nao so quando "sem sugestao" -
                            achado real na Sunrise (INSSRF-PF sugerido errado para IRRF NF a Recolher,
                            quando existia INSS Retido s/Servicos PF melhor na Matriz) - usuario precisa
                            poder corrigir QUALQUER sugestao, nao so preencher as vazias. */}
                        <ContaAutocomplete
                          contas={opcoesCompatíveis}
                          valorAtual={overrides[s.sourceId] ?? s.targetId ?? ''}
                          onSelecionar={id => setOverrides(prev => ({ ...prev, [s.sourceId]: id }))}
                          destaque={overrides[s.sourceId] !== undefined}
                        />
                      </td>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                        {(s.confidence * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default SugestaoDeParaPage;
