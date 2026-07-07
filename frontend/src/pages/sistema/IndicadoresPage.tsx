// frontend/src/pages/sistema/IndicadoresPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CdiTabelaPage from '../accounting/investments/CdiTabelaPage';
import api from '../../services/api';

const INDICADORES = [
  { key: 'SELIC', label: 'Selic',  cor: '#0369A1', fonte: 'BCB Serie 11', desc: 'Taxa Selic acumulada no mes (% a.m.)' },
  { key: 'IPCA',  label: 'IPCA',   cor: '#7C3AED', fonte: 'IBGE',         desc: 'Indice Nacional de Precos ao Consumidor Amplo (% a.m.)' },
  { key: 'IGPM',  label: 'IGP-M',  cor: '#EA580C', fonte: 'FGV/IBRE',     desc: 'Indice Geral de Precos - Mercado (% a.m.)' },
  { key: 'IGPDI', label: 'IGP-DI', cor: '#B45309', fonte: 'FGV/IBRE',     desc: 'Indice Geral de Precos - Disponibilidade Interna (% a.m.)' },
  { key: 'INPC',  label: 'INPC',   cor: '#0891B2', fonte: 'IBGE',         desc: 'Indice Nacional de Precos ao Consumidor (% a.m.)' },
  { key: 'TR',    label: 'TR',     cor: '#6B7280', fonte: 'BCB',           desc: 'Taxa Referencial (% a.m.)' },
  { key: 'CDI',   label: 'CDI',    cor: '#15803D', fonte: 'BCB Serie 12',  desc: 'Certificado de Deposito Interbancario — ver tabela dedicada' },
];

