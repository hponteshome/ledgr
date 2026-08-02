// VisoesContabeisPage.tsx — frontend/src/pages/VisoesContabeisPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface RfbCode { id: string; codigo: string; descricao: string; nivel: number; codigoPai?: string; ordem: number; tipo: string; }
interface AccountingView { id: string; name: string; tipo: string; leiaute: number; anoBase: number; }
interface ChildRow { accountId: string; code: string; reducedCode?: string; name: string; type: string; level: number; aglutinationCode: string | null; overridden: boolean; }
interface GroupRow { parentId: string; parentCode: string; parentName: string; parentLevel: number; groupCode: string | null; children: ChildRow[]; }

const TIPO_OPTS = [{ v: 'BP', l: 'BP — Balanço Patrimonial' }, { v: 'DRE', l: 'DRE — Demonstrativo de Resultado' }];
const ANO_OPTS = Array.from({ length: 2025 - 2015 + 1 }, (_, i) => 2025 - i);

export default function VisoesContabeisPage() {
  const [anoBase, setAnoBase] = useState(2025);
  const [tipo, setTipo] = useState('BP');
  const [leiaute] = useState(9);

  const [activeView, setActiveView] = useState<AccountingView | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [rfbCodes, setRfbCodes] = useState<RfbCode[]>([]);
  const [rfbCount, setRfbCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // dirty: accountId -> aglutinationCode ('') = remover
  const [dirty, setDirty] = useState<Record<string, string>>({});

  // ── Carregar/criar view ───────────────────────────────────────────────────
  const loadOrCreateView = useCallback(async () => {
    setLoading(true);
    try {
      const all = (await api.get('/sped/visoes/views')).data;
      let view = all.find((v: AccountingView) => v.anoBase === anoBase && v.tipo === tipo) ?? null;
      if (!view) {
        const r = await api.post('/sped/visoes/views', {
          name: tipo === 'BP' ? `Balanço Patrimonial ${anoBase}` : `DRE ${anoBase}`,
          tipo, leiaute, anoBase,
        });
        view = r.data;
      }
      setActiveView(view);

      const [grpR, rfbR, cntR] = await Promise.all([
        api.get('/sped/visoes/views/' + view.id + '/mappings/grouped'),
        api.get('/sped/visoes/rfb-codes', { params: { leiaute, anoBase, tipo } }),
        api.get('/sped/visoes/rfb-codes', { params: { leiaute, anoBase } }),
      ]);
      setGroups(grpR.data);
      setRfbCodes(rfbR.data);
      setRfbCount(cntR.data.length);
      setDirty({});
    } catch (e: any) {
      Swal.fire('Erro', e?.response?.data?.message ?? 'Falha ao carregar visão', 'error');
    } finally {
      setLoading(false);
    }
  }, [anoBase, tipo, leiaute]);

  useEffect(() => { loadOrCreateView(); }, [loadOrCreateView]);

  // ── Helpers dirty ────────────────────────────────────────────────────────
  const effectiveCode = (accountId: string, savedCode: string | null) =>
    dirty[accountId] !== undefined ? dirty[accountId] : (savedCode ?? '');

  const effectiveGroupCode = (group: GroupRow) => {
    const codes = group.children.map(c => effectiveCode(c.accountId, c.aglutinationCode)).filter(Boolean);
    const unique = [...new Set(codes)];
    if (unique.length === 0) return '';
    if (unique.length === 1) return unique[0];
    return '__mixed__';
  };

  // Aplicar código a todas as filhas do grupo
  const handleGroupSelect = (group: GroupRow, code: string) => {
    const updates: Record<string, string> = {};
    group.children.forEach(c => { updates[c.accountId] = code; });
    setDirty(prev => ({ ...prev, ...updates }));
  };

  const handleChildSelect = (accountId: string, code: string) => {
    setDirty(prev => ({ ...prev, [accountId]: code }));
  };

  const handleGroupRemove = (group: GroupRow) => {
    const updates: Record<string, string> = {};
    group.children.forEach(c => { updates[c.accountId] = ''; });
    setDirty(prev => ({ ...prev, ...updates }));
  };

  const toggleExpand = (parentId: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(parentId) ? next.delete(parentId) : next.add(parentId);
      return next;
    });
  };

  // ── Salvar ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!activeView) return;
    setSaving(true);
    try {
      const toUpsert = Object.entries(dirty).filter(([, c]) => c !== '').map(([accountId, aglutinationCode]) => ({ accountId, aglutinationCode }));
      const toDelete = Object.entries(dirty).filter(([, c]) => c === '').map(([accountId]) => accountId);
      if (toUpsert.length) await api.post('/sped/visoes/views/' + activeView.id + '/mappings/bulk', { mappings: toUpsert });
      await Promise.all(toDelete.map(aid => api.delete('/sped/visoes/views/' + activeView.id + '/mappings/' + aid)));
      Swal.fire({ icon: 'success', title: 'Mapeamentos salvos', timer: 1500, showConfirmButton: false });
      await loadOrCreateView();
    } catch (e: any) {
      Swal.fire('Erro', e?.response?.data?.message ?? 'Falha ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Auto-match ───────────────────────────────────────────────────────────
  const handleAutoMatch = async () => {
    if (!activeView) return;
    const requestedViewId = activeView.id; // captura o alvo no momento do clique
    const conf = await Swal.fire({ title: 'Auto-mapear contas?', text: 'Sugerirá códigos RFB por grupo/tipo. Você pode revisar antes de salvar.', icon: 'question', showCancelButton: true, confirmButtonColor: '#111111', confirmButtonText: 'Sugerir' });
    if (!conf.isConfirmed) return;
    try {
      const r = await api.post('/sped/visoes/views/' + requestedViewId + '/auto-match', { leiaute, anoBase });
      // Race condition real: se o usuario trocou Ano/Tipo enquanto a resposta estava em
      // voo, activeView ja mudou para outra visao (e dirty ja foi limpo por
      // loadOrCreateView). Aplicar a resposta velha por cima escreveria sugestoes da
      // visao antiga dentro do estado da visao nova - descobri isso na pratica: 81
      // contas patrimoniais do BP foram parar salvas dentro da visao DRE (01/08/2026).
      if (!activeView || activeView.id !== requestedViewId) {
        console.warn('Auto-match: resposta descartada, view mudou durante a chamada.');
        return;
      }
      const suggestions: { accountId: string; aglutinationCode: string }[] = r.data.suggestions;
      const newDirty = { ...dirty };
      suggestions.forEach(s => { newDirty[s.accountId] = s.aglutinationCode; });
      setDirty(newDirty);
      Swal.fire({ icon: 'info', title: r.data.total + ' sugestões aplicadas', text: 'Revise e clique em Salvar para confirmar.', confirmButtonColor: '#111111' });
    } catch (e: any) {
      Swal.fire('Erro', e?.response?.data?.message ?? 'Falha no auto-match', 'error');
    }
  };

  // ── Import RFB ───────────────────────────────────────────────────────────
  const handleImportRfb = async () => {
    const { value: file } = await Swal.fire({ title: 'Importar tabela RFB', input: 'file', inputAttributes: { accept: '.json' }, confirmButtonColor: '#111111', showCancelButton: true });
    if (!file) return;
    try {
      const text = await file.text();
      const codes = JSON.parse(text);
      await api.post('/sped/visoes/rfb-codes/import', { codes });
      Swal.fire({ icon: 'success', title: codes.length + ' códigos importados', timer: 1500, showConfirmButton: false });
      await loadOrCreateView();
    } catch (e: any) {
      Swal.fire('Erro', 'Falha ao importar JSON RFB', 'error');
    }
  };

  // ── Estatísticas ─────────────────────────────────────────────────────────
  const allChildren = useMemo(() => groups.flatMap(g => g.children), [groups]);
  const totalAnalytic = allChildren.length;
  const totalMapped = allChildren.filter(c => effectiveCode(c.accountId, c.aglutinationCode) !== '').length;
  const dirtyCount = Object.values(dirty).filter(v => v !== '').length;

  // ── Select RFB agrupado ──────────────────────────────────────────────────
  const rfbGroups = useMemo(() => {
    const top = rfbCodes.filter(c => c.nivel === 1);
    return top.map(g => ({
      label: g.codigo + ' — ' + g.descricao,
      options: rfbCodes.filter(c => c.codigo.startsWith(g.codigo + '.') || c.codigo === g.codigo),
    }));
  }, [rfbCodes]);

  const RfbSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ flex: 1, border: '0.5px solid ' + (value && value !== '__mixed__' ? '#D1D5DB' : '#FCA5A5'), borderRadius: 6, padding: '5px 8px', fontSize: 12, background: value && value !== '__mixed__' ? 'white' : '#FEF2F2' }}>
      <option value="">{value === '__mixed__' ? '— Múltiplos valores —' : '— Selecionar código RFB —'}</option>
      {rfbGroups.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.descricao}</option>)}
        </optgroup>
      ))}
    </select>
  );

  // ── Filtro ───────────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    const q = filter.toLowerCase();
    return groups.filter(g => {
      const groupMatch = !q || g.parentCode.toLowerCase().includes(q) || g.parentName.toLowerCase().includes(q);
      const childMatch = g.children.some(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
      const hasUnmapped = !onlyUnmapped || g.children.some(c => !effectiveCode(c.accountId, c.aglutinationCode));
      return (groupMatch || childMatch) && hasUnmapped;
    });
  }, [groups, filter, onlyUnmapped, dirty]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ background: '#7C3AED', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>SPED</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Visões Contábeis (I052)</h1>
        </div>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 13 }}>Mapeie grupos de contas analíticas aos códigos de aglutinação RFB — gera I051/I052 para o Bloco J do ECD.</p>
      </div>

      {/* Filtros contexto */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>ANO BASE</label>
          <select value={anoBase} onChange={e => setAnoBase(Number(e.target.value))} style={selStyle}>
            {ANO_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>TIPO</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={selStyle}>
            {TIPO_OPTS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 12, color: rfbCount > 0 ? '#059669' : '#DC2626', background: rfbCount > 0 ? '#D1FAE5' : '#FEE2E2', padding: '4px 10px', borderRadius: 99, fontWeight: 600 }}>
            {rfbCount > 0 ? `✓ ${rfbCount} códigos RFB` : '⚠ Sem códigos RFB'}
          </span>
        </div>
        <button onClick={handleImportRfb} style={{ ...btnSec, marginTop: 14, fontSize: 11 }}>
          {rfbCount > 0 ? '↑ Reimportar RFB' : 'Importar JSON RFB'}
        </button>
      </div>

      {/* Barra status + ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#374151' }}>
          <strong>{totalAnalytic}</strong> contas analíticas &nbsp;·&nbsp;
          <strong style={{ color: '#059669' }}>{totalMapped}</strong> mapeadas &nbsp;·&nbsp;
          <strong style={{ color: '#DC2626' }}>{totalAnalytic - totalMapped}</strong> sem mapear
          {dirtyCount > 0 && <span style={{ marginLeft: 12, color: '#D97706', fontWeight: 600 }}>● {dirtyCount} alteração(ões) não salvas</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleAutoMatch} style={btnSec} disabled={loading}>Auto-mapear</button>
          <button onClick={handleSave} style={btnPri} disabled={saving || loading || Object.keys(dirty).length === 0}>
            {saving ? 'Salvando...' : `Salvar${dirtyCount > 0 ? ' (' + dirtyCount + ')' : ''}`}
          </button>
        </div>
      </div>

      {/* Filtro tabela */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <input placeholder="🔍  Filtrar por código ou nome..." value={filter} onChange={e => setFilter(e.target.value)}
          style={{ flex: 1, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '7px 12px', fontSize: 13 }} />
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
          <input type="checkbox" checked={onlyUnmapped} onChange={e => setOnlyUnmapped(e.target.checked)} />
          Só sem mapeamento
        </label>
      </div>

      {/* Tabela grupos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>Carregando...</div>
      ) : (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={thStyle}>GRUPO / CONTA</th>
                <th style={{ ...thStyle, width: 400 }}>CÓDIGO RFB (I052)</th>
                <th style={{ ...thStyle, width: 70, textAlign: 'center' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>Nenhum grupo encontrado</td></tr>
              )}
              {filteredGroups.map(group => {
                const gCode = effectiveGroupCode(group);
                const isExpanded = expanded.has(group.parentId);
                const allMapped = group.children.every(c => effectiveCode(c.accountId, c.aglutinationCode));
                const isDirtyGroup = group.children.some(c => dirty[c.accountId] !== undefined);

                return (
                  <React.Fragment key={group.parentId}>
                    {/* Linha do grupo */}
                    <tr style={{ background: isDirtyGroup ? '#FFFBEB' : '#F9FAFB', borderTop: '0.5px solid #E5E7EB' }}>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => toggleExpand(group.parentId)}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: '#6B7280', padding: '2px 4px', borderRadius: 4 }}>
                            {isExpanded ? '▼' : '▶'}
                          </button>
                          <span style={{ fontFamily: 'monospace', color: '#7C3AED', fontWeight: 700, fontSize: 12 }}>{group.parentCode}</span>
                          <span style={{ color: '#374151', fontWeight: 600 }}>{group.parentName}</span>
                          <span style={{ fontSize: 11, color: '#9CA3AF' }}>({group.children.length} conta{group.children.length !== 1 ? 's' : ''})</span>
                        </div>
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <RfbSelect value={gCode === '__mixed__' ? '__mixed__' : gCode} onChange={v => handleGroupSelect(group, v)} />
                          {gCode && gCode !== '__mixed__' && (
                            <button onClick={() => handleGroupRemove(group)} title="Remover mapeamento do grupo"
                              style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}>×</button>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                        {gCode === '__mixed__'
                          ? <span style={{ color: '#D97706', fontSize: 13 }}>≠</span>
                          : allMapped
                            ? <span style={{ color: '#059669', fontSize: 16 }}>✓</span>
                            : <span style={{ color: '#FCA5A5', fontSize: 13 }}>⚠</span>}
                      </td>
                    </tr>

                    {/* Linhas filhas (expandidas) */}
                    {isExpanded && group.children.map(child => {
                      const cCode = effectiveCode(child.accountId, child.aglutinationCode);
                      const isChildDirty = dirty[child.accountId] !== undefined;
                      const diverges = cCode !== gCode && gCode !== '' && gCode !== '__mixed__';
                      return (
                        <tr key={child.accountId} style={{ background: isChildDirty ? '#FFFDE7' : '#FAFAFA', borderTop: '0.5px solid #F5F5F5' }}>
                          <td style={{ padding: '7px 12px 7px 44px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: 'monospace', color: '#9CA3AF', fontSize: 11 }}>{child.reducedCode || child.code}</span>
                              <span style={{ color: '#6B7280' }}>{child.name}</span>
                              {diverges && <span style={{ fontSize: 10, color: '#D97706', background: '#FEF3C7', padding: '1px 6px', borderRadius: 99, fontWeight: 600 }}>✎ individual</span>}
                            </div>
                          </td>
                          <td style={{ padding: '5px 12px' }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <RfbSelect value={cCode} onChange={v => handleChildSelect(child.accountId, v)} />
                              {cCode && (
                                <button onClick={() => handleChildSelect(child.accountId, '')} title="Remover"
                                  style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}>×</button>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '7px 12px' }}>
                            {cCode
                              ? <span style={{ color: diverges ? '#D97706' : '#059669', fontSize: 16 }}>{diverges ? '✎' : '✓'}</span>
                              : <span style={{ color: '#FCA5A5', fontSize: 13 }}>⚠</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 };
const selStyle: React.CSSProperties = { border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 13, background: 'white', minWidth: 200 };
const btnPri: React.CSSProperties = { background: '#111111', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const btnSec: React.CSSProperties = { background: '#fff', color: '#374151', border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #E5E7EB' };