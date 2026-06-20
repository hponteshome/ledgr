import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const fmtBRL  = (v:any)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = (s:any)=>s?new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const fmtCNPJ = (v:string)=>v?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')||v;
const AC = '#6C63FF';

const STATUS_BADGE:Record<string,{bg:string,c:string,l:string}>={
  RASCUNHO:   {bg:'#F9FAFB',c:'#6B7280',l:'Rascunho'},
  ASSINADA:   {bg:'#EFF6FF',c:'#1D4ED8',l:'Assinada'},
  AUTORIZADA: {bg:'#F0FDF4',c:'#15803D',l:'Autorizada'},
  REJEITADA:  {bg:'#FEF2F2',c:'#DC2626',l:'Rejeitada'},
  CANCELADA:  {bg:'#F9FAFB',c:'#9CA3AF',l:'Cancelada'},
};

// Codigos mais comuns LC 116 — cTribNac
const CODIGOS_SERVICO = [
  {v:'01.01',l:'01.01 — Análise e desenvolvimento de sistemas'},
  {v:'01.02',l:'01.02 — Programação'},
  {v:'01.03',l:'01.03 — Processamento de dados'},
  {v:'01.07',l:'01.07 — Suporte técnico em informática'},
  {v:'04.02',l:'04.02 — Medicina / Assessoria ou consultoria médica'},
  {v:'06.01',l:'06.01 — Assessoria ou consultoria em geral'},
  {v:'06.02',l:'06.02 — Análise, exame, pesquisa, coleta, compilação'},
  {v:'10.01',l:'10.01 — Agenciamento, corretagem ou intermediação'},
  {v:'17.01',l:'17.01 — Assessoria ou consultoria geral'},
  {v:'17.02',l:'17.02 — Datilografia, digitação, estenografia'},
  {v:'17.06',l:'17.06 — Propaganda e publicidade'},
];

const Inp = ({label,required,...p}:any) => (
  <div>
    <label style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',
      display:'block',marginBottom:3}}>{label}{required&&' *'}</label>
    <input {...p} required={required}
      style={{width:'100%',border:'0.5px solid #E5E7EB',borderRadius:6,
        padding:'7px 10px',fontSize:13,outline:'none',boxSizing:'border-box',...(p.style||{})}}/>
  </div>
);
const Sel = ({label,required,children,...p}:any) => (
  <div>
    <label style={{fontSize:11,fontWeight:600,color:'#6B7280',textTransform:'uppercase',
      display:'block',marginBottom:3}}>{label}{required&&' *'}</label>
    <select {...p} required={required}
      style={{width:'100%',border:'0.5px solid #E5E7EB',borderRadius:6,
        padding:'7px 10px',fontSize:13,outline:'none',...(p.style||{})}}>
      {children}
    </select>
  </div>
);

