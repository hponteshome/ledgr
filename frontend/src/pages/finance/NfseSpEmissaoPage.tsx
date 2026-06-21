// frontend/src/pages/finance/NfseSpEmissaoPage.tsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const fmtBRL = (v:any) => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = (s:any) => s?new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const AC = '#1D4ED8';

const SERVICOS = [
  {v:'01.01',l:'01.01 — Análise e desenvolvimento de sistemas'},
  {v:'01.02',l:'01.02 — Programação'},
  {v:'01.03',l:'01.03 — Processamento de dados e congêneres'},
  {v:'01.07',l:'01.07 — Suporte técnico em informática'},
  {v:'04.02',l:'04.02 — Medicina / Consultoria médica'},
  {v:'06.01',l:'06.01 — Assessoria ou consultoria em geral'},
  {v:'06.02',l:'06.02 — Pesquisa, coleta, compilação e fornecimento de dados'},
  {v:'10.01',l:'10.01 — Agenciamento, corretagem ou intermediação'},
  {v:'17.01',l:'17.01 — Assessoria ou consultoria'},
  {v:'17.06',l:'17.06 — Propaganda e publicidade'},
];

const STATUS_BADGE:Record<string,{bg:string,c:string,l:string}>={
  AUTORIZADA:{bg:'#F0FDF4',c:'#15803D',l:'Autorizada'},
  REJEITADA: {bg:'#FEF2F2',c:'#DC2626',l:'Rejeitada'},
  RASCUNHO:  {bg:'#F9FAFB',c:'#6B7280',l:'Rascunho'},
  CANCELADA: {bg:'#F1F5F9',c:'#94A3B8',l:'Cancelada'},
  ERRO:      {bg:'#FEF2F2',c:'#DC2626',l:'Erro'},
};

const Inp = ({label,required,...p}:any) => (
  <div>
    <label style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>{label}{required&&' *'}</label>
    <input {...p} required={required} style={{width:'100%',border:'0.5px solid #E5E7EB',borderRadius:6,padding:'7px 10px',fontSize:13,outline:'none',boxSizing:'border-box' as const,...(p.style||{})}}/>
  </div>
);
const Sel = ({label,required,children,...p}:any) => (
  <div>
    <label style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>{label}{required&&' *'}</label>
    <select {...p} required={required} style={{width:'100%',border:'0.5px solid #E5E7EB',borderRadius:6,padding:'7px 10px',fontSize:13,outline:'none',...(p.style||{})}}>{children}</select>
  </div>
);

