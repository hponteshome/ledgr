import React, { useState, useRef, useCallback, useEffect } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
const fmtBRL=(v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtCNPJ=(v:string)=>v?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')||v;
const fmtDate=(s:string)=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const AC='#6C63FF';
const MODE_STYLE:Record<string,{bg:string,color:string,label:string}>={
  PRESTADOR:    {bg:'#EFF6FF',color:'#1D4ED8',label:'Prestador (emitida)'},
  TOMADOR:      {bg:'#F0FDF4',color:'#15803D',label:'Tomador (recebida)'},
  DESCONHECIDO: {bg:'#F9FAFB',color:'#6B7280',label:'Desconhecido'},
};
export const NfseImportPage:React.FC=()=>{
  const [files,    setFiles]   =useState<File[]>([]);
  const [preview,  setPreview] =useState<any>(null);
  const [loading,  setLoading] =useState(false);
  const [imported, setImported]=useState<any>(null);
  const [dragOver, setDragOver]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  // Busca repositorio SP
  const [agentOnline,  setAgentOnline]  = useState<boolean|null>(null);
  const [certsA3,      setCertsA3]      = useState<any[]>([]);
  const [certs,    setCerts]   =useState<any[]>([]);

  const [buscaForm,setBuscaForm]=useState({certId:'',dtInicio:'',dtFim:'',paginas:'5',hom:false});
  const [buscando, setBuscando]=useState(false);
  const [buscaRes, setBuscaRes]=useState<any>(null);
  const setBF=(k:string,v:any)=>setBuscaForm(f=>({...f,[k]:v}));
  useEffect(()=>{
    // Detecta LEDGR Agent (A3)
    fetch('http://localhost:7778/health',{signal:AbortSignal.timeout(1500)})
      .then(r=>r.json()).then(()=>{
        setAgentOnline(true);
        fetch('http://localhost:7778/certificates').then(r=>r.json()).then(setCertsA3).catch(()=>{});
      }).catch(()=>setAgentOnline(false));
    api.get('/certificates').then((r:any)=>setCerts((r.data||[]).filter((c:any)=>c.isActive))).catch(()=>{});
  },[]);
  const [buscaEForm,setBuscaEForm]=useState({certId:'',dtInicio:'',dtFim:'',paginas:'5',hom:false});
  const [buscandoE, setBuscandoE]=useState(false);
  const [buscaERes, setBuscaERes]=useState<any>(null);
  const setBEF=(k:string,v:any)=>setBuscaEForm(f=>({...f,[k]:v}));

  const buscarEmitidas=async()=>{
    if(!buscaEForm.certId){Swal.fire('Atenção','Selecione um certificado.','warning');return;}
    setBuscandoE(true);setBuscaERes(null);
    try{
      const r=await api.post('/fiscal/nfse-sp/buscar-emitidas',{
        certId:buscaEForm.certId,dtInicio:buscaEForm.dtInicio||undefined,
        dtFim:buscaEForm.dtFim||undefined,paginas:parseInt(buscaEForm.paginas)||5,
        homologacao:buscaEForm.hom,
      });
      setBuscaERes(r.data);
      if(r.data.importadas>0) Swal.fire('Concluído!',`${r.data.importadas} nota(s) emitidas importadas.`,'success');
      else if(r.data.totalEncontradas===0) Swal.fire('Sem resultados','Nenhuma NFS-e emitida no período.','info');
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||e.message,'error');}
    finally{setBuscandoE(false);}
  };

  const buscarSP=async()=>{
    if(!buscaForm.certId){Swal.fire('Atenção','Selecione um certificado.','warning');return;}
    setBuscando(true);setBuscaRes(null);
    try{
      const r=await api.post('/fiscal/nfse-sp/buscar-tomador',{
        certId:buscaForm.certId,
        dtInicio:buscaForm.dtInicio||undefined,
        dtFim:buscaForm.dtFim||undefined,
        paginas:parseInt(buscaForm.paginas)||5,
        homologacao:buscaForm.hom,
      });
      setBuscaRes(r.data);
      if(r.data.importadas>0) Swal.fire('Concluído!',`${r.data.importadas} nota(s) importada(s).`,'success');
      else if(r.data.totalEncontradas===0) Swal.fire('Sem resultados','Nenhuma NFS-e no período.','info');
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||e.message,'error');}
    finally{setBuscando(false);}
  };
  const th={padding:'8px 12px',fontSize:11,fontWeight:600 as const,color:'#6B7280',
    textTransform:'uppercase' as const,background:'#F9FAFB',
    borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const};
  const td={padding:'8px 12px',fontSize:12,color:'#374151',
    borderBottom:'0.5px solid #F5F5F5',verticalAlign:'top' as const};
  const handleFiles=useCallback((fl:FileList|null)=>{
    if(!fl)return;
    const xmls=Array.from(fl).filter(f=>f.name.toLowerCase().endsWith('.xml'));
    if(!xmls.length){Swal.fire('Atenção','Selecione arquivos XML de NFS-e.','warning');return;}
    setFiles(xmls);setPreview(null);setImported(null);
  },[]);
  const doPreview=async()=>{
    setLoading(true);
    try{
      const fd=new FormData();files.forEach(f=>fd.append('files',f));
      const r=await api.post('/fiscal/nfse-sp/preview',fd,{headers:{'Content-Type':'multipart/form-data'}});
      setPreview(r.data);
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||e.message,'error');}
    finally{setLoading(false);}
  };
  const doImport=async()=>{
    const ok=await Swal.fire({title:`Importar ${preview.total} NFS-e?`,icon:'question',
      showCancelButton:true,confirmButtonText:'Importar',confirmButtonColor:AC});
    if(!ok.isConfirmed)return;
    setLoading(true);
    try{
      const fd=new FormData();files.forEach(f=>fd.append('files',f));
      const r=await api.post('/fiscal/nfse-sp/import',fd,{headers:{'Content-Type':'multipart/form-data'}});
      setImported(r.data);
      Swal.fire('Importado!',`${r.data.created} nota(s) importada(s).`,'success');
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||e.message,'error');}
    finally{setLoading(false);}
  };
  const totalServicos=preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorServicos||0),0)||0;
  const totalIss     =preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorIss||0),0)||0;
  const totalLiquido =preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorLiquido||0),0)||0;
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>

      {/* ── Busca Repositório SP ──────────────────────────────────────────── */}
      <div style={{background:'#EFF6FF',borderBottom:'0.5px solid #BFDBFE',
        padding:'12px 24px',flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{fontWeight:700,fontSize:13,color:'#1D4ED8'}}>🏛️ Buscar Notas do Repositório — Prefeitura de São Paulo</div>
          <div style={{fontSize:11,padding:'3px 10px',borderRadius:20,fontWeight:600,
            background:agentOnline===true?'#F0FDF4':agentOnline===false?'#FEF2F2':'#F9FAFB',
            color:agentOnline===true?'#15803D':agentOnline===false?'#DC2626':'#9CA3AF',
            border:'0.5px solid '+(agentOnline===true?'#86EFAC':agentOnline===false?'#FCA5A5':'#E5E7EB')}}>
            {agentOnline===true?'✓ LEDGR Agent online — A3 disponível':agentOnline===false?'✗ LEDGR Agent offline — apenas A1':'Verificando agent...'}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,alignItems:'end'}}>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:'#1D4ED8',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Certificado A1 *</label>
            <select value={buscaForm.certId} onChange={e=>setBF('certId',e.target.value)}
              style={{width:'100%',border:'0.5px solid #93C5FD',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}>
              <option value="">Selecione...</option>
              {certs.map((c:any)=>(<option key={c.id} value={c.id}>{c.alias}</option>))}
            </select>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:'#1D4ED8',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Data Início</label>
            <input type="date" value={buscaForm.dtInicio} onChange={e=>setBF('dtInicio',e.target.value)}
              style={{width:'100%',border:'0.5px solid #93C5FD',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}/>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:'#1D4ED8',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Data Fim</label>
            <input type="date" value={buscaForm.dtFim} onChange={e=>setBF('dtFim',e.target.value)}
              style={{width:'100%',border:'0.5px solid #93C5FD',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}/>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:'#1D4ED8',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Págs</label>
            <input type="number" min={1} max={20} value={buscaForm.paginas}
              onChange={e=>setBF('paginas',e.target.value)}
              style={{width:'100%',border:'0.5px solid #93C5FD',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff',textAlign:'center'}}/>
          </div>
          <button onClick={buscarSP} disabled={buscando||!buscaForm.certId}
            style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#1D4ED8',
              color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,
              whiteSpace:'nowrap' as const,opacity:buscando||!buscaForm.certId?0.6:1}}>
            {buscando?'Buscando...':'⬇ Buscar Notas'}
          </button>
        </div>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',color:'#6B7280',marginTop:6}}>
          <input type="checkbox" checked={buscaForm.hom} onChange={e=>setBF('hom',e.target.checked)}/>
          Homologação (testes)
        </label>
        {buscaRes&&(
          <div style={{display:'flex',gap:10,marginTop:8,flexWrap:'wrap'}}>
            {[{l:'Encontradas',v:buscaRes.totalEncontradas,c:'#1D4ED8'},{l:'Importadas',v:buscaRes.importadas,c:'#15803D'},{l:'Duplicatas',v:buscaRes.duplicatas,c:'#9CA3AF'},{l:'Erros',v:buscaRes.erros?.length||0,c:'#DC2626'}].map(t=>(
              <div key={t.l} style={{background:'#fff',borderRadius:6,padding:'4px 12px',border:'0.5px solid #BFDBFE',display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontSize:10,color:'#6B7280',textTransform:'uppercase' as const,fontWeight:600}}>{t.l}</span>
                <span style={{fontSize:15,fontWeight:700,color:t.c}}>{t.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Busca Emitidas SP ───────────────────────────────────────────── */}
      <div style={{background:'#F0FDF4',borderBottom:'0.5px solid #86EFAC',padding:'12px 24px',flexShrink:0}}>
        <div style={{fontWeight:700,fontSize:13,color:'#15803D',marginBottom:8}}>🏛️ Buscar NFS-e Emitidas — Prefeitura de São Paulo</div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,alignItems:'end'}}>
          <div><label style={{fontSize:10,fontWeight:600,color:'#15803D',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Certificado A1 *</label>
            <select value={buscaEForm.certId} onChange={e=>setBEF('certId',e.target.value)}
              style={{width:'100%',border:'0.5px solid #86EFAC',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}>
              <option value=''>Selecione...</option>
              {certs.length>0&&<optgroup label='Certificados A1 (servidor)'>{certs.map((c:any)=>(<option key={c.id} value={'a1:'+c.id}>{c.alias}</option>))}</optgroup>}
              {certsA3.length>0&&<optgroup label='Certificados A3 (token local — via LEDGR Agent)'>{certsA3.map((c:any)=>(<option key={c.thumbprint} value={'a3:'+c.thumbprint}>{c.alias} [{c.keyType}] {c.cnpj||c.cpf||''}</option>))}</optgroup>}
            </select></div>
          <div><label style={{fontSize:10,fontWeight:600,color:'#15803D',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Data Início</label>
            <input type='date' value={buscaEForm.dtInicio} onChange={e=>setBEF('dtInicio',e.target.value)}
              style={{width:'100%',border:'0.5px solid #86EFAC',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:'#15803D',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Data Fim</label>
            <input type='date' value={buscaEForm.dtFim} onChange={e=>setBEF('dtFim',e.target.value)}
              style={{width:'100%',border:'0.5px solid #86EFAC',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}/></div>
          <div><label style={{fontSize:10,fontWeight:600,color:'#15803D',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Págs</label>
            <input type='number' min={1} max={20} value={buscaEForm.paginas} onChange={e=>setBEF('paginas',e.target.value)}
              style={{width:'100%',border:'0.5px solid #86EFAC',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff',textAlign:'center'}}/></div>
          <button onClick={buscarEmitidas} disabled={buscandoE||!buscaEForm.certId}
            style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#15803D',
              color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,whiteSpace:'nowrap' as const,
              opacity:buscandoE||!buscaEForm.certId?0.6:1}}>
            {buscandoE?'Buscando...':'⬆ Buscar Emitidas'}
          </button>
        </div>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',color:'#6B7280',marginTop:6}}>
          <input type='checkbox' checked={buscaEForm.hom} onChange={e=>setBEF('hom',e.target.checked)}/>
          Homologação (testes)
        </label>
        {buscaERes&&(
          <div style={{display:'flex',gap:10,marginTop:8,flexWrap:'wrap'}}>
            {[{l:'Encontradas',v:buscaERes.totalEncontradas,c:'#15803D'},{l:'Importadas',v:buscaERes.importadas,c:'#059669'},{l:'Duplicatas',v:buscaERes.duplicatas,c:'#9CA3AF'},{l:'Erros',v:buscaERes.erros?.length||0,c:'#DC2626'}].map(t=>(
              <div key={t.l} style={{background:'#fff',borderRadius:6,padding:'4px 12px',border:'0.5px solid #86EFAC',display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontSize:10,color:'#6B7280',textTransform:'uppercase' as const,fontWeight:600}}>{t.l}</span>
                <span style={{fontSize:15,fontWeight:700,color:t.c}}>{t.v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:'#6C63FF'}}>◆ FISCAL</span>
        <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>Importação NFS-e São Paulo</h1>
        <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>
          Importa notas como Prestador (emitidas) e Tomador (recebidas) — formato ABRASF 2.0
        </p>
      </div>

      <div style={{flex:1,overflow:'auto',padding:'20px 24px'}}>
        {/* Drop zone */}
        <div onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files);}}
          onClick={()=>inputRef.current?.click()}
          style={{border:`2px dashed ${dragOver?AC:'#D1D5DB'}`,borderRadius:12,
            padding:'32px',textAlign:'center',cursor:'pointer',
            background:dragOver?'#F5F3FF':'#FAFAFA',marginBottom:16}}>
          <input ref={inputRef} type="file" accept=".xml" multiple style={{display:'none'}}
            onChange={e=>handleFiles(e.target.files)}/>
          <div style={{fontSize:32,marginBottom:8}}>📂</div>
          <div style={{fontWeight:600,color:'#374151',fontSize:14}}>
            {files.length>0?`${files.length} arquivo(s) selecionado(s)`
              :'Arraste os XMLs aqui ou clique para selecionar'}
          </div>
          <div style={{fontSize:12,color:'#9CA3AF',marginTop:4}}>
            Arquivos XML de NFS-e SP (múltiplos permitidos)
          </div>
        </div>
        {files.length>0&&(
          <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:10,
            padding:'12px 16px',marginBottom:16}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
              {files.map((f,i)=>(
                <span key={i} style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                  background:'#EFF6FF',color:'#1D4ED8',border:'0.5px solid #BFDBFE'}}>
                  📄 {f.name}
                </span>
              ))}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={doPreview} disabled={loading}
                style={{padding:'8px 20px',borderRadius:8,border:'none',background:AC,
                  color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>
                {loading?'Analisando...':'🔍 Analisar XMLs'}
              </button>
              <button onClick={()=>{setFiles([]);setPreview(null);}}
                style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',
                  background:'#fff',cursor:'pointer',fontSize:13}}>Limpar</button>
            </div>
          </div>
        )}
        {preview&&(
          <div>
            <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
              {[
                {l:'Total notas',v:String(preview.total),c:'#374151'},
                {l:'Valor Serviços',v:fmtBRL(totalServicos),c:'#1D4ED8'},
                {l:'ISS Total',v:fmtBRL(totalIss),c:'#F97316'},
                {l:'Valor Líquido',v:fmtBRL(totalLiquido),c:'#15803D'},
                {l:'Duplicatas',v:String(preview.items.filter((i:any)=>i.duplicate).length),c:'#9CA3AF'},
              ].map(t=>(
                <div key={t.l} style={{background:'#fff',border:'0.5px solid #E5E7EB',
                  borderRadius:8,padding:'8px 14px',minWidth:130}}>
                  <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase' as const,fontWeight:600}}>{t.l}</div>
                  <div style={{fontSize:15,fontWeight:700,color:t.c,marginTop:2}}>{t.v}</div>
                </div>
              ))}
              <button onClick={doImport} disabled={loading||!preview.items.length}
                style={{marginLeft:'auto',padding:'8px 24px',borderRadius:8,border:'none',
                  background:'#15803D',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,alignSelf:'center'}}>
                ✓ Importar {preview.total} NFS-e
              </button>
            </div>
            <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  {['Nº','Emissão','Modo','Prestador','Tomador','Serviços','ISS','Líquido',''].map(h=>(
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{preview.items.map((item:any,idx:number)=>{
                  const ms=MODE_STYLE[item.mode]??MODE_STYLE.DESCONHECIDO;
                  return(
                    <tr key={idx} style={{opacity:item.duplicate?0.5:1}}>
                      <td style={td}><b>{item.numero}</b>{item.duplicate&&<div style={{fontSize:10,color:'#9CA3AF'}}>duplicata</div>}</td>
                      <td style={td}>{fmtDate(item.dataEmissao)}</td>
                      <td style={td}><span style={{fontSize:10,padding:'2px 6px',borderRadius:20,fontWeight:600,background:ms.bg,color:ms.color}}>{ms.label}</span></td>
                      <td style={td}><div style={{fontSize:12,fontWeight:500}}>{item.prestadorNome}</div>
                        <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>{fmtCNPJ(item.prestadorCnpj||'')}</div></td>
                      <td style={td}><div style={{fontSize:12}}>{item.tomadorNome}</div>
                        <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>{fmtCNPJ(item.tomadorCnpj||'')}</div></td>
                      <td style={{...td,fontFamily:'monospace',textAlign:'right' as const}}>{fmtBRL(item.valorServicos)}</td>
                      <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,color:item.issRetido?'#F97316':'#374151'}}>
                        {fmtBRL(item.valorIss)}{item.issRetido&&<div style={{fontSize:9,color:'#F97316'}}>retido</div>}
                      </td>
                      <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,fontWeight:600,color:'#15803D'}}>{fmtBRL(item.valorLiquido)}</td>
                      <td style={td}><div style={{fontSize:10,color:'#9CA3AF'}}>{item.itemListaServico}</div></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        )}
        {imported&&(
          <div style={{background:'#F0FDF4',border:'0.5px solid #86EFAC',borderRadius:10,
            padding:'16px 20px',marginTop:16}}>
            <div style={{fontWeight:700,color:'#15803D',fontSize:15,marginBottom:4}}>✓ Importação concluída</div>
            <div style={{fontSize:13}}><b>{imported.created}</b> nota(s) · <b>{imported.skipped}</b> duplicata(s)</div>
          </div>
        )}
      </div>
    </div>
  );
};
export default NfseImportPage;
