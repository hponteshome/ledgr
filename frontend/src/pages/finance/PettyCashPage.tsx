// frontend/src/pages/finance/PettyCashPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { SmartDateInput } from '../../components/SmartDateInput';

const AC = '#0369A1';
const AC_SURF = '#F0F9FF';
function fmtBRL(v: any) { return Number(v??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function fmtDate(s: any) { if(!s) return '—'; const p=String(s).split('T')[0].split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }

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
  const [entryType, setEntryType] = useState<'EXPENSE'|'REPLENISHMENT'>('EXPENSE');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const [newFund, setNewFund] = useState({name:'',targetBalance:'',alertThreshold:'',responsibleId:''});
  const [newEntry, setNewEntry] = useState({type:'EXPENSE',category:'OUTROS',date:new Date().toISOString().slice(0,10),amount:'',description:'',receiptRef:'',supplier:''});

  const loadFunds = useCallback(async () => {
    const {data} = await api.get('/finance/petty-cash');
    setFunds(data);
    if (data.length && !selected) setSelected(data[0]);
  }, [refreshKey]);

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
  useEffect(() => { loadSummary(); loadEntries(); }, [loadSummary, loadEntries]);

  async function handleCreateFund() {
    try {
      await api.post('/finance/petty-cash', {
        ...newFund,
        targetBalance:  parseFloat(newFund.targetBalance.replace(',','.')),
        alertThreshold: parseFloat(newFund.alertThreshold.replace(',','.')),
      });
      setShowFund(false);
      setRefreshKey(k=>k+1);
    } catch(e:any) { alert(e?.response?.data?.message ?? 'Erro'); }
  }

  async function handleAddEntry() {
    if (!selected) return;
    try {
      await api.post(`/finance/petty-cash/${selected.id}/entries`, {...newEntry, type: entryType});
      setShowEntry(false);
      setRefreshKey(k=>k+1);
      setNewEntry({type:'EXPENSE',category:'OUTROS',date:new Date().toISOString().slice(0,10),amount:'',description:'',receiptRef:'',supplier:''});
    } catch(e:any) { alert(e?.response?.data?.message ?? 'Erro'); }
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
            <button onClick={()=>setShowFund(true)} style={{padding:'7px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',fontSize:13,cursor:'pointer',color:'#374151'}}>+ Novo Fundo</button>
            {selected && <button onClick={()=>{setEntryType('EXPENSE');setShowEntry(true);}} style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#B91C1C',color:'#fff',fontSize:13,cursor:'pointer',fontWeight:500}}>− Registrar Despesa</button>}
            {selected && <button onClick={()=>{setEntryType('REPLENISHMENT');setShowEntry(true);}} style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#15803D',color:'#fff',fontSize:13,cursor:'pointer',fontWeight:500}}>+ Repor Fundo</button>}
          </div>
        </div>
      </div>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Sidebar fundos */}
        {funds.length > 1 && (
          <div style={{width:200,borderRight:'0.5px solid #E5E7EB',padding:'12px 8px',background:'#F9FAFB',overflowY:'auto'}}>
            {funds.map(f => (
              <div key={f.id} onClick={()=>setSelected(f)} style={{padding:'10px 12px',borderRadius:8,cursor:'pointer',background:selected?.id===f.id ? AC_SURF : 'transparent',borderLeft:selected?.id===f.id ? `3px solid ${AC}` : '3px solid transparent',marginBottom:4}}>
                <div style={{fontSize:13,fontWeight:600,color:selected?.id===f.id ? AC : '#374151'}}>{f.name}</div>
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
                    <tr>{['Data','Tipo','Categoria','Fornecedor','Descrição','Comprovante','Valor','Saldo'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr><td colSpan={8} style={{...S.td,textAlign:'center',padding:'40px',color:'#9CA3AF'}}>Nenhum movimento no período.</td></tr>
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
            <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 20px'}}>Novo Fundo Fixo</h2>
            <div style={{display:'grid',gap:12}}>
              {[{label:'Nome do Fundo',key:'name',type:'text',placeholder:'Ex: Caixa da Maria'},{label:'Saldo Alvo (R$)',key:'targetBalance',type:'text',placeholder:'1000,00'},{label:'Alerta abaixo de (R$)',key:'alertThreshold',type:'text',placeholder:'200,00'}].map(f=>(
                <div key={f.key}><label style={S.label}>{f.label}</label><input type={f.type} placeholder={f.placeholder} value={(newFund as any)[f.key]} onChange={e=>setNewFund(d=>({...d,[f.key]:e.target.value}))} style={S.input} /></div>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:20}}>
              <button onClick={()=>setShowFund(false)} style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={handleCreateFund} disabled={!newFund.name||!newFund.targetBalance} style={{padding:'8px 18px',borderRadius:8,border:'none',background:AC,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500}}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Movimento */}
      {showEntry && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'#fff',borderRadius:14,width:540,padding:24,boxShadow:'0 20px 60px rgba(0,0,0,.15)',maxHeight:'90vh',overflowY:'auto'}}>
            <h2 style={{fontSize:16,fontWeight:600,margin:'0 0 4px'}}>{entryType==='EXPENSE'?'Registrar Despesa':'Repor Fundo'}</h2>
            <p style={{fontSize:13,color:'#6B7280',margin:'0 0 20px'}}>Saldo atual: <strong>{fmtBRL(summary?.current)}</strong></p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div><label style={S.label}>Data</label><SmartDateInput value={newEntry.date} onChange={v=>setNewEntry(d=>({...d,date:v}))} style={S.input} /></div>
              <div><label style={S.label}>Valor (R$)</label><input value={newEntry.amount} onChange={e=>setNewEntry(d=>({...d,amount:e.target.value}))} style={S.input} placeholder="0,00" /></div>
              {entryType==='EXPENSE' && <>
                <div><label style={S.label}>Categoria</label>
                  <select value={newEntry.category} onChange={e=>setNewEntry(d=>({...d,category:e.target.value}))} style={S.input}>
                    {Object.entries(CAT_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
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
              <button onClick={()=>setShowEntry(false)} style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
              <button onClick={handleAddEntry} disabled={!newEntry.amount||!newEntry.description} style={{padding:'8px 18px',borderRadius:8,border:'none',background:entryType==='EXPENSE'?'#B91C1C':'#15803D',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500}}>
                {entryType==='EXPENSE'?'Registrar Despesa':'Confirmar Reposição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}