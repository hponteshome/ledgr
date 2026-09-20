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

// NOVO (18/09/2026): mesma inferencia automatica ja usada no
// AccountMaintenanceModal.tsx (Plano de Contas da empresa) - acha o pai
// pelo maior prefixo de codigo ja existente, e infere tipo/natureza a
// partir dele (ou da classe 1/2/3/4 quando nao ha prefixo).
const CLASS_MAP: Record<string, { type: string; nature: string }> = {
  '1': { type: 'ASSET', nature: 'DEBIT' },
  '2': { type: 'LIABILITY', nature: 'CREDIT' },
  '3': { type: 'REVENUE', nature: 'CREDIT' },
  '4': { type: 'EXPENSE', nature: 'DEBIT' },
};

const findParentByPrefix = (code: string, allAccounts: MatrizAccount[]): MatrizAccount | null => {
  for (let len = code.length - 1; len >= 1; len--) {
    const candidate = code.slice(0, len);
    const found = allAccounts.find(a => a.code === candidate);
    if (found) return found;
  }
  return null;
};

const inferFromCode = (code: string, allAccounts: MatrizAccount[]) => {
  const clean = code.trim();
  if (!clean) return null;
  const parentAccount = findParentByPrefix(clean, allAccounts);
  if (parentAccount) {
    return { type: parentAccount.type, nature: parentAccount.nature, parent: parentAccount };
  }
  const first = clean[0];
  const inferred = CLASS_MAP[first] ?? { type: 'ASSET', nature: 'DEBIT' };
  return { type: inferred.type, nature: inferred.nature, parent: null };
};

// NOVO (18/09/2026): mesmo painel "Codigos Reduzidos Disponiveis" do Plano
// de Contas da empresa (AccountMaintenanceModal/getReducedCodeBlocks), so
// que calculado aqui 100% client-side com as contas ja carregadas - agrupa
// pelos 2 primeiros digitos do codigo completo, dentro da classe (1o
// digito), teto dinamico = proxima centena acima do maior reduzido ja
// usado no grupo, exclui 8888 (Apuracao de Resultado, reservado).
interface ReducedCodeBlock { grupo: string; total: number; primeiros10: number[] }
const computeReducedBlocks = (contas: MatrizAccount[], classeDigit: string): ReducedCodeBlock[] => {
  const porGrupo = new Map<string, number[]>();
  contas.forEach(c => {
    if (!c.code.startsWith(classeDigit) || !c.reducedCode) return;
    const num = parseInt(c.reducedCode, 10);
    if (isNaN(num)) return;
    // CORRIGIDO (18/09/2026): agrupa pelos 2 primeiros digitos do PROPRIO
    // codigo reduzido, nao do codigo completo - achado real confirmado no
    // Hotelsys (documentado no getReducedCodeBlocks do backend, que este
    // painel client-side replica): o reduzido pode ter faixa de digitos
    // diferente do codigo completo (ex: code "22" usa reduzido 23xx).
    // Agrupar pelo codigo completo dava blocos/sugestoes diferentes do
    // Plano da empresa mesmo com os dois planos identicos.
    const grupo = c.reducedCode.padStart(4, '0').slice(0, 2);
    if (!porGrupo.has(grupo)) porGrupo.set(grupo, []);
    porGrupo.get(grupo)!.push(num);
  });
  const blocos: ReducedCodeBlock[] = [];
  for (const [grupo, nums] of porGrupo.entries()) {
    const usados = new Set(nums);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const teto = Math.ceil((max + 1) / 100) * 100;
    const livres: number[] = [];
    let total = 0;
    for (let n = min; n < teto; n++) {
      if (n === 8888 || usados.has(n)) continue;
      total++;
      if (livres.length < 10) livres.push(n);
    }
    if (total > 0) blocos.push({ grupo, total, primeiros10: livres });
  }
  return blocos.sort((a, b) => a.grupo.localeCompare(b.grupo));
};

