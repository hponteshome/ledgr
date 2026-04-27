// frontend/src/pages/accounting/IobLotdImportModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiCheckCircle, FiXCircle, FiAlertTriangle, FiX } from 'react-icons/fi';

interface Props { onClose: () => void; onSuccess?: () => void; }

const API = 'http://localhost:3000';

const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const IobLotdImportModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep]       = useState<'upload' | 'preview' | 'done'>('upload');
  const [files, setFiles]     = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult]   = useState<any>(null);
  const [history, setHistory]   = useState<any[]>([]);
  const fileRef               = useRef<HTMLInputElement>(null);

  const token   = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const headers = { Authorization: `Bearer ${token}`, 'x-company-id': company.id ?? '' };
  useEffect(() => {
    fetch(`${API}/accounting/iob/lote-imports`, { headers })
      .then(r => r.json()).then(setHistory).catch(() => {});
  }, []);


  async function handleValidate() {
    if (files.length === 0) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      const res  = await fetch(`${API}/accounting/iob/import-lotd?dryRun=true`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      setPreview(data);
      setStep('preview');
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    if (files.length === 0) return;
    setLoading(true);
    const results: any[] = [];
    const errors: string[] = [];
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        const res  = await fetch(`${API}/accounting/iob/import-lotd?dryRun=false`, { method: 'POST', headers, body: fd });
        const data = await res.json();
        if (data.status === "error") { errors.push(`${f.name}: ${data.errors?.[0]?.message}`); }
        else { results.push(data); }
      }
      if (errors.length > 0) alert(errors.join('\n'));
      setResult({ imported: results.reduce((s,r) => s + (r.stats?.imported ?? 0), 0), total: files.length, errors: errors.length });
      setStep('done');
      fetch(`${API}/accounting/iob/lote-imports`, { headers }).then(r => r.json()).then(setHistory).catch(() => {});
      onSuccess?.();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 620, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8' }}>◆ Contábil</span>
            {files.length > 0 && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{files[0].name}{files.length > 1 ?  + ' e mais ' + (files.length-1) + ' arquivo(s)' : ''}{preview?.header ? ' · Lote ' + preview.header.batchType + ' · ' + preview.header.date : ''}</div>}
            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Importar Lote de Lançamentos IOB</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

          {/* STEP 1 */}
          {step === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Selecione o arquivo <strong>LOTD*.TXT</strong> exportado do sistema IOB. Os lançamentos serão validados contra o plano de contas mapeado.
              </p>
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #D1D5DB', borderRadius: 10, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: files.length > 0 ? '#F0FDF4' : '#F9FAFB' }}>
                <FiUpload size={24} style={{ color: files.length > 0 ? '#15803D' : '#9CA3AF', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: files.length > 0 ? '#15803D' : '#6B7280', margin: 0 }}>
                  {files.length > 0 ? files.length + ' arquivo(s) selecionado(s)' : 'Clique para selecionar arquivos LOTD*.TXT'}
                </p>
                {files.length > 0 && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>{files.map(f => f.name).join(', ')}</p>}
              </div>
              <input ref={fileRef} type="file" accept=".txt,.TXT" multiple style={{ display: 'none' }} onChange={e => setFiles(Array.from(e.target.files ?? []))} />
              {history.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 8 }}>Importações anteriores</div>
                  <div style={{ border: "0.5px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                    {history.map((h: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: i < history.length-1 ? "0.5px solid #F5F5F5" : "none", fontSize: 12 }}>
                        <div>
                          <span style={{ fontFamily: "monospace", color: "#374151" }}>{h.fileName}</span>
                          <span style={{ marginLeft: 8, fontSize: 11, color: "#9CA3AF" }}>{h.batchType} · {h.batchDate?.substring(0,10)}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: h.status === "done" ? "#15803D" : "#C2410C" }}>{h.stats?.imported ?? 0} lançamentos</span>
                          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: h.status === "done" ? "#F0FDF4" : "#FFF7ED", color: h.status === "done" ? "#15803D" : "#C2410C" }}>{h.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && preview && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Total no arquivo', value: preview.stats?.total,    color: '#111' },
                  { label: 'Lançamentos válidos', value: preview.stats?.imported, color: '#15803D' },
                  { label: 'Não encontrados',   value: preview.stats?.skipped,   color: preview.stats?.skipped > 0 ? '#B91C1C' : '#15803D' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 500, color: k.color }}>{k.value ?? 0}</div>
                  </div>
                ))}

              {/* Totais débitos/créditos */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
                <div style={{ background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 4 }}>Total Débitos</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "#2563EB", fontFamily: "monospace" }}>{preview.stats?.totalDebit?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) ?? "0,00"}</div>
                </div>
                <div style={{ background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 4 }}>Total Créditos</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: "#15803D", fontFamily: "monospace" }}>{preview.stats?.totalCredit?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) ?? "0,00"}</div>
                </div>
                <div style={{ background: preview.stats?.balanced ? "#F0FDF4" : "#FEF2F2", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 4 }}>Equilíbrio</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: preview.stats?.balanced ? "#15803D" : "#B91C1C" }}>
                    {preview.stats?.balanced ? "✓ Balanceado" : "✗ Divergente"}
                  </div>
                </div>
              </div>
              </div>

              {preview.stats?.notFound?.length > 0 && (
                <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <FiAlertTriangle size={13} color="#B91C1C" />
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#B91C1C' }}>Contas não encontradas ({preview.stats.notFound.length})</span>
                  </div>
                  <div style={{ maxHeight: 80, overflowY: 'auto' }}>
                    {preview.stats.notFound.map((c: string, i: number) => (
                      <div key={i} style={{ fontSize: 11, color: '#B91C1C', fontFamily: 'monospace' }}>{c}</div>
                    ))}
                  </div>
                </div>
              )}

              {preview.preview?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase' }}>Prévia — primeiros {preview.preview.length} lançamentos</div>
                  <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          {['Data', 'Débito', 'Crédito', 'Valor', 'Histórico'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', borderBottom: '0.5px solid #E5E7EB' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((p: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '0.5px solid #F5F5F5' }}>
                            <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 11, color: '#6B7280' }}>{p.date}</td>
                            <td style={{ padding: '5px 10px', color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.debit}</td>
                            <td style={{ padding: '5px 10px', color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.credit}</td>
                            <td style={{ padding: '5px 10px', fontFamily: 'monospace', textAlign: 'right', color: '#111' }}>{fmt(p.value)}</td>
                            <td style={{ padding: '5px 10px', color: '#9CA3AF', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.complement}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Done */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <FiCheckCircle size={40} color="#15803D" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>Importação concluída</h3>
              <p style={{ fontSize: 13, color: '#6B7280' }}>{result.total} arquivo(s) processado(s) · {result.imported} lançamentos importados.</p>
              {result.errors > 0 && <p style={{ fontSize: 12, color: '#B91C1C' }}>{result.errors} arquivo(s) com erro (duplicatas ou contas não encontradas).</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          {step === 'upload' && (
            <button onClick={handleValidate} disabled={files.length === 0 || loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: files.length === 0 || loading ? 0.5 : 1 }}>
              {loading ? 'Validando...' : 'Validar Arquivo'}
            </button>
          )}
          {step === 'preview' && (
            <button onClick={handleConfirm} disabled={loading || preview?.stats?.imported === 0} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Importando...' : 'Confirmar Importação'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
