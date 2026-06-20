import React, { useState, useRef, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const fmtBRL = (v:any) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtCNPJ = (v:string) => v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');
const fmtDate = (s:string) => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR') : '—';
const AC = '#6C63FF';

const MODE_STYLE: Record<string,{bg:string,color:string,label:string}> = {
  PRESTADOR:    {bg:'#F0FDF4',color:'#15803D',label:'Prestador (emitida)'},
  TOMADOR:      {bg:'#EFF6FF',color:'#1D4ED8',label:'Tomador (recebida)'},
  DESCONHECIDO: {bg:'#F9FAFB',color:'#6B7280',label:'Desconhecido'},
};

export const NfseImportPage: React.FC = () => {
  const [files,     setFiles]    = useState<File[]>([]);
  const [preview,   setPreview]  = useState<any>(null);
  const [loading,   setLoading]  = useState(false);
  const [imported,  setImported] = useState<any>(null);
  const [dragOver,  setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const th = {padding:'8px 12px',fontSize:11,fontWeight:600 as const,color:'#6B7280',
    textTransform:'uppercase' as const,background:'#F9FAFB',
    borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const,whiteSpace:'nowrap' as const};
  const td = {padding:'8px 12px',fontSize:12,color:'#374151',
    borderBottom:'0.5px solid #F5F5F5',verticalAlign:'top' as const};

  const handleFiles = useCallback((flist: FileList | null) => {
    if (!flist) return;
    const xmls = Array.from(flist).filter(f=>f.name.toLowerCase().endsWith('.xml'));
    if (!xmls.length) { Swal.fire('Atenção','Selecione arquivos XML de NFS-e.','warning'); return; }
    setFiles(xmls); setPreview(null); setImported(null);
  },[]);

  const doPreview = async () => {
    if (!files.length) return;
    setLoading(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const r = await api.post('/fiscal/nfse-sp/preview', fd,
        {headers:{'Content-Type':'multipart/form-data'}});
      setPreview(r.data);
    } catch(e:any) {
      Swal.fire('Erro', e?.response?.data?.message || e.message, 'error');
    } finally { setLoading(false); }
  };

  const doImport = async () => {
    if (!preview?.items?.length) return;
    const ok = await Swal.fire({
      title:`Importar ${preview.total} NFS-e?`,
      html:`Empresa: <b>${preview.company?.name}</b><br/>
            Duplicatas serão ignoradas automaticamente.`,
      icon:'question', showCancelButton:true,
      confirmButtonText:'Importar', confirmButtonColor:'#6C63FF',
    });
    if (!ok.isConfirmed) return;
    setLoading(true);
    try {
      const fd = new FormData();
      files.forEach(f => fd.append('files', f));
      const r = await api.post('/fiscal/nfse-sp/import', fd,
        {headers:{'Content-Type':'multipart/form-data'}});
      setImported(r.data);
      Swal.fire('Importado!',
        `${r.data.created} nota(s) importada(s). ${r.data.skipped} duplicata(s) ignorada(s).`,
        'success');
    } catch(e:any) {
      Swal.fire('Erro', e?.response?.data?.message || e.message, 'error');
    } finally { setLoading(false); }
  };

  // ── Busca repositorio SP ──────────────────────────────────────
  const [certs,    setCerts]    = React.useState<any[]>([]);
  const [buscaForm,setBuscaForm]= React.useState({certId:'',dtInicio:'',dtFim:'',paginas:'5',hom:false});
  const [buscando, setBuscando] = React.useState(false);
  const [buscaRes, setBuscaRes] = React.useState<any>(null);
  const setBF = (k:string,v:any) => setBuscaForm(f=>({...f,[k]:v}));

  React.useEffect(()=>{
    api.get('/certificates').then((r:any)=>setCerts((r.data||[]).filter((c:any)=>c.isActive))).catch(()=>{});
  },[]);

  const buscarSP = async() => {
    if(!buscaForm.certId){Swal.fire('Atenção','Selecione um certificado.','warning');return;}
    setBuscando(true); setBuscaRes(null);
    try{
      const r = await api.post('/fiscal/nfse-sp/buscar-tomador',{
        certId: buscaForm.certId,
        dtInicio: buscaForm.dtInicio||undefined,
        dtFim:    buscaForm.dtFim||undefined,
        paginas:  parseInt(buscaForm.paginas)||5,
        homologacao: buscaForm.hom,
      });
      setBuscaRes(r.data);
      if(r.data.importadas>0)
        Swal.fire('Concluído!',`${r.data.importadas} nota(s) importada(s) do repositório SP.`,'success');
      else if(r.data.totalEncontradas===0)
        Swal.fire('Sem resultados','Nenhuma NFS-e encontrada para o período.','info');
    }catch(e:any){ Swal.fire('Erro',e?.response?.data?.message||e.message,'error'); }
    finally{ setBuscando(false); }
  };

  const totalServicos = preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorServicos||0),0)||0;
  const totalIss      = preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorIss||0),0)||0;
  const totalLiquido  = preview?.items?.reduce((s:number,i:any)=>s+Number(i.valorLiquido||0),0)||0;

  return (
      {/* ── Painel Busca Repositório SP ──────────────────────────────── */}
      <div style={{background:'#EFF6FF',borderBottom:'0.5px solid #BFDBFE',padding:'14px 24px',flexShrink:0}}>
        <div style={{fontWeight:700,fontSize:13,color:'#1D4ED8',marginBottom:8}}>
          🏛️ Buscar Notas do Repositório — Prefeitura de São Paulo
        </div>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:8,alignItems:'end'}}>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:'#1D4ED8',textTransform:'uppercase',display:'block',marginBottom:3}}>Certificado A1 *</label>
            <select value={buscaForm.certId} onChange={e=>setBF('certId',e.target.value)}
              style={{width:'100%',border:'0.5px solid #93C5FD',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}>
              <option value=''>Selecione...</option>
              {certs.map((c:any)=>(<option key={c.id} value={c.id}>{c.alias}</option>))}
            </select>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:'#1D4ED8',textTransform:'uppercase',display:'block',marginBottom:3}}>Data Início</label>
            <input type='date' value={buscaForm.dtInicio} onChange={e=>setBF('dtInicio',e.target.value)}
              style={{width:'100%',border:'0.5px solid #93C5FD',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}/>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:'#1D4ED8',textTransform:'uppercase',display:'block',marginBottom:3}}>Data Fim</label>
            <input type='date' value={buscaForm.dtFim} onChange={e=>setBF('dtFim',e.target.value)}
              style={{width:'100%',border:'0.5px solid #93C5FD',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff'}}/>
          </div>
          <div>
            <label style={{fontSize:10,fontWeight:600,color:'#1D4ED8',textTransform:'uppercase',display:'block',marginBottom:3}}>Págs</label>
            <input type='number' min='1' max='20' value={buscaForm.paginas} onChange={e=>setBF('paginas',e.target.value)}
              style={{width:'100%',border:'0.5px solid #93C5FD',borderRadius:6,padding:'6px 10px',fontSize:12,outline:'none',background:'#fff',textAlign:'center'}}/>
          </div>
          <button onClick={buscarSP} disabled={buscando||!buscaForm.certId}
            style={{padding:'7px 16px',borderRadius:8,border:'none',background:'#1D4ED8',
              color:'#fff',cursor:'pointer',fontSize:13,fontWeight:700,whiteSpace:'nowrap',
              opacity:buscando||!buscaForm.certId?0.6:1}}>
            {buscando?'Buscando...':'⬇ Buscar Notas'}
          </button>
        </div>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',color:'#6B7280',marginTop:6}}>
          <input type='checkbox' checked={buscaForm.hom} onChange={e=>setBF('hom',e.target.checked)}/>
          Homologação (testes) — usa webservice de homologação da Prefeitura SP
        </label>
        {buscaRes&&(
          <div style={{display:'flex',gap:10,marginTop:8,flexWrap:'wrap'}}>
            {[{l:'Encontradas',v:buscaRes.totalEncontradas,c:'#1D4ED8'},{l:'Importadas',v:buscaRes.importadas,c:'#15803D'},{l:'Duplicatas',v:buscaRes.duplicatas,c:'#9CA3AF'},{l:'Erros',v:buscaRes.erros?.length||0,c:'#DC2626'}].map(t=>(
              <div key={t.l} style={{background:'#fff',borderRadius:6,padding:'4px 12px',border:'0.5px solid #BFDBFE',display:'flex',gap:6,alignItems:'center'}}>
                <span style={{fontSize:10,color:'#6B7280',textTransform:'uppercase',fontWeight:600}}>{t.l}</span>
                <span style={{fontSize:15,fontWeight:700,color:t.c}}>{t.v}</span>
              </div>
            ))}
            {buscaRes.erros?.map((e:string,i:number)=>(<div key={i} style={{fontSize:11,color:'#DC2626',padding:'3px 8px',background:'#FEF2F2',borderRadius:5}}>⚠ {e.slice(0,80)}</div>))}
          </div>
        )}
      </div>
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',
        padding:'14px 24px',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ FISCAL</span>
        <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>
          Importação NFS-e São Paulo
        </h1>
        <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>
          Importa notas como Prestador (emitidas) e Tomador (recebidas) — formato ABRASF 2.0
        </p>
      </div>

      <div style={{flex:1,overflow:'auto',padding:'20px 24px'}}>

        {/* Drop zone */}
        <div
          onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);handleFiles(e.dataTransfer.files);}}
          onClick={()=>inputRef.current?.click()}
          style={{border:`2px dashed ${dragOver?'#6C63FF':'#D1D5DB'}`,borderRadius:12,
            padding:'32px',textAlign:'center',cursor:'pointer',
            background:dragOver?'#F5F3FF':'#FAFAFA',
            transition:'all .2s',marginBottom:16}}>
          <input ref={inputRef} type="file" accept=".xml" multiple style={{display:'none'}}
            onChange={e=>handleFiles(e.target.files)}/>
          <div style={{fontSize:32,marginBottom:8}}>📂</div>
          <div style={{fontWeight:600,color:'#374151',fontSize:14}}>
            {files.length>0
              ? `${files.length} arquivo(s) selecionado(s)`
              : 'Arraste os XMLs aqui ou clique para selecionar'}
          </div>
          <div style={{fontSize:12,color:'#9CA3AF',marginTop:4}}>
            Arquivos XML de NFS-e SP (múltiplos permitidos)
          </div>
        </div>

        {/* Arquivos selecionados */}
        {files.length>0 && (
          <div style={{background:'#fff',border:'0.5px solid #E5E7EB',borderRadius:10,
            padding:'12px 16px',marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:'#6B7280',
              textTransform:'uppercase',marginBottom:8}}>
              Arquivos ({files.length})
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {files.map((f,i)=>(
                <span key={i} style={{fontSize:11,padding:'3px 10px',borderRadius:20,
                  background:'#EFF6FF',color:'#1D4ED8',border:'0.5px solid #BFDBFE'}}>
                  📄 {f.name}
                </span>
              ))}
            </div>
            <div style={{display:'flex',gap:8,marginTop:12}}>
              <button onClick={doPreview} disabled={loading}
                style={{padding:'8px 20px',borderRadius:8,border:'none',background:AC,
                  color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,
                  opacity:loading?0.6:1}}>
                {loading ? 'Analisando...' : '🔍 Analisar XMLs'}
              </button>
              <button onClick={()=>{setFiles([]);setPreview(null);setImported(null);}}
                style={{padding:'8px 16px',borderRadius:8,border:'0.5px solid #E5E7EB',
                  background:'#fff',cursor:'pointer',fontSize:13}}>
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div>
            {/* Totais */}
            <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
              {[
                {l:'Total notas',v:String(preview.total),c:'#374151'},
                {l:'Valor Serviços',v:fmtBRL(totalServicos),c:'#1D4ED8'},
                {l:'ISS Total',v:fmtBRL(totalIss),c:'#F97316'},
                {l:'Valor Líquido',v:fmtBRL(totalLiquido),c:'#15803D'},
                {l:'Duplicatas',v:String(preview.items.filter((i:any)=>i.duplicate).length),c:'#9CA3AF'},
              ].map(t=>(
                <div key={t.l} style={{background:'#fff',border:'0.5px solid #E5E7EB',
                  borderRadius:8,padding:'8px 16px',minWidth:140}}>
                  <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600}}>{t.l}</div>
                  <div style={{fontSize:16,fontWeight:700,color:t.c,marginTop:2}}>{t.v}</div>
                </div>
              ))}
              <button onClick={doImport} disabled={loading||!preview.items.length}
                style={{marginLeft:'auto',padding:'8px 24px',borderRadius:8,border:'none',
                  background:'#15803D',color:'#fff',cursor:'pointer',
                  fontSize:13,fontWeight:700,alignSelf:'center',opacity:loading?0.6:1}}>
                ✓ Importar {preview.total} NFS-e
              </button>
            </div>

            {/* Tabela preview */}
            <div style={{background:'#fff',border:'0.5px solid #E5E7EB',
              borderRadius:12,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>
                  {['Nº','Emissão','Modo','Prestador','Tomador','Serviços','ISS','Líquido',''].map(h=>(
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {preview.items.map((item:any,idx:number)=>{
                    const ms = MODE_STYLE[item.mode]??MODE_STYLE.DESCONHECIDO;
                    return (
                      <tr key={idx} style={{opacity:item.duplicate?0.5:1}}>
                        <td style={td}><b>{item.numero}</b>
                          {item.duplicate&&<div style={{fontSize:10,color:'#9CA3AF'}}>duplicata</div>}
                        </td>
                        <td style={td}>{fmtDate(item.dataEmissao)}</td>
                        <td style={td}>
                          <span style={{fontSize:10,padding:'2px 6px',borderRadius:20,
                            fontWeight:600,background:ms.bg,color:ms.color}}>
                            {ms.label}
                          </span>
                        </td>
                        <td style={td}>
                          <div style={{fontSize:12,fontWeight:500}}>{item.prestadorNome}</div>
                          <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>
                            {fmtCNPJ(item.prestadorCnpj||'')}
                          </div>
                        </td>
                        <td style={td}>
                          <div style={{fontSize:12}}>{item.tomadorNome}</div>
                          <div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>
                            {fmtCNPJ(item.tomadorCnpj||'')}
                          </div>
                        </td>
                        <td style={{...td,fontFamily:'monospace',textAlign:'right' as const}}>
                          {fmtBRL(item.valorServicos)}
                        </td>
                        <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,
                          color:item.issRetido?'#F97316':'#374151'}}>
                          {fmtBRL(item.valorIss)}
                          {item.issRetido&&<div style={{fontSize:9,color:'#F97316'}}>retido</div>}
                        </td>
                        <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,
                          fontWeight:600,color:'#15803D'}}>
                          {fmtBRL(item.valorLiquido)}
                        </td>
                        <td style={td}>
                          <div style={{fontSize:10,color:'#9CA3AF'}}>
                            {item.itemListaServico}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Resultado importacao */}
        {imported && (
          <div style={{background:'#F0FDF4',border:'0.5px solid #86EFAC',borderRadius:10,
            padding:'16px 20px',marginTop:16}}>
            <div style={{fontWeight:700,color:'#15803D',fontSize:15,marginBottom:4}}>
              ✓ Importação concluída
            </div>
            <div style={{fontSize:13,color:'#374151'}}>
              <b>{imported.created}</b> nota(s) importada(s) · 
              <b> {imported.skipped}</b> duplicata(s) ignorada(s)
              {imported.errors?.length>0&&(
                <div style={{color:'#DC2626',marginTop:4}}>
                  {imported.errors.map((e:string,i:number)=><div key={i}>⚠ {e}</div>)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default NfseImportPage;
