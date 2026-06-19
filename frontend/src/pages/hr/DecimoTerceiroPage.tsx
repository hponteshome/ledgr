import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
const fmtBRL=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate=(d)=>d?new Date(d).toLocaleDateString('pt-BR'):'—';
const AC='#6C63FF';
const STATUS_STYLE={CALCULADO:{bg:'#EFF6FF',color:'#1D4ED8'},PRIMEIRA_PAGA:{bg:'#FEF3C7',color:'#92400E'},QUITADO:{bg:'#F0FDF4',color:'#15803D'}};
export const DecimoTerceiroPage=()=>{
  const ano=new Date().getFullYear();
  const [year,setYear]=useState(ano);
  const [dados,setDados]=useState([]);
  const [loading,setLoading]=useState(false);
  const [calc,setCalc]=useState(false);
  const [pgModal,setPgModal]=useState(null);
  const [dtPgto,setDtPgto]=useState('');
  const th={padding:'8px 12px',fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',background:'#F9FAFB',borderBottom:'0.5px solid #E5E7EB',textAlign:'left'};
  const td={padding:'9px 12px',fontSize:13,color:'#374151',borderBottom:'0.5px solid #F5F5F5'};
  const btn=(c,sm)=>({padding:sm?'3px 8px':'7px 16px',borderRadius:6,border:'none',background:c,color:'#fff',cursor:'pointer',fontSize:sm?11:13,fontWeight:600});
  const ov={position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000};
  const load=useCallback(async()=>{
    setLoading(true);
    try{const r=await api.get('/hr/decimo-terceiro',{params:{ano:year}});setDados(r.data);}
    finally{setLoading(false);}
  },[year]);
  useEffect(()=>{load();},[load]);
  const calcular=async()=>{
    const ok=await Swal.fire({title:'Calcular 13 Salario '+year,text:'Recalcula para todos os funcionarios.',icon:'question',showCancelButton:true,confirmButtonText:'Calcular'});
    if(!ok.isConfirmed)return;
    setCalc(true);
    try{const r=await api.post('/hr/decimo-terceiro/calcular',{ano:year});await load();Swal.fire('Calculado!',r.data.total+' funcionario(s) calculados','success');}
    catch(e){Swal.fire('Erro',e?.response?.data?.message||'Falha','error');}
    finally{setCalc(false);}
  };
  const pagar=async()=>{
    if(!pgModal||!dtPgto)return;
    try{const ep=pgModal.parcela===1?'pagar-primeira':'pagar-segunda';await api.patch('/hr/decimo-terceiro/'+pgModal.id+'/'+ep,{dataPgto:dtPgto});setPgModal(null);setDtPgto('');load();}
    catch(e){Swal.fire('Erro',e?.response?.data?.message||'Falha','error');}
  };
  const pdf=(id,p)=>window.open((api.defaults.baseURL||'')+'/hr/decimo-terceiro/'+id+'/recibo/'+p+'/pdf','_blank');
  const totais=dados.reduce((a,d)=>({bruto:a.bruto+Number(d.valorBruto||0),inss:a.inss+Number(d.valorInss||0),irrf:a.irrf+Number(d.valorIrrf||0),liq2:a.liq2+Number(d.segundaParcelaLiquido||0)}),{bruto:0,inss:0,irrf:0,liq2:0});
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
        <div><span style={{fontSize:11,fontWeight:600,color:AC}}>◆ RH</span>
          <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>13° Salário</h1>
          <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>Cálculo, pagamento de parcelas e recibos</p>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input type="number" min={2020} max={2035} value={year} onChange={e=>setYear(+e.target.value||year)}
            style={{width:80,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',fontSize:14,fontWeight:700,textAlign:'center',outline:'none'}}/>
          <button onClick={calcular} disabled={calc} style={btn(AC)}>{calc?'Calculando...':'⟳ Calcular '+year}</button>
        </div>
      </div>
      {dados.length>0&&(
        <div style={{display:'flex',gap:12,padding:'12px 24px',background:'#F9FAFB',borderBottom:'0.5px solid #E5E7EB',flexShrink:0}}>
          {[{l:'Total Bruto',v:fmtBRL(totais.bruto),c:'#111'},{l:'Total INSS',v:fmtBRL(totais.inss),c:'#EF4444'},{l:'Total IRRF',v:fmtBRL(totais.irrf),c:'#F97316'},{l:'2a Parcela Liq.',v:fmtBRL(totais.liq2),c:'#15803D'},{l:'Funcionarios',v:String(dados.length),c:'#6B7280'}].map(t=>(
            <div key={t.l} style={{background:'#fff',borderRadius:8,padding:'8px 16px',border:'0.5px solid #E5E7EB'}}>
              <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600}}>{t.l}</div>
              <div style={{fontSize:16,fontWeight:700,color:t.c,marginTop:2}}>{t.v}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {loading?<div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>Carregando...</div>
        :dados.length===0?<div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}><div style={{fontSize:32}}>🎄</div><div style={{fontWeight:600}}>Nenhum calculo para {year}</div><div style={{fontSize:12}}>Clique em Calcular {year}</div></div>
        :<table style={{width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',border:'0.5px solid #E5E7EB'}}>
          <thead><tr>{['Funcionario','Meses','Salario Base','Bruto','INSS','IRRF','1a Parcela','2a Liquida','Status','Acoes'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{dados.map(d=>{const ss=STATUS_STYLE[d.status]||STATUS_STYLE.CALCULADO;return(
            <tr key={d.id}>
              <td style={{...td,fontWeight:500}}>{d.employee?.fullName}<div style={{fontSize:11,color:'#9CA3AF'}}>{d.employee?.role}</div></td>
              <td style={{...td,textAlign:'center'}}>{d.mesesTrabalhados}/12</td>
              <td style={{...td,fontFamily:'monospace'}}>{fmtBRL(d.salarioBase)}</td>
              <td style={{...td,fontFamily:'monospace',fontWeight:600}}>{fmtBRL(d.valorBruto)}</td>
              <td style={{...td,fontFamily:'monospace',color:'#EF4444'}}>({fmtBRL(d.valorInss)})</td>
              <td style={{...td,fontFamily:'monospace',color:'#F97316'}}>({fmtBRL(d.valorIrrf)})</td>
              <td style={td}><div style={{fontFamily:'monospace'}}>{fmtBRL(d.primeiraParcelaValor)}</div>{d.primeiraParcelaPagoEm&&<div style={{fontSize:10,color:'#15803D'}}>✓ {fmtDate(d.primeiraParcelaPagoEm)}</div>}</td>
              <td style={{...td,fontFamily:'monospace',fontWeight:600,color:'#15803D'}}>{fmtBRL(d.segundaParcelaLiquido)}{d.segundaParcelaPagoEm&&<div style={{fontSize:10}}>✓ {fmtDate(d.segundaParcelaPagoEm)}</div>}</td>
              <td style={td}><span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:600,background:ss.bg,color:ss.color}}>{d.status.replace('_',' ')}</span></td>
              <td style={td}><div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                {d.status==='CALCULADO'&&<button onClick={()=>{setPgModal({id:d.id,parcela:1});setDtPgto('');}} style={btn('#0369A1',true)}>Pagar 1a</button>}
                {d.status==='PRIMEIRA_PAGA'&&<button onClick={()=>{setPgModal({id:d.id,parcela:2});setDtPgto('');}} style={btn('#15803D',true)}>Pagar 2a</button>}
                <button onClick={()=>pdf(d.id,1)} style={btn('#7C3AED',true)}>PDF 1a</button>
                <button onClick={()=>pdf(d.id,2)} style={btn('#7C3AED',true)}>PDF 2a</button>
              </div></td>
            </tr>
          );})}</tbody>
        </table>}
      </div>
      {pgModal&&(<div style={ov}><div style={{background:'#fff',borderRadius:14,width:380,padding:24,boxShadow:'0 20px 60px rgba(0,0,0,.15)'}}>
        <h3 style={{margin:'0 0 16px',fontSize:15,fontWeight:700}}>Registrar Pagamento — {pgModal.parcela}a Parcela</h3>
        <div><label style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',display:'block',marginBottom:4}}>Data *</label>
          <input type="date" value={dtPgto} onChange={e=>setDtPgto(e.target.value)} style={{width:'100%',border:'0.5px solid #E5E7EB',borderRadius:6,padding:'7px 10px',fontSize:13,outline:'none',boxSizing:'border-box'}}/></div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
          <button onClick={()=>setPgModal(null)} style={{padding:'7px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
          <button onClick={pagar} disabled={!dtPgto} style={btn('#15803D')}>Confirmar</button>
        </div>
      </div></div>)}
    </div>
  );
};
export default DecimoTerceiroPage;
