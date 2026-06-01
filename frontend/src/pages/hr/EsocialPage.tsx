// frontend/src/pages/hr/EsocialPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import api from "@/services/api";
import Swal from "sweetalert2";

const AC = "#0369A1";
const MOTIVOS: Record<string, string> = {
  "01":"01 - Rescisao sem justa causa","02":"02 - Rescisao por justa causa",
  "03":"03 - Pedido de demissao","04":"04 - Termino do contrato",
  "10":"10 - Morte","11":"11 - Aposentadoria",
};
function fmtBRL(v: any) { return Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function fmtDate(s: any) { if(!s) return "-"; const p=String(s).split("T")[0].split("-"); return p[2]+"/"+p[1]+"/"+p[0]; }
async function dlXml(data: string, name: string) {
  const b=new Blob([data],{type:"application/xml"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");
  a.href=u; a.download=name; a.click(); URL.revokeObjectURL(u);
}

export default function EsocialPage() {
  const [emps, setEmps]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel]         = useState<any>(null);
  const [modal, setModal]     = useState<"s2205"|"s2299"|"s1200"|null>(null);
  const [s2205, setS2205] = useState({dtAlteracao:"",novaFuncao:"",novoSalario:"",cargaHoraria:""});
  const [s2299, setS2299] = useState({dtDeslig:"",mtvDeslig:"01",pensao:false});
  const [s1200, setS1200] = useState({perApur:new Date().toISOString().slice(0,7),vrBcCp:""});

  const load = useCallback(async()=>{
    setLoading(true);
    try { const {data}=await api.get("/hr/esocial/eventos"); setEmps(data); }
    catch{} finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  async function getXml(url: string, method="GET", body?: any) {
    const cfg: any = {responseType:"text"};
    if(method==="GET") return (await api.get(url,cfg)).data;
    return (await api.post(url,body,cfg)).data;
  }

  async function dl2200(e: any) {
    try { dlXml(await getXml("/hr/esocial/s2200/"+e.id),`S-2200-${e.fullName.replace(/\s+/g,"-")}.xml`); }
    catch { Swal.fire("Erro","Falha S-2200","error"); }
  }
  async function dl2205() {
    if(!sel||!s2205.dtAlteracao) return;
    try {
      const b: any={dtAlteracao:s2205.dtAlteracao};
      if(s2205.novaFuncao) b.novaFuncao=s2205.novaFuncao;
      if(s2205.novoSalario) b.novoSalario=parseFloat(s2205.novoSalario.replace(",","."));
      if(s2205.cargaHoraria) b.novaCargaHoraria=parseFloat(s2205.cargaHoraria);
      dlXml(await getXml("/hr/esocial/s2205/"+sel.id,"POST",b),`S-2205-${sel.fullName.replace(/\s+/g,"-")}.xml`);
      setModal(null);
    } catch { Swal.fire("Erro","Falha S-2205","error"); }
  }
  async function dl2299() {
    if(!sel||!s2299.dtDeslig) return;
    try {
      dlXml(await getXml("/hr/esocial/s2299/"+sel.id,"POST",s2299),`S-2299-${sel.fullName.replace(/\s+/g,"-")}.xml`);
      setModal(null);
    } catch { Swal.fire("Erro","Falha S-2299","error"); }
  }
  async function dl1200() {
    if(!sel||!s1200.perApur||!s1200.vrBcCp) return;
    try {
      const b={perApur:s1200.perApur,vrBcCpMensal:parseFloat(s1200.vrBcCp.replace(",","."))};
      dlXml(await getXml("/hr/esocial/s1200/"+sel.id,"POST",b),`S-1200-${sel.fullName.replace(/\s+/g,"-")}-${s1200.perApur}.xml`);
      setModal(null);
    } catch { Swal.fire("Erro","Falha S-1200","error"); }
  }

  const S = {
    th:{padding:"8px 12px",fontSize:11,fontWeight:600 as const,color:"#6B7280",textTransform:"uppercase" as const,background:"#F9FAFB",borderBottom:"0.5px solid #E5E7EB",textAlign:"left" as const},
    td:{padding:"10px 12px",fontSize:13,color:"#374151",borderBottom:"0.5px solid #F5F5F5"},
    inp:{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"6px 10px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box" as const},
    lbl:{fontSize:11,fontWeight:600 as const,color:"#6B7280",textTransform:"uppercase" as const,marginBottom:4,display:"block" as const},
    btn:(c:string)=>({fontSize:11,padding:"3px 10px",borderRadius:6,border:"none",background:c,color:"#fff",cursor:"pointer" as const,marginRight:4}),
  };
  const ov={position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000};
  const cd={background:"#fff",borderRadius:14,width:480,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.15)"};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{background:"#fff",borderBottom:"0.5px solid #E5E7EB",padding:"14px 24px",flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600,color:AC}}>&#9670; RH</span>
        <h1 style={{fontSize:18,fontWeight:600,color:"#111",margin:"2px 0 0"}}>Eventos eSocial</h1>
        <p style={{fontSize:12,color:"#9CA3AF",margin:"4px 0 0"}}>Gere os XMLs S-2200, S-2205, S-1200 e S-2299 por funcionario</p>
      </div>
      <div style={{flex:1,overflow:"auto",padding:"16px 24px"}}>
        {loading ? <div style={{textAlign:"center",padding:60,color:"#9CA3AF"}}>Carregando...</div> : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Funcionario","CPF","Funcao","Admissao","Salario","S-2200","S-2205","S-1200","S-2299"].map(h=>(
              <th key={h} style={S.th}>{h}</th>
            ))}</tr></thead>
            <tbody>{emps.map(e=>(
              <tr key={e.id}>
                <td style={S.td}><div style={{fontWeight:500}}>{e.fullName}</div></td>
                <td style={{...S.td,fontFamily:"monospace",fontSize:12}}>{e.taxId?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4")}</td>
                <td style={S.td}>{e.role}</td>
                <td style={S.td}>{fmtDate(e.hireDate)}</td>
                <td style={{...S.td,fontFamily:"monospace"}}>{fmtBRL(e.salary)}</td>
                <td style={S.td}><button style={S.btn("#15803D")} onClick={()=>dl2200(e)}>XML</button></td>
                <td style={S.td}><button style={S.btn("#0369A1")} onClick={()=>{setSel(e);setModal("s2205");}}>XML</button></td>
                <td style={S.td}><button style={S.btn("#7C3AED")} onClick={()=>{setSel(e);setS1200(s=>({...s,vrBcCp:String(e.salary)}));setModal("s1200");}}>XML</button></td>
                <td style={S.td}><button style={S.btn("#B91C1C")} onClick={()=>{setSel(e);setModal("s2299");}}>XML</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {modal==="s2205"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2205 - Alteracao Contratual</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Data da Alteracao *</label><input type="date" value={s2205.dtAlteracao} onChange={e=>setS2205(d=>({...d,dtAlteracao:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Nova Funcao</label><input value={s2205.novaFuncao} onChange={e=>setS2205(d=>({...d,novaFuncao:e.target.value}))} style={S.inp} placeholder="Vazio = sem alteracao"/></div>
            <div><label style={S.lbl}>Novo Salario</label><input value={s2205.novoSalario} onChange={e=>setS2205(d=>({...d,novoSalario:e.target.value}))} style={S.inp} placeholder="0,00"/></div>
            <div><label style={S.lbl}>Nova Carga Horaria</label><input value={s2205.cargaHoraria} onChange={e=>setS2205(d=>({...d,cargaHoraria:e.target.value}))} style={S.inp} placeholder="44"/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={dl2205} disabled={!s2205.dtAlteracao} style={{padding:"8px 18px",borderRadius:8,border:"none",background:AC,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
          </div>
        </div></div>
      )}

      {modal==="s2299"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2299 - Desligamento</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Data do Desligamento *</label><input type="date" value={s2299.dtDeslig} onChange={e=>setS2299(d=>({...d,dtDeslig:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Motivo *</label>
              <select value={s2299.mtvDeslig} onChange={e=>setS2299(d=>({...d,mtvDeslig:e.target.value}))} style={S.inp}>
                {Object.entries(MOTIVOS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="checkbox" checked={s2299.pensao} onChange={e=>setS2299(d=>({...d,pensao:e.target.checked}))} id="pensao"/>
              <label htmlFor="pensao" style={{fontSize:13}}>Pensao Alimenticia</label>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={dl2299} disabled={!s2299.dtDeslig} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#B91C1C",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
          </div>
        </div></div>
      )}

      {modal==="s1200"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-1200 - Remuneracao Mensal</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName} - {fmtBRL(sel.salary)}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Periodo de Apuracao *</label><input type="month" value={s1200.perApur} onChange={e=>setS1200(d=>({...d,perApur:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Base INSS *</label><input value={s1200.vrBcCp} onChange={e=>setS1200(d=>({...d,vrBcCp:e.target.value}))} style={S.inp} placeholder="0,00"/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={dl1200} disabled={!s1200.perApur||!s1200.vrBcCp} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#7C3AED",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
