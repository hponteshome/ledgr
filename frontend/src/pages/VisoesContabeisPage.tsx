// VisoesContabeisPage.tsx — frontend/src/pages/VisoesContabeisPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Swal from 'sweetalert2';

// ── Tipos ────────────────────────────────────────────────────────────────────
interface RfbCode { id: string; codigo: string; descricao: string; nivel: number; codigoPai?: string; ordem: number; tipo: string; }
interface AccountingView { id: string; name: string; tipo: string; leiaute: number; anoBase: number; _count?: { mappings: number }; }
interface MappingRow {
  id: string; code: string; reducedCode?: string; name: string;
  type: string; level: number; isAnalytic: boolean;
  mapping: { id: string; aglutinationCode: string } | null;
}

const TIPO_OPTS = [{ v: 'BP', l: 'BP — Balanço Patrimonial' }, { v: 'DRE', l: 'DRE — Demonstrativo de Resultado' }];
const ANO_OPTS = [2025, 2024, 2023, 2022, 2021, 2020, 2019];

// ── Componente principal ──────────────────────────────────────────────────────
export default function VisoesContabeisPage() {
  // Seleção de contexto
  const [anoBase, setAnoBase] = useState(2024);
  const [tipo, setTipo] = useState('BP');
  const [leiaute] = useState(9);

  // Estado geral
  const [views, setViews] = useState<AccountingView[]>([]);
  const [activeView, setActiveView] = useState<AccountingView | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [rfbCodes, setRfbCodes] = useState<RfbCode[]>([]);
  const [rfbCount, setRfbCount] = useState(0);
  const [dirty, setDirty] = useState<Record<string, string>>({}); // accountId → aglCode pendente
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);

  // ── Carregar views da empresa ────────────────────────────────────────────
  const loadViews = useCallback(async () => {
    try {
      const r = await api.get('/sped/visoes/views');
      setViews(r.data);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadViews(); }, [loadViews]);

  // ── Carregar/criar view ao mudar ano+tipo ────────────────────────────────
  const loadOrCreateView = useCallback(async () => {
    setLoading(true);
    try {
      // Procura view existente para o par ano+tipo
      const all: AccountingView[] = (await api.get('/sped/visoes/views')).data;
      setViews(all);
      let view = all.find(v => v.anoBase === anoBase && v.tipo === tipo) ?? null;

      if (!view) {
        // Cria automaticamente
        const r = await api.post('/sped/visoes/views', { name: tipo === 'BP' ? `Balanço Patrimonial ${anoBase}` : `DRE ${anoBase}`, tipo, leiaute, anoBase });
        view = r.data;
        await loadViews();
      }
      setActiveView(view);

      // Carrega mapeamentos
      const mR = await api.get('/sped/visoes/views/' + view!.id + '/mappings');
      setRows(mR.data.map((m: any) => ({
        id: m.accountId,
        code: m.account.code,
        reducedCode: m.account.reducedCode,
        name: m.account.name,
        type: m.account.type,
        level: m.account.level,
        isAnalytic: m.account.isAnalytic,
        mapping: m.aglutinationCode ? { id: m.id, aglutinationCode: m.aglutinationCode } : null,
      })));
      setDirty({});

      // Carrega códigos RFB
      const [rfbR, cntR] = await Promise.all([
        api.get('/sped/visoes/rfb-codes', { params: { leiaute, anoBase, tipo } }),
        api.get('/sped/visoes/rfb-codes', { params: { leiaute, anoBase } }),
      ]);
      setRfbCodes(rfbR.data);
      setRfbCount(cntR.data.length);
    } catch (e: any) {
      Swal.fire('Erro', e?.response?.data?.message ?? 'Falha ao carregar visão', 'error');
    } finally {
      setLoading(false);
    }
  }, [anoBase, tipo, leiaute, loadViews]);

  useEffect(() => { loadOrCreateView(); }, [loadOrCreateView]);

  // ── Mapeamentos locais (dirty) ───────────────────────────────────────────
  const effectiveCode = (row: MappingRow) => dirty[row.id] !== undefined ? dirty[row.id] : (row.mapping?.aglutinationCode ?? '');

  const handleSelect = (accountId: string, code: string) => {
    setDirty(prev => ({ ...prev, [accountId]: code }));
  };

  const handleRemove = (accountId: string) => {
    setDirty(prev => ({ ...prev, [accountId]: '' }));
  };

  // ── Salvar em lote ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!activeView) return;
    setSaving(true);
    try {
      // Monta itens: dirty com valor → upsert; dirty vazio → delete
      const toUpsert = Object.entries(dirty)
        .filter(([, c]) => c !== '')
        .map(([accountId, aglutinationCode]) => ({ accountId, aglutinationCode }));
      const toDelete = Object.entries(dirty)
        .filter(([, c]) => c === '')
        .map(([accountId]) => accountId);

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

  // ── Auto-match ────────────────────────────────────────────────────────────
  const handleAutoMatch = async () => {
    if (!activeView) return;
    const conf = await Swal.fire({ title: 'Auto-mapear contas?', text: 'Sugerirá códigos RFB por tipo de conta. Você pode revisar antes de salvar.', icon: 'question', showCancelButton: true, confirmButtonColor: '#111111', confirmButtonText: 'Sugerir' });
    if (!conf.isConfirmed) return;
    try {
      const r = await api.post('/sped/visoes/views/' + activeView.id + '/auto-match', { leiaute, anoBase });
      const suggestions: { accountId: string; aglutinationCode: string }[] = r.data.suggestions;
      const newDirty = { ...dirty };
      suggestions.forEach(s => { newDirty[s.accountId] = s.aglutinationCode; });
      setDirty(newDirty);
      Swal.fire({ icon: 'info', title: r.data.total + ' sugestões aplicadas', text: 'Revise e clique em Salvar para confirmar.', confirmButtonColor: '#111111' });
    } catch (e: any) {
      Swal.fire('Erro', e?.response?.data?.message ?? 'Falha no auto-match', 'error');
    }
  };

  // ── Import JSON RFB ───────────────────────────────────────────────────────
  const handleImportRfb = async () => {
    const { value: file } = await Swal.fire({
      title: 'Importar tabela RFB',
      text: 'Selecione o arquivo JSON com os códigos de aglutinação RFB.',
      input: 'file',
      inputAttributes: { accept: '.json' },
      confirmButtonColor: '#111111',
      showCancelButton: true,
    });
    if (!file) return;
    try {
      const text = await (file as File).text();
      const codes = JSON.parse(text);
      const r = await api.post('/sped/visoes/rfb-codes/import', { codes });
      Swal.fire({ icon: 'success', title: r.data.imported + ' códigos importados', timer: 1800, showConfirmButton: false });
      await loadOrCreateView();
    } catch {
      Swal.fire('Erro', 'Arquivo inválido ou falha na importação.', 'error');
    }
  };

  // ── Preview I052 ──────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!activeView) return;
    try {
      const r = await api.get('/sped/visoes/views/' + activeView.id + '/mappings');
      const lines: any[] = r.data.filter((m: any) => m.aglutinationCode);
      const text = lines.map(m => `|I052|${m.account?.reducedCode || m.account?.code}|${m.aglutinationCode}|`).join('\n');
      Swal.fire({
        title: 'Preview I052 (' + lines.length + ' registros)',
        html: '<pre style="text-align:left;font-size:11px;max-height:400px;overflow:auto">' + text + '</pre>',
        width: 700,
        confirmButtonColor: '#111111',
      });
    } catch { /**/ }
  };

  // ── Filtros visuais ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (!r.isAnalytic) return false;
      // Filtrar contas por tipo de view: BP=ASSET/LIABILITY/EQUITY, DRE=REVENUE/EXPENSE
      if (tipo === "BP" && !["ASSET", "LIABILITY", "EQUITY"].includes(r.type)) return false;
      if (tipo === "DRE" && !["REVENUE", "EXPENSE"].includes(r.type)) return false;
      if (onlyUnmapped && effectiveCode(r)) return false;
      if (filter) {
        const q = filter.toLowerCase();
        return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, filter, onlyUnmapped, dirty]);

  const totalAnalytic = rows.filter(r => r.isAnalytic).length;
  const totalMapped = rows.filter(r => r.isAnalytic && effectiveCode(r)).length;
  const dirtyCount = Object.values(dirty).filter(v => v !== '').length;

  // ── Opções do select RFB agrupadas por nível 1 ───────────────────────────
  const rfbGroups = useMemo(() => {
    const top = rfbCodes.filter(c => c.nivel === 1);
    return top.map(g => ({
      label: g.codigo + ' — ' + g.descricao,
      options: rfbCodes.filter(c => c.codigo.startsWith(g.codigo + '.') || c.codigo === g.codigo),
    }));
  }, [rfbCodes]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <span style={{ background: '#7C3AED', color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>SPED</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Visões Contábeis (I052)</h1>
        </div>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 13 }}>
          Mapeie as contas analíticas aos códigos de aglutinação RFB — gera os registros I052 para o Bloco J do ECD.
        </p>
      </div>

      {/* Filtros de contexto */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>ANO BASE</label>
          <select value={anoBase} onChange={e => setAnoBase(Number(e.target.value))} style={selStyle}>
            {ANO_OPTS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>TIPO</label>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={selStyle}>
            {TIPO_OPTS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 12, color: rfbCount > 0 ? '#059669' : '#DC2626', background: rfbCount > 0 ? '#D1FAE5' : '#FEE2E2', padding: '4px 10px', borderRadius: 99, fontWeight: 600 }}>
            {rfbCount > 0 ? `✓ ${rfbCount} códigos RFB` : '⚠ Sem códigos RFB'}
          </span>
        </div>
        {rfbCount === 0 && (
          <button onClick={handleImportRfb} style={{ ...btnSec, marginTop: 14 }}>Importar JSON RFB</button>
        )}
        {rfbCount > 0 && (
          <button onClick={handleImportRfb} style={{ ...btnSec, marginTop: 14, fontSize: 11 }}>↑ Reimportar RFB</button>
        )}
      </div>

      {/* Barra de status + ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#374151' }}>
          <strong>{totalAnalytic}</strong> contas analíticas &nbsp;·&nbsp;
          <strong style={{ color: '#059669' }}>{totalMapped}</strong> mapeadas &nbsp;·&nbsp;
          <strong style={{ color: '#DC2626' }}>{totalAnalytic - totalMapped}</strong> sem mapear
          {dirtyCount > 0 && <span style={{ marginLeft: 12, color: '#D97706', fontWeight: 600 }}>● {dirtyCount} alteração(ões) não salvas</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePreview} style={btnSec} disabled={loading}>Preview I052</button>
          <button onClick={handleAutoMatch} style={btnSec} disabled={loading}>Auto-mapear</button>
          <button onClick={handleSave} style={btnPri} disabled={saving || loading || Object.keys(dirty).length === 0}>
            {saving ? 'Salvando...' : `Salvar${dirtyCount > 0 ? ' (' + dirtyCount + ')' : ''}`}
          </button>
        </div>
      </div>

      {/* Filtro da tabela */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
        <input
          placeholder="🔍  Filtrar por código ou nome..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ flex: 1, border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '7px 12px', fontSize: 13 }}
        />
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#374151' }}>
          <input type="checkbox" checked={onlyUnmapped} onChange={e => setOnlyUnmapped(e.target.checked)} />
          Só sem mapeamento
        </label>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>Carregando...</div>
      ) : (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={thStyle}>CÓDIGO</th>
                <th style={thStyle}>CONTA</th>
                <th style={{ ...thStyle, width: 380 }}>CÓDIGO RFB (I052)</th>
                <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>Nenhuma conta encontrada</td></tr>
              )}
              {filtered.map(row => {
                const current = effectiveCode(row);
                const isDirty = dirty[row.id] !== undefined;
                const rfbSelected = rfbCodes.find(c => c.codigo === current);
                return (
                  <tr key={row.id} style={{ borderTop: '0.5px solid #F5F5F5', background: isDirty ? '#FFFBEB' : 'white' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#7C3AED', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {row.reducedCode || row.code}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#374151' }}>{row.name}</td>
                    <td style={{ padding: '6px 12px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select
                          value={current}
                          onChange={e => handleSelect(row.id, e.target.value)}
                          style={{ flex: 1, border: '0.5px solid ' + (current ? '#D1D5DB' : '#FCA5A5'), borderRadius: 6, padding: '5px 8px', fontSize: 12, background: current ? 'white' : '#FEF2F2' }}
                        >
                          <option value="">— Selecionar código RFB —</option>
                          {rfbGroups.map(g => (
                            <optgroup key={g.label} label={g.label}>
                              {g.options.map(o => (
                                <option key={o.codigo} value={o.codigo}>
                                  {o.codigo} — {o.descricao}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        {current && (
                          <button onClick={() => handleRemove(row.id)} title="Remover mapeamento"
                            style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}>×</button>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                      {current
                        ? <span style={{ color: '#059669', fontSize: 16 }}>✓</span>
                        : <span style={{ color: '#FCA5A5', fontSize: 13 }}>⚠</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Estilos inline ────────────────────────────────────────────────────────────
const selStyle: React.CSSProperties = { border: '0.5px solid #D1D5DB', borderRadius: 6, padding: '7px 10px', fontSize: 13, background: 'white', minWidth: 200 };
const btnPri: React.CSSProperties = { background: '#111111', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600 };
const btnSec: React.CSSProperties = { background: '#fff', color: '#374151', border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' };
const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '0.5px solid #E5E7EB' };