// frontend/src/pages/finance/NfseSpCsvPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDate(d: string | Date) {
  try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return String(d); }
}
const S = {
  page:  { padding: 24, fontFamily: 'system-ui', maxWidth: 1100, margin: '0 auto' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#FFF7ED', color: '#C2410C', display: 'inline-block', marginBottom: 8 },
  h1:    { fontSize: 17, fontWeight: 500, margin: '0 0 4px', color: '#111' },
  sub:   { fontSize: 12, color: '#9CA3AF', margin: '0 0 20px' },
  drop:  (active: boolean) => ({ border: `2px dashed ${active ? '#F97316' : '#E5E7EB'}`, borderRadius: 10, padding: '32px 24px', textAlign: 'center' as const, cursor: 'pointer', background: active ? '#FFF7ED' : '#F9FAFB', transition: 'all .15s' }),
  kpi:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 16 },
  kpic:  { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' },
  kpil:  { fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' as const, marginBottom: 3 },
  kpiv:  (c?: string) => ({ fontSize: 16, fontWeight: 500, color: c || '#111' }),
  tbl:   { width: '100%', borderCollapse: 'collapse' as const, fontSize: 12 },
  th:    { padding: '8px 10px', textAlign: 'left' as const, fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, borderBottom: '0.5px solid #E5E7EB', background: '#F9FAFB', whiteSpace: 'nowrap' as const },
  td:    { padding: '7px 10px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 },
  btnP:  { padding: '8px 20px', borderRadius: 8, border: 'none', background: '#C2410C', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  btnS:  { padding: '8px 16px', borderRadius: 8, border: '0.5px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' },
};

type Step = 'upload' | 'preview' | 'done';

export default function NfseSpCsvPage() {
  const [step,    setStep]    = useState<Step>('upload');
  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [result,  setResult]  = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [drag,    setDrag]    = useState(false);
  const [showLotes, setShowLotes] = useState(false);
  const [lotes,     setLotes]     = useState<any[]>([]);
  const [loadingLotes, setLoadingLotes] = useState(false);
  const [filter,  setFilter]  = useState<'all'|'ok'|'dup'|'canceled'>('all');

  const handleFile = (f: File) => { setFile(f); };

  const loadLotes = useCallback(async () => {
    setLoadingLotes(true);
    try { const r = await api.get('/fiscal/nfse-sp-csv/lotes'); setLotes(r.data); }
    catch(e: any) { console.error(e); }
    finally { setLoadingLotes(false); }
  }, []);

  useEffect(() => { loadLotes(); }, [loadLotes]);

  const doExcluirLote = async (batchId: string, count: number) => {
    const conf = await Swal.fire({ title: 'Excluir lote?',
      text: `Isso removerá ${count} nota(s), lançamentos contábeis, AP/AR e agenda vinculados.`,
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#DC2626', confirmButtonText: 'Excluir', cancelButtonText: 'Cancelar' });
    if (!conf.isConfirmed) return;
    try {
      await api.post('/fiscal/nfse-sp-csv/excluir-lote', { batchId });
      Swal.fire('Excluído!', 'Lote removido com sucesso.', 'success');
      loadLotes();
    } catch(e: any) { Swal.fire('Erro', e?.response?.data?.message || e.message, 'error'); }
  };

  const doPreview = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await api.post('/fiscal/nfse-sp-csv/preview', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(r.data); setStep('preview');
    } catch(e: any) { alert(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  const doImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('fileName', file.name);
      const r = await api.post('/fiscal/nfse-sp-csv/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(r.data); setStep('done'); loadLotes();
    } catch(e: any) { alert(e?.response?.data?.message || e.message); }
    finally { setLoading(false); }
  };

  const filteredItems = preview?.items?.filter((i: any) => {
    if (filter === 'ok')       return !i.duplicate && i.situacao !== 'C';
    if (filter === 'dup')      return i.duplicate;
    if (filter === 'canceled') return i.situacao === 'C';
    return true;
  }) || [];


  // Modal de lotes
  const ModalLotes = () => (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => { if(e.target === e.currentTarget) setShowLotes(false); }}>
      <div style={{ background:'#fff', borderRadius:12, width:800, maxWidth:'95vw', maxHeight:'80vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'0.5px solid #E5E7EB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:600, fontSize:15 }}>📥 Importações NFS-e SP (CSV PMSP)</div>
          <button onClick={() => setShowLotes(false)} style={{ border:'none', background:'none', fontSize:18, cursor:'pointer', color:'#9CA3AF' }}>✕</button>
        </div>
        <div style={{ overflow:'auto', flex:1, padding:16 }}>
          {loadingLotes ? <div style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Carregando...</div> :
          lotes.length === 0 ? <div style={{ textAlign:'center', padding:32, color:'#9CA3AF' }}>Nenhuma importação encontrada.</div> :
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>{['Data','Arquivo','Período','Notas','Valor Total','ISS','Ações'].map(h =>
                <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'#6B7280', textTransform:'uppercase', borderBottom:'0.5px solid #E5E7EB', background:'#F9FAFB', whiteSpace:'nowrap' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {lotes.map((l: any) => (
                <tr key={l.id} style={{ borderBottom:'0.5px solid #F5F5F5' }}>
                  <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                  <td style={{ padding:'8px 10px', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={l.fileName}>{l.fileName || '—'}</td>
                  <td style={{ padding:'8px 10px', whiteSpace:'nowrap', fontSize:11, color:'#6B7280' }}>
                    {l.periodFrom ? new Date(l.periodFrom).toLocaleDateString('pt-BR') : '—'} → {l.periodTo ? new Date(l.periodTo).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding:'8px 10px', textAlign:'center', fontWeight:600 }}>{l.totalNotes}</td>
                  <td style={{ padding:'8px 10px', fontFamily:'monospace', color:'#C2410C' }}>{Number(l.totalAmount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td style={{ padding:'8px 10px', fontFamily:'monospace' }}>{Number(l.totalIss).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                  <td style={{ padding:'8px 10px' }}>
                    <button onClick={() => doExcluirLote(l.id, l.totalNotes)}
                      style={{ padding:'4px 10px', borderRadius:6, border:'none', background:'#FEE2E2', color:'#DC2626', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>}
        </div>
      </div>
    </div>
  );
  return (
    <div style={S.page}>

      <div style={S.badge}>◆ Fiscal</div>
      <h1 style={S.h1}>Importação NFS-e SP — CSV PMSP</h1>
      <p style={S.sub}>Importa o arquivo CSV exportado pelo portal nfe.prefeitura.sp.gov.br (NFS-e Emitidas ou Recebidas)</p>

      {(step === 'upload' || step === 'done') && (
        <div>
          {step === 'upload' && <>
            <div style={S.drop(drag)}
              onClick={() => document.getElementById('csv-input')?.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f); }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: file ? '#C2410C' : '#6B7280' }}>
                {file ? file.name : 'Clique ou arraste o arquivo CSV'}
              </div>
              {file && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{(file.size/1024).toFixed(1)} KB</div>}
            </div>
            <input id="csv-input" type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if(f) handleFile(f); }} />
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button style={S.btnP} disabled={!file || loading} onClick={doPreview}>
                {loading ? 'Processando...' : 'Validar CSV'}
              </button>
            </div>
          </>}

          {/* Lista de lotes anteriores */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10, display:'flex', alignItems:'center', gap: 8 }}>
              📋 Importações anteriores
              <button onClick={loadLotes} style={{ fontSize:10, padding:'2px 8px', borderRadius:6, border:'0.5px solid #E5E7EB', background:'#fff', cursor:'pointer', color:'#6B7280' }}>↻ Atualizar</button>
            </div>
            {loadingLotes ? <div style={{ color:'#9CA3AF', fontSize:12 }}>Carregando...</div> :
            lotes.length === 0 ? <div style={{ color:'#9CA3AF', fontSize:12, padding:'12px 0' }}>Nenhuma importação registrada.</div> :
            <div style={{ border:'0.5px solid #E5E7EB', borderRadius:8, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>{['Data/Hora','Arquivo','Período','Notas','Valor Total','ISS',''].map(h =>
                    <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontSize:10, fontWeight:600, color:'#6B7280', textTransform:'uppercase' as const, borderBottom:'0.5px solid #E5E7EB', background:'#F9FAFB', whiteSpace:'nowrap' as const }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {lotes.map((l: any) => (
                    <tr key={l.id} style={{ borderBottom:'0.5px solid #F5F5F5' }}>
                      <td style={{ padding:'7px 10px', whiteSpace:'nowrap' as const }}>{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                      <td style={{ padding:'7px 10px', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, color:'#6B7280' }} title={l.fileName}>{l.fileName||'—'}</td>
                      <td style={{ padding:'7px 10px', whiteSpace:'nowrap' as const, fontSize:11, color:'#6B7280' }}>
                        {l.periodFrom?new Date(l.periodFrom).toLocaleDateString('pt-BR'):'—'} → {l.periodTo?new Date(l.periodTo).toLocaleDateString('pt-BR'):'—'}
                      </td>
                      <td style={{ padding:'7px 10px', textAlign:'center' as const, fontWeight:600 }}>{l.totalNotes}</td>
                      <td style={{ padding:'7px 10px', fontFamily:'monospace', color:'#C2410C' }}>{Number(l.totalAmount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                      <td style={{ padding:'7px 10px', fontFamily:'monospace' }}>{Number(l.totalIss).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td>
                      <td style={{ padding:'7px 10px' }}>
                        <button onClick={() => doExcluirLote(l.id, l.totalNotes)}
                          style={{ padding:'3px 10px', borderRadius:6, border:'none', background:'#FEE2E2', color:'#DC2626', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div>
          <div style={S.kpi}>
            {[
              { l: 'Total',      v: preview.total,                        c: '#111'     },
              { l: 'A importar', v: preview.ok,                           c: '#15803D'  },
              { l: 'Duplicatas', v: preview.duplicates,                   c: '#9CA3AF'  },
              { l: 'Canceladas', v: preview.canceled,                     c: '#B91C1C'  },
              { l: 'Valor total',v: fmtBRL(preview.totalValorServicos),   c: '#C2410C'  },
              { l: 'ISS total',  v: fmtBRL(preview.totalIss),             c: '#374151'  },
              { l: 'IR total',   v: fmtBRL(preview.totalIr),              c: '#374151'  },
            ].map(k => (
              <div key={k.l} style={S.kpic}>
                <div style={S.kpil}>{k.l}</div>
                <div style={S.kpiv(k.c)}>{k.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['all','ok','dup','canceled'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '4px 12px', borderRadius: 20, border: '0.5px solid', fontSize: 11, cursor: 'pointer',
                  borderColor: filter===f ? '#C2410C' : '#E5E7EB',
                  background: filter===f ? '#C2410C' : '#fff',
                  color: filter===f ? '#fff' : '#374151', fontWeight: filter===f ? 600 : 400 }}>
                {f === 'all' ? 'Todos' : f === 'ok' ? 'A importar' : f === 'dup' ? 'Duplicatas' : 'Canceladas'}
              </button>
            ))}
            <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', alignSelf: 'center' }}>{filteredItems.length} notas</span>
          </div>

          <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
            <table style={S.tbl}>
              <thead>
                <tr>{['NFS-e','Data','Tomador','Valor','ISS','IR','Modo','St'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filteredItems.map((i: any) => (
                  <tr key={i.numero} style={{ background: i.duplicate ? '#FFFBEB' : i.situacao==='C' ? '#FEF2F2' : '#fff' }}>
                    <td style={S.td}>{i.numero}</td>
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{fmtDate(i.dataEmissao)}</td>
                    <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.tomadorNome}>{i.tomadorNome || i.prestadorNome}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#C2410C' }}>{fmtBRL(i.valorServicos)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{fmtBRL(i.issDevido)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace' }}>{fmtBRL(i.ir)}</td>
                    <td style={S.td}><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: i.mode==='PRESTADOR'?'#EFF6FF':'#F0FDF4', color: i.mode==='PRESTADOR'?'#1D4ED8':'#15803D', fontWeight: 600 }}>{i.mode}</span></td>
                    <td style={S.td}>
                      {i.duplicate && <span style={{ fontSize: 10, color: '#D97706' }}>DUP</span>}
                      {i.situacao==='C' && <span style={{ fontSize: 10, color: '#B91C1C' }}>CANC</span>}
                      {!i.duplicate && i.situacao!=='C' && <span style={{ fontSize: 10, color: '#15803D' }}>OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.btnS} onClick={() => { setStep('upload'); setPreview(null); }}>← Voltar</button>
            <button style={{ ...S.btnP, opacity: preview.ok === 0 ? 0.5 : 1 }}
              disabled={loading || preview.ok === 0} onClick={doImport}>
              {loading ? 'Importando...' : `Importar ${preview.ok} nota(s)`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div>
          <div style={{ background:'#F0FDF4', border:'0.5px solid #86EFAC', borderRadius:10, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:24 }}>✅</span>
            <div>
              <div style={{ fontWeight:600, fontSize:14, color:'#15803D' }}>Importação concluída</div>
              <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                {result.created} nota(s) importada(s) · {result.skipped} ignorada(s)
                {result.errors?.length > 0 && ` · ${result.errors.length} erro(s)`}
              </div>
            </div>
            <button style={{ ...S.btnS, marginLeft:'auto' }} onClick={() => { setStep('upload'); setFile(null); setPreview(null); setResult(null); }}>
              ＋ Nova importação
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