const S = {
  page:  { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)' } as React.CSSProperties,
  card:  { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 } as React.CSSProperties,
  input: { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 9px', fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none' } as React.CSSProperties,
  label: { fontSize: 10, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 },
  btn:   { height: 30, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 12px', fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' } as React.CSSProperties,
  btnP:  { height: 30, border: 'none', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: '#111', color: '#fff', fontWeight: 500 } as React.CSSProperties,
  th:    { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, padding: '7px 10px', textAlign: 'right' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', whiteSpace: 'nowrap' as const },
  thL:   { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, padding: '7px 10px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  td:    { padding: '6px 10px', textAlign: 'right' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12, whiteSpace: 'nowrap' as const },
  tdL:   { padding: '6px 10px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12 },
  tab:   (a: boolean, cor = '#111') => ({ height: 30, border: '0.5px solid ' + (a ? cor : 'var(--color-border-tertiary)'), borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: a ? cor : 'var(--color-background-primary)', color: a ? '#fff' : 'var(--color-text-secondary)', fontWeight: a ? 600 : 400 } as React.CSSProperties),
};

function fmtComp(s: string) { const [y,m] = s.split('-'); return m+'/'+y; }
function fmtN(v: any, d = 4) { return v != null ? parseFloat(v).toFixed(d) + '%' : '—'; }
function fmtAccum(rows: any[]) {
  let acum = 1;
  return rows.map(r => { acum *= (1 + parseFloat(r.taxaMensal)/100); return acum - 1; });
}

function parseTsv(raw: string, indicador: string): any[] {
  const lines = raw.trim().split('\n').filter(l => l.trim() && !l.startsWith('//'));
  const result: any[] = [];
  for (const line of lines) {
    const parts = line.split(/[\t;,]/).map(p => p.trim().replace(',','.'));
    if (parts.length < 2) continue;
    const comp = parts[0]; // AAAA-MM
    const taxa = parseFloat(parts[1]);
    if (!comp.match(/^\d{4}-\d{2}$/) || isNaN(taxa)) continue;
    result.push({ indicador, competencia: comp, taxaMensal: taxa, fonte: parts[2]?.trim() || undefined });
  }
  return result;
}

export function IndicadoresPage() {
  const [aba, setAba] = useState('SELIC');
  const [subAba, setSubAba] = useState<'tabela'|'importar'>('tabela');
  const [dados, setDados] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [anoFiltro, setAnoFiltro] = useState('');
  const [tsv, setTsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  // Entrada manual
  const [manComp, setManComp] = useState('');
  const [manTaxa, setManTaxa] = useState('');
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const ind = INDICADORES.find(i => i.key === aba)!;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { indicador: aba };
      if (anoFiltro) params.ano = anoFiltro;
      const { data } = await api.get('/tabelas-legais/indicadores', { params });
      setDados(data ?? []);
    } catch {} finally { setLoading(false); }
  }, [aba, anoFiltro]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveManual() {
    if (!manComp || !manTaxa) return;
    setSaving(true);
    try {
      await api.post('/tabelas-legais/indicadores', { indicador: aba, competencia: manComp, taxaMensal: parseFloat(manTaxa.replace(',','.')) });
      setManComp(''); setManTaxa('');
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    finally { setSaving(false); }
  }

  async function handleImportLote() {
    const registros = parseTsv(tsv, aba);
    if (!registros.length) { alert('Nenhum registro valido encontrado. Formato: AAAA-MM TAB taxa'); return; }
    setImporting(true);
    try {
      const r = await api.post('/tabelas-legais/indicadores/lote', { registros });
      setImportResult(r.data);
      setTsv('');
      load();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro na importacao'); }
    finally { setImporting(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return;
    await api.delete('/tabelas-legais/indicadores/' + id);
    load();
  }

  const anoAtual = new Date().getFullYear();
  const acums = fmtAccum([...dados].reverse());

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0891B2', background: '#ECFEFF', padding: '2px 8px', borderRadius: 4 }}>SISTEMA</span>
            <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Indicadores Economicos</h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>Serie historica mensal — Selic, IPCA, IGP-M, INPC, TR</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={S.btn} onClick={() => navigate('/app/sistema/indicadores/calculadora')}>Calculadora de Correcao</button>
          <select style={{ ...S.input, width: 100 }} value={anoFiltro} onChange={e => setAnoFiltro(e.target.value)}>
            <option value="">Todos</option>
            {Array.from({length: 14}, (_,i) => String(anoAtual - i)).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* Abas indicador */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {INDICADORES.map(i => (
          <button key={i.key} style={S.tab(aba === i.key, i.cor)}
            onClick={() => { setAba(i.key); setSubAba('tabela'); }}>
            {i.label}

          </button>
        ))}
      </div>

      {/* Sub-abas */}
      {aba !== 'CDI' && <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button style={S.tab(subAba==='tabela')} onClick={() => setSubAba('tabela')}>Tabela</button>
        <button style={S.tab(subAba==='importar')} onClick={() => setSubAba('importar')}>Importar / Adicionar</button>
      </div>}

      {aba === 'CDI' && (
        <div style={{ marginTop: 0 }}>
          <CdiTabelaPage />
        </div>
      )}

      {aba !== 'CDI' && subAba === 'tabela' && (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 500, color: ind.cor }}>{ind.label}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 8 }}>{ind.desc}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Fonte: {ind.fonte} · {dados.length} registros</span>
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>Carregando...</div> :
           dados.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)', fontSize: 13 }}>Nenhum dado cadastrado. Use "Importar / Adicionar" para incluir dados.</div> : (
            <div style={{ overflowX: 'auto', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                <thead><tr>
                  <th style={S.thL}>Competencia</th>
                  <th style={S.th}>Taxa Mensal (%)</th>
                  <th style={S.th}>Acum. Ano (%)</th>
                  <th style={S.th}>Acum. 12m (%)</th>
                  <th style={S.th}>Fonte</th>
                  <th style={S.th}></th>
                </tr></thead>
                <tbody>
                  {dados.map((d, idx) => (
                    <tr key={d.id} style={{ background: idx % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)' }}>
                      <td style={{ ...S.tdL, fontWeight: 500 }}>{fmtComp(d.competencia)}</td>
                      <td style={{ ...S.td, color: ind.cor, fontWeight: 600 }}>{fmtN(d.taxaMensal)}</td>
                      <td style={S.td}>{d.taxaAnual ? fmtN(d.taxaAnual) : '—'}</td>
                      <td style={S.td}>{d.acum12m ? fmtN(d.acum12m) : '—'}</td>
                      <td style={{ ...S.td, fontSize: 11, color: 'var(--color-text-secondary)' }}>{d.fonte ?? '—'}</td>
                      <td style={S.td}>
                        <button onClick={() => handleDelete(d.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontSize: 12 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aba !== 'CDI' && subAba === 'importar' && (
        <div>
          {/* Entrada manual */}
          <div style={S.card}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', marginBottom: 12 }}>Adicionar registro manual — {ind.label}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '160px 160px auto', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={S.label}>Competencia</label>
                <input style={S.input} type="month" value={manComp} onChange={e => setManComp(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Taxa Mensal (%)</label>
                <input style={S.input} type="text" placeholder="ex: 0.8313" value={manTaxa} onChange={e => setManTaxa(e.target.value)} />
              </div>
              <button style={S.btnP} onClick={handleSaveManual} disabled={saving || !manComp || !manTaxa}>
                {saving ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </div>

          {/* Importacao em lote */}
          <div style={S.card}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Importacao em lote — {ind.label}</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
              Cole os dados no formato TSV (tabulado) ou CSV: <code>AAAA-MM[tab]taxa_mensal</code><br/>
              Exemplo: <code>2025-010.9643</code> (taxa em % ao mes)<br/>
              Fonte recomendada: BCB — Sistema Gerenciador de Series Temporais (SGS)
            </p>
            <textarea
              style={{ width: '100%', height: 200, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '8px 10px', fontSize: 12, fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' as const, background: 'var(--color-background-secondary)' }}
              placeholder={"2025-01\t0.9643\n2025-02\t1.1690\n2025-03\t1.3134"}
              value={tsv} onChange={e => setTsv(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
              <button style={S.btnP} onClick={handleImportLote} disabled={importing || !tsv.trim()}>
                {importing ? 'Importando...' : 'Importar ' + parseTsv(tsv, aba).length + ' registro(s)'}
              </button>
              {importResult && <span style={{ fontSize: 12, color: '#15803D' }}>✓ {importResult.total} registro(s) importado(s)</span>}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: 8 }}>
        Fontes: BCB (Selic/TR), IBGE (IPCA/INPC), FGV/IBRE (IGP-M/IGP-DI). Dados para referencia — verificar sempre na fonte oficial.
      </div>
    </div>
  );
}