export const NfseSpEmissaoPage:React.FC = () => {
  const [tab,      setTab]      = useState<'emitir'|'historico'>('emitir');
  const [certs,    setCerts]    = useState<any[]>([]);
  const [historico,setHistorico]= useState<any[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [form, setForm] = useState({
    certId:'', ambiente:'HOMOLOGACAO',
    tomadorCnpj:'', tomadorNome:'', tomadorEmail:'',
    itemListaServico:'01.07', codigoCnae:'6201500',
    codigoTributacao:'', discriminacao:'',
    valorServicos:'', valorDeducoes:'0', aliquotaIss:'2',
    issRetido:false, optanteSimplesNacional:true,
    usarLayoutV2:false, aliquotaIbs:'0', aliquotaCbs:'0',
    inscricaoMunicipal:'',
  });
  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    api.get('/certificates').then((r:any)=>setCerts((r.data||[]).filter((c:any)=>c.isActive))).catch(()=>{});
    loadHistorico();
  },[]);

  const loadHistorico = () => {
    api.get('/fiscal/documentos',{params:{tipo:'NFSE',limit:50}})
      .then((r:any)=>setHistorico((r.data?.data||[]).filter((d:any)=>d.notes?.includes('RPS:'))))
      .catch(()=>{});
  };

  const vBC      = Math.max(0,(Number(form.valorServicos)||0)-(Number(form.valorDeducoes)||0));
  const vIss     = vBC*(Number(form.aliquotaIss)||0)/100;
  const vIbs     = vBC*(Number(form.aliquotaIbs)||0)/100;
  const vCbs     = vBC*(Number(form.aliquotaCbs)||0)/100;
  const vLiquido = vBC-(form.issRetido?vIss:0);

  const emitir = async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!form.certId){Swal.fire('Atenção','Selecione um certificado digital.','warning');return;}
    const ok = await Swal.fire({
      title:'Emitir NFS-e SP',
      html:`Tomador: <b>${form.tomadorNome}</b><br/>
            Serviço: <b>${form.itemListaServico}</b><br/>
            Valor: <b>${fmtBRL(Number(form.valorServicos))}</b><br/>
            ISS: <b>${fmtBRL(vIss)}</b> ${form.issRetido?'(retido)':''}<br/>
            ${form.usarLayoutV2?`IBS: <b>${fmtBRL(vIbs)}</b> · CBS: <b>${fmtBRL(vCbs)}</b><br/>`:''}
            Ambiente: <b style="color:${form.ambiente==='PRODUCAO'?'#15803D':'#92400E'}">${form.ambiente}</b>`,
      icon:'question',showCancelButton:true,
      confirmButtonText:'Emitir NFS-e',confirmButtonColor:AC,
    });
    if(!ok.isConfirmed)return;
    setLoading(true);
    try{
      const r = await api.post('/fiscal/nfse-sp/emitir',{
        ...form,
        valorServicos:Number(form.valorServicos),
        valorDeducoes:Number(form.valorDeducoes||0),
        aliquotaIss:Number(form.aliquotaIss||0),
        aliquotaIbs:Number(form.aliquotaIbs||0),
        aliquotaCbs:Number(form.aliquotaCbs||0),
      });
      if(r.data.status==='AUTORIZADA'){
        Swal.fire('NFS-e Autorizada!',`Nº ${r.data.numeroNfse||'—'} · Cód. Verif: ${r.data.codigoVerificacao||'—'}`,'success');
        setForm(f=>({...f,tomadorCnpj:'',tomadorNome:'',tomadorEmail:'',discriminacao:'',valorServicos:'',valorDeducoes:'0'}));
        loadHistorico();
      } else {
        Swal.fire('Atenção',r.data.erro||'Verifique o histórico.','warning');
        loadHistorico();
      }
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||e.message,'error');}
    finally{setLoading(false);}
  };

  const cancelar = async(doc:any)=>{
    const im = form.inscricaoMunicipal||prompt('Inscrição Municipal do prestador:')||'';
    if(!im){Swal.fire('Necessário','Informe a Inscrição Municipal.','info');return;}
    const num = doc.documentNumber;
    const cod = doc.accessKey?.replace(/0+$/,'');
    const ok = await Swal.fire({title:`Cancelar NFS-e ${num}?`,icon:'warning',showCancelButton:true,confirmButtonColor:'#DC2626',confirmButtonText:'Cancelar NFS-e'});
    if(!ok.isConfirmed)return;
    try{
      await api.post('/fiscal/nfse-sp/cancelar',{
        certId:form.certId||certs[0]?.id, numeroNfse:num,
        codigoVerificacao:cod, inscricaoMunicipal:im,
        ambiente:'PRODUCAO',
      });
      Swal.fire('Cancelada','','info'); loadHistorico();
    }catch(e:any){Swal.fire('Erro',e?.response?.data?.message||e.message,'error');}
  };

  const th={padding:'8px 12px',fontSize:11,fontWeight:600 as const,color:'#6B7280',textTransform:'uppercase' as const,background:'#F9FAFB',borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const};
  const td={padding:'9px 12px',fontSize:12,color:'#374151',borderBottom:'0.5px solid #F5F5F5',verticalAlign:'top' as const};

  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ FISCAL · SÃO PAULO</span>
        <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>Emissão NFS-e SP</h1>
        <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>
          Emissão via webservice Prefeitura SP (EnvioLoteRPS) · Layout v1 e v2 (Reforma Tributária 2026)
        </p>
      </div>

      <div style={{display:'flex',gap:0,borderBottom:'0.5px solid #E5E7EB',background:'#fff',flexShrink:0}}>
        {[{k:'emitir',l:'✍ Emitir NFS-e'},{k:'historico',l:`📋 Histórico (${historico.length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)}
            style={{padding:'10px 20px',border:'none',background:'none',cursor:'pointer',fontSize:13,fontWeight:600,
              borderBottom:tab===t.k?`2px solid ${AC}`:'2px solid transparent',color:tab===t.k?AC:'#6B7280'}}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'auto',padding:'20px 24px'}}>
        {tab==='emitir'&&(
          <div style={{maxWidth:720}}>
            {form.ambiente==='HOMOLOGACAO'&&(
              <div style={{background:'#FEF3C7',border:'0.5px solid #FCD34D',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#92400E',marginBottom:16}}>
                ⚠️ <b>Homologação</b> — notas sem validade fiscal. Mude para PRODUÇÃO quando pronto.
              </div>
            )}
            {form.usarLayoutV2&&(
              <div style={{background:'#EFF6FF',border:'0.5px solid #93C5FD',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#1D4ED8',marginBottom:16}}>
                📋 <b>Layout v2 (Reforma Tributária 2026)</b> — campos IBS e CBS obrigatórios desde 01/01/2026.
              </div>
            )}
            <form onSubmit={emitir}>
              <div style={{display:'grid',gap:16}}>
                {/* Certificado e ambiente */}
                <div style={{background:'#F9FAFB',borderRadius:8,padding:'14px',display:'grid',gridTemplateColumns:'2fr 1fr',gap:10}}>
                  <Sel label="Certificado Digital A1" required value={form.certId} onChange={(e:any)=>set('certId',e.target.value)}>
                    <option value="">Selecione...</option>
                    {certs.map((c:any)=>(<option key={c.id} value={c.id}>{c.alias} — válido até {fmtDate(c.validTo)}</option>))}
                  </Sel>
                  <Sel label="Ambiente" value={form.ambiente} onChange={(e:any)=>set('ambiente',e.target.value)}>
                    <option value="HOMOLOGACAO">Homologação</option>
                    <option value="PRODUCAO">Produção</option>
                  </Sel>
                </div>

                {/* Tomador */}
                <div style={{borderTop:'0.5px solid #E5E7EB',paddingTop:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10}}>Tomador de Serviços</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <Inp label="CNPJ / CPF" value={form.tomadorCnpj} onChange={(e:any)=>set('tomadorCnpj',e.target.value.replace(/\D/g,''))} maxLength={14}/>
                    <Inp label="Nome / Razão Social" required value={form.tomadorNome} onChange={(e:any)=>set('tomadorNome',e.target.value)}/>
                    <Inp label="E-mail" type="email" value={form.tomadorEmail} onChange={(e:any)=>set('tomadorEmail',e.target.value)}/>
                    <Inp label="Inscrição Municipal (prestador)" value={form.inscricaoMunicipal} onChange={(e:any)=>set('inscricaoMunicipal',e.target.value)} placeholder="Necessária para cancelamento"/>
                  </div>
                </div>

                {/* Serviço */}
                <div style={{borderTop:'0.5px solid #E5E7EB',paddingTop:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10}}>Serviço Prestado</div>
                  <div style={{display:'grid',gap:10}}>
                    <Sel label="Item Lista Serviço (LC 116)" required value={form.itemListaServico} onChange={(e:any)=>set('itemListaServico',e.target.value)}>
                      {SERVICOS.map(s=>(<option key={s.v} value={s.v}>{s.l}</option>))}
                    </Sel>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                      <Inp label="Código CNAE" value={form.codigoCnae} onChange={(e:any)=>set('codigoCnae',e.target.value)} placeholder="ex: 6201500"/>
                      <Inp label="Código Tributação Municipal" value={form.codigoTributacao} onChange={(e:any)=>set('codigoTributacao',e.target.value)}/>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase' as const,display:'block',marginBottom:3}}>Discriminação do Serviço *</label>
                      <textarea required value={form.discriminacao} onChange={e=>set('discriminacao',e.target.value)}
                        rows={3} placeholder="Descreva detalhadamente o serviço prestado"
                        style={{width:'100%',border:'0.5px solid #E5E7EB',borderRadius:6,padding:'7px 10px',fontSize:13,outline:'none',resize:'vertical',boxSizing:'border-box' as const}}/>
                    </div>
                  </div>
                </div>

                {/* Valores */}
                <div style={{borderTop:'0.5px solid #E5E7EB',paddingTop:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10}}>Valores e Tributação</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                    <Inp label="Valor do Serviço (R$) *" required type="number" step="0.01" min="0.01" value={form.valorServicos} onChange={(e:any)=>set('valorServicos',e.target.value)}/>
                    <Inp label="Deduções (R$)" type="number" step="0.01" value={form.valorDeducoes} onChange={(e:any)=>set('valorDeducoes',e.target.value)}/>
                    <Inp label="Alíquota ISS (%)" type="number" step="0.01" value={form.aliquotaIss} onChange={(e:any)=>set('aliquotaIss',e.target.value)}/>
                  </div>
                  <div style={{marginTop:10,display:'flex',gap:20}}>
                    <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
                      <input type="checkbox" checked={form.issRetido} onChange={e=>set('issRetido',e.target.checked)}/>
                      ISS Retido pelo Tomador
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
                      <input type="checkbox" checked={form.optanteSimplesNacional} onChange={e=>set('optanteSimplesNacional',e.target.checked)}/>
                      Optante Simples Nacional
                    </label>
                    <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer',color:AC}}>
                      <input type="checkbox" checked={form.usarLayoutV2} onChange={e=>set('usarLayoutV2',e.target.checked)}/>
                      Layout v2 (IBS/CBS — Reforma 2026)
                    </label>
                  </div>

                  {form.usarLayoutV2&&(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:10,padding:'10px',background:'#EFF6FF',borderRadius:8}}>
                      <Inp label="Alíquota IBS (%)" type="number" step="0.001" value={form.aliquotaIbs} onChange={(e:any)=>set('aliquotaIbs',e.target.value)}/>
                      <Inp label="Alíquota CBS (%)" type="number" step="0.001" value={form.aliquotaCbs} onChange={(e:any)=>set('aliquotaCbs',e.target.value)}/>
                    </div>
                  )}

                  {Number(form.valorServicos)>0&&(
                    <div style={{marginTop:12,background:'#F9FAFB',borderRadius:8,padding:'12px 16px'}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                        {[
                          {l:'Base Cálculo',v:fmtBRL(vBC),c:'#374151'},
                          {l:'ISS '+(form.issRetido?'retido':''),v:fmtBRL(vIss),c:'#F97316'},
                          ...(form.usarLayoutV2?[{l:'IBS',v:fmtBRL(vIbs),c:'#7C3AED'},{l:'CBS',v:fmtBRL(vCbs),c:'#7C3AED'}]:[]),
                          {l:'Valor Líquido',v:fmtBRL(vLiquido),c:'#15803D'},
                        ].map(x=>(
                          <div key={x.l}>
                            <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase' as const,fontWeight:600}}>{x.l}</div>
                            <div style={{fontSize:14,fontWeight:700,color:x.c}}>{x.v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading||!form.certId||!form.valorServicos}
                  style={{padding:'12px',borderRadius:10,border:'none',background:AC,color:'#fff',
                    fontSize:14,fontWeight:700,cursor:'pointer',
                    opacity:loading||!form.certId||!form.valorServicos?0.6:1}}>
                  {loading?'Emitindo...':'⚡ Emitir NFS-e SP'}
                </button>
              </div>
            </form>
          </div>
        )}

        {tab==='historico'&&(
          historico.length===0
            ?<div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontWeight:600}}>Nenhuma NFS-e SP emitida</div></div>
            :<table style={{width:'100%',borderCollapse:'collapse',background:'#fff',borderRadius:12,overflow:'hidden',border:'0.5px solid #E5E7EB'}}>
              <thead><tr>{['RPS/Nº','Emissão','Tomador','Discriminação','Valor','ISS','Status',''].map(h=>(<th key={h} style={th}>{h}</th>))}</tr></thead>
              <tbody>{historico.map((d:any)=>{
                const sb=STATUS_BADGE[d.status]??STATUS_BADGE.RASCUNHO;
                const rps=d.notes?.match(/RPS:(\d+)/)?.[1];
                const v2 =d.notes?.includes('v2');
                return(<tr key={d.id}>
                  <td style={td}><b>{d.documentNumber||'—'}</b>{rps&&<div style={{fontSize:10,color:'#9CA3AF'}}>RPS {rps}</div>}{v2&&<div style={{fontSize:9,color:'#7C3AED',fontWeight:600}}>v2</div>}</td>
                  <td style={td}>{d.issueDate?new Date(d.issueDate).toLocaleDateString('pt-BR'):'—'}</td>
                  <td style={{...td,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{d.issuerName||'—'}</td>
                  <td style={{...td,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,fontSize:11,color:'#6B7280'}}>{d.notes?.split('|')?.[0]||'—'}</td>
                  <td style={{...td,fontFamily:'monospace',textAlign:'right' as const}}>{fmtBRL(d.grossAmount)}</td>
                  <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,color:'#F97316'}}>{fmtBRL(d.issAmount)}</td>
                  <td style={td}><span style={{fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:600,background:sb.bg,color:sb.c}}>{sb.l}</span></td>
                  <td style={td}>
                    {d.status==='AUTORIZADA'&&(
                      <button onClick={()=>cancelar(d)}
                        style={{padding:'3px 8px',borderRadius:5,border:'1px solid #FCA5A5',background:'#FEF2F2',color:'#DC2626',cursor:'pointer',fontSize:10}}>
                        ✕ Cancelar
                      </button>
                    )}
                  </td>
                </tr>);
              })}</tbody>
            </table>
        )}
      </div>
    </div>
  );
};
export default NfseSpEmissaoPage;
