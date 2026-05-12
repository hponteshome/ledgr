import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUpload, FiFile, FiAlertTriangle, FiChevronRight, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import api from '../../services/api';

interface PreviewRow {
  code: string; reducedCode: string | null; name: string; level: number;
  nature: 'DEBIT'|'CREDIT'; type: string; spedCode: string | null; isAnalytic: boolean;
}
interface StructureIssue { lineNum: number; content: string; reason: string; severity: 'error'|'warning'; }
interface ImportResult { inserted: number; errors: Array<{code:string;name:string;reason:string}>; issues: StructureIssue[]; }

function applyMask(code: string): string {
  const raw = code.replace(/\./g, '');
  const sizes = [1,1,1,2,2,4];
  const parts: string[] = [];
  let cur = 0;
  for (const s of sizes) {
    const chunk = raw.slice(cur, cur + s);
    if (!chunk) break;
    parts.push(chunk);
    cur += s;
  }
  return parts.join('.');
}

const TYPE_LABEL: Record<string,string> = { ASSET:'Ativo', LIABILITY:'Passivo', EQUITY:'PL', REVENUE:'Receita', EXPENSE:'Despesa' };
const TYPE_COLOR: Record<string,[string,string]> = {
  ASSET:['#DBEAFE','#1D4ED8'], LIABILITY:['#FEF3C7','#92400E'],
  EQUITY:['#D1FAE5','#065F46'], REVENUE:['#EDE9FE','#5B21B6'], EXPENSE:['#FEE2E2','#991B1B'],
};

