// frontend/src/pages/accounting/HistoricoPadraoPage.tsx
// CRIADO (09/09/2026): manutencao manual do catalogo Historico Padrao -
// ate aqui so era alimentado automaticamente pela importacao ECD (registro
// 0400 do SPED). Necessario pro modal de Importacao Manual (aceita HP como
// identificador) e para lancamentos avulsos criados direto no sistema.
import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiEyeOff, FiEye, FiX, FiCheck } from 'react-icons/fi';
import api from '../../services/api';

interface HistoricoPadrao {
  id: string;
  code: string;
  description: string;
  isActive: boolean;
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 11,
  color: '#9CA3AF',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  textAlign: 'left',
  borderBottom: '1px solid #E5E7EB',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 13,
  borderBottom: '0.5px solid #F3F4F6',
};

const inputStyle: React.CSSProperties = {
  padding: '6px 9px',
  border: '1px solid #E5E7EB',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
};

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: '#111827',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const btnGhost: React.CSSProperties = {
  padding: '5px 8px',
  background: 'transparent',
  border: 'none',
  borderRadius: 5,
  cursor: 'pointer',
  color: '#6B7280',
  display: 'inline-flex',
  alignItems: 'center',
};

export const HistoricoPadraoPage: React.FC = () => {
  const [lista, setLista] = useState<HistoricoPadrao[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const [novoAberto, setNovoAberto] = useState(false);
  const [novoCode, setNovoCode] = useState('');
  const [novoDescription, setNovoDescription] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<HistoricoPadrao[]>('/accounting/historico-padrao', {
        params: { includeInactive: mostrarInativos ? 'true' : 'false' },
      });
      setLista(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao carregar os históricos padrão.');
    } finally {
      setLoading(false);
    }
  }, [mostrarInativos]);

  useEffect(() => { carregar(); }, [carregar]);

  const iniciarEdicao = (h: HistoricoPadrao) => {
    setEditandoId(h.id);
    setFormCode(h.code);
    setFormDescription(h.description);
    setNovoAberto(false);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setFormCode('');
    setFormDescription('');
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;
    setSalvando(true);
    setError(null);
    try {
      await api.patch(`/accounting/historico-padrao/${editandoId}`, {
        code: formCode.trim(),
        description: formDescription.trim(),
      });
      cancelarEdicao();
      await carregar();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const criarNovo = async () => {
    if (!novoCode.trim() || !novoDescription.trim()) {
      setError('Preencha código e descrição.');
      return;
    }
    setSalvando(true);
    setError(null);
    try {
      await api.post('/accounting/historico-padrao', {
        code: novoCode.trim(),
        description: novoDescription.trim(),
      });
      setNovoAberto(false);
      setNovoCode('');
      setNovoDescription('');
      await carregar();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao criar.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (h: HistoricoPadrao) => {
    setError(null);
    try {
      await api.patch(`/accounting/historico-padrao/${h.id}/ativo`, { isActive: !h.isActive });
      await carregar();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao alterar status.');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: '#9CA3AF' }}>
        Contabilidade / Cadastros
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Histórico Padrão</h1>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
        Catálogo de históricos padrão por conta contábil (registro 0400 do SPED) — usado na
        Importação Manual e em lançamentos avulsos. Populado automaticamente pela importação ECD;
        aqui você cadastra, edita ou desativa entradas à mão.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <button
          onClick={() => { setNovoAberto(v => !v); cancelarEdicao(); }}
          style={btnPrimary}
        >
          <FiPlus size={14} /> Novo Histórico
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mostrarInativos}
            onChange={(e) => setMostrarInativos(e.target.checked)}
          />
          Mostrar inativos
        </label>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#FEF2F2', color: '#B91C1C', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {novoAberto && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16, padding: 14, background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
          <div style={{ width: 140 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>CÓDIGO</div>
            <input style={inputStyle} value={novoCode} onChange={(e) => setNovoCode(e.target.value)} placeholder="Ex: 0001" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>DESCRIÇÃO</div>
            <input style={inputStyle} value={novoDescription} onChange={(e) => setNovoDescription(e.target.value)} placeholder="Ex: Pagamento a fornecedor" />
          </div>
          <button onClick={criarNovo} disabled={salvando} style={{ ...btnPrimary, opacity: salvando ? 0.6 : 1 }}>
            <FiCheck size={14} /> Salvar
          </button>
          <button onClick={() => setNovoAberto(false)} style={btnGhost}>
            <FiX size={16} />
          </button>
        </div>
      )}

      <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 140 }}>Código</th>
              <th style={thStyle}>Descrição</th>
              <th style={{ ...thStyle, width: 90 }}>Status</th>
              <th style={{ ...thStyle, width: 90, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#9CA3AF' }}>Carregando...</td></tr>
            ) : lista.length === 0 ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#9CA3AF' }}>Nenhum histórico padrão cadastrado ainda.</td></tr>
            ) : (
              lista.map((h) => (
                editandoId === h.id ? (
                  <tr key={h.id} style={{ background: '#F9FAFB' }}>
                    <td style={tdStyle}>
                      <input style={inputStyle} value={formCode} onChange={(e) => setFormCode(e.target.value)} />
                    </td>
                    <td style={tdStyle}>
                      <input style={inputStyle} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                    </td>
                    <td style={tdStyle} colSpan={2}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={salvarEdicao} disabled={salvando} style={{ ...btnGhost, color: '#059669' }} title="Salvar">
                          <FiCheck size={16} />
                        </button>
                        <button onClick={cancelarEdicao} style={btnGhost} title="Cancelar">
                          <FiX size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={h.id}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{h.code}</td>
                    <td style={tdStyle}>{h.description}</td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 10,
                        background: h.isActive ? '#ECFDF5' : '#F3F4F6',
                        color: h.isActive ? '#059669' : '#9CA3AF',
                      }}>
                        {h.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => iniciarEdicao(h)} style={btnGhost} title="Editar">
                        <FiEdit2 size={14} />
                      </button>
                      <button
                        onClick={() => alternarAtivo(h)}
                        style={btnGhost}
                        title={h.isActive ? 'Desativar' : 'Reativar'}
                      >
                        {h.isActive ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                      </button>
                    </td>
                  </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoricoPadraoPage;
