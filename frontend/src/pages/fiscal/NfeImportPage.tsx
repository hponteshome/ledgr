// frontend/src/pages/finance/NfeImportPage.tsx
import React, { useState, useRef, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
const fmtBRL=(v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtCNPJ=(v:string)=>v?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')||v;
const fmtDate=(s:string)=>s?new Date(s+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const AC='#15803D';
const MODE_STYLE:Record<string,{bg:string,color:string,label:string}>={
  ENTRADA:      {bg:'#EFF6FF',color:'#1D4ED8',label:'Entrada (compra)'},
  SAIDA:        {bg:'#F0FDF4',color:'#15803D',label:'Saída (venda)'},
  DESCONHECIDO: {bg:'#F9FAFB',color:'#6B7280',label:'Desconhecido'},
};
export const NfeImportPage:React.FC=()=>{
  const [files,    setFiles]   =useState<File[]>([]);
  const [preview,  setPreview] =useState<any>(null);
  const [loading,  setLoading] =useState(false);
  const [imported, setImported]=useState<any>(null);
  const [dragOver, setDragOver]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  const th={padding:'8px 12px',fontSize:11,fontWeight:600 as const,color:'#6B7280',
    textTransform:'uppercase' as const,background:'#F9FAFB',
    borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const};
  const td={padding:'8px 12px',fontSize:12,color:'#374151',
    borderBottom:'0.5px solid #F5F5F5',verticalAlign:'top' as const};
  const handleFiles=useCallback((fl:FileList|null)=>{
    if(!fl)return;
    const xmls=Array.from(fl).filter(f=>f.name.toLowerCase().endsWith('.xml'));
    if(!xmls.length){Swal.fire('Atenção','Selecione arquivos XML de NF-e.','warning');return;}
    setFiles(xmls);setPreview(null);setImported(null);
  },[]);
  const doPreview=async()=>{
    setLoading(true);
    try{
      const fd=new FormData();files.forEach(f=>fd.append('files',f));
      const r=await api.post('/fiscal/nfe/preview',fd,{headers:{'Content-Type':'multipart/form-data'}});
      setPreview(r.data);
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||e.message,'error');}
    finally{setLoading(false);}
  };
  const doImport=async()=>{
    const ok=await Swal.fire({title:`Importar ${preview.total} NF-e?`,icon:'question',
      showCancelButton:true,confirmButtonText:'Importar',confirmButtonColor:AC});
    if(!ok.isConfirmed)return;
    setLoading(true);
    try{
      const fd=new FormData();files.forEach(f=>fd.append('files',f));
      const r=await api.post('/fiscal/nfe/import',fd,{headers:{'Content-Type':'multipart/form-data'}});
      setImported(r.data);
      Swal.fire('Importado!',`${r.data.created} nota(s) importada(s).`,'success');
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||e.message,'error');}
    finally{setLoading(false);}
  };
  const totVNF=preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorNF||0),0)||0;
  const totPis=preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorPis||0),0)||0;
  const totCof=preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorCofins||0),0)||0;
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:'#6C63FF'}}>◆ FISCAL</span>
        <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>Importação NF-e (Produtos)</h1>
        <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>
          Importa notas de Entrada (compras) e Saída (vendas) — XML SEFAZ nfeProc / NFe
        </p>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'20px 24px'}}>
        <div onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files);}}
          onClick={()=>inputRef.current?.click()}
          style={{border:`2px dashed ${dragOver?AC:'#D1D5DB'}`,borderRadius:12,
            padding:'32px',textAlign:'center',cursor:'pointer',
            background:dragOver?'#F0FDF4':'#FAFAFA',marginBottom:16}}>
          <input ref={inputRef} type="file" accept=".xml" multiple style={{display:'none'}}
            onChange={e=>handleFiles(e.target.files)}/>
          <div style={{fontSize:32,marginBottom:8}}>📦</div>
          <div style={{fontWeight:600,color:'#374151',fontSize:14}}>
            {files.length>0?`${files.length} arquivo(s) selecionado(s)`
              :'Arraste os XMLs de NF-e aqui ou clique para selecionar'}
          </div>
          <div style={{fontSize:12,color:'#9CA3AF',marginTop:4}}>
            Formato SEFAZ: nfeProc.xml ou NFe.xml (múltiplos permitidos)
          </div>
        </div>
        {files.length>0&&(
          <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:10,
            padding:'12px 16px',marginBottom:16}}>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
              {files.map((f,i)=>(
                <span key={i} style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                  background:'#F0FDF4',color:'#15803D',border:'0.5px solid #86EFAC'}}>
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
                {l:'Valor NF',v:fmtBRL(totVNF),c:'#1D4ED8'},
                {l:'PIS',v:fmtBRL(totPis),c:'#7C3AED'},
                {l:'COFINS',v:fmtBRL(totCof),c:'#7C3AED'},
                {l:'Duplicatas',v:String(preview.items.filter((i:any)=>i.duplicate).length),c:'#9CA3AF'},
              ].map(t=>(
                <div key={t.l} style={{background:'#fff',border:'0.5px solid #E5E7EB',
                  borderRadius:8,padding:'8px 16px',minWidth:130}}>
                  <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600}}>{t.l}</div>
                  <div style={{fontSize:15,fontWeight:700,color:t.c,marginTop:2}}>{t.v}</div>
                </div>
              ))}
              <button onClick={doImport} disabled={loading||!preview.items.length}
                style={{marginLeft:'auto',padding:'8px 24px',borderRadius:8,border:'none',
                  background:AC,color:'#fff',cursor:'pointer',fontSize:13,
                  fontWeight:700,alignSelf:'center'}}>
                ✓ Importar {preview.total} NF-e
              </button>
            </div>
            <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:12,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  {['Nº','Emissão','Modo','Emitente','Destinatário','Valor NF','PIS','COFINS','Nat.Op',''].map(h=>(
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{preview.items.map((item:any,idx:number)=>{
                  const ms=MODE_STYLE[item.mode]??MODE_STYLE.DESCONHECIDO;
                  return(
                    <tr key={idx} style={{opacity:item.duplicate?0.5:1}}>
                      <td style={td}><b>{item.numero}</b><span style={{fontSize:9,color:'#9CA3AF',display:'block'}}>Série {item.serie}</span>
                        {item.duplicate&&<div style={{fontSize:10,color:'#9CA3AF'}}>duplicata</div>}
                      </td>
                      <td style={td}>{fmtDate(item.dataEmissao)}</td>
                      <td style={td}><span style={{fontSize:10,padding:'2px 6px',borderRadius:20,
                        fontWeight:600,background:ms.bg,color:ms.color}}>{ms.label}</span></td>
                      <td style={td}><div style={{fontSize:11}}>{item.emitenteNome}</div>
                        <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>{fmtCNPJ(item.emitenteCnpj||'')}</div></td>
                      <td style={td}><div style={{fontSize:11}}>{item.destinNome}</div>
                        <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>{fmtCNPJ(item.destinCnpj||'')}</div></td>
                      <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,fontWeight:600}}>{fmtBRL(item.valorNF)}</td>
                      <td style={{...td,fontFamily:'monospace',textAlign:'right' as const}}>{fmtBRL(item.valorPis)}</td>
                      <td style={{...td,fontFamily:'monospace',textAlign:'right' as const}}>{fmtBRL(item.valorCofins)}</td>
                      <td style={{...td,fontSize:10,color:'#6B7280',maxWidth:120,overflow:'hidden',
                        textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.natOp}</td>
                      <td style={td}></td>
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
            <div style={{fontSize:13}}>
              <b>{imported.created}</b> nota(s) importada(s) · <b>{imported.skipped}</b> duplicata(s) ignorada(s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default NfeImportPage;
