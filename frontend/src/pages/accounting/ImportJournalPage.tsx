import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUpload, FiFile, FiAlertTriangle, FiChevronRight, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import api from '../../services/api';

interface JournalIssue { severity: 'error'|'warning'; ref: string; lineNum?: number; reason: string; }
interface PreviewEntry {
  lcto: string; date: string; description: string; reference: string;
  debitTotal: string; creditTotal: string; lineCount: number; balanced: boolean;
}
interface PreviewResult {
  entries: PreviewEntry[]; issues: JournalIssue[]; hasErrors: boolean;
  totalEntries: number; totalLines: number;
}
interface ImportResult {
  inserted: number; skipped: number;
  errors: Array<{ref:string;reason:string}>; issues: JournalIssue[];
}

function fmtDate(iso: string): string {
  const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`;
}
function fmtValue(v: string): string {
  return Number(v).toLocaleString('pt-BR', {minimumFractionDigits:2});
}

export default function ImportJournalPage() {
  const navigate = useNavigate();
  const [step, setStep]             = useState<1|2|3>(1);
  const [file, setFile]             = useState<File|null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [importing, setImporting]   = useState(false);
  const [preview, setPreview]       = useState<PreviewResult|null>(null);
  const [result, setResult]         = useState<ImportResult|null>(null);
  const [dragging, setDragging]     = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    setFile(f); setPreview(null); setLoadingPrev(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const { data } = await api.post('/accounting/journal/preview-import', fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(data);
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
      const { data } = await api.post('/accounting/journal/import', fd,
        { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data); setStep(3);
    } catch(err: any) {
      alert(err?.response?.data?.message ?? 'Erro durante a importação.');
    } finally { setImporting(false); }
  }

  const errors   = preview?.issues.filter(i => i.severity === 'error')   ?? [];
  const warnings = preview?.issues.filter(i => i.severity === 'warning') ?? [];

  // ── Stepper ──────────────────────────────────────────────────
  const Stepper = () => (
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:32}}>
      {(['Upload & Preview','Validação','Resultado'] as const).map((label,i) => {
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
    items: JournalIssue[]; title: string; color: string; bg: string; border: string;
  }) => items.length === 0 ? null : (
    <div style={{border:`1px solid ${border}`,borderRadius:8,overflow:'hidden',marginBottom:12}}>
      <div style={{background:bg,padding:'8px 14px',display:'flex',alignItems:'center',gap:8}}>
        {items[0].severity==='error'
          ? <FiXCircle size={15} color={color} />
          : <FiAlertTriangle size={15} color={color} />}
        <span style={{fontSize:13,fontWeight:600,color}}>{title}</span>
      </div>
      <div style={{maxHeight:180,overflowY:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
          <thead><tr style={{background:bg}}>
            {['Linha','Lcto','Motivo'].map(h=>(
              <th key={h} style={{padding:'5px 10px',textAlign:'left',color,fontWeight:600}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{items.map((w,i)=>(
            <tr key={i} style={{borderTop:`1px solid ${border}`}}>
              <td style={{padding:'4px 10px',color,fontWeight:600,whiteSpace:'nowrap'}}>{w.lineNum??'—'}</td>
              <td style={{padding:'4px 10px',fontFamily:'monospace',color:'#374151',whiteSpace:'nowrap'}}>{w.ref}</td>
              <td style={{padding:'4px 10px',color:'#374151'}}>{w.reason}</td>
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
        <input ref={inputRef} type="file" accept=".txt,.csv" style={{display:'none'}}
          onChange={e=>{const f=e.target.files?.[0];if(f) handleFile(f);}} />
        <FiUpload size={28} color={dragging?'#2563EB':'#9CA3AF'} style={{marginBottom:10}} />
        {file
          ? <div><FiFile size={16} color="#2563EB" style={{marginRight:6}} />
              <strong style={{color:'#1E3A5F'}}>{file.name}</strong>
              <span style={{fontSize:12,color:'#6B7280',marginLeft:8}}>{(file.size/1024).toFixed(1)} KB</span></div>
          : <><p style={{margin:0,fontWeight:600,color:'#374151'}}>Arraste o arquivo ou clique para selecionar</p>
              <p style={{margin:'4px 0 0',fontSize:12,color:'#6B7280'}}>Formato: separado por pipe (|) — Diário de Lançamentos</p></>}
      </div>

      {loadingPrev && <p style={{color:'#6B7280',fontSize:13}}>Processando arquivo…</p>}

      {preview && (<>
        {/* Cards resumo */}
        <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
          {[
            ['Lançamentos',preview.totalEntries,'#2563EB','#EFF6FF'],
            ['Partidas',preview.totalLines,'#065F46','#D1FAE5'],
            ['Erros',errors.length,'#991B1B','#FEF2F2'],
            ['Avisos',warnings.length,'#92400E','#FFFBEB'],
          ].map(([l,v,c,b])=>(
            <div key={l as string} style={{flex:'1 1 100px',padding:'12px 16px',borderRadius:10,background:b as string}}>
              <div style={{fontSize:24,fontWeight:700,color:c as string}}>{v}</div>
              <div style={{fontSize:12,color:'#6B7280'}}>{l}</div>
            </div>
          ))}
        </div>

        <IssuesTable items={errors} title={`${errors.length} erro${errors.length>1?'s':''} — importação bloqueada`}
          color="#991B1B" bg="#FEF2F2" border="#FECACA" />
        <IssuesTable items={warnings} title={`${warnings.length} aviso${warnings.length>1?'s':''}`}
          color="#92400E" bg="#FFFBEB" border="#FCD34D" />

        {/* Preview dos primeiros lançamentos */}
        {preview.entries.length > 0 && (
          <div style={{overflowX:'auto',border:'1px solid #E5E7EB',borderRadius:8,marginTop:12,marginBottom:24}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr style={{background:'#F3F4F6'}}>
                {['Referência','Data','Histórico','Partidas','Débito','Crédito','✓'].map(h=>(
                  <th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#374151',fontWeight:600,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{preview.entries.map((e,i)=>(
                <tr key={i} style={{borderTop:'1px solid #F3F4F6',background:i%2===0?'#fff':'#FAFAFA'}}>
                  <td style={{padding:'6px 10px',fontFamily:'monospace',fontSize:11,color:'#6B7280'}}>{e.reference}</td>
                  <td style={{padding:'6px 10px',whiteSpace:'nowrap'}}>{fmtDate(e.date)}</td>
                  <td style={{padding:'6px 10px',color:'#374151',maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}
                    title={e.description}>{e.description}</td>
                  <td style={{padding:'6px 10px',textAlign:'center',color:'#6B7280'}}>{e.lineCount}</td>
                  <td style={{padding:'6px 10px',textAlign:'right',color:'#1D4ED8',fontFamily:'monospace'}}>{fmtValue(e.debitTotal)}</td>
                  <td style={{padding:'6px 10px',textAlign:'right',color:'#065F46',fontFamily:'monospace'}}>{fmtValue(e.creditTotal)}</td>
                  <td style={{padding:'6px 10px',textAlign:'center'}}>
                    {e.balanced ? <FiCheckCircle size={14} color="#16A34A" /> : <FiXCircle size={14} color="#DC2626" />}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {preview.totalEntries > 10 && (
              <div style={{padding:'8px 12px',background:'#F9FAFB',borderTop:'1px solid #E5E7EB',fontSize:12,color:'#6B7280'}}>
                Exibindo 10 de {preview.totalEntries} lançamentos
              </div>
            )}
          </div>
        )}
      </>)}

      <div style={{display:'flex',justifyContent:'flex-end',marginTop:8}}>
        <button disabled={!preview||preview.hasErrors} onClick={()=>setStep(2)}
          style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:8,
            padding:'10px 28px',fontWeight:600,fontSize:14,
            opacity:preview&&!preview.hasErrors?1:0.4,
            cursor:preview&&!preview.hasErrors?'pointer':'not-allowed'}}>
          {!preview?'Selecione um arquivo':preview.hasErrors?'Corrija os erros para continuar':'Próximo →'}
        </button>
      </div>
    </div>
  );

  // ── Step 2 ───────────────────────────────────────────────────
  const Step2 = () => (
    <div>
      <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        {[
          ['Lançamentos a importar',preview?.totalEntries??0,'#2563EB','#EFF6FF'],
          ['Partidas totais',preview?.totalLines??0,'#065F46','#D1FAE5'],
          ['Avisos',warnings.length,'#92400E','#FFFBEB'],
        ].map(([l,v,c,b])=>(
          <div key={l as string} style={{flex:'1 1 140px',padding:'14px 18px',borderRadius:10,background:b as string}}>
            <div style={{fontSize:26,fontWeight:700,color:c as string}}>{v}</div>
            <div style={{fontSize:12,color:'#6B7280'}}>{l}</div>
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <IssuesTable items={warnings} title={`${warnings.length} aviso${warnings.length>1?'s':''} — serão importados normalmente`}
          color="#92400E" bg="#FFFBEB" border="#FCD34D" />
      )}

      <div style={{display:'flex',gap:10,background:'#EFF6FF',border:'1px solid #BFDBFE',
        borderRadius:8,padding:'12px 14px',marginBottom:32,alignItems:'flex-start'}}>
        <FiAlertTriangle size={16} color="#2563EB" style={{flexShrink:0,marginTop:2}} />
        <p style={{margin:0,fontSize:13,color:'#1E3A5F'}}>
          Lançamentos com <strong>referência já existente</strong> no banco serão ignorados automaticamente.
          Origem registrada como <strong>JOURNAL_IMPORT</strong>.
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

  // ── Step 3 ───────────────────────────────────────────────────
  const Step3 = () => (
    <div style={{textAlign:'center'}}>
      <FiCheckCircle size={48} color="#16A34A" style={{marginBottom:16}} />
      <h3 style={{margin:'0 0 8px',color:'#1E3A5F'}}>Importação concluída</h3>
      <p style={{color:'#6B7280',fontSize:14,marginBottom:8}}>
        <strong style={{color:'#16A34A'}}>{result?.inserted??0}</strong> lançamentos importados
        {(result?.skipped??0)>0 && <> · <strong style={{color:'#6B7280'}}>{result!.skipped}</strong> ignorados (já existiam)</>}
        {(result?.errors?.length??0)>0 && <> · <strong style={{color:'#DC2626'}}>{result!.errors.length}</strong> erros</>}
      </p>

      {(result?.errors?.length??0)>0 && (
        <div style={{textAlign:'left',border:'1px solid #FECACA',borderRadius:8,overflow:'hidden',marginBottom:24}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{background:'#FEF2F2'}}>
              {['Lcto','Motivo'].map(h=>(
                <th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#991B1B',fontWeight:600}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{result!.errors.map((e,i)=>(
              <tr key={i} style={{borderTop:'1px solid #FEE2E2'}}>
                <td style={{padding:'6px 10px',fontFamily:'monospace'}}>{e.ref}</td>
                <td style={{padding:'6px 10px',color:'#DC2626',fontSize:11}}>{e.reason}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div style={{display:'flex',gap:12,justifyContent:'center'}}>
        <button onClick={()=>navigate('/app/accounting/journal')}
          style={{background:'#2563EB',color:'#fff',border:'none',borderRadius:8,
            padding:'10px 28px',fontWeight:600,fontSize:14,cursor:'pointer'}}>
          Ver Lançamentos
        </button>
        <button onClick={()=>{setStep(1);setFile(null);setPreview(null);setResult(null);}}
          style={{background:'transparent',color:'#6B7280',border:'1px solid #D1D5DB',
            borderRadius:8,padding:'10px 24px',fontWeight:500,fontSize:14,cursor:'pointer'}}>
          Importar outro arquivo
        </button>
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:920,margin:'0 auto',padding:'32px 24px'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <button onClick={()=>navigate('/app/accounting/journal')}
          style={{background:'transparent',border:'none',cursor:'pointer',color:'#6B7280',padding:4,fontSize:18}}>
          ←
        </button>
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:700,color:'#1E3A5F'}}>Importação de Lançamentos</h2>
          <p style={{margin:0,fontSize:13,color:'#6B7280'}}>Formato pipe (|) · Origem: JOURNAL_IMPORT · Anti-duplicata por referência</p>
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





