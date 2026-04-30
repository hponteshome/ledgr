import React, { useState, useMemo, useCallback, useEffect } from 'react';
import api from '../../../services/api';

interface HistoricalRate { competence: string; rate: number; }
interface PartialRedemption { id: string; date: string; amount: number; label: string; }
interface ProjectionLine {
  competence: string; calendarDays: number; indexerRate: number;
  grossYield: number; grossBalance: number; accumulatedYield: number;
  irrfRate: number; irrfOnRedemption: number; netBalance: number;
  isProjected: boolean; isRedemption?: boolean;
  redemptionGross?: number; redemptionIrrf?: number; redemptionNet?: number;
}

function irrfRate(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.200;
  if (days <= 720) return 0.175;
  return 0.150;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000);
}
function lastDayOfMonth(year: number, month: number): Date { return new Date(year, month, 0); }
function parseDate(s: string): Date { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
const fmtBRL = (v: number) => v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtPct = (v: number, dec=4) => (v*100).toFixed(dec)+'%';
const fmtComp = (s: string) => s.split('-').reverse().join('/');
const uid = () => Math.random().toString(36).slice(2,9);

function buildProjection(p: {
  capitalInitial:number; applicationDate:string; maturityDate:string;
  indexerRate:number; irrfExempt:boolean; projectedMonthlyRate:number;
  partialRedemptions:PartialRedemption[];
  historicalRates:HistoricalRate[];
}): ProjectionLine[] {
  const appDate=parseDate(p.applicationDate), matDate=parseDate(p.maturityDate);
  const pct=p.indexerRate/100, projRate=p.projectedMonthlyRate/100;
  const redemptions=p.partialRedemptions.map(r=>({...r,dateObj:parseDate(r.date)}));
  const lines:ProjectionLine[]=[];
  let saldoBruto=p.capitalInitial, rendAcum=0;
  let cursor=new Date(appDate.getFullYear(),appDate.getMonth(),1);
  while(true){
    const yyyy=cursor.getFullYear(),mm=cursor.getMonth()+1;
    const comp=`${yyyy}-${String(mm).padStart(2,'0')}`;
    const fimMes=lastDayOfMonth(yyyy,mm);
    if(fimMes>matDate||saldoBruto<=0) break;
    const hist=p.historicalRates.find(h=>h.competence===comp);
    const isProjected=!hist, rawRate=hist?hist.rate:projRate;
    const indice=rawRate*pct, rendMes=saldoBruto*indice;
    saldoBruto+=rendMes; rendAcum+=rendMes;
    const dias=daysBetween(appDate,fimMes);
    const aliq=p.irrfExempt?0:irrfRate(dias);
    const irrfTot=rendAcum*aliq, saldoLiq=saldoBruto-irrfTot;
    const redEvent=redemptions.find(r=>r.dateObj.getFullYear()===yyyy&&r.dateObj.getMonth()+1===mm);
    const line:ProjectionLine={competence:comp,calendarDays:dias,indexerRate:indice,grossYield:rendMes,
      grossBalance:saldoBruto,accumulatedYield:rendAcum,irrfRate:aliq,
      irrfOnRedemption:irrfTot,netBalance:saldoLiq,isProjected};
    if(redEvent){
      const isTotal=redEvent.amount===0||redEvent.amount>=saldoBruto;
      const prop=isTotal?1:Math.min(redEvent.amount/saldoBruto,1);
      const brutoResg=saldoBruto*prop, rendResg=rendAcum*prop;
      const diasR=daysBetween(appDate,redEvent.dateObj);
      const aliqR=p.irrfExempt?0:irrfRate(diasR);
      line.isRedemption=true; line.redemptionGross=brutoResg;
      line.redemptionIrrf=rendResg*aliqR; line.redemptionNet=brutoResg-(rendResg*aliqR);
      saldoBruto=isTotal?0:saldoBruto-brutoResg;
      rendAcum=isTotal?0:rendAcum*(1-prop);
      lines.push(line); 
      if(isTotal) break;
    } else { lines.push(line); }
    cursor.setMonth(cursor.getMonth()+1);
    if(lines.length>400) break;
  }
  return lines;
}

const S = {
  page:    {padding:'24px 0',fontFamily:'var(--font-sans,system-ui)',fontSize:14,color:'var(--color-text-primary)'} as React.CSSProperties,
  badge:   {display:'inline-flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,background:'#EFF6FF',color:'#1D4ED8'} as React.CSSProperties,
  h1:      {fontSize:15,fontWeight:500,margin:0} as React.CSSProperties,
  secTitle:{fontSize:11,fontWeight:500,color:'var(--color-text-secondary)',textTransform:'uppercase' as const,letterSpacing:'.3px',marginBottom:10},
  card:    {background:'var(--color-background-primary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:10,padding:'14px 16px'} as React.CSSProperties,
  kpiGrid: {display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:20} as React.CSSProperties,
  kpi:     {background:'var(--color-background-secondary)',borderRadius:8,padding:'11px 14px'} as React.CSSProperties,
  kpiLbl:  {fontSize:10,textTransform:'uppercase' as const,letterSpacing:'.3px',color:'var(--color-text-secondary)',marginBottom:3},
  kpiVal:  {fontSize:19,fontWeight:500},
  kpiSub:  {fontSize:10,color:'var(--color-text-secondary)',marginTop:2},
  input:   {height:32,border:'0.5px solid var(--color-border-secondary)',borderRadius:6,padding:'0 9px',fontSize:13,background:'var(--color-background-primary)',color:'var(--color-text-primary)',width:'100%',outline:'none'} as React.CSSProperties,
  label:   {fontSize:10,textTransform:'uppercase' as const,letterSpacing:'.3px',color:'var(--color-text-secondary)',display:'block',marginBottom:4},
  btn:     {height:30,border:'0.5px solid var(--color-border-secondary)',borderRadius:6,padding:'0 12px',fontSize:12,cursor:'pointer',background:'var(--color-background-primary)',color:'var(--color-text-primary)'} as React.CSSProperties,
  btnPrimary: {height:30,border:'none',borderRadius:6,padding:'0 14px',fontSize:12,cursor:'pointer',background:'#111',color:'#fff',fontWeight:500} as React.CSSProperties,
  btnDanger: {height:28,border:'0.5px solid #FCA5A5',borderRadius:6,padding:'0 10px',fontSize:11,cursor:'pointer',background:'#FEF2F2',color:'#B91C1C'} as React.CSSProperties,
  tblWrap: {overflowX:'auto' as const,border:'0.5px solid var(--color-border-tertiary)',borderRadius:8},
  th:      {background:'var(--color-background-secondary)',color:'var(--color-text-secondary)',fontSize:10,fontWeight:500,textTransform:'uppercase' as const,letterSpacing:'.3px',padding:'8px 10px',textAlign:'right' as const,borderBottom:'0.5px solid var(--color-border-tertiary)',whiteSpace:'nowrap' as const},
  thL:     {background:'var(--color-background-secondary)',color:'var(--color-text-secondary)',fontSize:10,fontWeight:500,textTransform:'uppercase' as const,letterSpacing:'.3px',padding:'8px 10px',textAlign:'left' as const,borderBottom:'0.5px solid var(--color-border-tertiary)'},
  td:      {padding:'7px 10px',textAlign:'right' as const,borderBottom:'0.5px solid var(--color-border-tertiary)',fontSize:12,whiteSpace:'nowrap' as const},
  tdL:     {padding:'7px 10px',textAlign:'left' as const,borderBottom:'0.5px solid var(--color-border-tertiary)',fontSize:12},
  neg:     {color:'#DC2626'},
  pos:     {color:'#15803D'},
  divider: {border:'none',borderTop:'0.5px solid var(--color-border-tertiary)',margin:'20px 0'} as React.CSSProperties,
  infoBox: {background:'var(--color-background-secondary)',border:'0.5px solid var(--color-border-tertiary)',borderRadius:8,padding:'11px 14px',fontSize:12,color:'var(--color-text-secondary)',lineHeight:1.6} as React.CSSProperties,
  resBadge:{display:'inline-block',padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:500,background:'#FFF7ED',color:'#C2410C',marginLeft:4},
  projBadge:{display:'inline-block',padding:'1px 5px',borderRadius:3,fontSize:9,background:'var(--color-background-secondary)',color:'var(--color-text-secondary)',marginLeft:4},
  aliqPill:(a:number)=>({display:'inline-block',padding:'1px 6px',borderRadius:4,fontSize:10,fontWeight:500,
    background:a===0.225?'#FEF2F2':a===0.2?'#FFF7ED':a===0.175?'#FEFCE8':'#F0FDF4',
    color:a===0.225?'#B91C1C':a===0.2?'#C2410C':a===0.175?'#854D0E':'#15803D'} as React.CSSProperties),
};

export default function CdbProjecaoPage() {
  const [applicationDate, setApplicationDate] = useState('2023-12-27');
  const [maturityDate,    setMaturityDate]     = useState('2028-11-30');
  const [capital,         setCapital]          = useState(31000);
  const [pctCdi,          setPctCdi]           = useState(96);
  const [projRate,        setProjRate]         = useState(0.95);
  const [irrfExempt,      setIrrfExempt]       = useState(false);
  const [historicalRates, setHistoricalRates]  = useState<HistoricalRate[]>([]);
  const [ratesLoading,    setRatesLoading]     = useState(true);
  const [redemptions,     setRedemptions]      = useState<PartialRedemption[]>([]);
  const [redDate,         setRedDate]          = useState('');
  const [redAmount,       setRedAmount]        = useState('');
  const [redTotal,        setRedTotal]         = useState(false);
  const [tab,             setTab]              = useState<'extrato'|'resgates'>('extrato');
  const [showInfo,        setShowInfo]         = useState(false);

  useEffect(() => {
    api.get('/accounting/cdi/monthly')
      .then(r => setHistoricalRates(r.data.map((m: any) => ({
        competence: m.competence,
        rate: m.monthlyRateFactor,
      }))))
      .catch(() => {})
      .finally(() => setRatesLoading(false));
  }, []);

  const projection = useMemo(() => buildProjection({
    capitalInitial:capital, applicationDate, maturityDate,
    indexerRate:pctCdi, irrfExempt, projectedMonthlyRate:projRate,
    partialRedemptions:redemptions, historicalRates,
  }), [capital,applicationDate,maturityDate,pctCdi,irrfExempt,projRate,redemptions,historicalRates]);

  const kpis = useMemo(() => {
    if(!projection.length) return null;
    const last=projection[projection.length-1];
    const resgatesTotal=projection.filter(l=>l.isRedemption).reduce((s,l)=>s+(l.redemptionNet??0),0);
    return {
      saldoFinal:last.netBalance, rendBruto:last.accumulatedYield,
      irrfTotal:last.irrfOnRedemption, retLiquido:last.netBalance-capital+resgatesTotal,
      aliqFinal:last.irrfRate, diasFinal:last.calendarDays,
      resgatesTotal, qtdResgates:projection.filter(l=>l.isRedemption).length,
    };
  }, [projection,capital]);

  const addRedemption = useCallback(() => {
    if(!redDate) return;
    setRedemptions(prev=>[...prev,{id:Math.random().toString(36).slice(2,9),date:redDate,
      amount:redTotal?0:(parseFloat(redAmount)||0),
      label:redTotal?'Total':`R$ ${fmtBRL(parseFloat(redAmount)||0)}`}]);
    setRedDate(''); setRedAmount(''); setRedTotal(false);
  },[redDate,redAmount,redTotal]);

  const sparkline = useMemo(() => {
    if(projection.length<2) return '';
    const vals=projection.map(l=>l.netBalance);
    const min=Math.min(...vals), max=Math.max(...vals), range=max-min||1;
    const W=300,H=60;
    const pts=vals.map((v,i)=>`${(i/(vals.length-1))*W},${H-((v-min)/range)*(H-4)-2}`);
    return `M${pts.join(' L')}`;
  },[projection]);

  return (
    <div style={S.page}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
        <span style={S.badge}>◆ Contábil</span>
        <span style={S.h1}>Renda Fixa — Simulador CDB</span>
        <span style={{fontSize:11,color:'var(--color-text-secondary)',marginLeft:8}}>
          {ratesLoading ? 'Carregando CDI...' : `${historicalRates.length} meses CDI real`}
        </span>
        <button style={{...S.btn,marginLeft:'auto',fontSize:11}} onClick={()=>setShowInfo(v=>!v)}>
          {showInfo?'Ocultar':'Ver'} metodologia
        </button>
      </div>
      {showInfo&&(
        <div style={{...S.infoBox,marginBottom:20}}>
          <strong style={{color:'var(--color-text-primary)'}}>Metodologia — Lucro Real:</strong>{' '}
          Rendimento calculado mensalmente sobre saldo bruto acumulado. IRRF pela tabela regressiva
          sobre o rendimento bruto acumulado: menos ou igual a 180d=22,5% - 181-360d=20% - 361-720d=17,5% - acima=15%.
          Resgates parciais: IRRF proporcional ao rendimento resgatado.
        </div>
      )}
      <div style={{...S.card,marginBottom:20}}>
        <p style={S.secTitle}>Parâmetros</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:12}}>
          <div><label style={S.label}>Data de aplicação</label>
            <input style={S.input} type='date' value={applicationDate} onChange={e=>setApplicationDate(e.target.value)}/></div>
          <div><label style={S.label}>Vencimento</label>
            <input style={S.input} type='date' max='9999-12-31' value={maturityDate} onChange={e=>setMaturityDate(e.target.value)}/></div>
          <div><label style={S.label}>Capital inicial (R$)</label>
            <input style={S.input} type='number' min={0} step={1000} value={capital} onChange={e=>setCapital(parseFloat(e.target.value)||0)}/></div>
          <div><label style={S.label}>% do CDI contratado</label>
            <input style={S.input} type='number' min={50} max={200} step={0.5} value={pctCdi} onChange={e=>setPctCdi(parseFloat(e.target.value)||96)}/></div>
          <div><label style={S.label}>CDI mensal projetado (%)</label>
            <input style={S.input} type='number' min={0} max={5} step={0.01} value={projRate} onChange={e=>setProjRate(parseFloat(e.target.value)||0.95)}/></div>
          <div style={{display:'flex',alignItems:'flex-end',paddingBottom:2}}>
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}>
              <input type='checkbox' checked={irrfExempt} onChange={e=>setIrrfExempt(e.target.checked)}/>
              Isento de IRRF (LCI/LCA)
            </label>
          </div>
        </div>
      </div>
      {kpis&&(
        <div style={S.kpiGrid}>
          <div style={S.kpi}><div style={S.kpiLbl}>Capital inicial</div><div style={S.kpiVal}>R$ {fmtBRL(capital)}</div><div style={S.kpiSub}>Aplicado em {applicationDate.split('-').reverse().join('/')}</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>Rendimento bruto</div><div style={S.kpiVal}>R$ {fmtBRL(kpis.rendBruto)}</div><div style={S.kpiSub}>{((kpis.rendBruto/capital)*100).toFixed(2)}% sobre capital</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>IRRF estimado</div><div style={{...S.kpiVal,...S.neg}}>{irrfExempt?'--':`R$ ${fmtBRL(kpis.irrfTotal)}`}</div><div style={S.kpiSub}>{irrfExempt?'Isento':`${(kpis.aliqFinal*100).toFixed(1)}% (${kpis.diasFinal}d)`}</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>Saldo líquido final</div><div style={S.kpiVal}>R$ {fmtBRL(kpis.saldoFinal)}</div><div style={S.kpiSub}>Vencto {maturityDate.split('-').reverse().join('/')}</div></div>
          <div style={S.kpi}><div style={S.kpiLbl}>Retorno líquido</div><div style={{...S.kpiVal,...S.pos}}>R$ {fmtBRL(kpis.retLiquido)}</div><div style={S.kpiSub}>{((kpis.retLiquido/capital)*100).toFixed(2)}% liquido</div></div>
          {kpis.qtdResgates>0&&<div style={S.kpi}><div style={S.kpiLbl}>Resgates</div><div style={S.kpiVal}>{kpis.qtdResgates}</div><div style={S.kpiSub}>Liq: R$ {fmtBRL(kpis.resgatesTotal)}</div></div>}
        </div>
      )}
      {projection.length>1&&(
        <div style={{...S.card,marginBottom:20}}>
          <p style={{...S.secTitle,marginBottom:4}}>Evolução do saldo líquido</p>
          <svg width='100%' viewBox='0 0 300 64' preserveAspectRatio='none' style={{height:64,display:'block'}}>
            <defs><linearGradient id='sg' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stopColor='#2563EB' stopOpacity='0.15'/><stop offset='100%' stopColor='#2563EB' stopOpacity='0'/></linearGradient></defs>
            <path d={`${sparkline} L300,62 L0,62 Z`} fill='url(#sg)'/>
            <path d={sparkline} stroke='#2563EB' strokeWidth='1.5' fill='none'/>
          </svg>
        </div>
      )}
      <div style={{display:'flex',gap:2,marginBottom:14}}>
        {(['extrato','resgates'] as const).map(t=>(
          <button key={t} style={{...S.btn,background:tab===t?'#111':'var(--color-background-primary)',color:tab===t?'#fff':'var(--color-text-secondary)',borderColor:tab===t?'#111':'var(--color-border-tertiary)'}} onClick={()=>setTab(t)}>
            {t==='extrato'?'Extrato mensal':`Resgates${redemptions.length?` (${redemptions.length})`:''}`}
          </button>
        ))}
      </div>
      {tab==='resgates'&&(
        <div style={{...S.card,marginBottom:20}}>
          <p style={S.secTitle}>Adicionar resgate antecipado</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:14}}>
            <div><label style={S.label}>Data</label><input style={S.input} type='date' max='9999-12-31' value={redDate} onChange={e=>setRedDate(e.target.value)}/></div>
            <div><label style={S.label}>Valor bruto (R$)</label><input style={S.input} type='number' min={0} value={redAmount} disabled={redTotal} onChange={e=>setRedAmount(e.target.value)}/></div>
            <div style={{display:'flex',alignItems:'flex-end',paddingBottom:2}}><label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:13}}><input type='checkbox' checked={redTotal} onChange={e=>setRedTotal(e.target.checked)}/> Total</label></div>
            <div style={{display:'flex',alignItems:'flex-end'}}><button style={S.btnPrimary} onClick={addRedemption}>+ Adicionar</button></div>
          </div>
          {redemptions.length===0
            ?<p style={{fontSize:12,color:'var(--color-text-secondary)',fontStyle:'italic'}}>Nenhum resgate simulado.</p>
            :<div style={S.tblWrap}><table style={{width:'100%',borderCollapse:'collapse',minWidth:400}}><thead><tr><th style={S.thL}>Data</th><th style={S.th}>Valor</th><th style={S.th}>IRRF</th><th style={S.th}>Líquido</th><th style={S.th}></th></tr></thead><tbody>
              {redemptions.map(r=>(
                <tr key={r.id}><td style={S.tdL}>{r.date.split('-').reverse().join('/')}</td><td style={S.td}>{r.amount===0?'Total':`R$ ${fmtBRL(r.amount)}`}</td><td style={{...S.td,...S.neg}}>--</td><td style={{...S.td,...S.pos}}>--</td><td style={S.td}><button style={S.btnDanger} onClick={()=>setRedemptions(p=>p.filter(x=>x.id!==r.id))}>X</button></td></tr>
              ))}
            </tbody></table></div>}
        </div>
      )}
      {tab==='extrato'&&(
        <div style={S.tblWrap}>
          <table style={{width:'100%',borderCollapse:'collapse',minWidth:860}}>
            <thead><tr><th style={S.thL}>Competência</th><th style={S.th}>Dias</th><th style={S.th}>Índice</th><th style={S.th}>Rend. bruto</th><th style={S.th}>Rend. acum.</th><th style={S.th}>Saldo bruto</th><th style={S.th}>Alíq. IRRF</th><th style={S.th}>IRRF</th><th style={S.th}>Saldo líquido</th></tr></thead>
            <tbody>
              {projection.map((l,i)=>{
                const isLast=i===projection.length-1;
                return(<tr key={l.competence} style={{background:isLast?'var(--color-background-secondary)':'transparent'}}>
                  <td style={S.tdL}>{fmtComp(l.competence)}{l.isProjected&&<span style={S.projBadge}>proj</span>}{l.isRedemption&&<span style={S.resBadge}>resgate</span>}</td>
                  <td style={S.td}>{l.calendarDays}</td>
                  <td style={S.td}>{fmtPct(l.indexerRate,6)}</td>
                  <td style={S.td}>R$ {fmtBRL(l.grossYield)}</td>
                  <td style={S.td}>R$ {fmtBRL(l.accumulatedYield)}</td>
                  <td style={S.td}>R$ {fmtBRL(l.grossBalance)}</td>
                  <td style={S.td}>{irrfExempt?<span style={{color:'#15803D',fontSize:10}}>Isento</span>:<span style={S.aliqPill(l.irrfRate)}>{(l.irrfRate*100).toFixed(1)}%</span>}</td>
                  <td style={{...S.td,...S.neg}}>{irrfExempt?'--':`-R$ ${fmtBRL(l.irrfOnRedemption)}`}</td>
                  <td style={{...S.td,fontWeight:isLast?500:400}}>R$ {fmtBRL(l.netBalance)}</td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      )}
      <hr style={S.divider}/>
      <div style={S.infoBox}>
        IRRF tabela regressiva (IN SRF 487/2004): menos ou igual a 180d=22,5% - 181-360d=20% - 361-720d=17,5% - acima=15%.
        Para Lucro Real, IRRF e antecipacao de IRPJ/CSLL.
      </div>
    </div>
  );
}
