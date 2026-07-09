import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
const fmtDate=(d: any)=>d?new Date(d).toLocaleString('pt-BR'):'—';
const FLAGS: Record<string, {label:string;bg:string;color:string}> = {
  OK:{label:'✓ Dados OK',bg:'#F0FDF4',color:'#15803D'},
  CPF_NAO_ENCONTRADO:{label:'⚠ CPF não encontrado na base',bg:'#FEF3C7',color:'#92400E'},
  DIVERGENCIA_NOME:{label:'⚠ Divergência de nome',bg:'#FEF2F2',color:'#DC2626'},
};
const AC='#6C63FF';
export const PendentesPage=()=>{
  const [users,setUsers]=useState<any[]>([]);
  const [profiles,setProfiles]=useState<any[]>([]);
  const [companies,setCompanies]=useState<any[]>([]);
  const [sel,setSel]=useState<any>(null);
  const [form,setForm]=useState<{profileId:string;level:string;companyIds:string[]}>({profileId:'',level:'1',companyIds:[]});
  const [loading,setLoading]=useState(false);
  const inp={width:'100%',border:'1px solid #E5E7EB',borderRadius:6,padding:'7px 10px',fontSize:13,outline:'none',boxSizing:'border-box'} as React.CSSProperties;
  const lbl={fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',display:'block',marginBottom:4};
  const ov={position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000} as React.CSSProperties;
  const load=useCallback(async()=>{
    setLoading(true);
    try{const [u,p,c]=await Promise.all([api.get('/users/pendentes'),api.get('/profiles'),api.get('/companies')]);
      setUsers(u.data);setProfiles(p.data);setCompanies(c.data);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);
  const aprovar=async()=>{
    if(!sel||!form.profileId||!form.companyIds.length){Swal.fire('Atenção','Selecione perfil e ao menos uma empresa.','warning');return;}
    try{await api.post('/users/'+sel.id+'/aprovar',{profileId:form.profileId,level:parseInt(form.level),companyIds:form.companyIds});
      setSel(null);load();Swal.fire('Aprovado!','Usuário ativado com sucesso.','success');}
    catch(e: any){Swal.fire('Erro',e?.response?.data?.message||'Falha','error');}
  };
  const rejeitar=async()=>{
    const{value}=await Swal.fire({title:'Motivo da rejeição',input:'text',inputPlaceholder:'Opcional',showCancelButton:true,confirmButtonColor:'#DC2626',confirmButtonText:'Rejeitar'});
    if(value===undefined)return;
    try{await api.post('/users/'+sel.id+'/rejeitar',{motivo:value||'Sem motivo'});
      setSel(null);load();Swal.fire('Rejeitado','Cadastro rejeitado.','info');}
    catch(e: any){Swal.fire('Erro',e?.response?.data?.message||'Falha','error');}
  };
  const toggle=(id: any)=>setForm(f=>({...f,companyIds:f.companyIds.includes(id)?f.companyIds.filter(x=>x!==id):[...f.companyIds,id]}));
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ USUÁRIOS</span>
        <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>
          Cadastros Pendentes
          {users.length>0&&<span style={{marginLeft:10,fontSize:13,padding:'2px 10px',borderRadius:20,background:'#FEF3C7',color:'#92400E',fontWeight:700}}>{users.length} pendente{users.length>1?'s':''}</span>}
        </h1>
        <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>Aprove ou rejeite solicitações de acesso</p>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {loading&&<div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>Carregando...</div>}
        {!loading&&users.length===0&&<div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}><div style={{fontSize:32}}>✅</div><div style={{fontWeight:600,marginTop:8}}>Nenhum cadastro pendente</div></div>}
        {users.map(u=>{
          const f=FLAGS[u.pendingFlags||'OK'];
          return(
            <div key={u.id} style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,padding:'16px 20px',marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                  <span style={{fontWeight:700,fontSize:15}}>{u.fullName}</span>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,fontWeight:600,background:f.bg,color:f.color}}>{f.label}</span>
                </div>
                <div style={{fontSize:12,color:'#6B7280',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 20px'}}>
                  <span>📧 {u.email}</span><span>📋 {u.document}</span>
                  <span>📞 {u.phone1||'—'}</span><span>🕐 {fmtDate(u.requestedAt)}</span>
                </div>
                {u.person&&u.pendingFlags==='DIVERGENCIA_NOME'&&(
                  <div style={{marginTop:8,padding:'8px 12px',background:'#FEF2F2',borderRadius:6,fontSize:12}}>
                    <b>Informado:</b> {u.fullName}<br/><b>Na base (Person):</b> {u.person.fullName}
                  </div>
                )}
              </div>
              <button onClick={()=>{setSel(u);setForm({profileId:'',level:'1',companyIds:[]});}}
                style={{padding:'7px 16px',borderRadius:8,border:'none',background:AC,color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,marginLeft:16,flexShrink:0}}>
                Analisar
              </button>
            </div>
          );
        })}
      </div>
      {sel&&(<div style={ov}><div style={{background:'#fff',borderRadius:16,width:560,padding:28,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,.2)'}}>
        <h3 style={{margin:'0 0 4px',fontSize:16,fontWeight:700}}>Analisar Cadastro</h3>
        <p style={{fontSize:13,color:'#6B7280',margin:'0 0 20px'}}>{sel.fullName} — {sel.email}</p>
        <div style={{display:'grid',gap:14}}>
          <div><label style={lbl}>Perfil de Acesso *</label>
            <select value={form.profileId} onChange={e=>setForm(f=>({...f,profileId:e.target.value}))} style={inp}>
              <option value="">Selecione...</option>
              {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          <div><label style={lbl}>Nível</label>
            <select value={form.level} onChange={e=>setForm(f=>({...f,level:e.target.value}))} style={inp}>
              <option value="1">1 — Básico</option><option value="2">2 — Intermediário</option>
              <option value="3">3 — Avançado</option><option value="99">99 — Master</option>
            </select></div>
          <div><label style={lbl}>Empresas *</label>
            <div style={{maxHeight:160,overflowY:'auto',border:'1px solid #E5E7EB',borderRadius:6,padding:'4px 0'}}>
              {companies.map(c=>(
                <label key={c.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',cursor:'pointer',fontSize:13,borderBottom:'0.5px solid #F5F5F5'}}>
                  <input type="checkbox" checked={form.companyIds.includes(c.id)} onChange={()=>toggle(c.id)}/>
                  {c.name||c.tradeName||c.legalName}
                  <span style={{fontSize:11,color:'#9CA3AF'}}>{c.taxId}</span>
                </label>
              ))}
            </div></div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:24}}>
          <button onClick={rejeitar} style={{padding:'9px 20px',borderRadius:8,border:'1px solid #FCA5A5',background:'#FEF2F2',color:'#DC2626',cursor:'pointer',fontSize:13,fontWeight:600}}>✕ Rejeitar</button>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setSel(null)} style={{padding:'9px 20px',borderRadius:8,border:'1px solid #E5E7EB',background:'#fff',cursor:'pointer',fontSize:13}}>Cancelar</button>
            <button onClick={aprovar} disabled={!form.profileId||!form.companyIds.length}
              style={{padding:'9px 20px',borderRadius:8,border:'none',background:'#15803D',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>✓ Aprovar e Ativar</button>
          </div>
        </div>
      </div></div>)}
    </div>
  );
};
export default PendentesPage;
