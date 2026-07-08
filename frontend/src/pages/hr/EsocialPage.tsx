// frontend/src/pages/hr/EsocialPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import api from "@/services/api";
import Swal from "sweetalert2";
import { SmartDateInput } from "../../components/SmartDateInput";
import { SmartMonthInput } from "../../components/SmartMonthInput";

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
  const [modal, setModal]     = useState<"s2205"|"s2230"|"s2240"|"s2210"|"s1210"|"s2190"|"s1202"|"s2220"|"s2298"|"s2299"|"s1200"|null>(null);
  const [s2205, setS2205] = useState({dtAlteracao:"",novaFuncao:"",novoSalario:"",cargaHoraria:""});
  const [s2299, setS2299] = useState({dtDeslig:"",mtvDeslig:"01",pensao:false,tpAmb:"2"});
  const [s1200, setS1200] = useState({perApur:new Date().toISOString().slice(0,7),vrBcCp:""});
  const [s1299, setS1299] = useState({perApur:new Date().toISOString().slice(0,7),tpAmb:"2"});
  const [s2230, setS2230] = useState({dtIniAfast:"",codMotAfast:"17",dtTermAfast:"",tpAmb:"2"});
  const [s2240, setS2240] = useState({dscSetor:"",condAmb:"1",dscAtivDes:"",utilizEpc:"S",utilizEpi:"N",tpAmb:"2"});
  const [s2210, setS2210] = useState({dtAcid:"",hrAcid:"08:00",tpAcid:"1",tpCat:"1",dscLoc:"",codCID:"",dscLesao:"",descricao:"",dtAtend:"",nmMedico:"",nrOC:"",ufCRM:"PR",tpAmb:"2"});
  const [s1210, setS1210] = useState({perApur:new Date().toISOString().slice(0,7),dtPgto:"",tpPgto:"1",tpAmb:"2"});
  const [s2190, setS2190] = useState({dtAdm:"",codCateg:"01",tpContr:"1",tpAmb:"2"});
  const [s1202, setS1202] = useState({perApur:new Date().toISOString().slice(0,7),vrBcCp:"",codCateg:"701",tpAmb:"2"});
  const [s2220, setS2220] = useState({dtAso:"",resAso:"1",tpAso:"0",nmMedico:"",nrCRM:"",ufCRM:"PR",tpAmb:"2"});
  const [s1070, setS1070] = useState({tpProc:"1",nrProc:"",origem:"1",obsSusp:"",tpAmb:"2"});
  const [s2298, setS2298] = useState({dtReintegr:"",motivo:"1",tpAmb:"2"});
  const [s1299Status, setS1299Status] = useState<{nrRec?:string;status?:string;erro?:string}|null>(null);
  const [s1299Loading, setS1299Loading] = useState(false);

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
      const s2299body={...s2299,pensaoAlimenticia:s2299.pensao};
      dlXml(await getXml("/hr/esocial/s2299/"+sel.id,"POST",s2299body),`S-2299-${sel.fullName.replace(/\s+/g,"-")}.xml`);
      setModal(null);
    } catch { Swal.fire("Erro","Falha S-2299","error"); }
  }
  async function transmitirS1299() {
    if (!s1299.perApur) return;
    if (!confirm(s1299.tpAmb==="1"
      ? "ATENCAO: Transmissao em PRODUCAO REAL — S-1299 fecha o periodo "+s1299.perApur+". Continuar?"
      : "Transmitir S-1299 (Fechamento) para "+s1299.perApur+" em Producao Restrita?")) return;
    setS1299Loading(true); setS1299Status(null);
    try {
      const res = await api.post("/hr/esocial/transmitir/s1299", { perApur: s1299.perApur, tpAmb: s1299.tpAmb });
      const d = res.data;
      setS1299Status({ nrRec: d.nrRec, status: d.status,
        erro: d.erros ? JSON.stringify(d.erros).slice(0,120) : undefined });
    } catch(e:any) {
      setS1299Status({ status:"ERRO", erro: e?.response?.data?.message ?? e.message });
    } finally { setS1299Loading(false); }
  }

  async function transmitirS1200() {
    if(!sel||!s1200.perApur||!s1200.vrBcCp) return;
    try {
      const b={perApur:s1200.perApur,vrBcCp:s1200.vrBcCp,tpAmb:s2299.tpAmb};
      const res = await api.post("/hr/esocial/transmitir/s1200/"+sel.id, b);
      Swal.fire("S-1200 Transmitido","Recibo: "+(res.data.nrRec??"Pendente"),"success");
      setModal(null);
    } catch(e:any) { Swal.fire("Erro","Falha S-1200: "+(e?.response?.data?.message??e.message),"error"); }
  }

  async function dlS2230() {
    if(!sel||!s2230.dtIniAfast) return;
    try {
      const b={...s2230};
      dlXml(await getXml("/hr/esocial/s2230/"+sel.id,"POST",b),`S-2230-${sel.fullName.replace(/\s+/g,"-")}.xml`);
      setModal(null);
    } catch { Swal.fire("Erro","Falha S-2230","error"); }
  }

  async function transmitirS2230() {
    if(!sel||!s2230.dtIniAfast) return;
    if(!confirm("Transmitir S-2230 Afastamento de "+sel.fullName+"?")) return;
    try {
      const res = await api.post("/hr/esocial/transmitir/s2230/"+sel.id, s2230);
      Swal.fire("S-2230 Transmitido","Recibo: "+(res.data.nrRec??"Pendente"),"success");
      setModal(null);
    } catch(e:any) { Swal.fire("Erro","Falha S-2230: "+(e?.response?.data?.message??e.message),"error"); }
  }

  async function actEvent(tipo: string, url: string, body: any, setter: any) {
    if (!sel) return;
    try {
      if (tipo==="TX") {
        const res = await api.post(url+sel.id, body);
        Swal.fire("Transmitido","Recibo: "+(res.data.nrRec??"Pendente"),"success");
      } else {
        dlXml(await getXml(url+sel.id,"POST",body),`${tipo}-${sel.fullName.replace(/\s+/g,"-")}.xml`);
      }
      setModal(null);
    } catch(e:any) { Swal.fire("Erro",`Falha ${tipo}: `+(e?.response?.data?.message??e.message),"error"); }
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
        <p style={{fontSize:12,color:"#9CA3AF",margin:"4px 0 0"}}>Gere os XMLs S-2200, S-2205, S-1200, S-2299 e S-1299 (fechamento)</p>
      </div>
      <div style={{flex:1,overflow:"auto",padding:"16px 24px"}}>
        {/* ── S-1070 Processos Administrativos/Judiciais ─── */}
        <div style={{background:"#fff",border:"0.5px solid #E5E7EB",borderRadius:12,padding:"14px 20px",marginBottom:10,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap" as const}}>
          <div><div style={{fontSize:12,fontWeight:700,color:"#374151"}}>S-1070 — Processo Adm./Judicial</div></div>
          <select value={s1070.tpProc} onChange={e=>setS1070(d=>({...d,tpProc:e.target.value}))} style={{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"5px 8px",fontSize:12,outline:"none"}}>
            <option value="1">Administrativo</option>
            <option value="2">Judicial</option>
          </select>
          <input value={s1070.nrProc} onChange={e=>setS1070(d=>({...d,nrProc:e.target.value}))} placeholder="Numero do processo" style={{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"5px 10px",fontSize:12,outline:"none",width:200}}/>
          <input value={s1070.obsSusp} onChange={e=>setS1070(d=>({...d,obsSusp:e.target.value}))} placeholder="Descricao / objeto" style={{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"5px 10px",fontSize:12,outline:"none",flex:1}}/>
          <select value={s1070.tpAmb} onChange={e=>setS1070(d=>({...d,tpAmb:e.target.value}))} style={{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"5px 8px",fontSize:12,color:s1070.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600,outline:"none"}}>
            <option value="2">Prod. Restrita</option><option value="1">Producao Real</option>
          </select>
          <button onClick={()=>actEvent("S-1070","/hr/esocial/s1070",s1070,setS1070)} disabled={!s1070.nrProc} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#F59E0B",color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer"}}>Gerar XML</button>
          <button onClick={async()=>{if(!s1070.nrProc)return;try{const r=await api.post("/hr/esocial/transmitir/s1070",s1070);Swal.fire("S-1070","Recibo: "+(r.data.nrRec??"Pendente"),"success");}catch(e:any){Swal.fire("Erro",e?.response?.data?.message??"Falha S-1070","error");}}} disabled={!s1070.nrProc} style={{padding:"6px 12px",borderRadius:8,border:"none",background:s1070.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",fontWeight:600,fontSize:12,cursor:"pointer"}}>[TX] Transmitir</button>
        </div>

        {/* ── S-1299 Fechamento ─────────────────────────────────── */}
        <div style={{background:"#fff",border:"0.5px solid #E5E7EB",borderRadius:12,padding:"14px 20px",marginBottom:16,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap" as const}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:2}}>S-1299 — Fechamento de Eventos Periódicos</div>
            <div style={{fontSize:11,color:"#9CA3AF"}}>Transmita após todos os S-1200 do mês</div>
          </div>
          <SmartMonthInput value={s1299.perApur} onChange={v=>setS1299(d=>({...d,perApur:v}))}
            style={{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"5px 10px",fontSize:13}}/>
          <select value={s1299.tpAmb} onChange={e=>setS1299(d=>({...d,tpAmb:e.target.value}))}
            style={{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"5px 10px",fontSize:12,color:s1299.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600,outline:"none"}}>
            <option value="2">Prod. Restrita</option>
            <option value="1">Producao Real</option>
          </select>
          <button onClick={transmitirS1299} disabled={s1299Loading||!s1299.perApur}
            style={{padding:"6px 16px",borderRadius:8,border:"none",
              background:s1299.tpAmb==="1"?"#B91C1C":"#0369A1",
              color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer",opacity:s1299Loading?0.6:1}}>
            {s1299Loading?"Transmitindo...":"[TX] S-1299 Fechar Periodo"}
          </button>
          {s1299Status&&(
            <span style={{fontSize:11,padding:"4px 10px",borderRadius:6,fontWeight:600,
              background:s1299Status.status==="TRANSMITIDO"?"#DCFCE7":"#FEE2E2",
              color:s1299Status.status==="TRANSMITIDO"?"#15803D":"#B91C1C"}}>
              {s1299Status.status==="TRANSMITIDO"?"Recibo: "+s1299Status.nrRec:"ERRO: "+(s1299Status.erro??s1299Status.status)}
            </span>
          )}
        </div>

        {loading ? <div style={{textAlign:"center",padding:60,color:"#9CA3AF"}}>Carregando...</div> : (
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Funcionario","CPF","Funcao","Admissao","Salario","S-2200","S-2205","S-1200","S-2299","S-2230","S-2240","S-2210","S-1210","S-2190","S-1202","S-2220","S-2298"].map(h=>(
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
                <td style={S.td}><button style={S.btn("#0891B2")} onClick={()=>{setSel(e);setModal("s2230");}}>Afastar</button></td>
                <td style={S.td}><button style={S.btn("#0D9488")} onClick={()=>{setSel(e);setModal("s2240");}}>NR</button></td>
                <td style={S.td}><button style={S.btn("#DC2626")} onClick={()=>{setSel(e);setModal("s2210");}}>CAT</button></td>
                <td style={S.td}><button style={S.btn("#7C3AED")} onClick={()=>{setSel(e);setModal("s1210");}}>Pgto</button></td>
                <td style={S.td}><button style={S.btn("#15803D")} onClick={()=>{setSel(e);setModal("s2190");}}>Prelim</button></td>
                <td style={S.td}><button style={S.btn("#9333EA")} onClick={()=>{setSel(e);setModal("s1202");}}>Pro-lab</button></td>
                <td style={S.td}><button style={S.btn("#0891B2")} onClick={()=>{setSel(e);setModal("s2220");}}>ASO</button></td>
                <td style={S.td}><button style={S.btn("#F59E0B")} onClick={()=>{setSel(e);setModal("s2298");}}>Reintegr</button></td>
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
            <div><label style={S.lbl}>Data da Alteracao *</label><SmartDateInput value={s2205.dtAlteracao} onChange={v=>setS2205(d=>({...d,dtAlteracao:v}))} style={S.inp}/></div>
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

      {modal==="s2230"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2230 - Afastamento Temporario</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Inicio do Afastamento *</label><SmartDateInput value={s2230.dtIniAfast} onChange={v=>setS2230(d=>({...d,dtIniAfast:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Motivo *</label>
              <select value={s2230.codMotAfast} onChange={e=>setS2230(d=>({...d,codMotAfast:e.target.value}))} style={S.inp}>
                <option value="17">17 - Ferias</option>
                <option value="01">01 - Acidente de Trabalho</option>
                <option value="02">02 - Doenca / Afastamento INSS</option>
                <option value="06">06 - Licenca Maternidade</option>
                <option value="10">10 - Licenca Paternidade</option>
                <option value="19">19 - Licenca sem Vencimento</option>
                <option value="31">31 - Mandato Eleitoral</option>
                <option value="99">99 - Outros</option>
              </select>
            </div>
            <div><label style={S.lbl}>Termino (opcional — para ferias)</label><SmartDateInput value={s2230.dtTermAfast} onChange={v=>setS2230(d=>({...d,dtTermAfast:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Ambiente</label>
              <select value={s2230.tpAmb} onChange={e=>setS2230(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,color:s2230.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Producao Restrita</option>
                <option value="1">Producao Real</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={dlS2230} disabled={!s2230.dtIniAfast} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#7C3AED",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={transmitirS2230} disabled={!s2230.dtIniAfast} style={{padding:"8px 18px",borderRadius:8,border:"none",background:s2230.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}

      {modal==="s2190"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2190 - Admissao Preliminar</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Data de Admissao *</label><SmartDateInput value={s2190.dtAdm} onChange={v=>setS2190(d=>({...d,dtAdm:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Categoria</label>
              <select value={s2190.codCateg} onChange={e=>setS2190(d=>({...d,codCateg:e.target.value}))} style={S.inp}>
                <option value="01">01 - Empregado CLT</option>
                <option value="10">10 - Trabalhador Temporario</option>
                <option value="35">35 - Aprendiz</option>
                <option value="65">65 - Domestico</option>
              </select>
            </div>
            <div><label style={S.lbl}>Tipo Contrato</label>
              <select value={s2190.tpContr} onChange={e=>setS2190(d=>({...d,tpContr:e.target.value}))} style={S.inp}>
                <option value="1">1 - Prazo Indeterminado</option>
                <option value="2">2 - Prazo Determinado</option>
              </select>
            </div>
            <div><label style={S.lbl}>Ambiente</label>
              <select value={s2190.tpAmb} onChange={e=>setS2190(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,color:s2190.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Producao Restrita</option><option value="1">Producao Real</option>
              </select>
            </div>
          </div>
          <p style={{fontSize:11,color:"#9CA3AF",margin:"8px 0 0"}}>Obs: S-2200 completo deve ser enviado em ate 30 dias apos o inicio do trabalho.</p>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={()=>actEvent("S-2190","/hr/esocial/s2190/",s2190,setS2190)} disabled={!s2190.dtAdm} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#15803D",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={()=>actEvent("TX","/hr/esocial/transmitir/s2190/",s2190,setS2190)} disabled={!s2190.dtAdm} style={{padding:"8px 16px",borderRadius:8,border:"none",background:s2190.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}

      {modal==="s1202"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-1202 - Remuneracao Sem Vinculo (Pro-labore/Autonomo)</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Competencia *</label><SmartMonthInput value={s1202.perApur} onChange={v=>setS1202(d=>({...d,perApur:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Valor Base INSS (R$) *</label><input value={s1202.vrBcCp} onChange={e=>setS1202(d=>({...d,vrBcCp:e.target.value}))} style={S.inp} placeholder="0,00"/></div>
            <div><label style={S.lbl}>Categoria</label>
              <select value={s1202.codCateg} onChange={e=>setS1202(d=>({...d,codCateg:e.target.value}))} style={S.inp}>
                <option value="701">701 - Contrib. Individual (Pro-labore)</option>
                <option value="711">711 - Autonomo</option>
                <option value="722">722 - Diretor Sem Vinculo</option>
              </select>
            </div>
            <div><label style={S.lbl}>Ambiente</label>
              <select value={s1202.tpAmb} onChange={e=>setS1202(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,color:s1202.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Producao Restrita</option><option value="1">Producao Real</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={()=>actEvent("S-1202","/hr/esocial/s1202/",s1202,setS1202)} disabled={!s1202.perApur||!s1202.vrBcCp} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#9333EA",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={()=>actEvent("TX","/hr/esocial/transmitir/s1202/",s1202,setS1202)} disabled={!s1202.perApur||!s1202.vrBcCp} style={{padding:"8px 16px",borderRadius:8,border:"none",background:s1202.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}

      {modal==="s2220"&&sel&&(
        <div style={ov}><div style={{...cd,width:520}}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2220 - ASO / Monitoramento Saude</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={S.lbl}>Data do ASO *</label><SmartDateInput value={s2220.dtAso} onChange={v=>setS2220(d=>({...d,dtAso:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Resultado</label>
              <select value={s2220.resAso} onChange={e=>setS2220(d=>({...d,resAso:e.target.value}))} style={S.inp}>
                <option value="1">1 - Apto</option>
                <option value="2">2 - Inapto Temporario</option>
                <option value="3">3 - Inapto Permanente</option>
              </select>
            </div>
            <div><label style={S.lbl}>Tipo de Exame</label>
              <select value={s2220.tpAso} onChange={e=>setS2220(d=>({...d,tpAso:e.target.value}))} style={S.inp}>
                <option value="0">0 - Admissional</option>
                <option value="1">1 - Periodico</option>
                <option value="2">2 - Retorno ao Trabalho</option>
                <option value="3">3 - Mudanca de Risco</option>
                <option value="9">9 - Demissional</option>
              </select>
            </div>
            <div><label style={S.lbl}>CRM Medico</label><input value={s2220.nrCRM} onChange={e=>setS2220(d=>({...d,nrCRM:e.target.value}))} style={S.inp} placeholder="Numero CRM"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Nome do Medico *</label><input value={s2220.nmMedico} onChange={e=>setS2220(d=>({...d,nmMedico:e.target.value}))} style={S.inp} placeholder="Nome completo"/></div>
            <div><label style={S.lbl}>UF CRM</label><input value={s2220.ufCRM} onChange={e=>setS2220(d=>({...d,ufCRM:e.target.value.toUpperCase().slice(0,2)}))} style={S.inp} placeholder="PR"/></div>
            <div><label style={S.lbl}>Ambiente</label>
              <select value={s2220.tpAmb} onChange={e=>setS2220(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,color:s2220.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Producao Restrita</option><option value="1">Producao Real</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={()=>actEvent("S-2220","/hr/esocial/s2220/",s2220,setS2220)} disabled={!s2220.dtAso||!s2220.nmMedico} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#0891B2",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={()=>actEvent("TX","/hr/esocial/transmitir/s2220/",s2220,setS2220)} disabled={!s2220.dtAso||!s2220.nmMedico} style={{padding:"8px 16px",borderRadius:8,border:"none",background:s2220.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}

      {modal==="s2298"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2298 - Reintegracao</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Data da Reintegracao *</label><SmartDateInput value={s2298.dtReintegr} onChange={v=>setS2298(d=>({...d,dtReintegr:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Motivo</label>
              <select value={s2298.motivo} onChange={e=>setS2298(d=>({...d,motivo:e.target.value}))} style={S.inp}>
                <option value="1">1 - Reintegracao Judicial</option>
                <option value="2">2 - Conversao Suspensao em Rescisao</option>
                <option value="3">3 - Outros</option>
              </select>
            </div>
            <div><label style={S.lbl}>Ambiente</label>
              <select value={s2298.tpAmb} onChange={e=>setS2298(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,color:s2298.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Producao Restrita</option><option value="1">Producao Real</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={()=>actEvent("S-2298","/hr/esocial/s2298/",s2298,setS2298)} disabled={!s2298.dtReintegr} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#F59E0B",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={()=>actEvent("TX","/hr/esocial/transmitir/s2298/",s2298,setS2298)} disabled={!s2298.dtReintegr} style={{padding:"8px 16px",borderRadius:8,border:"none",background:s2298.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}

      {modal==="s2240"&&sel&&(
        <div style={ov}><div style={{...cd,width:520}}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2240 - Condicoes Ambientais (NR-15/NR-16)</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={S.lbl}>Setor *</label><input value={s2240.dscSetor} onChange={e=>setS2240(d=>({...d,dscSetor:e.target.value}))} style={S.inp} placeholder="Ex: Producao, Administrativo"/></div>
            <div><label style={S.lbl}>Condicao *</label>
              <select value={s2240.condAmb} onChange={e=>setS2240(d=>({...d,condAmb:e.target.value}))} style={S.inp}>
                <option value="1">1 - Normal</option>
                <option value="2">2 - Insalubre (NR-15)</option>
                <option value="3">3 - Perigoso (NR-16)</option>
              </select>
            </div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Atividade desenvolvida *</label><input value={s2240.dscAtivDes} onChange={e=>setS2240(d=>({...d,dscAtivDes:e.target.value}))} style={S.inp} placeholder="Descricao da atividade"/></div>
            <div><label style={S.lbl}>Usa EPC?</label>
              <select value={s2240.utilizEpc} onChange={e=>setS2240(d=>({...d,utilizEpc:e.target.value}))} style={S.inp}>
                <option value="S">Sim</option><option value="N">Nao</option>
              </select>
            </div>
            <div><label style={S.lbl}>Usa EPI?</label>
              <select value={s2240.utilizEpi} onChange={e=>setS2240(d=>({...d,utilizEpi:e.target.value}))} style={S.inp}>
                <option value="N">Nao</option><option value="S">Sim</option>
              </select>
            </div>
            <div><label style={S.lbl}>Ambiente</label>
              <select value={s2240.tpAmb} onChange={e=>setS2240(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,color:s2240.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Producao Restrita</option><option value="1">Producao Real</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={()=>actEvent("S-2240","/hr/esocial/s2240/",s2240,setS2240)} disabled={!s2240.dscSetor||!s2240.dscAtivDes} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#0D9488",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={()=>actEvent("TX","/hr/esocial/transmitir/s2240/",s2240,setS2240)} disabled={!s2240.dscSetor||!s2240.dscAtivDes} style={{padding:"8px 16px",borderRadius:8,border:"none",background:s2240.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}

      {modal==="s2210"&&sel&&(
        <div style={ov}><div style={{...cd,width:580}}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2210 - CAT (Acidente de Trabalho)</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><label style={S.lbl}>Data do Acidente *</label><SmartDateInput value={s2210.dtAcid} onChange={v=>setS2210(d=>({...d,dtAcid:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Hora</label><input type="time" value={s2210.hrAcid} onChange={e=>setS2210(d=>({...d,hrAcid:e.target.value}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Tipo de Acidente</label>
              <select value={s2210.tpAcid} onChange={e=>setS2210(d=>({...d,tpAcid:e.target.value}))} style={S.inp}>
                <option value="1">1 - Tipico</option><option value="2">2 - Trajeto</option><option value="3">3 - Doenca Ocupacional</option>
              </select>
            </div>
            <div><label style={S.lbl}>Tipo CAT</label>
              <select value={s2210.tpCat} onChange={e=>setS2210(d=>({...d,tpCat:e.target.value}))} style={S.inp}>
                <option value="1">1 - Inicial</option><option value="2">2 - Reabertura</option><option value="3">3 - Obito</option>
              </select>
            </div>
            <div><label style={S.lbl}>CID *</label><input value={s2210.codCID} onChange={e=>setS2210(d=>({...d,codCID:e.target.value.toUpperCase()}))} style={S.inp} placeholder="Ex: S60.0"/></div>
            <div><label style={S.lbl}>Data Atendimento *</label><SmartDateInput value={s2210.dtAtend} onChange={v=>setS2210(d=>({...d,dtAtend:v}))} style={S.inp}/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Local do Acidente *</label><input value={s2210.dscLoc} onChange={e=>setS2210(d=>({...d,dscLoc:e.target.value}))} style={S.inp} placeholder="Ex: Almoxarifado, estrada PR-151"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Descricao da Lesao *</label><input value={s2210.dscLesao} onChange={e=>setS2210(d=>({...d,dscLesao:e.target.value}))} style={S.inp} placeholder="Ex: Fratura de falange"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Descricao do Acidente *</label><input value={s2210.descricao} onChange={e=>setS2210(d=>({...d,descricao:e.target.value}))} style={S.inp} placeholder="Como ocorreu o acidente"/></div>
            <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Medico / CRM / UF</label>
              <div style={{display:"flex",gap:6}}>
                <input value={s2210.nmMedico} onChange={e=>setS2210(d=>({...d,nmMedico:e.target.value}))} style={{...S.inp,flex:2}} placeholder="Nome do medico"/>
                <input value={s2210.nrOC} onChange={e=>setS2210(d=>({...d,nrOC:e.target.value}))} style={{...S.inp,flex:1}} placeholder="CRM"/>
                <input value={s2210.ufCRM} onChange={e=>setS2210(d=>({...d,ufCRM:e.target.value.toUpperCase().slice(0,2)}))} style={{...S.inp,width:50,flex:0}} placeholder="UF"/>
              </div>
            </div>
            <div><label style={S.lbl}>Ambiente</label>
              <select value={s2210.tpAmb} onChange={e=>setS2210(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,color:s2210.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Producao Restrita</option><option value="1">Producao Real</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={()=>actEvent("S-2210","/hr/esocial/s2210/",s2210,setS2210)} disabled={!s2210.dtAcid||!s2210.codCID} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#DC2626",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={()=>actEvent("TX","/hr/esocial/transmitir/s2210/",s2210,setS2210)} disabled={!s2210.dtAcid||!s2210.codCID} style={{padding:"8px 16px",borderRadius:8,border:"none",background:s2210.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}

      {modal==="s1210"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-1210 - Pagamento de Rendimentos</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Competencia *</label><SmartMonthInput value={s1210.perApur} onChange={v=>setS1210(d=>({...d,perApur:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Data do Pagamento *</label><SmartDateInput value={s1210.dtPgto} onChange={v=>setS1210(d=>({...d,dtPgto:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Tipo de Pagamento</label>
              <select value={s1210.tpPgto} onChange={e=>setS1210(d=>({...d,tpPgto:e.target.value}))} style={S.inp}>
                <option value="1">1 - Mensal (normal)</option>
                <option value="2">2 - 13o Salario</option>
                <option value="3">3 - Ferias</option>
                <option value="4">4 - PLR</option>
                <option value="5">5 - Rescisao</option>
              </select>
            </div>
            <div><label style={S.lbl}>Ambiente</label>
              <select value={s1210.tpAmb} onChange={e=>setS1210(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,color:s1210.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Producao Restrita</option><option value="1">Producao Real</option>
              </select>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={()=>actEvent("S-1210","/hr/esocial/s1210/",s1210,setS1210)} disabled={!s1210.perApur||!s1210.dtPgto} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#7C3AED",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={()=>actEvent("TX","/hr/esocial/transmitir/s1210/",s1210,setS1210)} disabled={!s1210.perApur||!s1210.dtPgto} style={{padding:"8px 16px",borderRadius:8,border:"none",background:s1210.tpAmb==="1"?"#B91C1C":"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}

      {modal==="s2299"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-2299 - Desligamento</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Data do Desligamento *</label><SmartDateInput value={s2299.dtDeslig} onChange={v=>setS2299(d=>({...d,dtDeslig:v}))} style={S.inp}/></div>
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
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
              <select value={s2299.tpAmb} onChange={e=>setS2299(d=>({...d,tpAmb:e.target.value}))} style={{...S.inp,width:"auto",fontSize:12,color:s2299.tpAmb==="1"?"#B91C1C":"#0369A1",fontWeight:600}}>
                <option value="2">Prod. Restrita (testes)</option>
                <option value="1">⚠ Produção Real</option>
              </select>
              <button onClick={dl2299} disabled={!s2299.dtDeslig} style={{padding:"8px 18px",borderRadius:8,border:"none",background:s2299.tpAmb==="1"?"#B91C1C":"#374151",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            </div>
          </div>
        </div></div>
      )}

      {modal==="s1200"&&sel&&(
        <div style={ov}><div style={cd}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 4px"}}>S-1200 - Remuneracao Mensal</h2>
          <p style={{fontSize:13,color:"#6B7280",margin:"0 0 16px"}}>{sel.fullName} - {fmtBRL(sel.salary)}</p>
          <div style={{display:"grid",gap:12}}>
            <div><label style={S.lbl}>Periodo de Apuracao *</label><SmartMonthInput value={s1200.perApur} onChange={v=>setS1200(d=>({...d,perApur:v}))} style={S.inp}/></div>
            <div><label style={S.lbl}>Base INSS *</label><input value={s1200.vrBcCp} onChange={e=>setS1200(d=>({...d,vrBcCp:e.target.value}))} style={S.inp} placeholder="0,00"/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",cursor:"pointer",fontSize:13}}>Cancelar</button>
            <button onClick={dl1200} disabled={!s1200.perApur||!s1200.vrBcCp} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#7C3AED",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>Gerar XML</button>
            <button onClick={transmitirS1200} disabled={!s1200.perApur||!s1200.vrBcCp} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0369A1",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>[TX] Transmitir</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
