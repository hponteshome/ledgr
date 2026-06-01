// frontend/src/pages/hr/FolhaPage.tsx
import React, { useState, useEffect, useCallback } from "react";
import api from "@/services/api";

const AC = "#0891B2";
const AC_SURF = "#ECFEFF";

function fmtBRL(v: any) { return Number(v??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

const STATUS_CFG: Record<string,{label:string;bg:string;color:string}> = {
  ABERTA:    {label:"Aberta",    bg:"#DBEAFE",color:"#1D4ED8"},
  CALCULADA: {label:"Calculada", bg:"#FEF3C7",color:"#92400E"},
  FECHADA:   {label:"Fechada",   bg:"#DCFCE7",color:"#15803D"},
  PAGA:      {label:"Paga",      bg:"#F3E8FF",color:"#7C3AED"},
};

async function downloadPdf(url: string, filename: string) {
  const token = localStorage.getItem("@ledgr:token");
  const companyId = JSON.parse(localStorage.getItem("@ledgr:activeCompany")||"{}").id;
  const res = await fetch((import.meta as any).env.VITE_API_URL + url, {
    headers: { Authorization: "Bearer "+token, ...(companyId?{"x-company-id":companyId}:{}) },
  });
  if (!res.ok) throw new Error("Erro ao gerar PDF");
  const blob = await res.blob();
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

// ── Preview Modal ─────────────────────────────────────────────────────────────
interface PreviewProps {
  title: string;
  html: string;
  pdfUrl: string;
  pdfFilename: string;
  onClose: () => void;
}
function PreviewModal({ title, html, pdfUrl, pdfFilename, onClose }: PreviewProps) {
  const [downloading, setDownloading] = useState(false);
  async function handleDownload() {
    setDownloading(true);
    try { await downloadPdf(pdfUrl, pdfFilename); }
    catch { alert("Erro ao gerar PDF"); }
    finally { setDownloading(false); }
  }
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:2000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:820,display:"flex",flexDirection:"column",maxHeight:"92vh",boxShadow:"0 24px 80px rgba(0,0,0,.25)"}}>
        {/* Header */}
        <div style={{padding:"14px 20px",borderBottom:"0.5px solid #E5E7EB",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <h2 style={{fontSize:15,fontWeight:600,margin:0,color:"#111"}}>{title}</h2>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handleDownload} disabled={downloading}
              style={{padding:"7px 18px",borderRadius:8,border:"none",background:"#111",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>
              {downloading ? "Gerando PDF..." : "Baixar PDF"}
            </button>
            <button onClick={onClose}
              style={{padding:"7px 14px",borderRadius:8,border:"0.5px solid #E5E7EB",background:"#fff",color:"#374151",cursor:"pointer",fontSize:13}}>
              Fechar
            </button>
          </div>
        </div>
        {/* Preview */}
        <div style={{flex:1,overflow:"auto",background:"#F3F4F6",padding:16}}>
          <iframe
            srcDoc={html}
            style={{width:"100%",height:"100%",minHeight:600,border:"none",borderRadius:8,background:"#fff"}}
            title="preview"
          />
        </div>
      </div>
    </div>
  );
}

export default function FolhaPage() {
  const [folhas, setFolhas]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState<any>(null);
  const [detalhe, setDetalhe]         = useState<any>(null);
  const [loadingDet, setLoadingDet]   = useState(false);
  const [showNova, setShowNova]       = useState(false);
  const [competencia, setCompetencia] = useState(new Date().toISOString().slice(0,7));
  const [saving, setSaving]           = useState(false);
  const [loadingPreview, setLoadingPreview] = useState<string|null>(null);
  const [preview, setPreview]         = useState<PreviewProps|null>(null);

  const S = {
    th: {padding:"8px 12px",fontSize:11,fontWeight:600 as const,color:"#6B7280",textTransform:"uppercase" as const,background:"#F9FAFB",borderBottom:"0.5px solid #E5E7EB",textAlign:"left" as const},
    td: {padding:"10px 12px",fontSize:13,color:"#374151",borderBottom:"0.5px solid #F5F5F5"},
    inp:{border:"0.5px solid #E5E7EB",borderRadius:6,padding:"6px 10px",fontSize:13,outline:"none",width:"100%",boxSizing:"border-box" as const},
    lbl:{fontSize:11,fontWeight:600 as const,color:"#6B7280",textTransform:"uppercase" as const,marginBottom:4,display:"block" as const},
    btn:(bg:string,color="#fff")=>({padding:"7px 16px",borderRadius:8,border:"none",background:bg,color,cursor:"pointer" as const,fontSize:13,fontWeight:500 as const}),
    btnSm:(bg:string,color="#fff")=>({padding:"4px 10px",borderRadius:6,border:"none",background:bg,color,cursor:"pointer" as const,fontSize:11,fontWeight:500 as const,whiteSpace:"nowrap" as const}),
  };
  const ov = {position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000};

  const load = useCallback(async()=>{
    setLoading(true);
    try { const {data}=await api.get("/hr/folha"); setFolhas(data); }
    catch{} finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  async function loadDetalhe(id: string) {
    setLoadingDet(true);
    try { const {data}=await api.get("/hr/folha/"+id); setDetalhe(data); }
    catch{} finally{setLoadingDet(false);}
  }

  async function handleNova() {
    setSaving(true);
    try { await api.post("/hr/folha",{competencia}); setShowNova(false); load(); }
    catch(e:any){ alert(e?.response?.data?.message??"Erro ao criar folha"); }
    finally{setSaving(false);}
  }

  async function handleCalcular(id: string) {
    try { await api.post("/hr/folha/"+id+"/calcular"); load(); if(selected?.id===id) loadDetalhe(id); }
    catch(e:any){ alert(e?.response?.data?.message??"Erro ao calcular"); }
  }
  async function handleFechar(id: string) {
    if(!confirm("Fechar esta folha? Nao sera possivel recalcular.")) return;
    try { await api.patch("/hr/folha/"+id+"/fechar"); load(); if(selected?.id===id) loadDetalhe(id); }
    catch(e:any){ alert(e?.response?.data?.message??"Erro ao fechar"); }
  }
  async function handleReabrir(id: string) {
    try { await api.patch("/hr/folha/"+id+"/reabrir"); load(); if(selected?.id===id) loadDetalhe(id); }
    catch{ alert("Erro"); }
  }

  async function openPreview(key: string, previewUrl: string, pdfUrl: string, pdfFilename: string, title: string) {
    setLoadingPreview(key);
    try {
      const { data } = await api.get(previewUrl);
      setPreview({ title, html: data.html, pdfUrl, pdfFilename, onClose: ()=>setPreview(null) });
    } catch(e:any) { alert(e?.response?.data?.message??"Erro ao carregar preview"); }
    finally { setLoadingPreview(null); }
  }

  function selFolha(f: any) { setSelected(f); setDetalhe(null); loadDetalhe(f.id); }

  return (
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Preview modal */}
      {preview && <PreviewModal {...preview} />}

      {/* Lista lateral */}
      <div style={{width:320,borderRight:"0.5px solid #E5E7EB",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"14px 16px",borderBottom:"0.5px solid #E5E7EB",background:"#fff"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <span style={{fontSize:11,fontWeight:600,color:AC}}>&#9670; RH</span>
              <h1 style={{fontSize:16,fontWeight:600,color:"#111",margin:"2px 0 0"}}>Folha de Pagamento</h1>
            </div>
            <button onClick={()=>setShowNova(true)} style={S.btn(AC)}>+ Nova</button>
          </div>
        </div>
        <div style={{flex:1,overflow:"auto"}}>
          {loading
            ? <div style={{padding:40,textAlign:"center",color:"#9CA3AF"}}>Carregando...</div>
            : folhas.length===0
              ? <div style={{padding:40,textAlign:"center",color:"#9CA3AF",fontSize:13}}>Nenhuma folha cadastrada.</div>
              : folhas.map(f=>{
                  const st=STATUS_CFG[f.status]??STATUS_CFG.ABERTA;
                  return (
                    <div key={f.id} onClick={()=>selFolha(f)}
                      style={{padding:"12px 16px",borderBottom:"0.5px solid #F5F5F5",cursor:"pointer",background:selected?.id===f.id?AC_SURF:"#fff"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontWeight:600,fontSize:14,color:"#111"}}>{f.competencia}</span>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:st.bg,color:st.color,fontWeight:600}}>{st.label}</span>
                      </div>
                      <div style={{fontSize:12,color:"#6B7280",marginTop:4}}>
                        {f._count?.funcionarios??0} func. · {fmtBRL(f.totalLiquido)} liq.
                      </div>
                    </div>
                  );
                })}
        </div>
      </div>

      {/* Detalhe */}
      <div style={{flex:1,overflow:"auto",background:AC_SURF}}>
        {!selected ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#9CA3AF",fontSize:14}}>
            Selecione uma folha para ver o detalhe
          </div>
        ) : loadingDet ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#9CA3AF"}}>Carregando...</div>
        ) : detalhe && (
          <div style={{padding:24}}>
            <div style={{background:"#fff",borderRadius:12,padding:20,marginBottom:16,border:"0.5px solid #E5E7EB"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:700,margin:0}}>Folha {detalhe.competencia}</h2>
                  <span style={{fontSize:12,color:"#6B7280"}}>{STATUS_CFG[detalhe.status]?.label}</span>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["ABERTA","CALCULADA"].includes(detalhe.status) && (
                    <button onClick={()=>handleCalcular(detalhe.id)} style={S.btn("#0369A1")}>Calcular</button>
                  )}
                  {detalhe.status==="CALCULADA" && (
                    <button onClick={()=>handleFechar(detalhe.id)} style={S.btn("#15803D")}>Fechar Folha</button>
                  )}
                  {["CALCULADA","FECHADA"].includes(detalhe.status) && (
                    <button onClick={()=>handleReabrir(detalhe.id)} style={S.btn("#fff","#374151")}>Reabrir</button>
                  )}
                  {["CALCULADA","FECHADA","PAGA"].includes(detalhe.status) && (<>
                    <button
                      onClick={()=>openPreview("gps","/hr/folha/"+detalhe.id+"/gps-preview","/hr/folha/"+detalhe.id+"/gps-pdf","GPS_"+detalhe.competencia.replace("-","_")+".pdf","GPS — "+detalhe.competencia)}
                      disabled={loadingPreview==="gps"}
                      style={S.btn("#1a1a6e")}>
                      {loadingPreview==="gps"?"Carregando...":"GPS"}
                    </button>
                    <button
                      onClick={()=>openPreview("darf","/hr/folha/"+detalhe.id+"/darf-preview","/hr/folha/"+detalhe.id+"/darf-pdf","DARF_IRRF_"+detalhe.competencia.replace("-","_")+".pdf","DARF IRRF — "+detalhe.competencia)}
                      disabled={loadingPreview==="darf"}
                      style={S.btn("#006633")}>
                      {loadingPreview==="darf"?"Carregando...":"DARF"}
                    </button>
                  </>)}
                </div>
              </div>
              {/* KPIs */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:16}}>
                {[
                  {label:"Total Bruto",    value:detalhe.totalBruto,          color:"#0369A1"},
                  {label:"Total Liquido",  value:detalhe.totalLiquido,        color:"#15803D"},
                  {label:"INSS Empregado", value:detalhe.totalInssEmpregado,  color:"#7C3AED"},
                  {label:"INSS Patronal",  value:detalhe.totalInssEmpregador, color:"#EA580C"},
                  {label:"IRRF",           value:detalhe.totalIrrf,           color:"#B91C1C"},
                  {label:"FGTS",           value:detalhe.totalFgts,           color:"#0891B2"},
                  {label:"Total Descontos",value:detalhe.totalDescontos,      color:"#6B7280"},
                  {label:"Sindical",       value:detalhe.totalSindical,       color:"#92400E"},
                ].map(k=>(
                  <div key={k.label} style={{background:"#F9FAFB",borderRadius:8,padding:"10px 12px",border:"0.5px solid #E5E7EB"}}>
                    <div style={{fontSize:10,color:"#9CA3AF",textTransform:"uppercase",marginBottom:2}}>{k.label}</div>
                    <div style={{fontSize:14,fontWeight:700,color:k.color}}>{fmtBRL(k.value)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabela funcionarios */}
            <div style={{background:"#fff",borderRadius:12,border:"0.5px solid #E5E7EB",overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>{["Funcionario","Sal. Base","Bruto","INSS Emp.","INSS Pat.","IRRF","FGTS","Descontos","Liquido",""].map(h=>(
                    <th key={h} style={S.th}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {(detalhe.funcionarios??[]).map((f:any)=>(
                    <tr key={f.id}>
                      <td style={S.td}>
                        <div style={{fontWeight:500}}>{f.employee?.fullName}</div>
                        <div style={{fontSize:11,color:"#9CA3AF"}}>{f.employee?.role}</div>
                      </td>
                      <td style={{...S.td,fontFamily:"monospace"}}>{fmtBRL(f.salarioBase)}</td>
                      <td style={{...S.td,fontFamily:"monospace",color:"#0369A1",fontWeight:600}}>{fmtBRL(f.totalBruto)}</td>
                      <td style={{...S.td,fontFamily:"monospace",color:"#7C3AED"}}>{fmtBRL(f.valorInss)}</td>
                      <td style={{...S.td,fontFamily:"monospace",color:"#EA580C"}}>
                        {fmtBRL(Number(f.valorInssEmpregador)+Number(f.valorRat)+Number(f.valorTerceiros))}
                      </td>
                      <td style={{...S.td,fontFamily:"monospace",color:"#B91C1C"}}>{fmtBRL(f.valorIrrf)}</td>
                      <td style={{...S.td,fontFamily:"monospace",color:"#0891B2"}}>{fmtBRL(f.valorFgts)}</td>
                      <td style={{...S.td,fontFamily:"monospace",color:"#6B7280"}}>{fmtBRL(f.totalDescontos)}</td>
                      <td style={{...S.td,fontFamily:"monospace",color:"#15803D",fontWeight:700}}>{fmtBRL(f.totalLiquido)}</td>
                      <td style={S.td}>
                        <button
                          onClick={()=>openPreview(
                            "recibo_"+f.id,
                            "/hr/folha/"+detalhe.id+"/recibo/"+f.id+"/preview",
                            "/hr/folha/"+detalhe.id+"/recibo/"+f.id,
                            "recibo_"+detalhe.competencia.replace("-","_")+"_"+f.id.slice(0,8)+".pdf",
                            "Recibo — "+(f.employee?.fullName||"")+" — "+detalhe.competencia
                          )}
                          disabled={loadingPreview==="recibo_"+f.id}
                          style={S.btnSm("#111")}>
                          {loadingPreview==="recibo_"+f.id?"...":"Recibo"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal nova folha */}
      {showNova && (
        <div style={ov}><div style={{background:"#fff",borderRadius:14,width:400,padding:24,boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}>
          <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 16px"}}>Nova Folha de Pagamento</h2>
          <div><label style={S.lbl}>Competencia *</label>
            <input type="month" value={competencia} onChange={e=>setCompetencia(e.target.value)} style={S.inp}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:20}}>
            <button onClick={()=>setShowNova(false)} style={S.btn("#fff","#374151")}>Cancelar</button>
            <button onClick={handleNova} disabled={saving||!competencia} style={S.btn(AC)}>
              {saving?"Criando...":"Criar Folha"}
            </button>
          </div>
        </div></div>
      )}
    </div>
  );
}
