// frontend/src/pages/hr/EmployeeDetailPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/services/api";

const AC = "#0891B2";
function fmtDate(s: any) { if(!s) return "—"; const p=String(s).split("T")[0].split("-"); return p[2]+"/"+p[1]+"/"+p[0]; }
function fmtBRL(v: any) { return Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtMin(m: number) { const h=Math.floor(Math.abs(m)/60); const min=Math.abs(m)%60; return (m<0?"-":"")+h+"h"+(min>0?min+"min":""); }

const TIPOS_HIST = ["PROMOCAO","REAJUSTE_SALARIAL","MUDANCA_FUNCAO","MUDANCA_SETOR","MUDANCA_CARGA_HORARIA","DISSIDIO","OUTROS"];
const TIPOS_OCO  = ["ADVERTENCIA_VERBAL","ADVERTENCIA_ESCRITA","SUSPENSAO","ELOGIO","FALTA_INJUSTIFICADA","ATRASO_REITERADO","OUTROS"];
const TIPOS_AFAS = ["FERIAS","LICENCA_MEDICA","LICENCA_MATERNIDADE","LICENCA_PATERNIDADE","ACIDENTE_TRABALHO","LICENCA_NAOREL","SUSPENSAO_DISCIPLINAR","OUTROS"];

type Tab = "dados"|"historico"|"ocorrencias"|"afastamentos"|"banco";

export default function EmployeeDetailPage() {
  const { id } = useParams<{id:string}>();
  const nav = useNavigate();
  const [emp, setEmp]   = useState<any>(null);
  const [tab, setTab]   = useState<Tab>("dados");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  // Modais
  const [showEdit, setShowEdit]   = useState(false);
  const [showHist, setShowHist]   = useState(false);
  const [showOco, setShowOco]     = useState(false);
  const [showAfas, setShowAfas]   = useState(false);
  const [showBH, setShowBH]       = useState(false);
  const [showRescisao, setShowRescisao] = useState(false);
  const [rescisaoDto, setRescisaoDto] = useState({motivo:"SEM_JUSTA_CAUSA",tipoAvisoPrevio:"INDENIZADO",dataAviso:"",dataAfastamento:"",feriasVencidas:false,feriasVencidasDobro:false,saldoFgtsContaInformado:"",outrosProventos:"",outrosDescontos:"",observacao:""});
  const [rescisaoPreview, setRescisaoPreview] = useState<any>(null);
  const [calculando, setCalculando] = useState(false);

  // Formularios
  const [editDto, setEditDto]   = useState<any>({});
  const [histDto, setHistDto]   = useState({tipo:"REAJUSTE_SALARIAL",dataAlteracao:"",funcaoNova:"",salarioNovo:"",percentualReajuste:"",setorNovo:"",motivo:"",observacao:""});
  const [ocoDto, setOcoDto]     = useState({tipo:"ADVERTENCIA_VERBAL",data:"",motivo:"",descricao:"",testemunha:"",diasSuspensao:""});
  const [afasDto, setAfasDto]   = useState({tipo:"FERIAS",dataInicio:"",dataFim:"",diasTotal:"",cid:"",beneficioINSS:false,nrBeneficioINSS:"",observacao:""});
  const [bhDto, setBhDto]       = useState({tipo:"CREDITO",data:"",minutos:"",competencia:new Date().toISOString().slice(0,7),descricao:""});

  const load = useCallback(async()=>{
    setLoading(true);
    try { const {data}=await api.get("/hr/employees/"+id); setEmp(data); setEditDto({...data}); }
    catch{} finally{setLoading(false);}
  },[id]);

  useEffect(()=>{load();},[load]);

  const S = {
    th:{padding:"8px 12px",fontSize:11,fontWeight:600 as const,color:"#6B7280",textTransform:"uppercase" as const,background:"#F9FAFB",borderBottom:"0.5px solid #E5E7EB",textAlign:"left" as const},
    td:{padding:"10px 12px",fontSize:13,color:"#374151",borderBottom:"0.5px solid #F5F5F5"},
    inp:{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"6px 10px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box" as const},
    lbl:{fontSize:11,fontWeight:600 as const,color:"#6B7280",textTransform:"uppercase" as const,marginBottom:4,display:"block" as const},
    btn:(bg:string,col="#fff")=>({padding:"7px 16px",borderRadius:8,border:"none",background:bg,color:col,cursor:"pointer" as const,fontSize:13,fontWeight:500 as const}),
    row:{display:"grid" as const,gridTemplateColumns:"1fr 1fr",gap:12},
  };
  const ov={position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000};
  const cd=(w=520)=>({background:"#fff",borderRadius:14,width:w,maxHeight:"90vh",overflowY:"auto" as const,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.15)"});

  async function saveEdit() {
    setSaving(true);
    try { await api.put("/hr/employees/"+id, editDto); setShowEdit(false); load(); }
    catch(e:any){ alert(e?.response?.data?.message??"Erro"); } finally{setSaving(false);}
  }

  async function saveHist() {
    setSaving(true);
    try { await api.post("/hr/employees/"+id+"/historico", histDto); setShowHist(false); load(); }
    catch(e:any){ alert(e?.response?.data?.message??"Erro"); } finally{setSaving(false);}
  }

  async function saveOco() {
    setSaving(true);
    try { await api.post("/hr/employees/"+id+"/ocorrencias", ocoDto); setShowOco(false); load(); }
    catch(e:any){ alert(e?.response?.data?.message??"Erro"); } finally{setSaving(false);}
  }

  async function saveAfas() {
    setSaving(true);
    try { await api.post("/hr/employees/"+id+"/afastamentos", afasDto); setShowAfas(false); load(); }
    catch(e:any){ alert(e?.response?.data?.message??"Erro"); } finally{setSaving(false);}
  }

  async function saveBH() {
    setSaving(true);
    try { await api.post("/hr/employees/"+id+"/banco-horas", {...bhDto,minutos:parseInt(bhDto.minutos)}); setShowBH(false); load(); }
    catch(e:any){ alert(e?.response?.data?.message??"Erro"); } finally{setSaving(false);}
  }

  async function calcularRescisao() {
    setCalculando(true);
    try {
      const {data} = await api.post("/hr/employees/"+id+"/rescisao/calcular", {
        ...rescisaoDto,
        saldoFgtsContaInformado: parseFloat(rescisaoDto.saldoFgtsContaInformado)||0,
        outrosProventos: parseFloat(rescisaoDto.outrosProventos)||0,
        outrosDescontos: parseFloat(rescisaoDto.outrosDescontos)||0,
      });
      setRescisaoPreview(data);
    } catch(e:any){ alert(e?.response?.data?.message??"Erro ao calcular rescisao"); }
    finally{ setCalculando(false); }
  }

  async function confirmarRescisao() {
    if(!window.confirm("ATENCAO: Esta acao registrara a rescisao definitivamente e alterara o status do funcionario para DESLIGADO. Confirmar?")) return;
    setSaving(true);
    try {
      await api.post("/hr/employees/"+id+"/rescisao", {
        ...rescisaoDto,
        saldoFgtsContaInformado: parseFloat(rescisaoDto.saldoFgtsContaInformado)||0,
        outrosProventos: parseFloat(rescisaoDto.outrosProventos)||0,
        outrosDescontos: parseFloat(rescisaoDto.outrosDescontos)||0,
      });
      setShowRescisao(false); setRescisaoPreview(null);
      alert("Rescisao registrada! Funcionario desligado.");
      load();
    } catch(e:any){ alert(e?.response?.data?.message??"Erro ao confirmar rescisao"); }
    finally{ setSaving(false); }
  }

  if(loading) return <div style={{padding:60,textAlign:"center",color:"#9CA3AF"}}>Carregando...</div>;
  if(!emp)    return <div style={{padding:60,textAlign:"center",color:"#EF4444"}}>Funcionario nao encontrado.</div>;

  const bh = emp.bancoHoras;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{background:"#fff",borderBottom:"0.5px solid #E5E7EB",padding:"14px 24px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <button onClick={()=>nav("/app/hr/employees")} style={{background:"none",border:"none",color:AC,cursor:"pointer",fontSize:12,padding:0,marginBottom:6}}>
              ← Funcionarios
            </button>
            <h1 style={{fontSize:20,fontWeight:700,margin:0}}>{emp.fullName}</h1>
            <div style={{fontSize:13,color:"#6B7280",marginTop:2}}>{emp.role} · Admissao: {fmtDate(emp.hireDate)} · {fmtBRL(emp.salary)}/mes</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowEdit(true)} style={S.btn(AC)}>Editar</button>
            <button onClick={()=>setShowHist(true)} style={S.btn("#7C3AED")}>+ Alteracao Contratual</button>
            {emp.status==="active"&&<button onClick={()=>{setRescisaoPreview(null);setShowRescisao(true);}} style={{...S.btn("#DC2626"),display:"flex",alignItems:"center",gap:6}}><span>&#9888;</span> Rescindir Contrato</button>}
            {emp.status==="terminated"&&<span style={{fontSize:12,padding:"6px 12px",borderRadius:8,background:"#FEE2E2",color:"#B91C1C",fontWeight:600}}>&#9940; Desligado em {fmtDate(emp.terminationDate)}</span>}
          </div>
        </div>
        {/* Tabs */}
        <div style={{display:"flex",gap:0,marginTop:12}}>
          {(["dados","historico","ocorrencias","afastamentos","banco"] as Tab[]).map(t=>{
            const labels:Record<Tab,string>={dados:"Dados",historico:"Historico",ocorrencias:"Ocorrencias",afastamentos:"Afastamentos",banco:"Banco de Horas"};
            return <div key={t} onClick={()=>setTab(t)} style={{padding:"10px 18px",fontSize:13,cursor:"pointer",borderBottom:tab===t?`2px solid ${AC}`:"2px solid transparent",color:tab===t?AC:"#6B7280",fontWeight:tab===t?600:400}}>{labels[t]}</div>;
          })}
        </div>
      </div>

      {/* Conteudo */}
      <div style={{flex:1,overflow:"auto",padding:"20px 24px"}}>

        {/* Dados */}
        {tab==="dados" && (
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {[
              {label:"CPF",value:emp.taxId?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4")},
              {label:"PIS",value:emp.pisNumber},
              {label:"RG",value:emp.rgNumber},
              {label:"Data Nascimento",value:fmtDate(emp.birthDate)},
              {label:"Mae",value:emp.motherName},
              {label:"Estado Civil",value:emp.maritalStatus},
              {label:"Telefone",value:emp.phone||emp.cellPhone},
              {label:"Endereco",value:emp.street?(emp.street+", "+emp.number+" - "+emp.city+"/"+emp.addressState):"—"},
              {label:"CTPS",value:emp.ctpsNumber?(emp.ctpsNumber+" S:"+emp.ctpsSeries):"—"},
              {label:"Vinculo",value:emp.employmentBond},
              {label:"Carga Horaria",value:emp.weeklyHours?emp.weeklyHours+"h/sem":"—"},
              {label:"Setor",value:emp.department||emp.lotacao||"—"},
              {label:"Status",value:emp.status==="active"?"Ativo":"Inativo"},
              {label:"Desligamento",value:fmtDate(emp.terminationDate)},
            ].map(f=>(
              <div key={f.label} style={{background:"#fff",borderRadius:10,padding:"12px 16px",border:"0.5px solid #E5E7EB"}}>
                <div style={{fontSize:10,color:"#9CA3AF",textTransform:"uppercase",marginBottom:4}}>{f.label}</div>
                <div style={{fontSize:14,fontWeight:500,color:"#111"}}>{f.value||"—"}</div>
              </div>
            ))}
          </div>
        )}

        {/* Historico */}
        {tab==="historico" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <button onClick={()=>setShowHist(true)} style={S.btn(AC)}>+ Registrar Alteracao</button>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:10,overflow:"hidden",border:"0.5px solid #E5E7EB"}}>
              <thead><tr>{["Data","Tipo","Funcao Anterior","Funcao Nova","Salario Anterior","Salario Novo","Reajuste","Motivo"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{(emp.contratoHistorico??[]).map((h:any)=>(
                <tr key={h.id}>
                  <td style={S.td}>{fmtDate(h.dataAlteracao)}</td>
                  <td style={S.td}>{h.tipo}</td>
                  <td style={S.td}>{h.funcaoAnterior||"—"}</td>
                  <td style={S.td}>{h.funcaoNova||"—"}</td>
                  <td style={{...S.td,fontFamily:"monospace"}}>{h.salarioAnterior?fmtBRL(h.salarioAnterior):"—"}</td>
                  <td style={{...S.td,fontFamily:"monospace",color:"#15803D"}}>{h.salarioNovo?fmtBRL(h.salarioNovo):"—"}</td>
                  <td style={S.td}>{h.percentualReajuste?(Number(h.percentualReajuste)*100).toFixed(2)+"%":"—"}</td>
                  <td style={S.td}>{h.motivo||"—"}</td>
                </tr>
              ))}
              {(emp.contratoHistorico??[]).length===0&&<tr><td colSpan={8} style={{...S.td,textAlign:"center",color:"#9CA3AF",padding:40}}>Nenhum historico registrado.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Ocorrencias */}
        {tab==="ocorrencias" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <button onClick={()=>setShowOco(true)} style={S.btn("#B91C1C")}>+ Registrar Ocorrencia</button>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:10,overflow:"hidden",border:"0.5px solid #E5E7EB"}}>
              <thead><tr>{["Data","Tipo","Motivo","Descricao","Testemunha","Dias Susp."].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{(emp.ocorrencias??[]).map((o:any)=>(
                <tr key={o.id}>
                  <td style={S.td}>{fmtDate(o.data)}</td>
                  <td style={S.td}><span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:o.tipo.includes("ADVERTENCIA")?"#FEE2E2":o.tipo==="ELOGIO"?"#DCFCE7":"#FEF3C7",color:o.tipo.includes("ADVERTENCIA")?"#B91C1C":o.tipo==="ELOGIO"?"#15803D":"#92400E"}}>{o.tipo}</span></td>
                  <td style={S.td}>{o.motivo}</td>
                  <td style={S.td}>{o.descricao||"—"}</td>
                  <td style={S.td}>{o.testemunha||"—"}</td>
                  <td style={S.td}>{o.diasSuspensao||"—"}</td>
                </tr>
              ))}
              {(emp.ocorrencias??[]).length===0&&<tr><td colSpan={6} style={{...S.td,textAlign:"center",color:"#9CA3AF",padding:40}}>Nenhuma ocorrencia registrada.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Afastamentos */}
        {tab==="afastamentos" && (
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
              <button onClick={()=>setShowAfas(true)} style={S.btn("#EA580C")}>+ Registrar Afastamento</button>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:10,overflow:"hidden",border:"0.5px solid #E5E7EB"}}>
              <thead><tr>{["Tipo","Inicio","Fim","Dias","CID","INSS","Observacao"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{(emp.afastamentos??[]).map((a:any)=>(
                <tr key={a.id}>
                  <td style={S.td}>{a.tipo}</td>
                  <td style={S.td}>{fmtDate(a.dataInicio)}</td>
                  <td style={S.td}>{fmtDate(a.dataFim)}</td>
                  <td style={S.td}>{a.diasTotal||"—"}</td>
                  <td style={S.td}>{a.cid||"—"}</td>
                  <td style={S.td}>{a.beneficioINSS?"Sim":"Nao"}</td>
                  <td style={S.td}>{a.observacao||"—"}</td>
                </tr>
              ))}
              {(emp.afastamentos??[]).length===0&&<tr><td colSpan={7} style={{...S.td,textAlign:"center",color:"#9CA3AF",padding:40}}>Nenhum afastamento registrado.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Banco de Horas */}
        {tab==="banco" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={{background:"#fff",borderRadius:10,padding:"12px 20px",border:"0.5px solid #E5E7EB"}}>
                <div style={{fontSize:11,color:"#9CA3AF",textTransform:"uppercase"}}>Saldo Atual</div>
                <div style={{fontSize:24,fontWeight:700,color:bh&&bh.saldoMinutos>=0?"#15803D":"#B91C1C"}}>
                  {bh?fmtMin(bh.saldoMinutos):"0h"}
                </div>
              </div>
              <button onClick={()=>setShowBH(true)} style={S.btn(AC)}>+ Lancamento</button>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",background:"#fff",borderRadius:10,overflow:"hidden",border:"0.5px solid #E5E7EB"}}>
              <thead><tr>{["Data","Tipo","Minutos","Saldo Apos","Competencia","Descricao"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{(bh?.lancamentos??[]).map((l:any)=>(
                <tr key={l.id}>
                  <td style={S.td}>{fmtDate(l.data)}</td>
                  <td style={S.td}><span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:l.minutos>0?"#DCFCE7":"#FEE2E2",color:l.minutos>0?"#15803D":"#B91C1C"}}>{l.tipo}</span></td>
                  <td style={{...S.td,fontFamily:"monospace",color:l.minutos>0?"#15803D":"#B91C1C"}}>{fmtMin(l.minutos)}</td>
                  <td style={{...S.td,fontFamily:"monospace"}}>{fmtMin(l.saldoApos)}</td>
                  <td style={S.td}>{l.competencia}</td>
                  <td style={S.td}>{l.descricao||"—"}</td>
                </tr>
              ))}
              {!(bh?.lancamentos?.length)&&<tr><td colSpan={6} style={{...S.td,textAlign:"center",color:"#9CA3AF",padding:40}}>Nenhum lancamento no banco de horas.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Editar */}
      {showEdit && (
        <div style={ov}><div style={cd()}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 16px"}}>Editar Funcionario</h2>
          <div style={{display:"grid",gap:12}}>
            <div style={S.row}>
              <div><label style={S.lbl}>Nome Completo</label><input value={editDto.fullName||""} onChange={e=>setEditDto((d:any)=>({...d,fullName:e.target.value}))} style={S.inp}/></div>
              <div><label style={S.lbl}>Funcao</label><input value={editDto.role||""} onChange={e=>setEditDto((d:any)=>({...d,role:e.target.value}))} style={S.inp}/></div>
            </div>
            <div style={S.row}>
              <div><label style={S.lbl}>Salario</label><input value={editDto.salary||""} onChange={e=>setEditDto((d:any)=>({...d,salary:e.target.value}))} style={S.inp}/></div>
              <div><label style={S.lbl}>Carga Horaria Semanal</label><input value={editDto.weeklyHours||""} onChange={e=>setEditDto((d:any)=>({...d,weeklyHours:e.target.value}))} style={S.inp}/></div>
            </div>
            <div style={S.row}>
              <div><label style={S.lbl}>Setor/Departamento</label><input value={editDto.department||""} onChange={e=>setEditDto((d:any)=>({...d,department:e.target.value}))} style={S.inp}/></div>
              <div><label style={S.lbl}>Lotacao</label><input value={editDto.lotacao||""} onChange={e=>setEditDto((d:any)=>({...d,lotacao:e.target.value}))} style={S.inp}/></div>
            </div>
            <div style={S.row}>
              <div><label style={S.lbl}>Telefone</label><input value={editDto.phone||""} onChange={e=>setEditDto((d:any)=>({...d,phone:e.target.value}))} style={S.inp}/></div>
              <div><label style={S.lbl}>Celular</label><input value={editDto.cellPhone||""} onChange={e=>setEditDto((d:any)=>({...d,cellPhone:e.target.value}))} style={S.inp}/></div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setShowEdit(false)} style={S.btn("#fff","#374151")}>Cancelar</button>
            <button onClick={saveEdit} disabled={saving} style={S.btn(AC)}>{saving?"Salvando...":"Salvar"}</button>
          </div>
        </div></div>
      )}

      {/* Modal Historico */}
      {showHist && (
        <div style={ov}><div style={cd()}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 16px"}}>Alteracao Contratual</h2>
          <div style={{display:"grid",gap:12}}>
            <div style={S.row}>
              <div><label style={S.lbl}>Tipo *</label>
                <select value={histDto.tipo} onChange={e=>setHistDto(d=>({...d,tipo:e.target.value}))} style={S.inp}>
                  {TIPOS_HIST.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Data *</label><input type="date" value={histDto.dataAlteracao} onChange={e=>setHistDto(d=>({...d,dataAlteracao:e.target.value}))} style={S.inp}/></div>
            </div>
            <div style={S.row}>
              <div><label style={S.lbl}>Funcao Anterior</label><input value={histDto.funcaoNova} onChange={e=>setHistDto(d=>({...d,funcaoNova:e.target.value}))} style={S.inp} placeholder="Nova funcao"/></div>
              <div><label style={S.lbl}>Novo Salario</label><input value={histDto.salarioNovo} onChange={e=>setHistDto(d=>({...d,salarioNovo:e.target.value}))} style={S.inp} placeholder="0,00"/></div>
            </div>
            <div><label style={S.lbl}>% Reajuste</label><input value={histDto.percentualReajuste} onChange={e=>setHistDto(d=>({...d,percentualReajuste:e.target.value}))} style={S.inp} placeholder="5.5"/></div>
            <div><label style={S.lbl}>Motivo</label><input value={histDto.motivo} onChange={e=>setHistDto(d=>({...d,motivo:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Observacao</label><input value={histDto.observacao} onChange={e=>setHistDto(d=>({...d,observacao:e.target.value}))} style={S.inp}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setShowHist(false)} style={S.btn("#fff","#374151")}>Cancelar</button>
            <button onClick={saveHist} disabled={saving||!histDto.dataAlteracao} style={S.btn("#7C3AED")}>{saving?"Salvando...":"Registrar"}</button>
          </div>
        </div></div>
      )}

      {/* Modal Ocorrencia */}
      {showOco && (
        <div style={ov}><div style={cd()}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 16px"}}>Registrar Ocorrencia</h2>
          <div style={{display:"grid",gap:12}}>
            <div style={S.row}>
              <div><label style={S.lbl}>Tipo *</label>
                <select value={ocoDto.tipo} onChange={e=>setOcoDto(d=>({...d,tipo:e.target.value}))} style={S.inp}>
                  {TIPOS_OCO.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Data *</label><input type="date" value={ocoDto.data} onChange={e=>setOcoDto(d=>({...d,data:e.target.value}))} style={S.inp}/></div>
            </div>
            <div><label style={S.lbl}>Motivo *</label><input value={ocoDto.motivo} onChange={e=>setOcoDto(d=>({...d,motivo:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Descricao</label><textarea value={ocoDto.descricao} onChange={e=>setOcoDto(d=>({...d,descricao:e.target.value}))} style={{...S.inp,height:80,resize:"vertical" as const}}/></div>
            <div style={S.row}>
              <div><label style={S.lbl}>Testemunha</label><input value={ocoDto.testemunha} onChange={e=>setOcoDto(d=>({...d,testemunha:e.target.value}))} style={S.inp}/></div>
              <div><label style={S.lbl}>Dias Suspensao</label><input type="number" value={ocoDto.diasSuspensao} onChange={e=>setOcoDto(d=>({...d,diasSuspensao:e.target.value}))} style={S.inp}/></div>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setShowOco(false)} style={S.btn("#fff","#374151")}>Cancelar</button>
            <button onClick={saveOco} disabled={saving||!ocoDto.data||!ocoDto.motivo} style={S.btn("#B91C1C")}>{saving?"Salvando...":"Registrar"}</button>
          </div>
        </div></div>
      )}

      {/* Modal Afastamento */}
      {showAfas && (
        <div style={ov}><div style={cd()}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 16px"}}>Registrar Afastamento</h2>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Tipo *</label>
              <select value={afasDto.tipo} onChange={e=>setAfasDto(d=>({...d,tipo:e.target.value}))} style={S.inp}>
                {TIPOS_AFAS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={S.row}>
              <div><label style={S.lbl}>Data Inicio *</label><input type="date" value={afasDto.dataInicio} onChange={e=>setAfasDto(d=>({...d,dataInicio:e.target.value}))} style={S.inp}/></div>
              <div><label style={S.lbl}>Data Fim</label><input type="date" value={afasDto.dataFim} onChange={e=>setAfasDto(d=>({...d,dataFim:e.target.value}))} style={S.inp}/></div>
            </div>
            <div style={S.row}>
              <div><label style={S.lbl}>Dias Total</label><input type="number" value={afasDto.diasTotal} onChange={e=>setAfasDto(d=>({...d,diasTotal:e.target.value}))} style={S.inp}/></div>
              <div><label style={S.lbl}>CID</label><input value={afasDto.cid} onChange={e=>setAfasDto(d=>({...d,cid:e.target.value}))} style={S.inp} placeholder="Ex: M54.5"/></div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" checked={afasDto.beneficioINSS} onChange={e=>setAfasDto(d=>({...d,beneficioINSS:e.target.checked}))} id="binss"/>
              <label htmlFor="binss" style={{fontSize:13}}>Beneficio INSS</label>
            </div>
            {afasDto.beneficioINSS && <div><label style={S.lbl}>Nr Beneficio INSS</label><input value={afasDto.nrBeneficioINSS} onChange={e=>setAfasDto(d=>({...d,nrBeneficioINSS:e.target.value}))} style={S.inp}/></div>}
            <div><label style={S.lbl}>Observacao</label><input value={afasDto.observacao} onChange={e=>setAfasDto(d=>({...d,observacao:e.target.value}))} style={S.inp}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setShowAfas(false)} style={S.btn("#fff","#374151")}>Cancelar</button>
            <button onClick={saveAfas} disabled={saving||!afasDto.dataInicio} style={S.btn("#EA580C")}>{saving?"Salvando...":"Registrar"}</button>
          </div>
        </div></div>
      )}

      {/* Modal Banco de Horas */}
      {showBH && (
        <div style={ov}><div style={cd(420)}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 16px"}}>Lancamento Banco de Horas</h2>
          <div style={{display:"grid",gap:12}}>
            <div style={S.row}>
              <div><label style={S.lbl}>Tipo *</label>
                <select value={bhDto.tipo} onChange={e=>setBhDto(d=>({...d,tipo:e.target.value}))} style={S.inp}>
                  {["CREDITO","DEBITO","AJUSTE","EXPIRACAO"].map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Data *</label><input type="date" value={bhDto.data} onChange={e=>setBhDto(d=>({...d,data:e.target.value}))} style={S.inp}/></div>
            </div>
            <div style={S.row}>
              <div><label style={S.lbl}>Minutos *</label><input type="number" value={bhDto.minutos} onChange={e=>setBhDto(d=>({...d,minutos:e.target.value}))} style={S.inp} placeholder="Ex: 120 = 2h"/></div>
              <div><label style={S.lbl}>Competencia *</label><input type="month" value={bhDto.competencia} onChange={e=>setBhDto(d=>({...d,competencia:e.target.value}))} style={S.inp}/></div>
            </div>
            <div><label style={S.lbl}>Descricao</label><input value={bhDto.descricao} onChange={e=>setBhDto(d=>({...d,descricao:e.target.value}))} style={S.inp}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setShowBH(false)} style={S.btn("#fff","#374151")}>Cancelar</button>
            <button onClick={saveBH} disabled={saving||!bhDto.data||!bhDto.minutos} style={S.btn(AC)}>{saving?"Salvando...":"Lancar"}</button>
          </div>
        </div></div>
      )}
      {/* Modal Rescisao CLT */}
      {showRescisao && (
        <div style={ov}><div style={{background:"#fff",borderRadius:14,width:740,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
          {/* Header vermelho */}
          <div style={{background:"#DC2626",borderRadius:"14px 14px 0 0",padding:"16px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#fff"}}>&#9888; Rescisao de Contrato CLT — TRCT</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.85)",marginTop:3}}>{emp.fullName} &middot; Admissao: {fmtDate(emp.hireDate)} &middot; {fmtBRL(emp.salary)}/mes</div>
            </div>
            <button onClick={()=>{setShowRescisao(false);setRescisaoPreview(null);}} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",cursor:"pointer",fontSize:18,borderRadius:6,padding:"2px 8px",lineHeight:1}}>&#10005;</button>
          </div>

          <div style={{padding:24,display:"grid",gap:16}}>

            {/* Parametros */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={S.lbl}>Motivo da Rescisao *</label>
                <select value={rescisaoDto.motivo} onChange={e=>setRescisaoDto(d=>({...d,motivo:e.target.value}))} style={S.inp}>
                  <option value="SEM_JUSTA_CAUSA">Sem Justa Causa (Empregador)</option>
                  <option value="PEDIDO_DEMISSAO">Pedido de Demissao</option>
                  <option value="ACORDO_484A">Acordo Mutuo (Art. 484-A)</option>
                  <option value="JUSTA_CAUSA">Justa Causa</option>
                  <option value="TERMINO_CONTRATO_DETERMINADO">Termino Contrato Determinado</option>
                  <option value="RESCISAO_INDIRETA">Rescisao Indireta</option>
                </select>
              </div>
              <div>
                <label style={S.lbl}>Tipo de Aviso Previo *</label>
                <select value={rescisaoDto.tipoAvisoPrevio} onChange={e=>setRescisaoDto(d=>({...d,tipoAvisoPrevio:e.target.value}))} style={S.inp}>
                  <option value="INDENIZADO">Indenizado (nao vai trabalhar)</option>
                  <option value="TRABALHADO">Trabalhado (cumpre todos os dias)</option>
                  <option value="TRABALHADO_PARCIAL">Trabalhado parcial + indenizado (misto)</option>
                  <option value="DISPENSADO">Dispensado pelo empregador</option>
                  <option value="NAO_CUMPRIDO">Nao cumprido (desconto funcionario)</option>
                  <option value="NAO_SE_APLICA">Nao se aplica</option>
                </select>
              </div>
              <div>
                <label style={S.lbl}>Data do Comunicado do Aviso *</label>
                <input type="date" value={rescisaoDto.dataAviso} onChange={e=>setRescisaoDto(d=>({...d,dataAviso:e.target.value}))} style={S.inp}/>
              </div>
              <div>
                <label style={S.lbl}>Data de Afastamento (ultimo dia trabalhado) *</label>
                <input type="date" value={rescisaoDto.dataAfastamento} onChange={e=>setRescisaoDto(d=>({...d,dataAfastamento:e.target.value}))} style={S.inp}/>
              </div>
              <div>
                <label style={S.lbl}>Saldo FGTS Conta Vinculada (R$)</label>
                <input type="number" step="0.01" placeholder="0,00 — preencher apos extrato FGTS Digital" value={rescisaoDto.saldoFgtsContaInformado} onChange={e=>setRescisaoDto(d=>({...d,saldoFgtsContaInformado:e.target.value}))} style={S.inp}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",justifyContent:"center",gap:8,paddingTop:8}}>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13}}>
                  <input type="checkbox" checked={rescisaoDto.feriasVencidas} onChange={e=>setRescisaoDto(d=>({...d,feriasVencidas:e.target.checked}))}/>
                  Ha ferias vencidas (periodo anterior nao gozado)
                </label>
                {rescisaoDto.feriasVencidas && (
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"#B91C1C"}}>
                    <input type="checkbox" checked={rescisaoDto.feriasVencidasDobro} onChange={e=>setRescisaoDto(d=>({...d,feriasVencidasDobro:e.target.checked}))}/>
                    Em dobro (vencidas ha +12 meses — art. 137 CLT)
                  </label>
                )}
              </div>
            </div>

            {/* Extras */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr",gap:12}}>
              <div><label style={S.lbl}>Outros Proventos (R$)</label>
                <input type="number" step="0.01" value={rescisaoDto.outrosProventos} onChange={e=>setRescisaoDto(d=>({...d,outrosProventos:e.target.value}))} style={S.inp} placeholder="0,00"/></div>
              <div><label style={S.lbl}>Outros Descontos (R$)</label>
                <input type="number" step="0.01" value={rescisaoDto.outrosDescontos} onChange={e=>setRescisaoDto(d=>({...d,outrosDescontos:e.target.value}))} style={S.inp} placeholder="0,00"/></div>
              <div><label style={S.lbl}>Observacao</label>
                <input value={rescisaoDto.observacao} onChange={e=>setRescisaoDto(d=>({...d,observacao:e.target.value}))} style={S.inp} placeholder="Observacao geral sobre a rescisao"/></div>
            </div>

            {/* Botao calcular */}
            <div style={{display:"flex",justifyContent:"center"}}>
              <button onClick={calcularRescisao} disabled={calculando||!rescisaoDto.dataAviso||!rescisaoDto.dataAfastamento} style={{...S.btn("#0891B2"),padding:"10px 40px",fontSize:14,fontWeight:700,opacity:(calculando||!rescisaoDto.dataAviso||!rescisaoDto.dataAfastamento)?0.5:1}}>
                {calculando?"Calculando TRCT...":"Calcular TRCT"}
              </button>
            </div>

            {/* Preview TRCT */}
            {rescisaoPreview && (
              <div style={{border:"1px solid #E5E7EB",borderRadius:12,overflow:"hidden"}}>
                <div style={{background:"#F0F9FF",padding:"8px 16px",borderBottom:"1px solid #BAE6FD",fontSize:12,color:"#0369A1",display:"flex",gap:16}}>
                  <span>Aviso: <strong>{rescisaoPreview.parametros.diasAvisoPrevio}d total</strong>
                    {rescisaoPreview.parametros.diasAvisoTrabalhados>0&&<span style={{color:"#374151"}}> ({rescisaoPreview.parametros.diasAvisoTrabalhados}d trabalhados + {rescisaoPreview.parametros.diasAvisoIndenizados}d indenizados)</span>}
                  </span>
                  <span>Projecao fim: <strong>{fmtDate(rescisaoPreview.parametros.dataProjecaoFim)}</strong></span>
                  <span>Dep. IRRF: <strong>{rescisaoPreview.parametros.numDependentes}</strong></span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>

                  {/* Proventos */}
                  <div style={{borderRight:"1px solid #E5E7EB"}}>
                    <div style={{padding:"8px 14px",background:"#F9FAFB",fontSize:10,fontWeight:700,color:"#374151",textTransform:"uppercase" as const,borderBottom:"1px solid #E5E7EB",letterSpacing:0.5}}>Proventos</div>
                    {([
                      ["Saldo Salario ("+rescisaoPreview.proventos.saldoSalarioDias+"d)",rescisaoPreview.proventos.saldoSalarioValor,"#15803D"],
                      ["Aviso Previo Indenizado",rescisaoPreview.proventos.avisoPrevioValor,"#15803D"],
                      ["13o Prop. ("+rescisaoPreview.proventos.decimoTerceiroMeses+"/12)",rescisaoPreview.proventos.decimoTerceiroValor,"#15803D"],
                      ...(rescisaoPreview.proventos.feriasVencidas?[["Ferias Vencidas",rescisaoPreview.proventos.feriasVencidasValor,"#15803D"],["1/3 Ferias Vencidas",rescisaoPreview.proventos.feriasVencidasTerco,"#15803D"]]:[]),
                      ["Ferias Prop. ("+rescisaoPreview.proventos.feriasPropMeses+"/12)",rescisaoPreview.proventos.feriasPropValor,"#15803D"],
                      ["1/3 Ferias Proporcionais",rescisaoPreview.proventos.feriasPropTerco,"#15803D"],
                      ...(rescisaoPreview.proventos.outrosProventos>0?[["Outros Proventos",rescisaoPreview.proventos.outrosProventos,"#15803D"]]:[]),
                    ] as [string,number,string][]).map(([l,v,c])=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 14px",borderBottom:"0.5px solid #F5F5F5",fontSize:12}}>
                        <span style={{color:"#374151"}}>{l}</span><span style={{fontFamily:"monospace",color:c,fontWeight:v>0?600:400}}>{fmtBRL(v)}</span>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:"#F0FDF4",fontSize:13,fontWeight:700,borderTop:"1px solid #BBF7D0"}}>
                      <span>Total Proventos</span><span style={{fontFamily:"monospace",color:"#15803D"}}>{fmtBRL(rescisaoPreview.proventos.totalProventos)}</span>
                    </div>
                  </div>

                  {/* Descontos */}
                  <div style={{borderRight:"1px solid #E5E7EB"}}>
                    <div style={{padding:"8px 14px",background:"#F9FAFB",fontSize:10,fontWeight:700,color:"#374151",textTransform:"uppercase" as const,borderBottom:"1px solid #E5E7EB",letterSpacing:0.5}}>Descontos</div>
                    {([
                      ["INSS Remuneracao (base "+fmtBRL(rescisaoPreview.descontos.inssRemun.base)+")", rescisaoPreview.descontos.inssRemun.valor],
                      ["INSS 13º Salario (base "+fmtBRL(rescisaoPreview.descontos.inss13.base)+")", rescisaoPreview.descontos.inss13.valor],
                      ["IRRF Remuneracao (base "+fmtBRL(rescisaoPreview.descontos.irrfRemun.base)+")", rescisaoPreview.descontos.irrfRemun.valor],
                      ["IRRF 13º Salario (base "+fmtBRL(rescisaoPreview.descontos.irrf13.base)+")", rescisaoPreview.descontos.irrf13.valor],
                      ...(rescisaoPreview.descontos.outrosDescontos>0?[["Outros Descontos",rescisaoPreview.descontos.outrosDescontos]]:[]),
                    ] as [string,number][]).map(([l,v])=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 14px",borderBottom:"0.5px solid #F5F5F5",fontSize:12}}>
                        <span style={{color:"#374151"}}>{l}</span>
                        <span style={{fontFamily:"monospace",color:v>0?"#DC2626":"#9CA3AF",fontWeight:v>0?600:400}}>{v>0?fmtBRL(v):"isento"}</span>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:"#FFF1F2",fontSize:13,fontWeight:700,borderTop:"1px solid #FECDD3"}}>
                      <span>Total Descontos</span><span style={{fontFamily:"monospace",color:"#DC2626"}}>{fmtBRL(rescisaoPreview.descontos.totalDescontos)}</span>
                    </div>
                  </div>

                  {/* FGTS + Liquido */}
                  <div>
                    <div style={{padding:"8px 14px",background:"#F9FAFB",fontSize:10,fontWeight:700,color:"#374151",textTransform:"uppercase" as const,borderBottom:"1px solid #E5E7EB",letterSpacing:0.5}}>FGTS (Informativo)</div>
                    {([
                      ["Base calculo FGTS",rescisaoPreview.fgts.baseFgtsMes,"#B45309"],
                      ["Deposito mes (8%)",rescisaoPreview.fgts.fgtsSobreVerbas,"#B45309"],
                      ["Saldo conta vinculada",rescisaoPreview.fgts.saldoFgtsContaInformado,"#6B7280"],
                      ["Multa 40%",rescisaoPreview.fgts.multaFgtsValor,"#B45309"],
                    ] as [string,number,string][]).map(([l,v,c])=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 14px",borderBottom:"0.5px solid #F5F5F5",fontSize:12}}>
                        <span style={{color:"#374151"}}>{l}</span>
                        <span style={{fontFamily:"monospace",color:v>0?c:"#9CA3AF"}}>{v>0?fmtBRL(v):"informar saldo"}</span>
                      </div>
                    ))}
                    <div style={{padding:"8px 14px",background:"#F0F9FF",borderTop:"1px solid #BAE6FD",fontSize:10,fontWeight:700,color:"#0369A1",textTransform:"uppercase" as const,letterSpacing:0.5}}>Liquido TRCT a Pagar</div>
                    <div style={{display:"flex",justifyContent:"center",alignItems:"center",padding:"16px 14px",fontSize:24,fontWeight:800,color:"#0891B2",fontFamily:"monospace"}}>
                      {fmtBRL(rescisaoPreview.totalLiquido)}
                    </div>
                  </div>

                </div>
                <div style={{padding:"8px 16px",background:"#FFFBEB",borderTop:"1px solid #FDE68A",fontSize:11,color:"#92400E"}}>
                  &#9432; INSS e IRRF incidem apenas sobre Saldo de Salario e 13o. Ferias e Aviso Indenizado sao verbas indenizatorias — isentas. Multa FGTS sera calculada apos informar saldo da conta vinculada.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{padding:"12px 24px",borderTop:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#FAFAFA",borderRadius:"0 0 14px 14px"}}>
            <span style={{fontSize:12,color:"#9CA3AF"}}>Rescisao sem justa causa · Aviso indenizado · Lei 12.506/2011 · IRRF Lei 15.270/2025</span>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setShowRescisao(false);setRescisaoPreview(null);}} style={S.btn("#fff","#374151")}>Cancelar</button>
              {rescisaoPreview&&<button onClick={confirmarRescisao} disabled={saving} style={{...S.btn("#DC2626"),padding:"8px 24px",fontWeight:700}}>{saving?"Registrando...":"Confirmar Rescisao"}</button>}
            </div>
          </div>
        </div></div>
      )}

    </div>
  );
}