export const MatrizMasterAccountsPage: React.FC = () => {
  const [contas, setContas] = useState<MatrizAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [mostrarInativas, setMostrarInativas] = useState(false);
  const [modalAberto, setModalAberto] = useState<'novo' | 'editar' | null>(null);
  const [contaEditando, setContaEditando] = useState<MatrizAccount | null>(null);
  // NOVO (18/09/2026): "+" na linha - cria conta FILHA da clicada, igual ao
  // Plano de Contas da empresa ja tem, em vez de exigir escolher o pai manual
  // sempre pelo botao generico "Nova Conta" do topo.
  const [paiPreSelecionado, setPaiPreSelecionado] = useState<MatrizAccount | null>(null);

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
          onClick={() => { setContaEditando(null); setPaiPreSelecionado(null); setModalAberto('novo'); }}
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
            {contasVisiveis.map((c, idx) => (
              <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.45, background: idx % 2 === 0 ? '#FFFFFF' : '#F1F5F9' }}>
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
                  <button onClick={() => { setPaiPreSelecionado(c); setContaEditando(null); setModalAberto('novo'); }} title="Adicionar conta filha" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', marginRight: 8 }}>
                    <FiPlus size={14} />
                  </button>
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
          paiPreSelecionado={paiPreSelecionado}
          onClose={() => { setModalAberto(null); setPaiPreSelecionado(null); }}
          onSuccess={() => { setModalAberto(null); setPaiPreSelecionado(null); fetchContas(); }}
        />
      )}
    </div>
  );
};

