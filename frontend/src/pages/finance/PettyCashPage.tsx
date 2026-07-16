// frontend/src/pages/finance/PettyCashPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { SmartDateInput } from '../../components/SmartDateInput';
import toast from 'react-hot-toast';

const AC = '#0369A1';
const AC_SURF = '#F0F9FF';
function fmtBRL(v: any) { return Number(v??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function fmtDate(s: any) { if(!s) return '—'; const p=String(s).split('T')[0].split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }

function maskCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const cents = digits.padStart(3, '0');
  const intPart = cents.slice(0, -2).replace(/^0+(?=\d)/, '');
  const decPart = cents.slice(-2);
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return intFormatted + ',' + decPart;
}
function unmaskCurrency(masked: string): number {
  if (!masked) return 0;
  return parseFloat(masked.replace(/\./g, '').replace(',', '.')) || 0;
}
function numberToMask(value: number | string): string {
  const num = Number(value) || 0;
  return maskCurrency(Math.round(num * 100).toString());
}

const TYPE_LABEL: Record<string,{label:string;bg:string;color:string}> = {
  EXPENSE:       {label:'Despesa',     bg:'#FEE2E2',color:'#B91C1C'},
  REPLENISHMENT: {label:'Reposição',   bg:'#DCFCE7',color:'#15803D'},
  OPENING:       {label:'Abertura',    bg:'#DBEAFE',color:'#1D4ED8'},
};
const CAT_LABEL: Record<string,string> = {
  ALIMENTACAO:'Alimentação', TRANSPORTE:'Transporte', MATERIAL_ESCRITORIO:'Material Escritório',
  LIMPEZA:'Limpeza', CORREIOS:'Correios', MANUTENCAO:'Manutenção', OUTROS:'Outros',
};

const S = {
  th: {padding:'8px 12px',fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase' as const,background:'#F9FAFB',borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const},
  td: {padding:'10px 12px',fontSize:13,color:'#374151',borderBottom:'0.5px solid #F5F5F5'},
  input: {border:'0.5px solid #E5E7EB',borderRadius:6,padding:'7px 10px',fontSize:13,outline:'none',width:'100%',boxSizing:'border-box' as const},
  label: {fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase' as const,marginBottom:4,display:'block' as const},
};

export default function PettyCashPage() {
  const [funds, setFunds]         = useState<any[]>([]);
  const [selected, setSelected]   = useState<any>(null);
  const [summary, setSummary]     = useState<any>(null);
  const [entries, setEntries]     = useState<any[]>([]);
  const [totals, setTotals]       = useState<any>({});
  const [showNew, setShowNew]     = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [showFund, setShowFund]   = useState(false);
  const [editingFundId, setEditingFundId] = useState<string|null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [entryType, setEntryType] = useState<'EXPENSE'|'REPLENISHMENT'>('EXPENSE');
  const [editingEntryId, setEditingEntryId] = useState<string|null>(null);
  const [showClosure, setShowClosure] = useState(false);
  const [closurePreview, setClosurePreview] = useState<any>(null);
  const [closureEntries, setClosureEntries] = useState<Record<string,string>>({});
  const [closureAccountText, setClosureAccountText] = useState<Record<string,string>>({});
  const [closureCashAccountId, setClosureCashAccountId] = useState('');
  const [closureCashAccountText, setClosureCashAccountText] = useState('');
  const [closureSaveMappings, setClosureSaveMappings] = useState(true);
  const [accountsList, setAccountsList] = useState<{id:string;code:string;name:string}[]>([]);
  const [closureSubmitting, setClosureSubmitting] = useState(false);
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [newFund, setNewFund] = useState({name:'',targetBalance:'',alertThreshold:'',responsibleId:''});
  const [newEntry, setNewEntry] = useState({type:'EXPENSE',category:'OUTROS',date:new Date().toISOString().slice(0,10),amount:'',description:'',receiptRef:'',supplier:'',accountId:''});
  const [entryAccountText, setEntryAccountText] = useState('');
  const [categoryAccountMap, setCategoryAccountMap] = useState<Record<string,string>>({});

  const loadFunds = useCallback(async () => {
    const {data} = await api.get('/finance/petty-cash', { params: { includeInactive: showInactive } });
    setFunds(data);
    if (data.length && !selected) setSelected(data[0]);
  }, [refreshKey, showInactive]);

  const loadSummary = useCallback(async () => {
    if (!selected) return;
    const {data} = await api.get(`/finance/petty-cash/${selected.id}/summary`);
    setSummary(data);
  }, [selected, refreshKey]);

  const loadEntries = useCallback(async () => {
    if (!selected) return;
    const params: any = {};
    if (from) params.from = from;
    if (to)   params.to   = to;
    const {data} = await api.get(`/finance/petty-cash/${selected.id}/entries`, {params});
    setEntries(data.entries ?? []);
    setTotals(data);
  }, [selected, from, to, refreshKey]);

  useEffect(() => { loadFunds(); }, [loadFunds]);
  useEffect(() => {
    api.get('/chart-of-accounts', { params: { onlyAnalytic: true, limit: 1000 } })
      .then(({data}) => setAccountsList(data.items ?? data))
      .catch(() => {});
    api.get('/finance/petty-cash/category-accounts')
      .then(({data}) => {
        const map: Record<string,string> = {};
        for (const m of data) map[m.category] = m.accountId;
        setCategoryAccountMap(map);
      })
      .catch(() => {});
  }, []);
  useEffect(() => { loadSummary(); loadEntries(); }, [loadSummary, loadEntries]);

  async function handleSaveFund() {
    if (!newFund.name.trim()) { toast.error('Informe o nome do fundo.'); return; }
    if (!newFund.targetBalance || unmaskCurrency(newFund.targetBalance) <= 0) { toast.error('Informe o saldo alvo.'); return; }
    try {
      const payload = {
        ...newFund,
        targetBalance:  unmaskCurrency(newFund.targetBalance),
        alertThreshold: unmaskCurrency(newFund.alertThreshold),
      };
      if (editingFundId) {
        await api.put(`/finance/petty-cash/${editingFundId}`, payload);
        toast.success('Fundo atualizado.');
      } else {
        await api.post('/finance/petty-cash', payload);
        toast.success('Fundo criado.');
      }
      setShowFund(false);
      setEditingFundId(null);
      setNewFund({name:'',targetBalance:'',alertThreshold:'',responsibleId:''});
      setRefreshKey(k=>k+1);
    } catch(e:any) { toast.error(e?.response?.data?.message ?? 'Erro'); }
  }

  function openEditFund() {
    if (!selected) return;
    setNewFund({
      name: selected.name ?? '',
      targetBalance: numberToMask(selected.targetBalance ?? 0),
      alertThreshold: numberToMask(selected.alertThreshold ?? 0),
      responsibleId: selected.responsibleId ?? '',
    });
    setEditingFundId(selected.id);
    setShowFund(true);
  }

  async function handleToggleActive() {
    if (!selected) return;
    const novoStatus = !selected.active;
    if (!confirm(`${novoStatus ? 'Reativar' : 'Desativar'} o fundo "${selected.name}"?`)) return;
    try {
      await api.patch(`/finance/petty-cash/${selected.id}/toggle-active`, { active: novoStatus });
      toast.success(novoStatus ? 'Fundo reativado.' : 'Fundo desativado.');
      setRefreshKey(k=>k+1);
    } catch(e:any) { toast.error(e?.response?.data?.message ?? 'Erro'); }
  }

  async function handleDeleteFund() {
    if (!selected) return;
    if (!confirm(`Excluir o fundo "${selected.name}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await api.delete(`/finance/petty-cash/${selected.id}`);
      toast.success('Fundo excluido.');
      setSelected(null);
      setRefreshKey(k=>k+1);
    } catch(e:any) { toast.error(e?.response?.data?.message ?? 'Erro'); }
  }

  async function handleSaveEntry() {
    if (!selected) return;
    if (!newEntry.amount || unmaskCurrency(newEntry.amount) <= 0) { toast.error('Informe o valor.'); return; }
    if (!newEntry.description.trim()) { toast.error('Informe a descrição.'); return; }
    try {
      const entryPayload = { ...newEntry, amount: unmaskCurrency(newEntry.amount), type: entryType };
      if (editingEntryId) {
        await api.put(`/finance/petty-cash/${selected.id}/entries/${editingEntryId}`, entryPayload);
        toast.success('Movimento atualizado.');
      } else {
        await api.post(`/finance/petty-cash/${selected.id}/entries`, entryPayload);
        toast.success(entryType==='EXPENSE' ? 'Despesa registrada.' : 'Reposicao confirmada.');
      }
      setShowEntry(false);
      setEditingEntryId(null);
      setRefreshKey(k=>k+1);
      setNewEntry({type:'EXPENSE',category:'OUTROS',date:new Date().toISOString().slice(0,10),amount:'',description:'',receiptRef:'',supplier:'',accountId:''});
      setEntryAccountText('');
    } catch(e:any) { toast.error(e?.response?.data?.message ?? 'Erro'); }
  }

  function openEditEntry(e: any) {
    setNewEntry({
      type: e.type,
      category: e.category ?? 'OUTROS',
      date: String(e.date).split('T')[0],
      amount: numberToMask(e.amount),
      description: e.description ?? '',
      receiptRef: e.receiptRef ?? '',
      supplier: e.supplier ?? '',
      accountId: e.accountId ?? '',
    });
    const acc = accountsList.find(a => a.id === e.accountId);
    setEntryAccountText(acc ? `${acc.code} - ${acc.name}` : '');
    setEntryType(e.type === 'EXPENSE' ? 'EXPENSE' : 'REPLENISHMENT');
    setEditingEntryId(e.id);
    setShowEntry(true);
  }

  function resolveAccountFromText(text: string): string {
    const match = accountsList.find(a => `${a.code} - ${a.name}` === text);
    return match ? match.id : '';
  }

  function handleNewEntryAccountChange(text: string) {
    setEntryAccountText(text);
    const id = resolveAccountFromText(text);
    setNewEntry(d => ({...d, accountId: id}));
  }

  function handleEntryAccountChange(entryId: string, text: string) {
    setClosureAccountText(prev => ({ ...prev, [entryId]: text }));
    setClosureEntries(prev => ({ ...prev, [entryId]: resolveAccountFromText(text) }));
  }

  function handleCashAccountChange(text: string) {
    setClosureCashAccountText(text);
    setClosureCashAccountId(resolveAccountFromText(text));
  }

  async function openClosure() {
    if (!selected) return;
    try {
      const [{data: preview}, {data: accountsRaw}] = await Promise.all([
        api.get(`/finance/petty-cash/${selected.id}/closure-preview`),
        api.get('/chart-of-accounts', { params: { onlyAnalytic: true, limit: 1000 } }),
      ]);
      const accounts = accountsRaw.items ?? accountsRaw;
      if (!preview.entries || preview.entries.length === 0) {
        toast.error('Nao ha despesas pendentes para fechar neste fundo.');
        return;
      }
      setClosurePreview(preview);
      setAccountsList(accounts);
      const initEntries: Record<string,string> = {};
      const initText: Record<string,string> = {};
      for (const e of preview.entries) {
        const accId = e.suggestedAccountId ?? '';
        initEntries[e.id] = accId;
        const acc = accounts.find((a:any) => a.id === accId);
        initText[e.id] = acc ? `${acc.code} - ${acc.name}` : '';
      }
      setClosureEntries(initEntries);
      setClosureAccountText(initText);
      const cashId = preview.fund.cashAccountId ?? '';
      setClosureCashAccountId(cashId);
      const cAcc = accounts.find((a:any) => a.id === cashId);
      setClosureCashAccountText(cAcc ? `${cAcc.code} - ${cAcc.name}` : '');
      setShowClosure(true);
    } catch(e:any) { toast.error(e?.response?.data?.message ?? 'Erro ao carregar previa do fechamento.'); }
  }

  async function handleConfirmClosure() {
    if (!closurePreview || !selected) return;
    const missing = closurePreview.entries.filter((e:any) => !closureEntries[e.id]);
    if (missing.length > 0) { toast.error(`Falta classificar ${missing.length} despesa(s) antes de fechar.`); return; }
    if (!closureCashAccountId) { toast.error('Selecione a conta de caixa do fundo.'); return; }
    setClosureSubmitting(true);
    try {
      await api.post(`/finance/petty-cash/${selected.id}/close`, {
        entries: closurePreview.entries.map((e:any) => ({ id: e.id, accountId: closureEntries[e.id] })),
        cashAccountId: closureCashAccountId,
        saveMappings: closureSaveMappings,
      });
      toast.success('Caixa fechado. Lancamento contabil gerado.');
      setShowClosure(false);
      setRefreshKey(k=>k+1);
    } catch(e:any) { toast.error(e?.response?.data?.message ?? 'Erro ao fechar caixa.'); }
    finally { setClosureSubmitting(false); }
  }

  async function handleDeleteEntry(entryId: string) {
    if (!selected) return;
    if (!confirm('Excluir este movimento? Os saldos posteriores serao recalculados.')) return;
    try {
      await api.delete(`/finance/petty-cash/${selected.id}/entries/${entryId}`);
      toast.success('Movimento excluido.');
      setRefreshKey(k=>k+1);
    } catch(e:any) { toast.error(e?.response?.data?.message ?? 'Erro'); }
  }

  const pct = summary?.pct ?? 0;
  const barColor = pct > 40 ? '#15803D' : pct > 20 ? '#D97706' : '#B91C1C';

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ Financeiro</span>
            <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>Fundo Fixo / Caixa Pequeno</h1>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{setEditingFundId(null); setNewFund({name:'',targetBalance:'',alertThreshold:'',responsibleId:''}); setShowFund(true);}} style={{padding:'7px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',fontSize:13,cursor:'pointer',color:'#374151'}}>+ Novo Fundo</button>
            {selected && <button onClick={openEditFund} style={{padding:'7px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',fontSize:13,cursor:'pointer',color:'#374151'}}>✏️ Editar Fundo</button>}
            {selected && <button onClick={handleToggleActive} style={{padding:'7px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',fontSize:13,cursor:'pointer',color:selected.active?'#92400E':'#15803D'}}>{selected.active ? '⏸️ Desativar Fundo' : '▶️ Reativar Fundo'}</button>}
            {selected && <button onClick={handleDeleteFund} style={{padding:'7px 16px',borderRadius:8,border:'0.5px solid #FCA5A5',background:'#fff',fontSize:13,cursor:'pointer',color:'#B91C1C'}}>🗑️ Excluir Fundo</button>}
            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B7280',cursor:'pointer',marginLeft:4}}>
              <input type="checkbox" checked={showInactive} onChange={e=>{setShowInactive(e.target.checked); setSelected(null);}} />
              Mostrar inativos
            </label>
      {showClosure && closurePreview && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:60}}>
          <div style={{background:'#fff',borderRadius:12,padding:24,width:640,maxHeight:'85vh',overflowY:'auto',boxShadow:'0 10px 40px rgba(0,0,0,0.2)'}}>
            <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 4px'}}>Fechar Caixa</h2>
            <p style={{fontSize:12,color:'#6B7280',margin:'0 0 16px'}}>
              Revise a conta contabil de cada despesa do periodo antes de confirmar. O lancamento contabil sera gerado automaticamente.
            </p>

            <datalist id="accounts-dl">
              {accountsList.map(a => <option key={a.id} value={`${a.code} - ${a.name}`} />)}
            </datalist>

            <div style={{marginBottom:16,padding:12,background:'#F9FAFB',borderRadius:8}}>
              <label style={S.label}>Conta de Caixa do Fundo (credito)</label>
              <input list="accounts-dl" value={closureCashAccountText} onChange={e=>handleCashAccountChange(e.target.value)}
                placeholder="Buscar conta de caixa..." style={{...S.input, borderColor: closureCashAccountId ? '#D1D5DB' : '#FCA5A5'}} />
            </div>

            <div style={{display:'grid',gap:10}}>
              {closurePreview.entries.map((e:any) => (
                <div key={e.id} style={{border:'0.5px solid #E5E7EB',borderRadius:8,padding:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6}}>
                    <span style={{fontWeight:500}}>{e.description}</span>
                    <span style={{fontFamily:'monospace',color:'#B91C1C'}}>{fmtBRL(e.amount)}</span>
                  </div>
                  <div style={{fontSize:11,color:'#9CA3AF',marginBottom:6}}>{fmtDate(e.date)} · {e.category ? CAT_LABEL[e.category] : '—'}</div>
                  <input list="accounts-dl" value={closureAccountText[e.id] ?? ''} onChange={ev=>handleEntryAccountChange(e.id, ev.target.value)}
                    placeholder="Buscar conta contabil..." style={{...S.input, borderColor: closureEntries[e.id] ? '#D1D5DB' : '#FCA5A5'}} />
                </div>
              ))}
            </div>

            <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#6B7280',cursor:'pointer',marginTop:14}}>
              <input type="checkbox" checked={closureSaveMappings} onChange={e=>setClosureSaveMappings(e.target.checked)} />
              Salvar como conta padrao para cada categoria (proximas despesas ja vem sugeridas)
            </label>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:20,paddingTop:16,borderTop:'0.5px solid #E5E7EB'}}>
              <div style={{fontSize:13}}>Total do periodo: <strong style={{fontFamily:'monospace'}}>{fmtBRL(closurePreview.totalExpenses)}</strong></div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={()=>setShowClosure(false)} style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
                <button onClick={handleConfirmClosure} disabled={closureSubmitting} style={{padding:'8px 18px',borderRadius:8,border:'none',background:'#1E3A8A',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500,opacity:closureSubmitting?0.6:1}}>
                  {closureSubmitting ? 'Fechando...' : '🔒 Confirmar Fechamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
            {selected && <button onClick={()=>{setEditingEntryId(null); setEntryType('EXPENSE');setShowEntry(true);}} style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#B91C1C',color:'#fff',fontSize:13,cursor:'pointer',fontWeight:500}}>− Registrar Despesa</button>}
            {selected && <button onClick={()=>{setEditingEntryId(null); setEntryType('REPLENISHMENT');setShowEntry(true);}} style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#15803D',color:'#fff',fontSize:13,cursor:'pointer',fontWeight:500}}>+ Repor Fundo</button>}
            {selected && <button onClick={openClosure} style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#1E3A8A',color:'#fff',fontSize:13,cursor:'pointer',fontWeight:500}}>🔒 Fechar Caixa</button>}
          </div>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Sidebar fundos */}
        {(funds.length > 1 || showInactive) && (
          <div style={{width:200,borderRight:'0.5px solid #E5E7EB',padding:'12px 8px',background:'#F9FAFB',overflowY:'auto'}}>
            {funds.map(f => (
              <div key={f.id} onClick={()=>setSelected(f)} style={{padding:'10px 12px',borderRadius:8,cursor:'pointer',opacity:f.active?1:0.5,background:selected?.id===f.id ? AC_SURF : 'transparent',borderLeft:selected?.id===f.id ? `3px solid ${AC}` : '3px solid transparent',marginBottom:4}}>
                <div style={{fontSize:13,fontWeight:600,color:selected?.id===f.id ? AC : '#374151',display:'flex',alignItems:'center',gap:6}}>
                  {f.name}
                  {!f.active && <span style={{fontSize:9,padding:'1px 6px',borderRadius:10,background:'#FEE2E2',color:'#B91C1C',fontWeight:700}}>INATIVO</span>}
                </div>
                <div style={{fontSize:11,color:'#9CA3AF'}}>{f.responsible?.fullName ?? 'Sem responsável'}</div>
              </div>
            ))}
          </div>
        )}

        {/* Conteúdo principal */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
          {!selected ? (
            <div style={{textAlign:'center',padding:'60px',color:'#9CA3AF'}}>
              <div style={{fontSize:48,marginBottom:12}}>💰</div>
              <div>Nenhum fundo fixo cadastrado.</div>
              <button onClick={()=>setShowFund(true)} style={{marginTop:16,padding:'8px 20px',borderRadius:8,border:'none',background:AC,color:'#fff',cursor:'pointer'}}>Criar Fundo Fixo</button>
            </div>
          ) : summary && (
            <>
              {/* Saldo atual */}
              <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:'20px 24px',marginBottom:20}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
                  <div>
                    <div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',marginBottom:4}}>Saldo Atual — {selected.name}</div>
                    <div style={{fontSize:32,fontWeight:700,color:barColor}}>{fmtBRL(summary.current)}</div>
                    <div style={{fontSize:12,color:'#6B7280',marginTop:4}}>Meta: {fmtBRL(summary.target)} · Alerta: {fmtBRL(summary.alert)}</div>
                  </div>
                  {summary.needsReplenishment && (
                    <div style={{background:'#FEF3C7',border:'0.5px solid #F59E0B',borderRadius:10,padding:'10px 16px',textAlign:'center'}}>
                      <div style={{fontSize:11,fontWeight:700,color:'#92400E'}}>⚠️ REPOR FUNDO</div>
                      <div style={{fontSize:13,color:'#92400E',marginTop:2}}>Falta {fmtBRL(summary.replenishmentAmount)}</div>
                    </div>
                  )}
                </div>
                {/* Barra de progresso */}
                <div style={{background:'#F3F4F6',borderRadius:8,height:12,overflow:'hidden'}}>
                  <div style={{width:`${Math.min(pct,100)}%`,height:'100%',background:barColor,borderRadius:8,transition:'width 0.5s'}} />
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#9CA3AF',marginTop:4}}>
                  <span>R$ 0</span><span>{pct}%</span><span>{fmtBRL(summary.target)}</span>
                </div>
              </div>

              {/* KPIs */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                {[
                  {label:'Total Despesas',   value:totals.totalExpenses,      color:'#B91C1C'},
                  {label:'Total Reposições', value:totals.totalReplenishment, color:'#15803D'},
                  {label:'Movimentos',       value:entries.length,             color:AC, fmt:(v:any)=>v},
                ].map(k=>(
                  <div key={k.label} style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:10,padding:'12px 16px'}}>
                    <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',marginBottom:4}}>{k.label}</div>
                    <div style={{fontSize:18,fontWeight:700,color:k.color}}>{(k as any).fmt ? (k as any).fmt(k.value) : fmtBRL(k.value)}</div>
                  </div>
                ))}
              </div>

              {/* Filtro período */}
              <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'flex-end'}}>
                <div><label style={S.label}>De</label><SmartDateInput value={from} onChange={v=>setFrom(v)} style={{width:140}} /></div>
                <div><label style={S.label}>Até</label><SmartDateInput value={to} onChange={v=>setTo(v)} style={{width:140}} /></div>
                <button onClick={()=>{setFrom('');setTo('');}} style={{padding:'7px 14px',borderRadius:6,border:'0.5px solid #E5E7EB',background:'#fff',fontSize:12,cursor:'pointer',color:'#6B7280'}}>Limpar</button>
              </div>

              {/* Tabela de movimentos */}
              <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr>{['Data','Tipo','Categoria','Fornecedor','Descrição','Comprovante','Valor','Saldo',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr><td colSpan={9} style={{...S.td,textAlign:'center',padding:'40px',color:'#9CA3AF'}}>Nenhum movimento no período.</td></tr>
                    ) : entries.map(e=>{
                      const t = TYPE_LABEL[e.type] ?? TYPE_LABEL.EXPENSE;
                      return (
                        <tr key={e.id}>
                          <td style={S.td}>{fmtDate(e.date)}</td>
                          <td style={S.td}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:t.bg,color:t.color,fontWeight:600}}>{t.label}</span></td>
                          <td style={S.td}>{e.category ? CAT_LABEL[e.category] ?? e.category : '—'}</td>
                          <td style={S.td}>{e.supplier ?? '—'}</td>
                          <td style={{...S.td,maxWidth:300,wordBreak:'break-word'}}>{e.description}</td>
                          <td style={{...S.td,fontSize:11,color:'#9CA3AF'}}>{e.receiptRef ?? '—'}</td>
                          <td style={{...S.td,fontFamily:'monospace',fontWeight:600,color:e.type==='EXPENSE'?'#B91C1C':'#15803D'}}>{e.type==='EXPENSE'?'-':'+' }{fmtBRL(e.amount)}</td>
                          <td style={{...S.td,fontFamily:'monospace',color:'#374151'}}>{fmtBRL(e.balanceAfter)}</td>
                          <td style={{...S.td,whiteSpace:'nowrap'}}>
                            {e.closureId ? (
                              <span title="Lancamento fechado - imutavel" style={{color:'#9CA3AF',fontSize:14}}>🔒</span>
                            ) : e.type !== 'OPENING' && (
                              <>
                                <button onClick={()=>openEditEntry(e)} title="Editar" style={{border:'none',background:'transparent',cursor:'pointer',padding:4,color:'#6B7280'}}>✏️</button>
                                <button onClick={()=>handleDeleteEntry(e.id)} title="Excluir" style={{border:'none',background:'transparent',cursor:'pointer',padding:4,color:'#B91C1C'}}>🗑️</button>
                              </>
                            )}
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
      </div>

      {/* Modal Novo Fundo */}
      {showFund && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#fff',borderRadius:14,width:460,padding:24,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
            <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 20px'}}>{editingFundId ? 'Editar Fundo Fixo' : 'Novo Fundo Fixo'}</h2>
            <div style={{display:'grid',gap:12}}>
              {[{label:'Nome do Fundo',key:'name',type:'text',placeholder:'Ex: Caixa da Maria'},{label:'Saldo Alvo (R$)',key:'targetBalance',type:'text',placeholder:'1000,00'},{label:'Alerta abaixo de (R$)',key:'alertThreshold',type:'text',placeholder:'200,00'}].map(f=>(
                <div key={f.key}><label style={S.label}>{f.label}</label><input type={f.type} placeholder={f.placeholder} value={(newFund as any)[f.key]} onChange={e=>{
                  const isMoney = f.key==='targetBalance'||f.key==='alertThreshold';
                  setNewFund(d=>({...d,[f.key]: isMoney ? maskCurrency(e.target.value) : e.target.value}));
                }} style={S.input} /></div>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}>
              <button onClick={()=>{setShowFund(false); setEditingFundId(null);}} style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={handleSaveFund} style={{padding:'8px 18px',borderRadius:8,border:'none',background:AC,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500}}>{editingFundId ? 'Salvar' : 'Criar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Movimento */}
      {showEntry && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#fff',borderRadius:14,width:540,padding:24,boxShadow:'0 20px 60px rgba(0,0,0,.15)',maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 4px'}}>{editingEntryId ? 'Editar Movimento' : (entryType==='EXPENSE'?'Registrar Despesa':'Repor Fundo')}</h2>
            <p style={{fontSize:13,color:'#6B7280',margin:'0 0 20px'}}>Saldo atual: <strong>{fmtBRL(summary?.current)}</strong></p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={S.label}>Data</label><SmartDateInput value={newEntry.date} onChange={v=>setNewEntry(d=>({...d,date:v}))} style={S.input} /></div>
              <div><label style={S.label}>Valor (R$)</label><input value={newEntry.amount} onChange={e=>setNewEntry(d=>({...d,amount:maskCurrency(e.target.value)}))} style={S.input} placeholder="0,00" /></div>
              {entryType==='EXPENSE' && <>
                <div><label style={S.label}>Categoria</label>
                  <select value={newEntry.category} onChange={e=>{
                    const cat = e.target.value;
                    setNewEntry(d=>({...d,category:cat}));
                    if (!entryAccountText) {
                      const suggestedId = categoryAccountMap[cat];
                      if (suggestedId) {
                        const acc = accountsList.find(a => a.id === suggestedId);
                        if (acc) { setEntryAccountText(`${acc.code} - ${acc.name}`); setNewEntry(d=>({...d,category:cat,accountId:suggestedId})); }
                      }
                    }
                  }} style={S.input}>
                    {Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Conta Contabil (opcional)</label>
                  <input list="accounts-dl-entry" value={entryAccountText} onChange={e=>handleNewEntryAccountChange(e.target.value)}
                    placeholder="Buscar conta contabil..." style={S.input} />
                  <datalist id="accounts-dl-entry">
                    {accountsList.map(a => <option key={a.id} value={`${a.code} - ${a.name}`} />)}
                  </datalist>
                </div>
                <div><label style={S.label}>Fornecedor</label><input value={newEntry.supplier} onChange={e=>setNewEntry(d=>({...d,supplier:e.target.value}))} style={S.input} /></div>
                <div><label style={S.label}>Nº Comprovante</label><input value={newEntry.receiptRef} onChange={e=>setNewEntry(d=>({...d,receiptRef:e.target.value}))} style={S.input} placeholder="NF, recibo, etc." /></div>
              </>}
              <div style={{gridColumn:'1/-1'}}>
                <label style={S.label}>Descrição detalhada</label>
                <textarea value={newEntry.description} onChange={e=>setNewEntry(d=>({...d,description:e.target.value}))} style={{...S.input,height:100,resize:'vertical'}} placeholder="Descreva detalhadamente a despesa ou reposição..." />
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}>
              <button onClick={()=>{setShowEntry(false); setEditingEntryId(null);}} style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={handleSaveEntry} style={{padding:'8px 18px',borderRadius:8,border:'none',background:entryType==='EXPENSE'?'#B91C1C':'#15803D',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500}}>
                {editingEntryId ? 'Salvar' : (entryType==='EXPENSE'?'Registrar Despesa':'Confirmar Reposição')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}