export default function ImportChartOfAccountsPage() {
  const navigate = useNavigate();
  const [step, setStep]             = useState<1|2|3>(1);
  const [file, setFile]             = useState<File|null>(null);
    const [preview, setPreview]       = useState<PreviewRow[]>([]);
  const [issues, setIssues]         = useState<StructureIssue[]>([]);
  const [hasErrors, setHasErrors]   = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [result, setResult]         = useState<ImportResult|null>(null);
  const [dragging, setDragging]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setFile(f); setPreview([]); setIssues([]); setHasErrors(false); setLoadingPrev(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const { data } = await api.post(`/accounting/chart-of-accounts/preview`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(data.rows ?? []);
      setIssues(data.issues ?? []);
      setHasErrors(data.hasErrors ?? false);
    } catch(err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao processar arquivo.');
    } finally { setLoadingPrev(false); }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, []);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const { data } = await api.post(`/accounting/chart-of-accounts/import`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data); setStep(3);
    } catch(err: any) {
      alert(err?.response?.data?.message ?? 'Erro durante a importação.');
    } finally { setImporting(false); }
  }

  const errors   = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');

  // ── Stepper ──────────────────────────────────────────────────
  const steps = ['Upload & Preview','Validação','Resultado'];
  const Stepper = () => (
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:32}}>
      {steps.map((label,i) => {
        const s = (i+1) as 1|2|3;
        const active = step===s; const done = step>s;
        return (
          <React.Fragment key={s}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',
                justifyContent:'center',fontWeight:700,fontSize:13,
                background:done||active?'#2563EB':'#E5E7EB',color:done||active?'#fff':'#9CA3AF'}}>
                {done?'✓':s}
              </div>
              <span style={{fontSize:13,fontWeight:active?600:400,color:active?'#1E3A5F':'#9CA3AF'}}>{label}</span>
            </div>
            {i<2 && <FiChevronRight size={14} color="#D1D5DB" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  // ── Issues table ─────────────────────────────────────────────
  const IssuesTable = ({ items, title, color, bg, border }: {
    items: StructureIssue[]; title: string; color: string; bg: string; border: string;
  }) => items.length === 0 ? null : (
    <div style={{border:`1px solid ${border}`,borderRadius:8,overflow:'hidden',marginBottom:12}}>
      <div style={{background:bg,padding:'8px 14px',display:'flex',alignItems:'center',gap:8}}>
        {items[0].severity==='error'
          ? <FiXCircle size={15} color={color} />
          : <FiAlertTriangle size={15} color={color} />}
        <span style={{fontSize:13,fontWeight:600,color}}>{title}</span>
      </div>
      <div style={{maxHeight:160,overflowY:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
          <thead><tr style={{background:bg}}>
            {['Linha','Código/Conteúdo','Motivo'].map(h=>(
              <th key={h} style={{padding:'5px 10px',textAlign:'left',color,fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{items.map((w,i)=>(
            <tr key={i} style={{borderTop:`1px solid ${border}`}}>
              <td style={{padding:'4px 10px',fontWeight:600,color,whiteSpace:'nowrap'}}>{w.lineNum}</td>
              <td style={{padding:'4px 10px',fontFamily:'monospace',color:'#374151'}}>{w.content}</td>
              <td style={{padding:'4px 10px',color:'#DC2626'}}>{w.reason}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );

  // ── Step 1 ───────────────────────────────────────────────────
  const Step1 = () => (
    <div>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={onDrop} onClick={()=>inputRef.current?.click()}
        style={{border:`2px dashed ${dragging?'#2563EB':'#D1D5DB'}`,borderRadius:12,
          background:dragging?'#EFF6FF':'#F9FAFB',padding:'48px 24px',
          textAlign:'center',cursor:'pointer',marginBottom:20}}>
        <input ref={inputRef} type="file" accept=".txt" style={{display:'none'}}
          onChange={e=>{const f=e.target.files?.[0];if(f) handleFile(f);}} />
        <FiUpload size={28} color={dragging?'#2563EB':'#9CA3AF'} style={{marginBottom:10}} />
        {file
          ? <div><FiFile size={16} color="#2563EB" style={{marginRight:6}} />
              <strong style={{color:'#1E3A5F'}}>{file.name}</strong>
              <span style={{fontSize:12,color:'#6B7280',marginLeft:8}}>{(file.size/1024).toFixed(1)} KB</span></div>
          : <><p style={{margin:0,fontWeight:600,color:'#374151'}}>Arraste o arquivo .txt ou clique para selecionar</p>
              <p style={{margin:'4px 0 0',fontSize:12,color:'#6B7280'}}>Layout posicional — Plano de Contas</p></>}
      </div>

      {loadingPrev && <p style={{color:'#6B7280',fontSize:13}}>Carregando preview…</p>}

      {/* Card de erros estruturais */}
      <IssuesTable items={errors} title={`${errors.length} erro${errors.length>1?'s':''} estrutural${errors.length>1?'is':''} — importação bloqueada`}
        color="#991B1B" bg="#FEF2F2" border="#FECACA" />

      {/* Card de avisos */}
      <IssuesTable items={warnings} title={`${warnings.length} aviso${warnings.length>1?'s':''} — será${warnings.length>1?'ão':''} importado${warnings.length>1?'s':''} normalmente`}
        color="#92400E" bg="#FFFBEB" border="#FCD34D" />

      {/* Preview table */}
      {preview.length > 0 && (
        <div style={{overflowX:'auto',border:'1px solid #E5E7EB',borderRadius:8,marginBottom:24,marginTop:12}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'#F3F4F6'}}>
              {['Código','Nome','Nív','Tipo','Natureza','Cód. Red.','SPED'].map(h=>(
                <th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#374151',fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{preview.map((r,i)=>{
              const [bg,fg] = TYPE_COLOR[r.type]??['#F3F4F6','#374151'];
              return (
                <tr key={i} style={{borderTop:'1px solid #F3F4F6',background:i%2===0?'#fff':'#FAFAFA'}}>
                  <td style={{padding:'6px 10px',fontFamily:'monospace',color:'#1E3A5F',fontWeight:600}}>{applyMask(r.code)}</td>
                  <td style={{padding:'6px 10px',color:'#374151'}}>{r.name}</td>
                  <td style={{padding:'6px 10px',textAlign:'center',color:'#6B7280'}}>{r.level}</td>
                  <td style={{padding:'6px 10px'}}>
                    <span style={{fontSize:11,fontWeight:600,padding:'2px 7px',borderRadius:4,background:bg,color:fg}}>
                      {TYPE_LABEL[r.type]}
                    </span>
                  </td>
                  <td style={{padding:'6px 10px',color:'#6B7280',fontSize:11}}>{r.nature==='DEBIT'?'Devedora':'Credora'}</td>
                  <td style={{padding:'6px 10px',fontFamily:'monospace',color:'#6B7280',fontSize:11}}>{r.reducedCode??'—'}</td>
                  <td style={{padding:'6px 10px',fontFamily:'monospace',color:'#6B7280',fontSize:11}}>{r.spedCode??'—'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'flex-end'}}>
        <button disabled={!file||preview.length===0||hasErrors} onClick={()=>setStep(2)}
          style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:8,
            padding:'10px 28px',fontWeight:600,fontSize:14,
            opacity:file&&preview.length>0&&!hasErrors?1:0.4,
            cursor:file&&preview.length>0&&!hasErrors?'pointer':'not-allowed'}}>
          {hasErrors?'Corrija os erros para continuar':'Próximo →'}
        </button>
      </div>
    </div>
  );

  // ── Step 2 ───────────────────────────────────────────────────
  const Step2 = () => {
    const analytics = preview.filter(r=>r.isAnalytic).length;
    const synthetic = preview.length - analytics;
    return (
      <div>
        <div style={{display:'flex',gap:16,marginBottom:24,flexWrap:'wrap'}}>
          {[['Total',preview.length,'#2563EB','#EFF6FF'],
            ['Analíticas',analytics,'#065F46','#D1FAE5'],
            ['Sintéticas',synthetic,'#92400E','#FEF3C7']].map(([l,v,c,b])=>(
            <div key={l as string} style={{flex:'1 1 120px',padding:'14px 18px',borderRadius:10,background:b as string}}>
              <div style={{fontSize:26,fontWeight:700,color:c as string}}>{v}</div>
              <div style={{fontSize:12,color:'#6B7280'}}>{l}</div>
            </div>
          ))}
        </div>

        {warnings.length > 0 && (
          <IssuesTable items={warnings}
            title={`${warnings.length} aviso${warnings.length>1?'s':''} — contas analíticas sem código SPED`}
            color="#92400E" bg="#FFFBEB" border="#FCD34D" />
        )}

        <div style={{display:'flex',gap:10,background:'#FEF2F2',border:'1px solid #FECACA',
          borderRadius:8,padding:'12px 14px',marginBottom:32,alignItems:'flex-start'}}>
          <FiAlertTriangle size={16} color="#DC2626" style={{flexShrink:0,marginTop:2}} />
          <p style={{margin:0,fontSize:13,color:'#7F1D1D'}}>
            <strong>Substituição integral:</strong> o plano de contas atual da empresa será removido
            antes da importação. Certifique-se de que não há lançamentos vinculados.
          </p>
        </div>

        <div style={{display:'flex',justifyContent:'space-between'}}>
          <button onClick={()=>setStep(1)}
            style={{background:'transparent',color:'#6B7280',border:'1px solid #D1D5DB',
              borderRadius:8,padding:'10px 24px',fontWeight:500,fontSize:14,cursor:'pointer'}}>
            ← Voltar
          </button>
          <button onClick={handleImport} disabled={importing}
            style={{background:importing?'#93C5FD':'#2563EB',color:'#fff',border:'none',
              borderRadius:8,padding:'10px 28px',fontWeight:600,fontSize:14,
              cursor:importing?'wait':'pointer'}}>
            {importing?'Importando…':'Confirmar Importação'}
          </button>
        </div>
      </div>
    );
  };

  // ── Step 3 ───────────────────────────────────────────────────
  const Step3 = () => (
    <div style={{textAlign:'center'}}>
      <FiCheckCircle size={48} color="#16A34A" style={{marginBottom:16}} />
      <h3 style={{margin:'0 0 8px',color:'#1E3A5F'}}>Importação concluída</h3>
      <p style={{color:'#6B7280',fontSize:14,marginBottom:24}}>
        <strong style={{color:'#16A34A'}}>{result?.inserted??0}</strong> contas importadas
        {(result?.errors?.length??0)>0 &&
          <> · <strong style={{color:'#DC2626'}}>{result!.errors.length}</strong> erro{result!.errors.length>1?'s':''}</>}
      </p>
      {(result?.errors?.length??0)>0 && (
        <div style={{textAlign:'left',border:'1px solid #FECACA',borderRadius:8,overflow:'hidden',marginBottom:24}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'#FEF2F2'}}>
              {['Código','Nome','Motivo'].map(h=>(
                <th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#991B1B',fontWeight:600}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{result!.errors.map((e,i)=>(
              <tr key={i} style={{borderTop:'1px solid #FEE2E2'}}>
                <td style={{padding:'6px 10px',fontFamily:'monospace'}}>{applyMask(e.code)}</td>
                <td style={{padding:'6px 10px'}}>{e.name}</td>
                <td style={{padding:'6px 10px',color:'#DC2626',fontSize:11}}>{e.reason}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <button onClick={()=>navigate('/app/accounting/accounts')}
        style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:8,
          padding:'10px 28px',fontWeight:600,fontSize:14,cursor:'pointer'}}>
        Ver Plano de Contas
      </button>
    </div>
  );

  return (
    <div style={{maxWidth:860,margin:'0 auto',padding:'32px 24px'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button onClick={()=>navigate('/app/accounting/accounts')}
          style={{background:'transparent',border:'none',cursor:'pointer',color:'#6B7280',padding:4,fontSize:18}}>
          ←
        </button>
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:700,color:'#1E3A5F'}}>Importação de Plano de Contas</h2>
          <p style={{margin:0,fontSize:13,color:'#6B7280'}}>Layout posicional — substituição integral</p>
        </div>
      </div>
      <Stepper />
      <div style={{background:'#fff',borderRadius:12,border:'1px solid #E5E7EB',padding:'28px 32px'}}>
        {step===1 && <Step1 />}
        {step===2 && <Step2 />}
        {step===3 && <Step3 />}
      </div>
    </div>
  );
}