// ── Modal de criar/editar ────────────────────────────────────────────────
const ContaFormModal: React.FC<{
  conta: MatrizAccount | null;
  contasExistentes: MatrizAccount[];
  paiPreSelecionado?: MatrizAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ conta, contasExistentes, paiPreSelecionado, onClose, onSuccess }) => {
  const isEdicao = !!conta;
  const [code, setCode] = useState(conta?.code ?? '');
  const [name, setName] = useState(conta?.name ?? '');
  // NOVO (18/09/2026): quando aberto via "+" de uma linha, pre-preenche
  // nivel/tipo/natureza/pai a partir da conta clicada (o filho normalmente
  // herda tipo/natureza do pai; nivel = pai + 1).
  const [level, setLevel] = useState(conta?.level ?? (paiPreSelecionado ? paiPreSelecionado.level + 1 : 1));
  const [type, setType] = useState(conta?.type ?? paiPreSelecionado?.type ?? 'ASSET');
  const [nature, setNature] = useState(conta?.nature ?? paiPreSelecionado?.nature ?? 'DEBIT');
  const [isAnalytic, setIsAnalytic] = useState(conta?.isAnalytic ?? true);
  const [bloco, setBloco] = useState(conta?.bloco ?? paiPreSelecionado?.bloco ?? 'NUCLEO');
  const [parentId, setParentId] = useState(conta?.parentId ?? paiPreSelecionado?.id ?? '');
  const [reducedCode, setReducedCode] = useState(conta?.reducedCode ?? '');
  const [saving, setSaving] = useState(false);

  const parentsDisponiveis = contasExistentes
    .filter(c => c.isActive && c.id !== conta?.id && !c.isAnalytic)
    .sort((a, b) => a.code.localeCompare(b.code));

  // NOVO (18/09/2026): busca com autocomplete em vez de <select> gigante
  // (499 contas nao cabem numa lista pra escolher a dedo). Inicializa com
  // o rotulo do pai ja escolhido (edicao ou pre-selecionado via "+").
  const paiInicial = contasExistentes.find(c => c.id === (conta?.parentId ?? paiPreSelecionado?.id));
  const [parentQuery, setParentQuery] = useState(paiInicial ? `${paiInicial.code} — ${paiInicial.name}` : '');
  const parentOptions = useMemo(() => {
    if (!parentQuery.trim()) return [];
    const q = parentQuery.toUpperCase();
    return parentsDisponiveis.filter(p => p.code.includes(q) || p.name.toUpperCase().includes(q)).slice(0, 30);
  }, [parentQuery, parentsDisponiveis]);

  // NOVO (18/09/2026): ao digitar o codigo (so em modo criacao), infere
  // conta pai + tipo + natureza pelo maior prefixo ja existente no plano -
  // mesma logica do formulario do Plano de Contas da empresa.
  const handleCodeBlur = () => {
    if (isEdicao) return;
    const inferido = inferFromCode(code, contasExistentes);
    if (!inferido) return;
    setType(inferido.type);
    setNature(inferido.nature);
    if (inferido.parent) {
      setParentId(inferido.parent.id);
      setParentQuery(`${inferido.parent.code} — ${inferido.parent.name}`);
      setLevel(inferido.parent.level + 1);
    }
  };

  // classe = 1o digito do codigo digitado, ou da conta pai escolhida quando
  // o codigo ainda esta em branco (ex: acabou de inferir/selecionar o pai).
  const paiAtual = contasExistentes.find(p => p.id === parentId);
  const classeDigit = (code.trim()[0]) || paiAtual?.code[0] || null;
  const reducedCodeBlocks = useMemo(
    () => classeDigit ? computeReducedBlocks(contasExistentes, classeDigit) : [],
    [classeDigit, contasExistentes],
  );

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
      <div style={{ background: '#fff', borderRadius: 14, width: classeDigit ? 820 : 480, maxWidth: '95vw', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{isEdicao ? 'Editar Conta' : 'Nova Conta'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
        </div>
        <div style={{ display: 'flex', overflowY: 'auto' }}>
        <div style={{ padding: 20, flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelSt}>CÓDIGO</label>
            <input style={inputSt} value={code} onChange={e => setCode(e.target.value)} onBlur={handleCodeBlur} disabled={isEdicao} />
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
          <div style={{ position: 'relative' }}>
            <label style={labelSt}>CONTA PAI</label>
            <input
              style={inputSt}
              value={parentQuery}
              placeholder="Buscar por código ou nome... (deixe em branco para conta raiz)"
              onChange={e => { setParentQuery(e.target.value); if (!e.target.value.trim()) setParentId(''); }}
            />
            {parentQuery.trim() && parentOptions.length > 0 && (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: 6, maxHeight: 160, overflowY: 'auto', marginTop: 4 }}>
                {parentOptions.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => { setParentId(p.id); setParentQuery(`${p.code} — ${p.name}`); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 12, background: 'none', border: 'none', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer' }}>
                    <span style={{ fontFamily: 'monospace', color: '#6B7280' }}>{p.code}</span> — {p.name}
                  </button>
                ))}
              </div>
            )}
            {parentId && (
              <button type="button" onClick={() => { setParentId(''); setParentQuery(''); }}
                style={{ fontSize: 11, color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                Limpar conta pai
              </button>
            )}
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
        {classeDigit && (
          <div style={{ width: 220, flexShrink: 0, borderLeft: '1px solid #F3F4F6', padding: '20px 16px', overflowY: 'auto' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
              Códigos Reduzidos Disponíveis
            </p>
            {reducedCodeBlocks.length === 0 ? (
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>Nenhum intervalo disponível encontrado nessa classe.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {reducedCodeBlocks.map(b => (
                  <div key={b.grupo}>
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>
                      Grupo {b.grupo} — {b.total} disponíve{b.total === 1 ? 'l' : 'is'}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {b.primeiros10.map(n => (
                        <button key={n} type="button"
                          onClick={() => setReducedCode(String(n))}
                          style={{ padding: '3px 6px', borderRadius: 4, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 11, color: '#1D4ED8', cursor: 'pointer', fontFamily: 'monospace' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
