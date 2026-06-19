import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
const fmtBRL=(v)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate=(d)=>d?new Date(d).toLocaleDateString('pt-BR'):'—';
const AC='#6C63FF';
export const RaisPage=()=>{
  const [decls,setDecls]=useState([]);
  const [ano,setAno]=useState(new Date().getFullYear()-1);
  const [loading,setLoading]=useState(false);
  const [sel,setSel]=useState(null);
  const th={padding:'8px 12px',fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',background:'#F9FAFB',borderBottom:'0.5px solid #E5E7EB',textAlign:'left'};
  const td={padding:'9px 12px',fontSize:13,color:'#374151',borderBottom:'0.5px solid #F5F5F5'};
  const btn=(c)=>({padding:'6px 14px',borderRadius:6,border:'none',background:c,color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600});
  const load=useCallback(async()=>{setLoading(true);try{const r=await api.get('/hr/rais');setDecls(r.data);}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  const gerar=async()=>{
    setLoading(true);
    try{const r=await api.post('/hr/rais/gerar',{anoBase:ano});setSel(r.data);load();}
    catch(e){Swal.fire('Erro',e?.response?.data?.message||'Falha','error');}
    finally{setLoading(false);}
  };
  const registrar=async(id)=>{
    const {value}=await Swal.fire({title:'Protocolo RAIS',input:'text',inputPlaceholder:'Numero do protocolo',showCancelButton:true});
    if(!value)return;
    await api.patch('/hr/rais/'+id+'/registrar-envio',{protocolo:value});load();
  };
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
        <div><span style={{fontSize:11,fontWeight:600,color:AC}}>◆ RH</span>
          <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>RAIS</h1>
          <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>Relacao Anual de Informacoes Sociais</p></div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input type="number" min={2018} max={2035} value={ano} onChange={e=>setAno(+e.target.value||ano)}
            style={{width:80,border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',fontSize:14,fontWeight:700,textAlign:'center',outline:'none'}}/>
          <button onClick={gerar} disabled={loading} style={btn(AC)}>⟳ Gerar RAIS {ano}</button>
        </div>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {decls.map(d=>(
          <div key={d.id} style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:10,padding:'14px 18px',marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <span style={{fontWeight:700,fontSize:15}}>RAIS {d.anoBase}</span>
              <span style={{marginLeft:10,fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:600,background:d.status==='ENVIADA'?'#F0FDF4':'#EFF6FF',color:d.status==='ENVIADA'?'#15803D':'#1D4ED8'}}>{d.status}</span>
              <div style={{fontSize:12,color:'#6B7280',marginTop:4}}>{d.totalVinculos} vinculo(s) · Massa: {fmtBRL(d.totalMassaSalarial)}{d.dataEnvio?' · Enviada: '+fmtDate(d.dataEnvio):''}{d.protocoloRais?' · Protocolo: '+d.protocoloRais:''}</div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setSel(sel?.id===d.id?null:d)} style={btn('#0369A1')}>Ver Vinculos</button>
              {d.status!=='ENVIADA'&&<button onClick={()=>registrar(d.id)} style={btn('#15803D')}>✓ Registrar Envio</button>}
            </div>
          </div>
        ))}
        {!loading&&decls.length===0&&<div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>Nenhuma RAIS gerada. Selecione o ano e clique em Gerar.</div>}
        {sel?.vinculos&&(
          <div>
            <h3 style={{fontSize:14,fontWeight:700,margin:'0 0 10px'}}>Vinculos RAIS {sel.anoBase} ({sel.vinculos.length})</h3>
            <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:10,overflow:'hidden',border:'0.5px solid #E5E7EB'}}>
              <thead><tr>{['Funcionario','CPF','Admissao','Desligamento','Meses','Sal.Ref','Total Rem.'].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{sel.vinculos.map(v=>(
                <tr key={v.id}>
                  <td style={{...td,fontWeight:500}}>{v.employee?.fullName}</td>
                  <td style={{...td,fontFamily:'monospace'}}>{v.employee?.taxId}</td>
                  <td style={td}>{fmtDate(v.dataAdmissao)}</td>
                  <td style={td}>{fmtDate(v.dataDesligamento)}</td>
                  <td style={{...td,textAlign:'center'}}>{v.mesesTrabalhados}</td>
                  <td style={{...td,fontFamily:'monospace'}}>{fmtBRL(v.salarioMesRef)}</td>
                  <td style={{...td,fontFamily:'monospace',fontWeight:600}}>{fmtBRL(v.totalRemuneracao)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
export default RaisPage;
