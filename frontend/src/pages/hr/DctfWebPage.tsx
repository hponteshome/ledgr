import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { SmartMonthInput } from '../../components/SmartMonthInput';
const fmtBRL=(v: any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const AC='#6C63FF';
export const DctfWebPage=()=>{
  const now=new Date();
  const [comp,setComp]=useState(now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0'));
  const [data,setData]=useState<any>(null);
  const [comps,setComps]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const loadComps=useCallback(async()=>{const r=await api.get('/hr/dctfweb/competencias').catch(()=>({data:[]}));setComps(r.data||[]);},[]);
  const consolidar=useCallback(async()=>{if(!comp)return;setLoading(true);try{const r=await api.get('/hr/dctfweb/'+comp);setData(r.data);}finally{setLoading(false);}},[comp]);
  useEffect(()=>{loadComps();},[loadComps]);
  useEffect(()=>{consolidar();},[consolidar]);
  const Card=({label,value,color,sub}: any)=>(
    <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:10,padding:'14px 18px',flex:1,minWidth:160}}>
      <div style={{fontSize:11,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600}}>{label}</div>
      <div style={{fontSize:18,fontWeight:700,color:color||'#111',marginTop:4}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>{sub}</div>}
    </div>
  );
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
        <div><span style={{fontSize:11,fontWeight:600,color:AC}}>◆ RH / FISCAL</span>
          <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>DCTFWeb</h1>
          <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>Consolidacao mensal INSS + IRRF para declaracao ao Fisco</p></div>
        <SmartMonthInput value={comp} onChange={v=>setComp(v)}
          style={{border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',fontSize:13}}/>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'20px 24px'}}>
        {loading&&<div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>Carregando...</div>}
        {!loading&&data&&(<>
          <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
            <Card label="Competencia" value={data.competencia} color={AC}/>
            <Card label="Funcionarios" value={String(data.numFuncionarios)} color="#374151"/>
            <Card label="Status Folha" value={data.folhaStatus} color={data.folhaStatus==='FECHADA'?'#15803D':'#F97316'}/>
            <Card label="Total DARF" value={fmtBRL(data.totalDarf)} color="#DC2626" sub="INSS + IRRF"/>
          </div>
          <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:'18px 20px',marginBottom:16}}>
            <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700}}>Contribuicao Previdenciaria (CP)</h3>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <tbody>
                {[['Base de Calculo',data.cp.baseCalculo],['INSS Empregado',data.cp.inssEmpregado],['INSS Empregador (20%)',data.cp.inssEmpregador],['RAT Ajustado',data.cp.rat],['Terceiros (Sistema S)',data.cp.terceiros],['Pro-labore (CI)',data.cp.proLabore]].map(([l,v])=>(
                  <tr key={l} style={{borderBottom:'0.5px solid #F5F5F5'}}>
                    <td style={{padding:'7px 0',fontSize:13,width:'60%'}}>{l}</td>
                    <td style={{padding:'7px 0',fontSize:13,fontFamily:'monospace',textAlign:'right'}}>{fmtBRL(v)}</td>
                  </tr>
                ))}
                <tr style={{background:'#EFF6FF',fontWeight:700}}>
                  <td style={{padding:'10px 8px',fontSize:14,color:'#1D4ED8'}}>TOTAL CP</td>
                  <td style={{padding:'10px 8px',fontSize:14,fontFamily:'monospace',textAlign:'right',color:'#1D4ED8'}}>{fmtBRL(data.cp.totalCP)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:'18px 20px',marginBottom:16}}>
            <h3 style={{margin:'0 0 14px',fontSize:14,fontWeight:700}}>IRRF Retido na Fonte</h3>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <tbody>
                <tr style={{borderBottom:'0.5px solid #F5F5F5'}}>
                  <td style={{padding:'7px 0',fontSize:13,width:'60%'}}>Base de Calculo</td>
                  <td style={{padding:'7px 0',fontSize:13,fontFamily:'monospace',textAlign:'right'}}>{fmtBRL(data.irrf.baseCalculo)}</td>
                </tr>
                <tr style={{background:'#FEF3C7',fontWeight:700}}>
                  <td style={{padding:'10px 8px',fontSize:14,color:'#92400E'}}>IRRF a recolher</td>
                  <td style={{padding:'10px 8px',fontSize:14,fontFamily:'monospace',textAlign:'right',color:'#92400E'}}>{fmtBRL(data.irrf.totalIRRF)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{background:'#F0FDF4',border:'0.5px solid #86EFAC',borderRadius:10,padding:'12px 16px',fontSize:12,color:'#15803D',marginBottom:16}}>
            FGTS: {fmtBRL(data.fgts.totalFGTS)} — {data.fgts.obs}
          </div>
          <div style={{background:'#DC2626',borderRadius:12,padding:'18px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{color:'rgba(255,255,255,0.8)',fontSize:12,fontWeight:600}}>TOTAL DARF — {data.competencia}</div>
              <div style={{color:'#fff',fontSize:11,marginTop:2}}>CP {fmtBRL(data.cp.totalCP)} + IRRF {fmtBRL(data.irrf.totalIRRF)}</div>
            </div>
            <div style={{color:'#fff',fontSize:26,fontWeight:800}}>{fmtBRL(data.totalDarf)}</div>
          </div>
          <p style={{fontSize:11,color:'#9CA3AF',marginTop:12}}>Consolidacao informativa gerada da folha de pagamento. Declaracao oficial via portal DCTFWeb da RFB apos S-1299 no eSocial.</p>
        </>)}
        {!loading&&!data&&<div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>Selecione uma competencia com folha calculada</div>}
      </div>
    </div>
  );
};
export default DctfWebPage;
