// frontend/src/pages/system/MatrizMasterAccountsPage.tsx
// CRIADO 25/08/2026: CRUD do Plano de Contas Matriz (template global usado ao
// importar/criar o plano de contas de qualquer empresa). Substitui a edicao
// manual do arquivo texto PlanoContasMatrizLEDGR.txt - fonte de bugs reais
// (desalinhamento de coluna, encoding) corrigidos nesta mesma sessao.
import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiEdit2, FiEyeOff, FiEye, FiX } from 'react-icons/fi';
import api from '../../services/api';

interface MatrizAccount {
  id: string;
  code: string;
  reducedCode: string | null;
  name: string;
  level: number;
  type: string;
  nature: string;
  isAnalytic: boolean;
  bloco: string;
  parentId: string | null;
  isActive: boolean;
}

const typeLabel: Record<string, string> = {
  ASSET: 'Ativo', LIABILITY: 'Passivo', EQUITY: 'PL', REVENUE: 'Receita', EXPENSE: 'Despesa',
};

export const MatrizMasterAccountsPage: React.FC = () => {
  const [contas, setContas] = useState<MatrizAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [modalAberto, setModalAberto] = useState<'novo' | 'editar' | null>(null);
  const [contaEditando, setContaEditando] = useState<MatrizAccount | null>(null);

  const fetchContas = async () => {
    setLoading(true);
    try {
      const resp = await api.get<MatrizAccount[]>('/accounting/matriz-master');
      setContas(resp.data);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao carregar contas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContas(); }, []);

  const contasVisiveis = useMemo(() => {
    return contas
      .filter(c => mostrarInativas || c.isActive)
      .filter(c => {
        if (!busca) return true;
        const q = busca.toUpperCase();
        return c.code.includes(q) || c.name.toUpperCase().includes(q);
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [contas, busca, mostrarInativas]);

  const handleDeactivate = async (id: string) => {
    if (!window.confirm('Desativar esta conta? Empresas que já a usam não são afetadas.')) return;
    try {
      await api.delete(`/accounting/matriz-master/${id}`);
      fetchContas();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao desativar.');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await api.patch(`/accounting/matriz-master/${id}/reactivate`);
      fetchContas();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao reativar.');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: '#9CA3AF' }}>
        Administração do Sistema
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Plano de Contas Matriz</h1>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
        Template global aplicado ao criar/atualizar o plano de contas de qualquer empresa.
        Contas desativadas não são apagadas — empresas que já as usam continuam intactas.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar código ou nome..."
          style={{ flex: 1, minWidth: 220, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
          <input type="checkbox" checked={mostrarInativas} onChange={e => setMostrarInativas(e.target.checked)} />
          Mostrar inativas
        </label>
        <button
          onClick={() => { setContaEditando(null); setModalAberto('novo'); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          <FiPlus size={14} /> Nova Conta
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
        {loading ? 'Carregando...' : `${contasVisiveis.length} conta(s)`}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['Código', 'Nome', 'Nível', 'Tipo', 'Nat.', 'Bloco', 'Cód. Red.', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'left', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contasVisiveis.map(c => (
              <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.45, background: c.isAnalytic ? 'transparent' : '#F9FAFB' }}>
                <td style={{ padding: '6px 10px', fontSize: 12, fontFamily: 'monospace', fontWeight: c.isAnalytic ? 400 : 600, color: c.isAnalytic ? '#111827' : '#374151', borderBottom: '0.5px solid #F3F4F6', paddingLeft: 10 + (c.level - 1) * 16, borderLeft: c.isAnalytic ? '3px solid #10B981' : '3px solid transparent' }}>
                  {c.code}
                </td>
                <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: c.isAnalytic ? 400 : 600, color: c.isAnalytic ? '#111827' : '#374151', textTransform: c.isAnalytic ? 'none' : 'uppercase', letterSpacing: c.isAnalytic ? 'normal' : '0.3px', borderBottom: '0.5px solid #F3F4F6' }}>
                  {c.name}
                </td>
                <td style={{ padding: '6px 10px', fontSize: 12, color: '#9CA3AF', borderBottom: '0.5px solid #F3F4F6' }}>{c.level}</td>
                <td style={{ padding: '6px 10px', fontSize: 12, borderBottom: '0.5px solid #F3F4F6' }}>{typeLabel[c.type] || c.type}</td>
                <td style={{ padding: '6px 10px', fontSize: 12, borderBottom: '0.5px solid #F3F4F6' }}>{c.nature === 'DEBIT' ? 'D' : 'C'}</td>
                <td style={{ padding: '6px 10px', fontSize: 11, borderBottom: '0.5px solid #F3F4F6' }}>
                  {c.bloco !== 'NUCLEO' && (
                    <span style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 3 }}>{c.bloco}</span>
                  )}
                </td>
                <td style={{ padding: '6px 10px', fontSize: 12, fontFamily: 'monospace', color: c.isAnalytic ? '#059669' : '#D1D5DB', fontWeight: c.isAnalytic ? 500 : 400, borderBottom: '0.5px solid #F3F4F6' }}>{c.reducedCode || '-'}</td>
                <td style={{ padding: '6px 10px', borderBottom: '0.5px solid #F3F4F6', whiteSpace: 'nowrap' }}>
                  <button onClick={() => { setContaEditando(c); setModalAberto('editar'); }} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', marginRight: 8 }}>
                    <FiEdit2 size={14} />
                  </button>
                  {c.isActive ? (
                    <button onClick={() => handleDeactivate(c.id)} title="Desativar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C' }}>
                      <FiEyeOff size={14} />
                    </button>
                  ) : (
                    <button onClick={() => handleReactivate(c.id)} title="Reativar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803D' }}>
                      <FiEye size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <ContaFormModal
          conta={contaEditando}
          contasExistentes={contas}
          onClose={() => setModalAberto(null)}
          onSuccess={() => { setModalAberto(null); fetchContas(); }}
        />
      )}
    </div>
  );
};

// ── Modal de criar/editar ────────────────────────────────────────────────
const ContaFormModal: React.FC<{
  conta: MatrizAccount | null;
  contasExistentes: MatrizAccount[];
  onClose: () => void;
  onSuccess: () => void;
}> = ({ conta, contasExistentes, onClose, onSuccess }) => {
  const isEdicao = !!conta;
  const [code, setCode] = useState(conta?.code ?? '');
  const [name, setName] = useState(conta?.name ?? '');
  const [level, setLevel] = useState(conta?.level ?? 1);
  const [type, setType] = useState(conta?.type ?? 'ASSET');
  const [nature, setNature] = useState(conta?.nature ?? 'DEBIT');
  const [isAnalytic, setIsAnalytic] = useState(conta?.isAnalytic ?? false);
  const [bloco, setBloco] = useState(conta?.bloco ?? 'NUCLEO');
  const [parentId, setParentId] = useState(conta?.parentId ?? '');
  const [reducedCode, setReducedCode] = useState(conta?.reducedCode ?? '');
  const [saving, setSaving] = useState(false);

  const parentsDisponiveis = contasExistentes
    .filter(c => c.isActive && c.id !== conta?.id)
    .sort((a, b) => a.code.localeCompare(b.code));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isEdicao) {
        await api.patch(`/accounting/matriz-master/${conta!.id}`, {
          name, reducedCode: reducedCode || null, isAnalytic, bloco, parentId: parentId || null,
        });
      } else {
        await api.post('/accounting/matriz-master', {
          code, name, level, type, nature, isAnalytic, bloco, reducedCode: reducedCode || undefined,
          parentId: parentId || undefined,
        });
      }
      onSuccess();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const inputSt: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 };
  const labelSt: React.CSSProperties = { fontSize: 11, color: '#9CA3AF', marginBottom: 4, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 480, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{isEdicao ? 'Editar Conta' : 'Nova Conta'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelSt}>CÓDIGO</label>
            <input style={inputSt} value={code} onChange={e => setCode(e.target.value)} disabled={isEdicao} />
          </div>
          <div>
            <label style={labelSt}>NOME</label>
            <input style={inputSt} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelSt}>NÍVEL</label>
              <input type="number" style={inputSt} value={level} onChange={e => setLevel(parseInt(e.target.value, 10))} disabled={isEdicao} />
            </div>
            <div>
              <label style={labelSt}>CÓD. REDUZIDO</label>
              <input style={inputSt} value={reducedCode} onChange={e => setReducedCode(e.target.value)} placeholder="opcional" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelSt}>TIPO</label>
              <select style={inputSt} value={type} onChange={e => setType(e.target.value)} disabled={isEdicao}>
                <option value="ASSET">Ativo</option>
                <option value="LIABILITY">Passivo</option>
                <option value="EQUITY">PL</option>
                <option value="REVENUE">Receita</option>
                <option value="EXPENSE">Despesa</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>NATUREZA</label>
              <select style={inputSt} value={nature} onChange={e => setNature(e.target.value)} disabled={isEdicao}>
                <option value="DEBIT">Devedora</option>
                <option value="CREDIT">Credora</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelSt}>CONTA PAI</label>
            <select style={inputSt} value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">(nenhuma - raiz)</option>
              {parentsDisponiveis.map(p => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelSt}>BLOCO</label>
            <input style={inputSt} value={bloco} onChange={e => setBloco(e.target.value.toUpperCase())} placeholder="NUCLEO ou HOTELARIA" />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={isAnalytic} onChange={e => setIsAnalytic(e.target.checked)} />
            Conta analítica (recebe lançamento direto)
          </label>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving || !code || !name} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: saving || !code || !name ? 0.5 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatrizMasterAccountsPage;
