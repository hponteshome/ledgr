// frontend/src/pages/accounting/IobImportModal.tsx
import React, { useState, useRef } from 'react';
import { FiUpload, FiCheckCircle, FiXCircle, FiAlertTriangle, FiX } from 'react-icons/fi';

interface Props { onClose: () => void; onSuccess?: () => void; }

const API = 'http://localhost:3000';

export const IobImportModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep]       = useState<'upload' | 'preview' | 'done'>('upload');
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult]   = useState<any>(null);
  const fileRef               = useRef<HTMLInputElement>(null);

  const token   = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const headers = { Authorization: `Bearer ${token}`, 'x-company-id': company.id ?? '' };

  async function handleValidate() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/accounting/iob/import-plano?dryRun=true`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      setPreview(data);
      setStep('preview');
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/accounting/iob/import-plano?dryRun=false`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      setResult(data);
      setStep('done');
      onSuccess?.();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  const s = { overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }, modal: { background: '#fff', borderRadius: 14, width: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8' }}>◆ Contábil</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Importar Plano de Contas IOB</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Selecione o arquivo <strong>PLANO.TXT</strong> exportado do sistema IOB. O código reduzido de cada conta será mapeado automaticamente para o plano de contas existente.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                style={{ border: '2px dashed #D1D5DB', borderRadius: 10, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: file ? '#F0FDF4' : '#F9FAFB' }}
              >
                <FiUpload size={24} style={{ color: file ? '#15803D' : '#9CA3AF', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: file ? '#15803D' : '#6B7280', margin: 0 }}>
                  {file ? file.name : 'Clique para selecionar o arquivo PLANO.TXT'}
                </p>
                {file && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>{(file.size / 1024).toFixed(1)} KB</p>}
              </div>
              <input ref={fileRef} type="file" accept=".txt,.TXT" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {/* STEP 2: Preview dry-run */}
          {step === 'preview' && preview && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Total no arquivo', value: preview.stats?.total, color: '#111' },
                  { label: 'Contas mapeadas', value: preview.stats?.matched, color: '#15803D' },
                  { label: 'Não encontradas', value: preview.stats?.notFound, color: preview.stats?.notFound > 0 ? '#B91C1C' : '#15803D' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 500, color: k.color }}>{k.value ?? 0}</div>
                  </div>
                ))}
              </div>

              {preview.notFound?.length > 0 && (
                <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <FiAlertTriangle size={13} color="#B91C1C" />
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#B91C1C' }}>Contas não encontradas no plano ({preview.notFound.length})</span>
                  </div>
                  <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                    {preview.notFound.map((c: string, i: number) => (
                      <div key={i} style={{ fontSize: 11, color: '#B91C1C', fontFamily: 'monospace', padding: '1px 0' }}>{c}</div>
                    ))}
                  </div>
                </div>
              )}

              {preview.stats?.matched > 0 && (
                <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiCheckCircle size={13} color="#15803D" />
                    <span style={{ fontSize: 12, color: '#15803D' }}>{preview.stats.matched} contas terão o código reduzido IOB atualizado.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Done */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {result.status === 'done' || result.status === 'partial' ? (
                <><FiCheckCircle size={40} color="#15803D" style={{ marginBottom: 12 }} />
                <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>Importação concluída</h3>
                <p style={{ fontSize: 13, color: '#6B7280' }}>{result.stats?.matched} contas atualizadas com código reduzido IOB.</p>
                {result.stats?.notFound > 0 && <p style={{ fontSize: 12, color: '#B91C1C' }}>{result.stats.notFound} contas não encontradas.</p>}</>
              ) : (
                <><FiXCircle size={40} color="#B91C1C" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 13, color: '#B91C1C' }}>Erro na importação.</p></>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          {step === 'upload' && (
            <button onClick={handleValidate} disabled={!file || loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: !file || loading ? 0.5 : 1 }}>
              {loading ? 'Validando...' : 'Validar Arquivo'}
            </button>
          )}
          {step === 'preview' && (
            <button onClick={handleConfirm} disabled={loading || preview?.stats?.matched === 0} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading || preview?.stats?.matched === 0 ? 0.5 : 1 }}>
              {loading ? 'Importando...' : 'Confirmar Importação'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
