// frontend/src/pages/accounting/investments/CdiTabelaPage.tsx
import React, { useState, useMemo, useRef } from 'react';
import api from '../../../services/api';

interface CdiRow {
  id: string;
  date: string;
  dailyRate: number;
  monthlyAccum: number;
  yearAccum: number;
  accum30d: number;
  accum12m: number;
  accumIndex: number;
}

interface MonthlyRow {
  competence: string;
  businessDays: number;
  monthlyAccum: number;
  monthlyRateFactor: number;
}

const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR');
const fmtN    = (v: any, d=4) => v != null ? parseFloat(v).toFixed(d) : '—';
const fmtComp = (s: string) => s.split('-').reverse().join('/');

const S = {
  page:   { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)' } as React.CSSProperties,
  badge:  { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#EFF6FF', color: '#1D4ED8' } as React.CSSProperties,
  h1:     { fontSize: 15, fontWeight: 500, margin: 0 } as React.CSSProperties,
  card:   { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 } as React.CSSProperties,
  secTit: { fontSize: 11, fontWeight: 500, color: 'var(--color-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '.3px', marginBottom: 10 },
  kpiGrid:{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 } as React.CSSProperties,
  kpi:    { background: 'var(--color-background-secondary)', borderRadius: 8, padding: '11px 14px' } as React.CSSProperties,
  kpiLbl: { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: 'var(--color-text-secondary)', marginBottom: 3 },
  kpiVal: { fontSize: 18, fontWeight: 500 },
  kpiSub: { fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 },
  input:  { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 9px', fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none' } as React.CSSProperties,
  label:  { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.3px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 },
  btn:    { height: 30, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 12px', fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' } as React.CSSProperties,
  btnP:   { height: 30, border: 'none', borderRadius: 6, padding: '0 14px', fontSize: 12, cursor: 'pointer', background: '#111', color: '#fff', fontWeight: 500 } as React.CSSProperties,
  btnDng: { height: 28, border: '0.5px solid #FCA5A5', borderRadius: 6, padding: '0 10px', fontSize: 11, cursor: 'pointer', background: '#FEF2F2', color: '#B91C1C' } as React.CSSProperties,
  tblW:   { overflowX: 'auto' as const, border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8 },
  th:     { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '.3px', padding: '8px 10px', textAlign: 'right' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', whiteSpace: 'nowrap' as const },
  thL:    { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '.3px', padding: '8px 10px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  td:     { padding: '7px 10px', textAlign: 'right' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12, whiteSpace: 'nowrap' as const },
  tdL:    { padding: '7px 10px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12 },
  divider:{ border: 'none', borderTop: '0.5px solid var(--color-border-tertiary)', margin: '20px 0' } as React.CSSProperties,
  tab:    (active: boolean) => ({ height: 30, border: `0.5px solid ${active ? '#111' : 'var(--color-border-tertiary)'}`, borderRadius: 6, padding: '0 12px', fontSize: 12, cursor: 'pointer', background: active ? '#111' : 'var(--color-background-primary)', color: active ? '#fff' : 'var(--color-text-secondary)' } as React.CSSProperties),
};

function parseBrDate(s: string): string {
  const [d, m, y] = s.trim().split('/');
  if (!d || !m || !y) return '';
  const year = y.length === 2 ? '20' + y : y;
  return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

function parseTsv(raw: string) {
  const lines = raw.trim().split('\n').filter(l => l.trim());
  const rows: any[] = [];
  for (const line of lines) {
    const cols = line.split('\t').map(c => c.trim().replace(',', '.'));
    if (cols.length < 7) continue;
    const date = parseBrDate(cols[0]);
    if (!date) continue;
    rows.push({
      date,
      dailyRate:    parseFloat(cols[1]) || 0,
      monthlyAccum: parseFloat(cols[3]) || 0,
      yearAccum:    parseFloat(cols[4]) || 0,
      accum30d:     parseFloat(cols[5]) || 0,
      accum12m:     parseFloat(cols[6]) || 0,
      accumIndex:   parseFloat(cols[7]) || 0,
    });
  }
  return rows;
}
export default function CdiTabelaPage() {
  const [tab, setTab]           = useState<'diario'|'mensal'|'importar'|'atualizar'>('mensal');
  const [bulkComp,   setBulkComp]   = useState('');
  const [bulkRate,   setBulkRate]   = useState('');
  const [bulkDays,   setBulkDays]   = useState('');
  const [bulkJournal,setBulkJournal]= useState(false);
  const [bulkResult, setBulkResult] = useState<any[]>([]);
  const [bulkLoading,setBulkLoading]= useState(false);
  const [rows, setRows]         = useState<CdiRow[]>([]);
  const [monthly, setMonthly]   = useState<MonthlyRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState('');
  const [filterFrom, setFrom]   = useState('');
  const [filterTo,   setTo]     = useState('');
  const [pasteText,  setPaste]  = useState('');
  const [dailySortDir,  setDailySortDir]  = useState<'asc'|'desc'>('desc');
  const [monthlySortDir,setMonthlySortDir]= useState<'asc'|'desc'>('desc');
  const [newRow, setNewRow]     = useState({ date:'', dailyRate:'', monthlyAccum:'', yearAccum:'', accum30d:'', accum12m:'', accumIndex:'' });

  const loadMonthly = async () => {
    setLoading(true);
    try {
      const r = await api.get('/accounting/cdi/monthly', { params: { from: filterFrom||undefined, to: filterTo||undefined } });
      setMonthly(r.data);
    } catch { setMsg('Erro ao carregar taxas mensais'); }
    setLoading(false);
  };

  const loadDaily = async () => {
    setLoading(true);
    try {
      const r = await api.get('/accounting/cdi', { params: { from: filterFrom||undefined, to: filterTo||undefined } });
      setRows(r.data);
    } catch { setMsg('Erro ao carregar taxas diárias'); }
    setLoading(false);
  };

  const load = () => { tab === 'mensal' ? loadMonthly() : tab === 'diario' ? loadDaily() : null; };

  React.useEffect(() => { load(); }, [tab]);

  const importPaste = async () => {
    if (!pasteText.trim()) { setMsg('Cole os dados antes de importar'); return; }
    const parsed = parseTsv(pasteText);
    if (!parsed.length) { setMsg('Nenhuma linha válida encontrada. Verifique o formato.'); return; }
    setLoading(true);
    try {
      const r = await api.post('/accounting/cdi/import', { rows: parsed });
      setMsg(`Importado: ${r.data.inserted} novos · ${r.data.updated} atualizados de ${r.data.total} linhas`);
      setPaste('');
      loadMonthly();
    } catch { setMsg('Erro na importação'); }
    setLoading(false);
  };

  const addSingle = async () => {
    if (!newRow.date) { setMsg('Data obrigatória'); return; }
    setLoading(true);
    try {
      await api.post('/accounting/cdi/import', { rows: [{
        date: newRow.date,
        dailyRate:    parseFloat(newRow.dailyRate)    || 0,
        monthlyAccum: parseFloat(newRow.monthlyAccum) || 0,
        yearAccum:    parseFloat(newRow.yearAccum)    || 0,
        accum30d:     parseFloat(newRow.accum30d)     || 0,
        accum12m:     parseFloat(newRow.accum12m)     || 0,
        accumIndex:   parseFloat(newRow.accumIndex)   || 0,
      }]});
      setMsg('Registro salvo');
      setNewRow({ date:'', dailyRate:'', monthlyAccum:'', yearAccum:'', accum30d:'', accum12m:'', accumIndex:'' });
      load();
    } catch { setMsg('Erro ao salvar'); }
    setLoading(false);
  };

  const deleteRow = async (date: string) => {
    if (!confirm(`Excluir ${fmtDate(date)}?`)) return;
    try {
      await api.delete(`/accounting/cdi/${date.slice(0,10)}`);
      setMsg('Excluído');
      load();
    } catch { setMsg('Erro ao excluir'); }
  };

  const kpis = useMemo(() => {
    if (!monthly.length) return null;
    const last  = monthly[monthly.length - 1];
    const first = monthly[0];
    const acum  = monthly.reduce((s, m) => s * (1 + m.monthlyRateFactor), 1) - 1;
    return { last, first, acum: acum * 100, count: monthly.length };
  }, [monthly]);

  const runBulkUpdate = async () => {
    if (!bulkComp || !bulkRate) { setMsg('Informe competencia e taxa CDI'); return; }
    setBulkLoading(true); setBulkResult([]);
    try {
      const r = await api.post('/accounting/cdi/import', { rows: [{
        date: bulkComp + '-01',
        dailyRate: 0,
        monthlyAccum: parseFloat(bulkRate),
        yearAccum: 0, accum30d: 0, accum12m: 0, accumIndex: 0,
      }]});
      const bulk = await api.post('/accounting/fixed-income/bulk-update', {
        competence: bulkComp,
        indexerRate: parseFloat(bulkRate) / 100,
        businessDays: bulkDays ? parseInt(bulkDays) : undefined,
        generateJournalEntry: bulkJournal,
      });
      setBulkResult(bulk.data);
      const ok = bulk.data.filter((r: any) => r.success).length;
      const fail = bulk.data.filter((r: any) => !r.success).length;
      setMsg(`Atualizado: ${ok} investimentos OK${fail ? ` · ${fail} erros` : ''}`);
      loadMonthly();
    } catch (e: any) {
      setMsg('Erro: ' + (e?.response?.data?.message ?? e.message));
    }
    setBulkLoading(false);
  };


  return (
    <div style={S.page}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <span style={S.badge}>◆ Contábil</span>
        <span style={S.h1}>Tabela CDI — BCB Série 12</span>
        <button style={{ ...S.btn }} onClick={() => setTab('importar')}>
          Importar CDI
        </button>
        <button style={{ ...S.btn, marginLeft:'auto' }} onClick={load} disabled={loading}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {msg && (
        <div style={{ background:'#EFF6FF', border:'0.5px solid #BFDBFE', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#1D4ED8', marginBottom:16, display:'flex', justifyContent:'space-between' }}>
          {msg} <span style={{ cursor:'pointer' }} onClick={()=>setMsg('')}>✕</span>
        </div>
      )}

      {kpis && (
        <div style={S.kpiGrid}>
          <div style={S.kpi}><div style={S.kpiLbl}>Período</div><div style={S.kpiVal}>{kpis.count} meses</div><div style={S.kpiSub}>{fmtComp(kpis.first.competence)} → {fmtComp(kpis.last.competence)}</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>CDI último mês</div><div style={S.kpiVal}>{fmtN(kpis.last.monthlyAccum,4)}%</div><div style={S.kpiSub}>{kpis.last.businessDays} dias úteis</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>CDI acum. período</div><div style={S.kpiVal}>{fmtN(kpis.acum,4)}%</div><div style={S.kpiSub}>Capitalização composta</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>96% CDI último mês</div><div style={S.kpiVal}>{fmtN(kpis.last.monthlyAccum*0.96,4)}%</div><div style={S.kpiSub}>Fator: {(kpis.last.monthlyRateFactor*0.96).toFixed(8)}</div></div>
        </div>
      )}

      <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'flex-end', flexWrap:'wrap' as const }}>
        <div><label style={S.label}>De</label><input style={{ ...S.input, width:130 }} type="date" value={filterFrom} onChange={e=>setFrom(e.target.value)}/></div>
        <div><label style={S.label}>Até</label><input style={{ ...S.input, width:130 }} type="date" value={filterTo} onChange={e=>setTo(e.target.value)}/></div>
        <button style={S.btnP} onClick={load}>Filtrar</button>
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {(['mensal','diario','importar','atualizar'] as const).map(t => (
            <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>
              {t==='mensal'?'Mensal':t==='diario'?'Diário':t==='importar'?'Importar':'Atualização Mensal'}
            </button>
          ))}
        </div>
      </div>

      {tab==='mensal' && (
        <div style={S.tblW}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:420 }}>
            <thead><tr>
              <th style={{...S.thL, cursor:'pointer', userSelect:'none' as const, whiteSpace:'nowrap' as const}} onClick={()=>setMonthlySortDir(d=>d==='desc'?'asc':'desc')}>
                Competência {monthlySortDir==='desc'?'↓':'↑'}
              </th>
              <th style={S.th}>Dias úteis</th>
              <th style={S.th}>CDI mensal (%)</th>
              <th style={S.th}>Fator mensal</th>
              <th style={S.th}>96% CDI (%)</th>
              <th style={S.th}>Fator 96%</th>
            </tr></thead>
            <tbody>
              {[...monthly].sort((a,b)=>monthlySortDir==='desc'?b.competence.localeCompare(a.competence):a.competence.localeCompare(b.competence)).map(m => (
                <tr key={m.competence}>
                  <td style={S.tdL}>{fmtComp(m.competence)}</td>
                  <td style={S.td}>{m.businessDays}</td>
                  <td style={S.td}>{fmtN(m.monthlyAccum,6)}</td>
                  <td style={S.td}>{m.monthlyRateFactor.toFixed(8)}</td>
                  <td style={S.td}>{fmtN(m.monthlyAccum*0.96,6)}</td>
                  <td style={S.td}>{(m.monthlyRateFactor*0.96).toFixed(8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='diario' && (
        <div style={S.tblW}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
            <thead><tr>
              <th style={{...S.thL, cursor:'pointer', userSelect:'none' as const, whiteSpace:'nowrap' as const}} onClick={()=>setDailySortDir(d=>d==='desc'?'asc':'desc')}>
                Data {dailySortDir==='desc'?'↓':'↑'}
              </th>
              <th style={S.th}>Diária (%)</th>
              <th style={S.th}>Acum. mês (%)</th>
              <th style={S.th}>Acum. ano (%)</th>
              <th style={S.th}>Acum. 30d (%)</th>
              <th style={S.th}>Acum. 12m (%)</th>
              <th style={S.th}>Índice acum.</th>
              <th style={S.th}></th>
            </tr></thead>
            <tbody>
              {[...rows].sort((a,b)=>dailySortDir==='desc'?b.date.localeCompare(a.date):a.date.localeCompare(b.date)).map(r => (
                <tr key={r.id}>
                  <td style={S.tdL}>{fmtDate(r.date)}</td>
                  <td style={S.td}>{fmtN(r.dailyRate,6)}</td>
                  <td style={S.td}>{fmtN(r.monthlyAccum,4)}</td>
                  <td style={S.td}>{fmtN(r.yearAccum,4)}</td>
                  <td style={S.td}>{fmtN(r.accum30d,4)}</td>
                  <td style={S.td}>{fmtN(r.accum12m,4)}</td>
                  <td style={S.td}>{fmtN(r.accumIndex,7)}</td>
                  <td style={S.td}><button style={S.btnDng} onClick={()=>deleteRow(r.date)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==='importar' && (
        <div>
          <div style={S.card}>
            <p style={S.secTit}>Lançamento manual — registro único</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:12 }}>
              {[
                ['Data','date','date'],['Diária (%)','dailyRate','number'],
                ['Acum. mês (%)','monthlyAccum','number'],['Acum. ano (%)','yearAccum','number'],
                ['Acum. 30d (%)','accum30d','number'],['Acum. 12m (%)','accum12m','number'],
                ['Índice acum.','accumIndex','number'],
              ].map(([lbl,key,type]) => (
                <div key={key}>
                  <label style={S.label}>{lbl}</label>
                  <input style={S.input} type={type} max={type==='date'?'9999-12-31':undefined}
                    value={(newRow as any)[key]}
                    onChange={e=>setNewRow(p=>({...p,[key]:e.target.value}))}/>
                </div>
              ))}
            </div>
            <button style={S.btnP} onClick={addSingle} disabled={loading}>Salvar registro</button>
          </div>

          <div style={S.card}>
            <p style={S.secTit}>Importação em lote — colar da planilha</p>
            <p style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:6, lineHeight:1.6 }}>
              Cole diretamente da sua planilha Excel (colunas: Data · Diária · Diária Ano · Acum.Mês · Acum.Ano · Acum.30d · Acum.12m · Índice).
              O sistema detecta separador de tabulação automaticamente. Datas no formato DD/MM/AAAA.
            </p>
            <div style={{fontSize:11, color:'#0369A1', marginBottom:10, display:'flex', alignItems:'center', gap:6}}>
              Fonte recomendada:
              <a href="https://www.portaldefinancas.com/cdidiaria26.htm" target="_blank" rel="noopener noreferrer"
                style={{color:'#0369A1', fontWeight:500}}>Portal de Finanças — CDI Diário</a>
              <span style={{color:'#9CA3AF'}}>(© Portal de Finanças — dados utilizados com fins acadêmicos/internos)</span>
            </div>
            <textarea
              style={{ width:'100%', height:180, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'8px 10px', fontSize:12, fontFamily:'var(--font-mono,monospace)', background:'var(--color-background-primary)', color:'var(--color-text-primary)', resize:'vertical' as const, marginBottom:10 }}
              placeholder={'03/01/2022\t0,034749\t9,15\t0,0347\t0,0347\t0,7157\t4,4599\t100,0347490\n04/01/2022\t...'}
              value={pasteText}
              onChange={e=>setPaste(e.target.value)}
            />
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button style={S.btnP} onClick={importPaste} disabled={loading}>
                {loading ? 'Importando...' : `Importar ${parseTsv(pasteText).length || ''} linhas`}
              </button>
              {pasteText && <button style={S.btn} onClick={()=>setPaste('')}>Limpar</button>}
              <span style={{ fontSize:11, color:'var(--color-text-secondary)', marginLeft:4 }}>
                {pasteText ? `${parseTsv(pasteText).length} linhas detectadas` : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {tab==='atualizar' && (
        <div>
          <div style={S.card}>
            <p style={S.secTit}>Registrar CDI mensal e atualizar investimentos</p>
            <p style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:14, lineHeight:1.6 }}>
              Informe a competencia e a taxa CDI acumulada do mes (coluna Acum.Mes da planilha BCB).
              O sistema salva a taxa na tabela CDI e atualiza todos os investimentos ativos em lote.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:14 }}>
              <div>
                <label style={S.label}>Competencia (AAAA-MM)</label>
                <input style={S.input} type='month' value={bulkComp}
                  onChange={e => setBulkComp(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>CDI acumulado mes (%)</label>
                <input style={S.input} type='number' min={0} max={5} step={0.0001}
                  placeholder='ex: 0.9265'
                  value={bulkRate} onChange={e => setBulkRate(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Dias uteis (opcional)</label>
                <input style={S.input} type='number' min={0} max={31}
                  value={bulkDays} onChange={e => setBulkDays(e.target.value)} />
              </div>
              <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:4 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type='checkbox' checked={bulkJournal}
                    onChange={e => setBulkJournal(e.target.checked)} />
                  Gerar lancamento contabil
                </label>
              </div>
            </div>
            <button style={S.btnP} onClick={runBulkUpdate} disabled={bulkLoading}>
              {bulkLoading ? 'Atualizando...' : 'Executar atualizacao mensal'}
            </button>
          </div>
          {bulkResult.length > 0 && (
            <div style={{ ...S.card, marginTop:0 }}>
              <p style={S.secTit}>Resultado</p>
              <div style={S.tblW}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
                  <thead><tr>
                    <th style={S.thL}>Investimento</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Detalhe</th>
                  </tr></thead>
                  <tbody>
                    {bulkResult.map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={S.tdL}>{r.id}</td>
                        <td style={S.td}>
                          <span style={{ fontSize:10, fontWeight:500, padding:'1px 6px', borderRadius:4,
                            background: r.success ? '#F0FDF4' : '#FEF2F2',
                            color: r.success ? '#15803D' : '#B91C1C' }}>
                            {r.success ? 'OK' : 'ERRO'}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontSize:11, color:'var(--color-text-secondary)' }}>
                          {r.error ?? 'Atualizado'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {tab==='atualizar' && (
        <div>
          <div style={S.card}>
            <p style={S.secTit}>Registrar CDI mensal e atualizar investimentos</p>
            <p style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:14, lineHeight:1.6 }}>
              Informe a competencia e a taxa CDI acumulada do mes (coluna Acum.Mes da planilha BCB).
              O sistema salva a taxa na tabela CDI e atualiza todos os investimentos ativos em lote.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:14 }}>
              <div>
                <label style={S.label}>Competencia (AAAA-MM)</label>
                <input style={S.input} type='month' value={bulkComp}
                  onChange={e => setBulkComp(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>CDI acumulado mes (%)</label>
                <input style={S.input} type='number' min={0} max={5} step={0.0001}
                  placeholder='ex: 0.9265'
                  value={bulkRate} onChange={e => setBulkRate(e.target.value)} />
              </div>
              <div>
                <label style={S.label}>Dias uteis (opcional)</label>
                <input style={S.input} type='number' min={0} max={31}
                  value={bulkDays} onChange={e => setBulkDays(e.target.value)} />
              </div>
              <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:4 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type='checkbox' checked={bulkJournal}
                    onChange={e => setBulkJournal(e.target.checked)} />
                  Gerar lancamento contabil
                </label>
              </div>
            </div>
            <button style={S.btnP} onClick={runBulkUpdate} disabled={bulkLoading}>
              {bulkLoading ? 'Atualizando...' : 'Executar atualizacao mensal'}
            </button>
          </div>
          {bulkResult.length > 0 && (
            <div style={{ ...S.card, marginTop:0 }}>
              <p style={S.secTit}>Resultado</p>
              <div style={S.tblW}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:400 }}>
                  <thead><tr>
                    <th style={S.thL}>Investimento</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Detalhe</th>
                  </tr></thead>
                  <tbody>
                    {bulkResult.map((r: any, i: number) => (
                      <tr key={i}>
                        <td style={S.tdL}>{r.id}</td>
                        <td style={S.td}>
                          <span style={{ fontSize:10, fontWeight:500, padding:'1px 6px', borderRadius:4,
                            background: r.success ? '#F0FDF4' : '#FEF2F2',
                            color: r.success ? '#15803D' : '#B91C1C' }}>
                            {r.success ? 'OK' : 'ERRO'}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontSize:11, color:'var(--color-text-secondary)' }}>
                          {r.error ?? 'Atualizado'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      <hr style={S.divider}/>
      <div style={{ fontSize:11, color:'var(--color-text-secondary)', lineHeight:1.6 }}>
        Fonte: BCB — Série Temporal 12 (CDI). Coluna B (taxa diária) é a única entrada manual;
        as demais são calculadas. Dados utilizados automaticamente na projeção CDB ao selecionar
        competências com histórico real disponível.
      </div>
    </div>
  );
}