export const NfseNacionalPage:React.FC = () => {
  const [tab,      setTab]     = useState<'emitir'|'historico'>('emitir');
  const [certs,    setCerts]   = useState<any[]>([]);
  const [historico,setHistorico]=useState<any[]>([]);
  const [loading,  setLoading] = useState(false);
  const [form,     setForm]    = useState({
    tomadorCnpj:'', tomadorNome:'', tomadorEmail:'',
    codigoServico:'01.07', descricaoServico:'',
    valorServico:'', valorDeducoes:'0', aliquotaIss:'2',
    issRetido:false, certId:'', ambiente:'HOMOLOGACAO',
    codigoIbge:'3550308',
  });

  const set = (k:string,v:any) => setForm(f=>({...f,[k]:v}));

  const loadCerts = useCallback(async()=>{
    try{
      const r = await api.get('/certificates');
      setCerts((r.data||[]).filter((c:any)=>c.isActive));
    }catch{}
  },[]);

  const loadHistorico = useCallback(async()=>{
    try{
      const r = await api.get('/fiscal/nfse-nacional');
      setHistorico(r.data||[]);
    }catch{}
  },[]);

  useEffect(()=>{ loadCerts(); loadHistorico(); },[loadCerts,loadHistorico]);

  const vBC     = Math.max(0, Number(form.valorServico)||0 - (Number(form.valorDeducoes)||0));
  const vISS    = (vBC * (Number(form.aliquotaIss)||0) / 100);
  const vLiquido= form.issRetido ? vBC - vISS : vBC;

  const emitir = async(e:React.FormEvent) => {
    e.preventDefault();
    if(!form.certId){ Swal.fire('Atenção','Selecione um certificado digital.','warning'); return; }
    const ok = await Swal.fire({
      title:'Emitir NFS-e Nacional',
      html:`Tomador: <b>${form.tomadorNome}</b><br/>
            Valor: <b>${fmtBRL(Number(form.valorServico))}</b><br/>
            ISS: <b>${fmtBRL(vISS)}</b> ${form.issRetido?'(retido)':'(não retido)'}<br/>
            Líquido: <b>${fmtBRL(vLiquido)}</b><br/>
            Ambiente: <b>${form.ambiente}</b>`,
      icon:'question', showCancelButton:true,
      confirmButtonText:'Emitir', confirmButtonColor:AC,
    });
    if(!ok.isConfirmed) return;
    setLoading(true);
    try{
      const r = await api.post('/fiscal/nfse-nacional/emitir', {
        ...form,
        valorServico:  Number(form.valorServico),
        valorDeducoes: Number(form.valorDeducoes||0),
        aliquotaIss:   Number(form.aliquotaIss||0),
      });
      if(r.data.status==='AUTORIZADA'){
        Swal.fire('NFS-e Autorizada!',
          `Número: ${r.data.numeroNfse||'—'}<br/>Chave: ${r.data.chaveNfse||'—'}`,
          'success');
        setForm(f=>({...f,tomadorCnpj:'',tomadorNome:'',tomadorEmail:'',
          descricaoServico:'',valorServico:'',valorDeducoes:'0'}));
      } else {
        Swal.fire('Enviada com pendência',
          r.data.motivo||'Verifique o histórico e reenvie se necessário.','warning');
      }
      loadHistorico();
    }catch(e:any){
      Swal.fire('Erro',e?.response?.data?.message||e.message,'error');
    }finally{ setLoading(false); }
  };

  const reenviar = async(id:string) => {
    try{
      await api.post(`/fiscal/nfse-nacional/${id}/reenviar`);
      Swal.fire('Reenviado!','','success'); loadHistorico();
    }catch(e:any){ Swal.fire('Erro',e?.response?.data?.message||e.message,'error'); }
  };

  const cancelar = async(id:string) => {
    const {value} = await Swal.fire({title:'Motivo do cancelamento',input:'text',
      showCancelButton:true,confirmButtonColor:'#DC2626',confirmButtonText:'Cancelar NFS-e'});
    if(!value) return;
    try{
      await api.post(`/fiscal/nfse-nacional/${id}/cancelar`,{motivo:value});
      Swal.fire('Cancelada','','info'); loadHistorico();
    }catch(e:any){ Swal.fire('Erro',e?.response?.data?.message||e.message,'error'); }
  };

  const th={padding:'8px 12px',fontSize:11,fontWeight:600 as const,color:'#6B7280',
    textTransform:'uppercase' as const,background:'#F9FAFB',
    borderBottom:'0.5px solid #E5E7EB',textAlign:'left' as const};
  const td={padding:'9px 12px',fontSize:12,color:'#374151',
    borderBottom:'0.5px solid #F5F5F5',verticalAlign:'top' as const};

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      <div style={{background:'#fff',borderBottom:'0.5px solid #E5E7EB',padding:'14px 24px',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:AC}}>◆ FISCAL</span>
        <h1 style={{fontSize:18,fontWeight:600,color:'#111',margin:'2px 0 0'}}>
          NFS-e Nacional — Emissor RFB
        </h1>
        <p style={{fontSize:12,color:'#9CA3AF',margin:'4px 0 0'}}>
          Emissão direta via API da Receita Federal · Simples Nacional obrigatório a partir de 01/09/2026
        </p>
      </div>

      {/* Abas */}
      <div style={{display:'flex',gap:0,borderBottom:'0.5px solid #E5E7EB',
        background:'#fff',flexShrink:0}}>
        {[{k:'emitir',l:'✍ Emitir NFS-e'},{k:'historico',l:`📋 Histórico (${historico.length})`}].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k as any)}
            style={{padding:'10px 20px',border:'none',background:'none',cursor:'pointer',
              fontSize:13,fontWeight:600,borderBottom:tab===t.k?`2px solid ${AC}`:'2px solid transparent',
              color:tab===t.k?AC:'#6B7280'}}>
            {t.l}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflow:'auto',padding:'20px 24px'}}>

        {/* Aba Emitir */}
        {tab==='emitir'&&(
          <div style={{maxWidth:700}}>
            {/* Alerta ambiente */}
            {form.ambiente==='HOMOLOGACAO'&&(
              <div style={{background:'#FEF3C7',border:'0.5px solid #FCD34D',borderRadius:8,
                padding:'10px 14px',fontSize:12,color:'#92400E',marginBottom:16}}>
                ⚠️ <b>Modo Homologação</b> — notas NÃO têm validade fiscal. Mude para PRODUÇÃO quando pronto.
              </div>
            )}
            <form onSubmit={emitir}>
              <div style={{display:'grid',gap:14}}>

                {/* Certificado e ambiente */}
                <div style={{background:'#F9FAFB',borderRadius:8,padding:'14px',
                  display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <Sel label="Certificado Digital A1" required
                    value={form.certId} onChange={(e:any)=>set('certId',e.target.value)}>
                    <option value="">Selecione...</option>
                    {certs.map((c:any)=>(
                      <option key={c.id} value={c.id}>
                        {c.alias} — válido até {fmtDate(c.validTo)}
                      </option>
                    ))}
                  </Sel>
                  <Sel label="Ambiente" value={form.ambiente}
                    onChange={(e:any)=>set('ambiente',e.target.value)}>
                    <option value="HOMOLOGACAO">Homologação (Testes)</option>
                    <option value="PRODUCAO">Produção</option>
                  </Sel>
                </div>

                {/* Tomador */}
                <div style={{borderTop:'0.5px solid #E5E7EB',paddingTop:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10}}>
                    Tomador de Serviços
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <Inp label="CNPJ / CPF" value={form.tomadorCnpj}
                      onChange={(e:any)=>set('tomadorCnpj',e.target.value.replace(/\D/g,''))}
                      placeholder="Somente números" maxLength={14}/>
                    <Inp label="Nome / Razão Social" required value={form.tomadorNome}
                      onChange={(e:any)=>set('tomadorNome',e.target.value)}/>
                    <Inp label="E-mail" type="email" value={form.tomadorEmail}
                      onChange={(e:any)=>set('tomadorEmail',e.target.value)}/>
                    <Inp label="Cód. IBGE Município" value={form.codigoIbge}
                      onChange={(e:any)=>set('codigoIbge',e.target.value)}
                      placeholder="3550308 = São Paulo"/>
                  </div>
                </div>

                {/* Servico */}
                <div style={{borderTop:'0.5px solid #E5E7EB',paddingTop:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10}}>
                    Serviço Prestado
                  </div>
                  <div style={{display:'grid',gap:10}}>
                    <Sel label="Código do Serviço (LC 116)" required
                      value={form.codigoServico} onChange={(e:any)=>set('codigoServico',e.target.value)}>
                      {CODIGOS_SERVICO.map(c=><option key={c.v} value={c.v}>{c.l}</option>)}
                    </Sel>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:'#6B7280',
                        textTransform:'uppercase',display:'block',marginBottom:3}}>
                        Discriminação do Serviço *
                      </label>
                      <textarea required value={form.descricaoServico}
                        onChange={e=>set('descricaoServico',e.target.value)}
                        rows={3} placeholder="Descreva detalhadamente o serviço prestado"
                        style={{width:'100%',border:'0.5px solid #E5E7EB',borderRadius:6,
                          padding:'7px 10px',fontSize:13,outline:'none',resize:'vertical',
                          boxSizing:'border-box'}}/>
                    </div>
                  </div>
                </div>

                {/* Valores */}
                <div style={{borderTop:'0.5px solid #E5E7EB',paddingTop:14}}>
                  <div style={{fontSize:12,fontWeight:700,color:'#374151',marginBottom:10}}>
                    Valores
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                    <Inp label="Valor do Serviço (R$)" required type="number"
                      step="0.01" min="0.01"
                      value={form.valorServico} onChange={(e:any)=>set('valorServico',e.target.value)}/>
                    <Inp label="Deduções (R$)" type="number" step="0.01"
                      value={form.valorDeducoes} onChange={(e:any)=>set('valorDeducoes',e.target.value)}/>
                    <Inp label="Alíquota ISS (%)" type="number" step="0.01" min="0"
                      value={form.aliquotaIss} onChange={(e:any)=>set('aliquotaIss',e.target.value)}/>
                  </div>
                  <div style={{marginTop:10}}>
                    <label style={{display:'flex',alignItems:'center',gap:8,
                      fontSize:13,cursor:'pointer'}}>
                      <input type="checkbox" checked={form.issRetido}
                        onChange={e=>set('issRetido',e.target.checked)}/>
                      ISS Retido pelo Tomador
                    </label>
                  </div>

                  {/* Preview de valores */}
                  {Number(form.valorServico)>0&&(
                    <div style={{marginTop:12,background:'#F9FAFB',borderRadius:8,
                      padding:'12px 16px',fontSize:13}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8}}>
                        {[
                          {l:'Base de Cálculo',v:fmtBRL(vBC),c:'#374151'},
                          {l:'ISS '+(form.issRetido?'(retido)':''),v:fmtBRL(vISS),c:'#F97316'},
                          {l:'Valor Líquido',v:fmtBRL(vLiquido),c:'#15803D'},
                          {l:'Alíquota',v:form.aliquotaIss+'%',c:'#6B7280'},
                        ].map(x=>(
                          <div key={x.l}>
                            <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600}}>{x.l}</div>
                            <div style={{fontSize:14,fontWeight:700,color:x.c}}>{x.v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading||!form.certId||!form.valorServico}
                  style={{padding:'12px',borderRadius:10,border:'none',background:AC,
                    color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',
                    opacity:loading||!form.certId||!form.valorServico?0.6:1}}>
                  {loading?'Emitindo...':'⚡ Emitir NFS-e Nacional'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Aba Historico */}
        {tab==='historico'&&(
          <div>
            {historico.length===0?(
              <div style={{textAlign:'center',padding:60,color:'#9CA3AF'}}>
                <div style={{fontSize:32,marginBottom:8}}>📋</div>
                <div style={{fontWeight:600}}>Nenhuma NFS-e emitida ainda</div>
              </div>
            ):(
              <table style={{width:'100%',borderCollapse:'collapse',background:'#fff',
                borderRadius:12,overflow:'hidden',border:'0.5px solid #E5E7EB'}}>
                <thead><tr>
                  {['RPS','Emissão','Tomador','Serviço','Valor','ISS','Status','Ações'].map(h=>(
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{historico.map((h:any)=>{
                  const sb=STATUS_BADGE[h.status]??STATUS_BADGE.RASCUNHO;
                  return(
                    <tr key={h.id}>
                      <td style={td}>
                        <b>{h.serieRps}/{h.numeroRps}</b>
                        {h.numeroNfse&&<div style={{fontSize:10,color:'#6C63FF'}}>NFS-e: {h.numeroNfse}</div>}
                      </td>
                      <td style={td}>{fmtDate(h.dataEmissao)}<br/>
                        <span style={{fontSize:10,color:'#9CA3AF'}}>{h.competencia}</span>
                      </td>
                      <td style={td}>
                        <div style={{fontWeight:500}}>{h.tomadorNome}</div>
                        {h.tomadorCnpj&&<div style={{fontSize:10,color:'#9CA3AF',fontFamily:'monospace'}}>
                          {fmtCNPJ(h.tomadorCnpj)}
                        </div>}
                      </td>
                      <td style={{...td,maxWidth:180,overflow:'hidden',
                        textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        <div style={{fontSize:11,color:'#6B7280'}}>{h.codigoServico}</div>
                        <div style={{fontSize:11}}>{h.descricaoServico?.slice(0,60)}</div>
                      </td>
                      <td style={{...td,fontFamily:'monospace',textAlign:'right' as const}}>
                        {fmtBRL(h.valorServico)}
                      </td>
                      <td style={{...td,fontFamily:'monospace',textAlign:'right' as const,
                        color:h.issRetido?'#F97316':'#374151'}}>
                        {fmtBRL(h.valorIss)}
                        {h.issRetido&&<div style={{fontSize:9,color:'#F97316'}}>retido</div>}
                      </td>
                      <td style={td}>
                        <span style={{fontSize:10,padding:'2px 7px',borderRadius:20,
                          fontWeight:600,background:sb.bg,color:sb.c}}>{sb.l}</span>
                        {h.motivoRejeicao&&(
                          <div style={{fontSize:10,color:'#DC2626',marginTop:2,maxWidth:120,
                            overflow:'hidden',textOverflow:'ellipsis'}}>
                            {h.motivoRejeicao.slice(0,60)}
                          </div>
                        )}
                      </td>
                      <td style={td}>
                        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                          {(h.status==='REJEITADA'||h.status==='ASSINADA')&&(
                            <button onClick={()=>reenviar(h.id)}
                              style={{padding:'3px 8px',borderRadius:5,border:'none',
                                background:'#6C63FF',color:'#fff',cursor:'pointer',fontSize:10}}>
                              ↺ Reenviar
                            </button>
                          )}
                          {h.status==='AUTORIZADA'&&(
                            <button onClick={()=>cancelar(h.id)}
                              style={{padding:'3px 8px',borderRadius:5,border:'1px solid #FCA5A5',
                                background:'#FEF2F2',color:'#DC2626',cursor:'pointer',fontSize:10}}>
                              ✕ Cancelar
                            </button>
                          )}
                          {h.chaveNfse&&(
                            <span style={{fontSize:9,color:'#9CA3AF',display:'block',
                              fontFamily:'monospace',marginTop:2}}>
                              {h.chaveNfse.slice(0,15)}...
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default NfseNacionalPage;
