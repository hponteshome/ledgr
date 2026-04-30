import React, { useState, useEffect, useMemo } from 'react';
import api from '../../../services/api';

interface Investment {
  id: string; description: string; type: string; issuerName: string;
  issuerCnpj?: string; indexer: string; indexerRate: number;
  capitalInitial: number; capitalCurrent: number; capitalBalance?: number;
  applicationDate: string; maturityDate: string;
  irrfExempt: boolean; status: string; notes?: string;
}
interface HistoricalRate { competence: string; rate: number; }
interface Redemption {
  id: string; eventDate: string; eventType: string;
  redemptionPrincipal?: number; redemptionYield?: number;
  grossAmount?: number; irrfAmount?: number; netAmount?: number;
  balanceAfter: number; notes?: string;
}
interface ProjectionLine {
  competence: string; calendarDays: number; indexerRate: number;
  grossYield: number; grossBalance: number; accumulatedYield: number;
  irrfRate: number; irrfOnRedemption: number; netBalance: number;
  capitalBalance: number; isProjected: boolean;
}

const fmtBRL  = (v: any) => (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
const fmtDate = (s: string) => { if (!s) return '--'; const d = s.length===10 ? s+'T12:00:00Z' : s; return new Date(d).toLocaleDateString('pt-BR'); };
const fmtComp = (s: string) => s.split('-').reverse().join('/');

function irrfAliq(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.200;
  if (days <= 720) return 0.175;
  return 0.150;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000);
}
function lastDayOfMonth(y: number, m: number): Date { return new Date(y, m, 0); }
function parseD(s: string): Date {
  const d = new Date(s.length===10 ? s+'T12:00:00' : s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function buildProjection(inv: Investment, rates: HistoricalRate[], projRate: number, redemptions: Redemption[], holidays: Set<string> = new Set()): ProjectionLine[] {
  const appDate = parseD(inv.applicationDate.slice(0,10));
  const matDate = parseD(inv.maturityDate.slice(0,10));
  const pct = inv.indexerRate / 100, proj = projRate / 100;
  const lines: ProjectionLine[] = [];
  let saldoBruto = Number(inv.capitalInitial), rendAcum = 0, capitalBalance = Number(inv.capitalInitial);
  let cursor = new Date(appDate.getFullYear(), appDate.getMonth(), 1);
  // Calcular fator de proporcao do primeiro mes (dias uteis da aplicacao ate fim do mes)
  const firstMonthFactor = (() => {
    const y = appDate.getFullYear(), m = appDate.getMonth();
    const fimMes = lastDayOfMonth(y, m+1);
    let totalDU = 0, restanteDU = 0;
    const d = new Date(y, m, 1);
    while (d <= fimMes) {
      const dow = d.getDay();
      const ds = d.toISOString().slice(0,10);
      if (dow !== 0 && dow !== 6 && !holidays.has(ds)) {
        totalDU++;
        if (d >= appDate) restanteDU++;
      }
      d.setDate(d.getDate()+1);
    }
    return totalDU > 0 ? restanteDU / totalDU : 1;
  })();
  let isFirstMonth = true;
  while (true) {
    const yyyy = cursor.getFullYear(), mm = cursor.getMonth() + 1;
    const comp = yyyy + '-' + String(mm).padStart(2, '0');
    const fimMes = lastDayOfMonth(yyyy, mm);
    if (fimMes > matDate) break;
    const hist = rates.find(h => h.competence === comp);
    const isProjected = !hist, rawRate = hist ? hist.rate : proj;
    const fator = isFirstMonth ? firstMonthFactor : 1;
    isFirstMonth = false;
    const indice = rawRate * pct * fator, rendMes = saldoBruto * indice;
    saldoBruto += rendMes; rendAcum += rendMes;
    const dias = daysBetween(appDate, fimMes);
    const aliq = inv.irrfExempt ? 0 : irrfAliq(dias);
    lines.push({competence:comp, calendarDays:dias, indexerRate:indice,
      grossYield:rendMes, grossBalance:saldoBruto, accumulatedYield:rendAcum,
      irrfRate:aliq, irrfOnRedemption:rendAcum*aliq,
      netBalance:saldoBruto-rendAcum*aliq, capitalBalance, isProjected});
    // Aplicar resgates do mes: deduzir do saldo bruto
    const resgMes = redemptions.filter(r => {
      const d = parseD(r.eventDate);
      return d.getFullYear()===yyyy && d.getMonth()+1===mm;
    });
    for (const resg of resgMes) {
      const brutoResg = Number(resg.redemptionPrincipal ?? 0) + Number(resg.redemptionYield ?? 0);
      const rendResg = Number(resg.redemptionYield ?? 0);
      const princResg = Number(resg.redemptionPrincipal ?? 0);
      saldoBruto = Math.max(0, saldoBruto - brutoResg);
      rendAcum = Math.max(0, rendAcum - rendResg);
      capitalBalance = Math.max(0, capitalBalance - princResg);
    }
    // Se saldoBruto zerou mas ainda ha capital, reinicar com capitalBalance
    if (saldoBruto < 0.01 && capitalBalance > 0.01) {
      saldoBruto = capitalBalance;
      rendAcum = 0;
    }
    cursor.setMonth(cursor.getMonth() + 1);
    if (lines.length > 400) break;
  }
  return lines;
}

const S = {
  page:   {padding:'24px 0', fontFamily:'var(--font-sans,system-ui)', fontSize:14, color:'var(--color-text-primary)'} as React.CSSProperties,
  badge:  {display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:'#EFF6FF', color:'#1D4ED8'} as React.CSSProperties,
  h1:     {fontSize:15, fontWeight:500, margin:0} as React.CSSProperties,
  card:   {background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:10, padding:'14px 16px', marginBottom:16} as React.CSSProperties,
  secTit: {fontSize:11, fontWeight:500, color:'var(--color-text-secondary)', textTransform:'uppercase' as const, letterSpacing:'.3px', marginBottom:10},
  kpiGrid:{display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20} as React.CSSProperties,
  kpi:    {background:'var(--color-background-secondary)', borderRadius:8, padding:'11px 14px'} as React.CSSProperties,
  kpiLbl: {fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', marginBottom:3},
  kpiVal: {fontSize:18, fontWeight:500},
  kpiSub: {fontSize:10, color:'var(--color-text-secondary)', marginTop:2},
  input:  {height:32, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'0 9px', fontSize:13, background:'var(--color-background-primary)', color:'var(--color-text-primary)', width:'100%', outline:'none'} as React.CSSProperties,
  label:  {fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', display:'block', marginBottom:4},
  btn:    {height:30, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'0 12px', fontSize:12, cursor:'pointer', background:'var(--color-background-primary)', color:'var(--color-text-primary)'} as React.CSSProperties,
  btnP:   {height:30, border:'none', borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer', background:'#111', color:'#fff', fontWeight:500} as React.CSSProperties,
  btnDng: {height:26, border:'0.5px solid #FCA5A5', borderRadius:5, padding:'0 8px', fontSize:11, cursor:'pointer', background:'#FEF2F2', color:'#B91C1C'} as React.CSSProperties,
  btnEdt: {height:26, border:'0.5px solid var(--color-border-secondary)', borderRadius:5, padding:'0 8px', fontSize:11, cursor:'pointer', background:'var(--color-background-primary)', color:'var(--color-text-primary)'} as React.CSSProperties,
  tblW:   {overflowX:'auto' as const, border:'0.5px solid var(--color-border-tertiary)', borderRadius:8, marginBottom:16},
  th:     {background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontSize:10, fontWeight:500, textTransform:'uppercase' as const, letterSpacing:'.3px', padding:'8px 10px', textAlign:'right' as const, borderBottom:'0.5px solid var(--color-border-tertiary)', whiteSpace:'nowrap' as const},
  thL:    {background:'var(--color-background-secondary)', color:'var(--color-text-secondary)', fontSize:10, fontWeight:500, textTransform:'uppercase' as const, letterSpacing:'.3px', padding:'8px 10px', textAlign:'left' as const, borderBottom:'0.5px solid var(--color-border-tertiary)'},
  td:     {padding:'7px 10px', textAlign:'right' as const, borderBottom:'0.5px solid var(--color-border-tertiary)', fontSize:12, whiteSpace:'nowrap' as const},
  tdL:    {padding:'7px 10px', textAlign:'left' as const, borderBottom:'0.5px solid var(--color-border-tertiary)', fontSize:12},
  neg:    {color:'#DC2626'},
  pos:    {color:'#15803D'},
  divider:{border:'none', borderTop:'0.5px solid var(--color-border-tertiary)', margin:'20px 0'} as React.CSSProperties,
  overlay:{position:'fixed' as const, top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.25)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999},
  modal:  {background:'#ffffff', borderRadius:12, padding:'24px', width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto' as const, border:'0.5px solid var(--color-border-tertiary)', boxShadow:'0 20px 60px rgba(0,0,0,0.3)'},
  pill:   (s: string) => {
    const m: Record<string,{bg:string,color:string}> = {
      ATIVO:{bg:'#F0FDF4',color:'#15803D'}, RESGATADO:{bg:'#EFF6FF',color:'#1D4ED8'},
      VENCIDO:{bg:'#FEF2F2',color:'#B91C1C'}, CANCELADO:{bg:'#F9FAFB',color:'#6B7280'},
    };
    const t = m[s] ?? {bg:'#F9FAFB', color:'#374151'};
    return {display:'inline-block', padding:'1px 8px', borderRadius:4, fontSize:10, fontWeight:500, background:t.bg, color:t.color} as React.CSSProperties;
  },
  tab: (active: boolean) => ({
    height:30, border:'0.5px solid ' + (active ? '#111' : 'var(--color-border-tertiary)'),
    borderRadius:6, padding:'0 14px', fontSize:12, cursor:'pointer',
    background: active ? '#111' : 'var(--color-background-primary)',
    color: active ? '#fff' : 'var(--color-text-secondary)',
  } as React.CSSProperties),
  aliqPill: (a: number) => ({
    fontSize:10, fontWeight:500, padding:'1px 6px', borderRadius:4,
    background: a===0.225?'#FEF2F2':a===0.2?'#FFF7ED':a===0.175?'#FEFCE8':'#F0FDF4',
    color: a===0.225?'#B91C1C':a===0.2?'#C2410C':a===0.175?'#854D0E':'#15803D',
  } as React.CSSProperties),
};

// ── Modal Investimento (Cadastro + Edicao) ────────────────────────────────────
function InvestimentoModal({ inv, onClose, onSaved }: {
  inv?: Investment; onClose: ()=>void; onSaved: ()=>void;
}) {
  const isEdit = !!inv;
  const [form, setForm] = useState({
    description: inv?.description ?? '',
    type: inv?.type ?? 'CDB',
    issuerName: inv?.issuerName ?? '',
    issuerCnpj: inv?.issuerCnpj ?? '',
    indexer: inv?.indexer ?? 'CDI',
    indexerRate: String(inv?.indexerRate ?? '96'),
    capitalInitial: String(inv?.capitalInitial ?? ''),
    applicationDate: inv?.applicationDate?.slice(0,10) ?? '',
    maturityDate: inv?.maturityDate?.slice(0,10) ?? '',
    irrfExempt: inv?.irrfExempt ?? false,
    notes: inv?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setForm(p => ({...p, [k]: v}));

  const save = async () => {
    if (!form.description || !form.issuerName || !form.capitalInitial || !form.applicationDate || !form.maturityDate) {
      setErr('Preencha todos os campos obrigatorios'); return;
    }
    setSaving(true); setErr('');
    try {
      const payload = {
        ...form,
        indexerRate: parseFloat(form.indexerRate),
        capitalInitial: parseFloat(String(form.capitalInitial).replace(/\./g,'').replace(',','.')),
      };
      if (isEdit) {
        await api.put('/accounting/fixed-income/' + inv!.id, payload);
      } else {
        await api.post('/accounting/fixed-income', payload);
      }
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message ?? 'Erro ao salvar'); }
    setSaving(false);
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20}}>
          <span style={{fontSize:15, fontWeight:500}}>{isEdit ? 'Editar Investimento' : 'Novo Investimento'}</span>
          <button style={{...S.btn, padding:'0 8px'}} onClick={onClose}>x</button>
        </div>
        {err && <div style={{background:'#FEF2F2', border:'0.5px solid #FCA5A5', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#B91C1C', marginBottom:12}}>{err}</div>}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12}}>
          <div style={{gridColumn:'1/-1'}}>
            <label style={S.label}>Tipo</label>
            <select style={{...S.input}} value={form.type} onChange={e=>set('type',e.target.value)}>
              {['CDB','LCI','LCA','CRI','CRA','DEBENTURE','TESOURO_SELIC','TESOURO_PREFIXADO','TESOURO_IPCA','OUTRO'].map(t=>(
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={S.label}>Descricao *</label>
            <input style={S.input} type='text' value={form.description} onChange={e=>set('description',e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Emissor *</label>
            <input style={S.input} type='text' value={form.issuerName} onChange={e=>set('issuerName',e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>CNPJ do emissor</label>
            <input style={S.input} type='text' value={form.issuerCnpj} onChange={e=>set('issuerCnpj',e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Capital inicial *</label>
            <input style={S.input} type='number' min={0} step={1000} value={form.capitalInitial}
              onChange={e=>set('capitalInitial',e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Data aplicacao *</label>
            <input style={S.input} type='date' max='9999-12-31' value={form.applicationDate}
              onChange={e=>set('applicationDate',e.target.value)} disabled={isEdit}/>
          </div>
          <div>
            <label style={S.label}>Vencimento *</label>
            <input style={S.input} type='date' max='9999-12-31' value={form.maturityDate}
              onChange={e=>set('maturityDate',e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Indexador</label>
            <select style={{...S.input}} value={form.indexer} onChange={e=>set('indexer',e.target.value)}>
              {['CDI','SELIC','IPCA','IGPM','PREFIXADO'].map(i=><option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>% do indexador</label>
            <input style={S.input} type='number' min={0} max={200} step={0.5}
              value={form.indexerRate} onChange={e=>set('indexerRate',e.target.value)}/>
          </div>
          <div style={{gridColumn:'1/-1', display:'flex', alignItems:'center', gap:8, paddingTop:4}}>
            <input type='checkbox' id='irrfEx' checked={form.irrfExempt} onChange={e=>set('irrfExempt',e.target.checked)}/>
            <label htmlFor='irrfEx' style={{fontSize:13, cursor:'pointer'}}>Isento de IRRF (LCI / LCA / CRI / CRA)</label>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={S.label}>Observacoes</label>
            <textarea style={{...S.input, height:60, resize:'vertical' as const, paddingTop:8}}
              value={form.notes} onChange={e=>set('notes',e.target.value)}/>
          </div>
        </div>
        <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
          <button style={S.btn} onClick={onClose}>Cancelar</button>
          <button style={S.btnP} onClick={save} disabled={saving}>{saving ? 'Salvando...' : (isEdit ? 'Salvar alteracoes' : 'Salvar investimento')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Resgate (Cadastro + Edicao) ─────────────────────────────────────────
function ResgateModal({ inv, redemption, onClose, onSaved }: {
  inv: Investment; redemption?: Redemption; onClose: ()=>void; onSaved: ()=>void;
}) {
  const isEdit = !!redemption;
  const appDate = parseD(inv.applicationDate.slice(0,10));

  const [form, setForm] = useState({
    redemptionDate: redemption?.eventDate?.slice(0,10) ?? '',
    capital: redemption?.redemptionPrincipal ? String(redemption.redemptionPrincipal) : '',
    rendLiquido: redemption?.netAmount && redemption?.redemptionPrincipal
      ? String((redemption.netAmount - redemption.redemptionPrincipal))
      : '',
    notes: redemption?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const setF = (k: string, v: string) => setForm(p => ({...p, [k]: v}));

  const pNum = (s: string) => parseFloat(String(s).replace(/\./g,'').replace(',','.')) || 0;

  const capital    = pNum(form.capital);
  const rendLiq    = pNum(form.rendLiquido);
  const dias       = form.redemptionDate ? daysBetween(appDate, parseD(form.redemptionDate)) : 0;
  const aliq       = inv.irrfExempt ? 0 : irrfAliq(dias);
  const rendBruto  = inv.irrfExempt ? rendLiq : rendLiq / (1 - aliq);
  const irCalc     = rendBruto - rendLiq;
  const totBruto   = capital + rendBruto;
  const totLiq     = capital + rendLiq;

  const save = async () => {
    if (!form.redemptionDate || !form.capital) {
      setErr('Data e capital sao obrigatorios'); return;
    }
    setSaving(true); setErr('');
    try {
      const payload = {
        redemptionDate: form.redemptionDate,
        redemptionAmount: totBruto,
        redemptionPrincipal: capital,
        redemptionYield: rendBruto,
        irrfAmount: irCalc,
        netAmount: totLiq,
        isTotal: false,
        notes: form.notes || ('Resgate — ' + form.redemptionDate),
      };
      if (isEdit) {
        await api.put('/accounting/fixed-income/' + inv.id + '/events/' + redemption!.id, payload);
      } else {
        await api.post('/accounting/fixed-income/' + inv.id + '/redeem', payload);
      }
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message ?? 'Erro ao registrar resgate'); }
    setSaving(false);
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20}}>
          <div>
            <span style={{fontSize:15, fontWeight:500}}>{isEdit ? 'Editar Resgate' : 'Registrar Resgate'}</span>
            <div style={{fontSize:12, color:'var(--color-text-secondary)', marginTop:2}}>{inv.description} — {inv.issuerName}</div>
          </div>
          <button style={{...S.btn, padding:'0 8px'}} onClick={onClose}>x</button>
        </div>
        {err && <div style={{background:'#FEF2F2', border:'0.5px solid #FCA5A5', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#B91C1C', marginBottom:12}}>{err}</div>}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16}}>
          <div style={{gridColumn:'1/-1'}}>
            <label style={S.label}>Data do resgate *</label>
            <input style={S.input} type='date' max='9999-12-31' value={form.redemptionDate}
              onChange={e=>setF('redemptionDate',e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Capital resgatado (extrato bancario) *</label>
            <input style={S.input} type='text' placeholder='Ex: 209.500,00'
              value={form.capital} onChange={e=>setF('capital',e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Rendimento liquido (extrato bancario)</label>
            <input style={S.input} type='text' placeholder='Ex: 942,75'
              value={form.rendLiquido} onChange={e=>setF('rendLiquido',e.target.value)}/>
            <span style={{fontSize:10, color:'var(--color-text-secondary)', marginTop:2, display:'block'}}>
              Valor creditado menos o capital
            </span>
          </div>
          <div style={{gridColumn:'1/-1'}}>
            <label style={S.label}>Observacoes</label>
            <input style={S.input} type='text' value={form.notes} onChange={e=>setF('notes',e.target.value)}/>
          </div>
        </div>

        {form.redemptionDate && capital > 0 && (
          <div style={{background:'var(--color-background-secondary)', borderRadius:8, padding:'12px 14px', marginBottom:16}}>
            <div style={{fontSize:10, textTransform:'uppercase' as const, letterSpacing:'.3px', color:'var(--color-text-secondary)', marginBottom:10}}>Calculo automatico — {dias} dias corridos · Aliq. {(aliq*100).toFixed(1)}%</div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
              <div><div style={S.kpiLbl}>Capital</div><div style={{fontSize:13, fontWeight:500}}>R$ {fmtBRL(capital)}</div></div>
              <div><div style={S.kpiLbl}>Rend. bruto calc.</div><div style={{fontSize:13, fontWeight:500}}>R$ {fmtBRL(rendBruto)}</div></div>
              <div><div style={S.kpiLbl}>IR calculado</div><div style={{fontSize:13, fontWeight:500, color:'#DC2626'}}>R$ {fmtBRL(irCalc)}</div></div>
              <div><div style={S.kpiLbl}>Liquido total</div><div style={{fontSize:13, fontWeight:500, color:'#15803D'}}>R$ {fmtBRL(totLiq)}</div></div>
            </div>
          </div>
        )}

        <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
          <button style={S.btn} onClick={onClose}>Cancelar</button>
          <button style={S.btnP} onClick={save} disabled={saving}>
            {saving ? 'Registrando...' : (isEdit ? 'Salvar alteracoes' : 'Registrar resgate')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function RendaFixaPage() {
  const [investments,     setInvestments]     = useState<Investment[]>([]);
  const [selected,        setSelected]        = useState<Investment|null>(null);
  const [historicalRates, setHistoricalRates] = useState<HistoricalRate[]>([]);
  const [redemptions,     setRedemptions]     = useState<Redemption[]>([]);
  const [projRate,        setProjRate]        = useState(0.95);
  const [loading,         setLoading]         = useState(false);
  const [summary,         setSummary]         = useState<any>(null);
  const [holidays,        setHolidays]        = useState<Set<string>>(new Set());
  const [tab,             setTab]             = useState<'carteira'|'orientacao'>('carteira');
  const [detailTab,       setDetailTab]       = useState<'extrato'|'projecao'|'resgates'>('extrato');
  const [filterDate,      setFilterDate]      = useState('');
  const [showModal,       setShowModal]       = useState(false);
  const [editInv,         setEditInv]         = useState<Investment|null>(null);
  const [showResgate,     setShowResgate]     = useState(false);
  const [editResgate,     setEditResgate]     = useState<Redemption|null>(null);
  const [msg,             setMsg]             = useState('');
  const [journalEntries,  setJournalEntries]  = useState<any[]>([]);
  const [jLoading,        setJLoading]        = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [invR, cdiR, holR] = await Promise.all([
        api.get('/accounting/fixed-income'),
        api.get('/accounting/cdi/monthly'),
        api.get('/calendar/holidays?year=2022').catch(()=>({data:[]})),
      ]);
      // Carregar feriados de todos os anos relevantes
      const holYears = [2022,2023,2024,2025,2026,2027,2028];
      const holAll = await Promise.all(holYears.map(y => api.get('/calendar/holidays?year='+y).catch(()=>({data:[]}))));
      const holSet = new Set<string>(holAll.flatMap(r => (r.data??[]).map((h:any) => h.date.slice(0,10))));
      setHolidays(holSet);
      const invs = invR.data ?? [];
      const rates = (cdiR.data ?? []).map((m: any) => ({
        competence: m.competence, rate: m.monthlyRateFactor,
      }));
      setInvestments(invs);
      setHistoricalRates(rates);
      if (invs.length && !selected) setSelected(invs[0]);
      const sumR = await api.get('/accounting/fixed-income/summary');
      setSummary(sumR.data);
    } catch { setMsg('Erro ao carregar dados'); }
    setLoading(false);
  };

  const loadRedemptions = async (invId: string) => {
    try {
      const r = await api.get('/accounting/fixed-income/' + invId);
      setRedemptions((r.data?.events ?? []).filter((e: any) =>
        e.eventType === 'RESGATE_ANTECIPADO' || e.eventType === 'RESGATE_VENCIMENTO'
      ));
    } catch { setRedemptions([]); }
  };

  const loadJournalEntries = async () => {
    setJLoading(true);
    try {
      const r = await api.get('/accounting/journal-entries', {
        params: { sourceModule: 'ACCOUNTING', description: 'CDB', limit: 50 }
      });
      setJournalEntries(r.data?.data ?? r.data ?? []);
    } catch { setJournalEntries([]); }
    setJLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === 'orientacao') loadJournalEntries(); }, [tab]);
  useEffect(() => {
    if (selected) { loadRedemptions(selected.id); setDetailTab('extrato'); }
  }, [selected?.id]);

  const projection = useMemo(() =>
    selected ? buildProjection(selected, historicalRates, projRate, redemptions, holidays) : [],
    [selected, historicalRates, projRate, redemptions, holidays]
  );

  // Projecao de todos os investimentos para totalizacao na lista
  const allProjections = useMemo(() => {
    const map: Record<string, {rendBruto:number; irrf:number; saldoLiq:number; capitalBalance:number}> = {};
    for (const inv of investments) {
      const proj = buildProjection(inv, historicalRates, projRate, [], holidays);
      const filtered = filterDate ? proj.filter(l => l.competence <= filterDate) : proj;
      if (filtered.length) {
        const last = filtered[filtered.length - 1];
        map[inv.id] = {
          rendBruto: last.accumulatedYield,
          irrf: last.irrfOnRedemption,
          saldoLiq: last.netBalance,
          capitalBalance: last.capitalBalance,
        };
      }
    }
    return map;
  }, [investments, historicalRates, projRate, filterDate, holidays]);

  const kpis = useMemo(() => {
    if (!projection.length || !selected) return null;
    const last = projection[projection.length - 1];
    const totLiq = redemptions.reduce((s, r) => s + Number(r.netAmount ?? 0), 0);
    const totPrinc = redemptions.reduce((s, r) => s + Number(r.redemptionPrincipal ?? 0), 0);
    return {
      capitalInicial: Number(selected.capitalInitial),
      rendBruto: last.accumulatedYield,
      irrfTotal: last.irrfOnRedemption,
      saldoLiq: last.netBalance,
      aliqFinal: last.irrfRate,
      diasFinal: last.calendarDays,
      totLiq, totPrinc, qtdResgates: redemptions.length,
    };
  }, [projection, selected, redemptions]);

  const listKpis = useMemo(() => {
    const ativos = investments.filter(i => i.status === 'ATIVO');
    const saldoTotal = ativos.reduce((s, i) => s + Number(i.capitalCurrent), 0);
    const capitalTotal = ativos.reduce((s, i) => s + Number(i.capitalInitial), 0);
    const capitalBalance = ativos.reduce((s, i) => s + Number((i as any).capitalBalance ?? i.capitalInitial), 0);
    // Projecao consolidada: usar ultima linha de cada investimento
    const totalRendBruto = ativos.reduce((s, i) => {
      const cb = Number(i.capitalBalance ?? i.capitalInitial);
      return s + Math.max(0, Number(i.capitalCurrent) - cb);
    }, 0);
    const totalIrrf = ativos.reduce((s, i) => {
      const cb = Number(i.capitalBalance ?? i.capitalInitial);
      const rend = Math.max(0, Number(i.capitalCurrent) - cb);
      const appD = new Date(i.applicationDate);
      const dias = Math.round(Math.abs(new Date().getTime()-appD.getTime())/86400000);
      const aliq = i.irrfExempt ? 0 : dias<=180?0.225:dias<=360?0.200:dias<=720?0.175:0.150;
      return s + rend * aliq;
    }, 0);
    const totalSaldoLiq = saldoTotal - totalIrrf;
    return {
      count: ativos.length, total: investments.length,
      saldoTotal, capitalTotal, capitalBalance,
      totalRendBruto, totalIrrf, totalSaldoLiq,
    };
  }, [investments]);

  const onInvSaved = () => { setShowModal(false); setEditInv(null); load(); };
  const onResgSaved = () => {
    setShowResgate(false); setEditResgate(null);
    if (selected) { loadRedemptions(selected.id); load(); }
  };

  const deleteResgate = async (r: Redemption) => {
    if (!confirm('Excluir este resgate?')) return;
    try {
      await api.delete('/accounting/fixed-income/' + selected!.id + '/events/' + r.id);
      loadRedemptions(selected!.id); load();
    } catch { setMsg('Erro ao excluir resgate'); }
  };

  return (
    <div style={S.page}>
      {(showModal || editInv) && (
        <InvestimentoModal inv={editInv ?? undefined} onClose={()=>{setShowModal(false);setEditInv(null);}} onSaved={onInvSaved}/>
      )}
      {(showResgate || editResgate) && selected && (
        <ResgateModal inv={selected} redemption={editResgate ?? undefined}
          onClose={()=>{setShowResgate(false);setEditResgate(null);}} onSaved={onResgSaved}/>
      )}

      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:20}}>
        <span style={S.badge}>◆ Contabil</span>
        <span style={S.h1}>Renda Fixa — Carteira</span>
        <span style={{fontSize:11, color:'var(--color-text-secondary)', marginLeft:8}}>{historicalRates.length} meses CDI real</span>
        <div style={{marginLeft:'auto', display:'flex', gap:8}}>
          <button style={S.btn} onClick={load} disabled={loading}>{loading?'...':'Atualizar'}</button>
          <button style={S.btnP} onClick={()=>setShowModal(true)}>+ Novo investimento</button>
        </div>
      </div>

      {msg && <div style={{background:'#FEF2F2', border:'0.5px solid #FCA5A5', borderRadius:6, padding:'8px 12px', fontSize:12, color:'#B91C1C', marginBottom:12}}>{msg}<button style={{marginLeft:8, fontSize:11, cursor:'pointer', background:'none', border:'none', color:'#B91C1C'}} onClick={()=>setMsg('')}>x</button></div>}

      <div style={{display:'flex', gap:4, marginBottom:20}}>
        <button style={S.tab(tab==='carteira')} onClick={()=>setTab('carteira')}>Carteira</button>
        <button style={S.tab(tab==='orientacao')} onClick={()=>setTab('orientacao')}>Orientacao e Lancamentos</button>
      </div>

      {tab==='carteira' && (
        <div>
          <div style={S.kpiGrid}>
            <div style={S.kpi}><div style={S.kpiLbl}>Investimentos ativos</div><div style={S.kpiVal}>{listKpis.count}</div><div style={S.kpiSub}>de {listKpis.total} cadastrados</div></div>
            <div style={S.kpi}><div style={S.kpiLbl}>Saldo de capital</div><div style={{...S.kpiVal,color:'#0369A1'}}>R$ {fmtBRL(investments.filter(i=>i.status==='ATIVO').reduce((s,i)=>s+Number(i.capitalBalance??i.capitalInitial),0))}</div><div style={S.kpiSub}>Principal restante total</div></div>
            <div style={S.kpi}><div style={S.kpiLbl}>Total IRRF estimado</div><div style={{...S.kpiVal,color:'#DC2626'}}>R$ {fmtBRL(Object.values(allProjections).reduce((s,p)=>s+p.irrf,0))}</div><div style={S.kpiSub}>Aliq. regressiva por prazo</div></div>
            <div style={S.kpi}><div style={S.kpiLbl}>Rendimento liquido projetado</div><div style={{...S.kpiVal,color:'#15803D'}}>R$ {fmtBRL(Object.values(allProjections).reduce((s,p)=>s+p.rendBruto-p.irrf,0))}</div><div style={S.kpiSub}>Rend. bruto menos IRRF</div></div>
          </div>

          <div style={{display:'flex', justifyContent:'flex-end', alignItems:'center', gap:8, marginBottom:12}}>
            {filterDate && <span style={{fontSize:11, color:'#1D4ED8', fontWeight:500}}>Acumulado ate {filterDate.split('-').reverse().join('/')}</span>}
            <input style={{height:28, border:'0.5px solid var(--color-border-secondary)', borderRadius:6, padding:'0 8px', fontSize:13, background:'var(--color-background-primary)', color:'var(--color-text-primary)', outline:'none', width:150}} type='month'
              value={filterDate} onChange={e=>setFilterDate(e.target.value)}/>
            {filterDate && <button style={{...S.btn, fontSize:11, height:26}} onClick={()=>setFilterDate('')}>x</button>}
          </div>

          <div style={S.tblW}>
            <table style={{width:'100%', borderCollapse:'collapse', minWidth:860}}>
              <thead><tr>
                <th style={S.thL}>Descricao</th><th style={S.thL}>Tipo</th><th style={S.thL}>Emissor</th><th style={S.thL}>Indexador</th>
                <th style={S.th}>Capital inicial</th><th style={S.th}>Saldo capital</th><th style={S.th}>Rend. bruto</th><th style={S.th}>IRRF est.</th><th style={S.th}>Saldo liquido</th>
                <th style={S.th}>Aplicacao</th><th style={S.th}>Vencimento</th>
                <th style={S.thL}>Status</th><th style={S.th}>Acoes</th>
              </tr></thead>
              <tbody>
                {investments.length === 0
                  ? <tr><td colSpan={13} style={{...S.tdL, textAlign:'center' as const, color:'var(--color-text-secondary)', fontStyle:'italic', padding:'32px'}}>Nenhum investimento cadastrado.</td></tr>
                  : investments.map(inv => (
                    <tr key={inv.id}
                      style={{background: selected?.id===inv.id ? '#EFF6FF' : 'transparent', cursor:'pointer'}}
                      onClick={()=>setSelected(prev => prev?.id===inv.id ? null : inv)}>
                      <td style={S.tdL}><span style={{fontWeight:500}}>{inv.description}</span></td>
                      <td style={S.tdL}>{inv.type}</td>
                      <td style={S.tdL}>{inv.issuerName}</td>
                      <td style={S.tdL}>{inv.indexerRate}% {inv.indexer}{inv.irrfExempt?' · Isento':''}</td>
                      <td style={S.td}>R$ {fmtBRL(Number(inv.capitalInitial))}</td>
                      <td style={{...S.td,color:'#0369A1',fontWeight:500}}>R$ {fmtBRL(Number(inv.capitalBalance ?? inv.capitalInitial))}</td>
                      {(()=>{
                        const p = allProjections[inv.id];
                        return (<>
                          <td style={S.td}>{p ? 'R$ '+fmtBRL(p.rendBruto) : '--'}</td>
                          <td style={{...S.td,...S.neg}}>{p ? (inv.irrfExempt?'Isento':'R$ '+fmtBRL(p.irrf)) : '--'}</td>
                          <td style={S.td}>{p ? 'R$ '+fmtBRL(p.saldoLiq) : '--'}</td>
                        </>);
                      })()}
                      <td style={S.td}>{fmtDate(inv.applicationDate)}</td>
                      <td style={S.td}>{fmtDate(inv.maturityDate)}</td>
                      <td style={S.tdL}><span style={S.pill(inv.status)}>{inv.status}</span></td>
                      <td style={S.td} onClick={e=>e.stopPropagation()}>
                        <div style={{display:'flex', gap:4, justifyContent:'flex-end', alignItems:'center'}}>
                          <span style={{fontSize:10,color:'var(--color-text-secondary)',marginRight:4}}>{selected?.id===inv.id?'▼':'►'}</span>
                          <button style={S.btnEdt} onClick={()=>setEditInv(inv)}>Editar</button>
                          <button style={S.btnDng} onClick={async()=>{ if(confirm('Excluir?')){ await api.delete('/accounting/fixed-income/'+inv.id); if(selected?.id===inv.id) setSelected(null); load(); }}}>X</button>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
              {investments.length > 1 && (
                <tfoot>
                  <tr style={{background:'#F0F9FF',borderTop:'2px solid #2563EB'}}>
                    <td style={{...S.tdL,fontWeight:700,fontSize:11,color:'#1D4ED8'}} colSpan={4}>TOTAL — {listKpis.count} ativos</td>
                    <td style={{...S.td,fontWeight:700}}>R$ {fmtBRL(listKpis.capitalTotal)}</td>
                    <td style={{...S.td,fontWeight:700,color:'#0369A1'}}>R$ {fmtBRL(investments.filter(i=>i.status==='ATIVO').reduce((s,i)=>s+Number(i.capitalBalance??i.capitalInitial),0))}</td>
                    <td style={{...S.td,fontWeight:700}}>R$ {fmtBRL(Object.values(allProjections).reduce((s,p)=>s+p.rendBruto,0))}</td>
                    <td style={{...S.td,fontWeight:700,color:'#DC2626'}}>R$ {fmtBRL(Object.values(allProjections).reduce((s,p)=>s+p.irrf,0))}</td>
                    <td style={{...S.td,fontWeight:700}}>R$ {fmtBRL(Object.values(allProjections).reduce((s,p)=>s+p.saldoLiq,0))}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {selected && (
            <div style={{...S.card, marginLeft:32, marginTop:-8, borderTop:'none', borderTopLeftRadius:0, borderTopRightRadius:0, borderTop:'3px solid #2563EB'}}>
              <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' as const}}>
                <span style={{fontSize:13, fontWeight:500}}>{selected.description}</span>
                <span style={S.pill(selected.status)}>{selected.status}</span>
                <span style={{fontSize:11, color:'var(--color-text-secondary)'}}>{selected.indexerRate}% CDI{selected.irrfExempt?' · Isento IRRF':' · IRRF aplicavel'}</span>
                <div style={{marginLeft:'auto', display:'flex', gap:6, alignItems:'center'}}>
                  <span style={{fontSize:11, color:'var(--color-text-secondary)'}}>CDI proj.(%/mes)</span>
                  <input style={{...S.input, width:64, textAlign:'right' as const}} type='number' min={0} max={5} step={0.01}
                    value={projRate} onChange={e=>setProjRate(parseFloat(e.target.value)||0.95)}/>
                  <button style={S.btnP} onClick={()=>setShowResgate(true)}>+ Novo Resgate</button>
                </div>
              </div>

              {kpis && (
                <div style={S.kpiGrid}>
                  <div style={S.kpi}><div style={S.kpiLbl}>Capital inicial</div><div style={S.kpiVal}>R$ {fmtBRL(kpis.capitalInicial)}</div><div style={S.kpiSub}>Aplicado em {fmtDate(selected.applicationDate)}</div></div>
                  <div style={S.kpi}><div style={S.kpiLbl}>Rendimento bruto proj.</div><div style={S.kpiVal}>R$ {fmtBRL(kpis.rendBruto)}</div><div style={S.kpiSub}>{((kpis.rendBruto/kpis.capitalInicial)*100).toFixed(2)}% sobre capital</div></div>
                  <div style={S.kpi}><div style={S.kpiLbl}>IRRF estimado</div><div style={{...S.kpiVal,...S.neg}}>{selected.irrfExempt?'--':'R$ '+fmtBRL(kpis.irrfTotal)}</div><div style={S.kpiSub}>{selected.irrfExempt?'Isento':(kpis.aliqFinal*100).toFixed(1)+'% ('+kpis.diasFinal+'d)'}</div></div>
                  <div style={S.kpi}><div style={S.kpiLbl}>Saldo liquido final</div><div style={S.kpiVal}>R$ {fmtBRL(kpis.saldoLiq)}</div><div style={S.kpiSub}>Vencto {fmtDate(selected.maturityDate)}</div></div>
                  <div style={S.kpi}><div style={S.kpiLbl}>Saldo de capital</div><div style={{...S.kpiVal,color:'#0369A1'}}>R$ {fmtBRL(projection.length ? projection[projection.length-1].capitalBalance : Number(selected.capitalBalance ?? selected.capitalInitial))}</div><div style={S.kpiSub}>Principal restante</div></div>
                  {kpis.qtdResgates>0 && <div style={S.kpi}><div style={S.kpiLbl}>Resgates ({kpis.qtdResgates})</div><div style={{...S.kpiVal,color:'#C2410C'}}>R$ {fmtBRL(kpis.totLiq)}</div><div style={S.kpiSub}>Principal: R$ {fmtBRL(kpis.totPrinc)}</div></div>}
                </div>
              )}

              <div style={{display:'flex', gap:4, marginBottom:14, alignItems:'center', flexWrap:'wrap' as const}}>
                {(['extrato','projecao','resgates'] as const).map(t=>(
                  <button key={t} style={S.tab(detailTab===t)} onClick={()=>setDetailTab(t)}>
                    {t==='extrato'?'Extrato completo':t==='projecao'?'Projecao':('Resgates'+(redemptions.length?' ('+redemptions.length+')':''))}
                  </button>
                ))}
                <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:6}}>
                  {filterDate && <span style={{fontSize:11, color:'#1D4ED8', fontWeight:500}}>Filtrado ate {filterDate.split('-').reverse().join('/')}</span>}
                </div>
              </div>

              {detailTab==='resgates' && (
                <div>
                  {redemptions.length===0
                    ? <p style={{fontSize:12,color:'var(--color-text-secondary)',fontStyle:'italic'}}>Nenhum resgate registrado. Use "+ Novo Resgate" acima.</p>
                    : <div style={S.tblW}>
                        <table style={{width:'100%',borderCollapse:'collapse',minWidth:700}}>
                          <thead><tr>
                            <th style={S.thL}>Data</th><th style={S.th}>Capital</th>
                            <th style={S.th}>Rend. bruto</th><th style={S.th}>IR retido</th>
                            <th style={S.th}>Liq. creditado</th><th style={S.th}>Acoes</th>
                          </tr></thead>
                          <tbody>
                            {redemptions.map(r=>(
                              <tr key={r.id} style={{background:'#FFFBEB'}}>
                                <td style={S.tdL}>{fmtDate(r.eventDate)}</td>
                                <td style={S.td}>R$ {fmtBRL(r.redemptionPrincipal??0)}</td>
                                <td style={S.td}>R$ {fmtBRL(r.redemptionYield??0)}</td>
                                <td style={{...S.td,...S.neg}}>R$ {fmtBRL(r.irrfAmount??0)}</td>
                                <td style={{...S.td,...S.pos}}>R$ {fmtBRL(r.netAmount??0)}</td>
                                <td style={S.td}>
                                  <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                                    <button style={S.btnEdt} onClick={()=>setEditResgate(r)}>Editar</button>
                                    <button style={S.btnDng} onClick={()=>deleteResgate(r)}>X</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          <tr style={{background:'var(--color-background-secondary)',fontWeight:500}}>
                              <td style={{...S.tdL,fontWeight:600}}>TOTAL</td>
                              <td style={S.td}>R$ {fmtBRL(redemptions.reduce((s,r)=>s+Number(r.redemptionPrincipal??0),0))}</td>
                              <td style={S.td}>R$ {fmtBRL(redemptions.reduce((s,r)=>s+Number(r.redemptionYield??0),0))}</td>
                              <td style={{...S.td,...S.neg}}>R$ {fmtBRL(redemptions.reduce((s,r)=>s+Number(r.irrfAmount??0),0))}</td>
                              <td style={{...S.td,...S.pos}}>R$ {fmtBRL(redemptions.reduce((s,r)=>s+Number(r.netAmount??0),0))}</td>
                              <td style={S.td}></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                  }
                </div>
              )}

              {(detailTab==='extrato'||detailTab==='projecao') && (
                <div style={S.tblW}>
                  <table style={{width:'100%',borderCollapse:'collapse',minWidth:900}}>
                    <thead><tr>
                      <th style={S.thL}>Competencia</th><th style={S.th}>Dias</th><th style={S.th}>Indice</th>
                      <th style={S.th}>Rend. bruto</th><th style={S.th}>Rend. acum.</th><th style={S.th}>Saldo bruto</th>
                      <th style={S.th}>Aliq.</th><th style={S.th}>IRRF</th><th style={S.th}>Saldo liq.</th><th style={S.th}>Saldo capital</th>
                    </tr></thead>
                    <tbody>
                      {projection.filter(l => !filterDate || l.competence <= filterDate).map((l,i)=>{
                        const isLast = i===projection.length-1;
                        const resgMes = detailTab==='extrato' ? redemptions.filter(r=>{
                          const d = parseD(r.eventDate);
                          return d.getFullYear()===parseInt(l.competence.slice(0,4)) &&
                                 d.getMonth()+1===parseInt(l.competence.slice(5,7));
                        }) : [];
                        return (
                          <React.Fragment key={l.competence}>
                            <tr style={{background:isLast?'#EFF6FF':'transparent'}}>
                              <td style={S.tdL}>
                                {fmtComp(l.competence)}
                                {l.isProjected && <span style={{fontSize:9,padding:'1px 4px',borderRadius:3,background:'#F3F4F6',color:'#6B7280',marginLeft:4}}>proj</span>}
                              </td>
                              <td style={S.td}>{l.calendarDays}</td>
                              <td style={S.td}>{(l.indexerRate*100).toFixed(6)}%</td>
                              <td style={S.td}>R$ {fmtBRL(l.grossYield)}</td>
                              <td style={S.td}>R$ {fmtBRL(l.accumulatedYield)}</td>
                              <td style={S.td}>R$ {fmtBRL(l.grossBalance)}</td>
                              <td style={S.td}><span style={S.aliqPill(l.irrfRate)}>{(l.irrfRate*100).toFixed(1)}%</span></td>
                              <td style={{...S.td,...S.neg}}>{selected.irrfExempt?'--':'-R$ '+fmtBRL(l.irrfOnRedemption)}</td>
                              <td style={{...S.td,fontWeight:isLast?500:400}}>R$ {fmtBRL(l.netBalance)}</td>
                              <td style={{...S.td,color:'#0369A1',fontWeight:500}}>R$ {fmtBRL(l.capitalBalance)}</td>
                            </tr>
                            {resgMes.map(r=>(
                              <tr key={'rg-'+r.id} style={{background:'#FEF9C3'}}>
                                <td style={{...S.tdL,paddingLeft:20}}>
                                  <span style={{fontSize:10,fontWeight:600,padding:'1px 6px',borderRadius:4,background:'#FEF08A',color:'#713F12',marginRight:6}}>RESGATE</span>
                                  {fmtDate(r.eventDate)}
                                </td>
                                <td style={S.td} colSpan={2}><span style={{color:'#374151'}}>Principal: R$ {fmtBRL(r.redemptionPrincipal??0)}</span></td>
                                <td style={S.td} colSpan={2}><span style={{color:'#374151'}}>Rend. bruto: R$ {fmtBRL(r.redemptionYield??0)}</span></td>
                                <td style={{...S.td,...S.neg}}>IR: -R$ {fmtBRL(r.irrfAmount??0)}</td>
                                <td colSpan={2}></td>
                                <td style={{...S.td,...S.pos,fontWeight:500}}>Liq: R$ {fmtBRL(r.netAmount??0)}</td>
                                <td style={S.td}></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  {filterDate && (() => {
                    const filtered = projection.filter(l => l.competence <= filterDate);
                    if (!filtered.length) return null;
                    const last = filtered[filtered.length-1];
                    return (
                      <tfoot>
                        <tr style={{background:'#F0F9FF',borderTop:'2px solid #2563EB'}}>
                          <td style={{...S.tdL,fontWeight:700,color:'#1D4ED8'}} colSpan={3}>Acumulado ate {filterDate.split('-').reverse().join('/')}</td>
                          <td style={S.td} colSpan={2}></td>
                          <td style={{...S.td,fontWeight:700}}>R$ {fmtBRL(last.grossBalance)}</td>
                          <td style={S.td}></td>
                          <td style={{...S.td,fontWeight:700,color:'#DC2626'}}>-R$ {fmtBRL(last.irrfOnRedemption)}</td>
                          <td style={{...S.td,fontWeight:700}}>R$ {fmtBRL(last.netBalance)}</td>
                          <td style={{...S.td,fontWeight:700,color:'#0369A1'}}>R$ {fmtBRL(last.capitalBalance)}</td>
                        </tr>
                      </tfoot>
                    );
                  })()}
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab==='orientacao' && (
        <div>
          <div style={S.card}>
            <p style={S.secTit}>Fluxo operacional mensal</p>
            {[
              {n:'1',titulo:'BCB divulga CDI do mes',desc:'Acesse Tabela CDI -> aba Atualizacao Mensal. Informe competencia e CDI acumulado do mes.'},
              {n:'2',titulo:'Executar atualizacao em lote',desc:'Clique Executar — sistema salva a taxa e recalcula todos os investimentos ativos.'},
              {n:'3',titulo:'Lancamento contabil',desc:'Marque Gerar lancamento contabil para registrar receita financeira bruta (regime de competencia).'},
              {n:'4',titulo:'Cadastrar investimentos',desc:'Use + Novo investimento para registrar CDB, LCI, LCA e demais aplicacoes.'},
              {n:'5',titulo:'Resgates',desc:'Selecione o investimento -> aba Resgates -> + Novo Resgate. Informe data, capital e rendimento liquido do extrato bancario.'},
            ].map(s=>(
              <div key={s.n} style={{display:'flex',gap:14,marginBottom:14,alignItems:'flex-start'}}>
                <div style={{minWidth:26,height:26,borderRadius:'50%',background:'#EFF6FF',color:'#1D4ED8',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,flexShrink:0}}>{s.n}</div>
                <div><div style={{fontSize:13,fontWeight:500,marginBottom:2}}>{s.titulo}</div><div style={{fontSize:12,color:'var(--color-text-secondary)',lineHeight:1.6}}>{s.desc}</div></div>
              </div>
            ))}
            <div style={{background:'#FEFCE8',border:'0.5px solid #FEF08A',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#854D0E',marginTop:4}}>
              <strong>Lucro Real:</strong> IRRF retido no resgate e antecipacao de IRPJ/CSLL. LCI/LCA/CRI/CRA: isentos de IRRF para PJ.
            </div>
          </div>
          <div style={S.card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
              <p style={{...S.secTit,margin:0}}>Lancamentos contabeis gerados</p>
              <button style={S.btn} onClick={loadJournalEntries} disabled={jLoading}>{jLoading?'...':'Atualizar'}</button>
            </div>
            {journalEntries.length===0
              ?<p style={{fontSize:12,color:'var(--color-text-secondary)',fontStyle:'italic'}}>Nenhum lancamento encontrado. Execute atualizacao mensal com lancamento contabil ativado.</p>
              :<div style={S.tblW}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:500}}>
                  <thead><tr>
                    <th style={S.thL}>Data</th><th style={S.thL}>Descricao</th>
                    <th style={S.th}>Debitos</th><th style={S.th}>Creditos</th>
                  </tr></thead>
                  <tbody>
                    {journalEntries.map((je:any)=>{
                      const deb=(je.items??[]).filter((i:any)=>i.type==='DEBIT').reduce((s:number,i:any)=>s+parseFloat(i.value),0);
                      const cred=(je.items??[]).filter((i:any)=>i.type==='CREDIT').reduce((s:number,i:any)=>s+parseFloat(i.value),0);
                      return(<tr key={je.id}>
                        <td style={S.tdL}>{fmtDate(je.date)}</td>
                        <td style={{...S.tdL,maxWidth:300,overflow:'hidden' as const,textOverflow:'ellipsis' as const,whiteSpace:'nowrap' as const}}>{je.description}</td>
                        <td style={S.td}>R$ {fmtBRL(deb)}</td>
                        <td style={S.td}>R$ {fmtBRL(cred)}</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}
