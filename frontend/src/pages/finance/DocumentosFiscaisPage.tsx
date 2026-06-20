import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Swal from 'sweetalert2';

const fmtBRL  = (v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = (s:any)=>s?new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const fmtCNPJ = (v:string)=>v?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')||v;
const AC = '#6C63FF';

const TYPE_BADGE:Record<string,{bg:string,c:string,l:string}>={
  NFSE:{bg:'#EFF6FF',c:'#1D4ED8',l:'NFS-e'},
  NFE: {bg:'#F0FDF4',c:'#15803D',l:'NF-e'},
  FATURA:{bg:'#FEF3C7',c:'#92400E',l:'Fatura'},
  BOLETO:{bg:'#F5F3FF',c:'#7C3AED',l:'Boleto'},
  CONSUMO:{bg:'#FFF7ED',c:'#C2410C',l:'Consumo'},
  OUTROS:{bg:'#F9FAFB',c:'#6B7280',l:'Outros'},
};
const INT_BADGE:Record<string,{bg:string,c:string,l:string}>={
  PENDING:   {bg:'#FEF3C7',c:'#92400E',l:'Pendente'},
  INTEGRATED:{bg:'#F0FDF4',c:'#15803D',l:'Integrado'},
  ERROR:     {bg:'#FEF2F2',c:'#DC2626',l:'Erro'},
  MANUAL:    {bg:'#F5F3FF',c:'#7C3AED',l:'Manual'},
};

export const DocumentosFiscaisPage:React.FC=()=>{
  const nav = useNavigate();
  const [data,    setData]    = useState<any[]>([]);
  const [resumo,  setResumo]  = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search,  setSearch]  = useState('');
  const [tipo,    setTipo]    = useState('');
  const [comp,    setComp]    = useState('');
  const [intSt,   setIntSt]   = useState('');
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const th={padding:'8px 12px',fontSize:11,fontWeight:600 as const,color:'#6B7280',
    textTransform:'uppercase' as const,background:'#F9FAFB',
    borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const};
  const td={padding:'9px 12px',fontSize:12,color:'#374151',
    borderBottom:'0.5px solid #F5F5F5',verticalAlign:'top' as const};

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const params:any={page,limit:50};
      if(tipo) params.tipo=tipo;
      if(comp) params.competencia=comp;
      if(intSt) params.status=intSt;
      if(search) params.search=search;
      const [r,res]=await Promise.all([
        api.get('/fiscal/documentos',{params}),
        api.get('/fiscal/documentos/resumo',{params:comp?{competencia:comp}:{}}),
      ]);
      setData(r.data.data??[]); setTotal(r.data.total??0);
      setResumo(res.data);
    }finally{setLoading(false);}
  },[page,tipo,comp,intSt,search]);

  useEffect(()=>{load();},[load]);

  const integrar=async(id:string)=>{
    try{
      await api.post(`/finance/fiscal-documents/${id}/integrate`);
      load(); Swal.fire('Integrado!','AP + Agenda gerados.','success');
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||'Falha','error');}
  };

  const agora = new Date();
  const compAtual = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',
        flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'flex-end',flexWrap:'wrap',gap:10}}>
        <div>
          <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ FISCAL</span>
          <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>Documentos Fiscais</h1>
          <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>Central de NFS-e, NF-e e demais documentos fiscais</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>nav('/app/finance/nfse-sp')}
            style={{padding:'7px 14px',borderRadius:8,border:'none',background:'#1D4ED8',
              color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>⬆ NFS-e SP</button>
          <button onClick={()=>nav('/app/finance/nfe')}
            style={{padding:'7px 14px',borderRadius:8,border:'none',background:'#15803D',
              color:'#fff',cursor:'pointer',fontSize:12,fontWeight:600}}>⬆ NF-e</button>
        </div>
      </div>

      {/* KPI Cards */}
      {resumo&&(
        <div style={{display:'flex',gap:10,padding:'12px 24px',background:'#F9FAFB',
          borderBottom:'0.5px solid #E5E7EB',flexShrink:0,flexWrap:'wrap'}}>
          {[
            {l:'Total Documentos',v:String(total||0),c:'#374151'},
            {l:'Valor Total (líq.)',v:fmtBRL(resumo.totalNfs),c:'#1D4ED8'},
            {l:'ISS Total',v:fmtBRL(resumo.totalIss),c:'#F97316'},
            {l:'PIS+COFINS',v:fmtBRL((resumo.totalPis||0)+(resumo.totalCofins||0)),c:'#7C3AED'},
            {l:'Pendentes integração',v:String(resumo.pending||0),c:'#92400E'},
            {l:'Integrados',v:String(resumo.integrated||0),c:'#15803D'},
          ].map(t=>(
            <div key={t.l} style={{background:'#fff',borderRadius:8,padding:'8px 14px',
              border:'0.5px solid #E5E7EB',minWidth:140}}>
              <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600}}>{t.l}</div>
              <div style={{fontSize:15,fontWeight:700,color:t.c,marginTop:2}}>{t.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{display:'flex',gap:8,padding:'10px 24px',background:'#fff',
        borderBottom:'0.5px solid #E5E7EB',flexShrink:0,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
          placeholder="Buscar por emitente, número..."
          style={{border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',
            fontSize:12,outline:'none',minWidth:200}}/>
        <select value={tipo} onChange={e=>{setTipo(e.target.value);setPage(1);}}
          style={{border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none'}}>
          <option value="">Todos os tipos</option>
          <option value="NFSE">NFS-e</option>
          <option value="NFE">NF-e</option>
          <option value="FATURA">Fatura</option>
          <option value="BOLETO">Boleto</option>
          <option value="CONSUMO">Consumo</option>
        </select>
        <input type="month" value={comp} onChange={e=>{setComp(e.target.value);setPage(1);}}
          style={{border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none'}}/>
        <select value={intSt} onChange={e=>{setIntSt(e.target.value);setPage(1);}}
          style={{border:'0.5px solid #E5E7EB',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none'}}>
          <option value="">Todos os status</option>
          <option value="PENDING">Pendentes</option>
          <option value="INTEGRATED">Integrados</option>
          <option value="ERROR">Com erro</option>
        </select>
        <button onClick={load} style={{padding:'6px 12px',borderRadius:6,border:'0.5px solid #E5E7EB',
          background:'#fff',cursor:'pointer',fontSize:12}}>↻ Atualizar</button>
      </div>

      {/* Tabela */}
      <div style={{flex:1,overflow:'auto',padding:'0 24px 16px'}}>
        {loading&&<div style={{textAlign:'center',padding:40,color:'#9CA3AF'}}>Carregando...</div>}
        {!loading&&data.length===0&&(
          <div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>
            <div style={{fontSize:32,marginBottom:8}}>🧾</div>
            <div style={{fontWeight:600}}>Nenhum documento fiscal encontrado</div>
            <div style={{fontSize:12,marginTop:4}}>Importe NFS-e ou NF-e para começar</div>
          </div>
        )}
        {!loading&&data.length>0&&(
          <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',
            borderRadius:12,overflow:'hidden',border:'0.5px solid #E5E7EB',marginTop:12}}>
            <thead><tr>
              {['Tipo','Número','Emissão','Emitente','Valor Bruto','ISS','Líquido','Status',''].map(h=>(
                <th key={h} style={th}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{data.map((d:any)=>{
              const tb=TYPE_BADGE[d.documentType]??TYPE_BADGE.OUTROS;
              const ib=INT_BADGE[d.integrationStatus]??INT_BADGE.PENDING;
              return(
                <tr key={d.id}>
                  <td style={td}>
                    <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,
                      fontWeight:700,background:tb.bg,color:tb.c}}>{tb.l}</span>
                  </td>
                  <td style={{...td,fontFamily:'monospace',fontWeight:600}}>{d.documentNumber||'—'}</td>
                  <td style={td}>{fmtDate(d.issueDate)}<br/>
                    <span style={{fontSize:10,color:'#9CA3AF'}}>{d.competenceMonth}</span>
                  </td>
                  <td style={td}>
                    <div style={{fontSize:12,fontWeight:500,maxWidth:200,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {d.issuerName||'—'}
                    </div>
                    <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>
                      {fmtCNPJ(d.issuerCnpj||'')}
                    </div>
                  </td>
                  <td style={{...td,fontFamily:'monospace',textAlign:'right' as const}}>
                    {fmtBRL(d.grossAmount)}
                  </td>
                  <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,
                    color:Number(d.issAmount)>0?'#F97316':'#9CA3AF'}}>
                    {fmtBRL(d.issAmount)}
                  </td>
                  <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,
                    fontWeight:600,color:'#15803D'}}>
                    {fmtBRL(d.netAmount)}
                  </td>
                  <td style={td}>
                    <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,
                      fontWeight:600,background:ib.bg,color:ib.c}}>{ib.l}</span>
                  </td>
                  <td style={td}>
                    {d.integrationStatus==='PENDING'&&(
                      <button onClick={()=>integrar(d.id)}
                        style={{padding:'3px 10px',borderRadius:6,border:'none',
                          background:'#6C63FF',color:'#fff',cursor:'pointer',
                          fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
                        ⚡ Integrar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        {/* Paginacao */}
        {total>50&&(
          <div style={{display:'flex',justifyContent:'center',gap:8,marginTop:12}}>
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
              style={{padding:'5px 12px',borderRadius:6,border:'0.5px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:12}}>← Ant</button>
            <span style={{fontSize:12,color:'#6B7280',padding:'5px 10px'}}>
              Pág {page} · {total} docs
            </span>
            <button onClick={()=>setPage(p=>p+1)} disabled={page*50>=total}
              style={{padding:'5px 12px',borderRadius:6,border:'0.5px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:12}}>Prox →</button>
          </div>
        )}
      </div>
    </div>
  );
};
export default DocumentosFiscaisPage;
