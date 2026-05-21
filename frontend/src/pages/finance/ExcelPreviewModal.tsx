// frontend/src/pages/finance/ExcelPreviewModal.tsx
import React, { useState, useRef } from 'react';
import { FiX, FiUpload, FiCheckCircle, FiAlertTriangle, FiXCircle } from 'react-icons/fi';

interface Props { onClose: () => void; onSuccess: () => void; companyId: string; token: string; }

const API = 'http://localhost:3000';

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDate(s: string) { if (!s) return ''; try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return s; } }

export const ExcelPreviewModal: React.FC<Props> = ({ onClose, onSuccess, companyId, token }) => {
  const [step, setStep]       = useState<'upload' | 'preview' | 'done'>('upload');
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [result,  setResult]  = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const headers = { Authorization: `Bearer ${token}`, 'x-company-id': companyId };

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API}/bank-import/preview-excel`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Erro ao processar planilha');
      setPreview(data);
      setStep('preview');
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API}/bank-import/upload-excel`, { method: 'POST', headers, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Erro na importacao');
      setResult(data);
      setStep('done');
      onSuccess();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  const canConfirm = preview && preview.errors === 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 780, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F0FDF4' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#15803D' }}>◆ Financeiro</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Importar Planilha Mapeada</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Selecione a planilha Excel com colunas: <strong>Data, Descrição, Valor, Conta Débito, Conta Crédito, Complemento</strong>.
              </p>
              <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #D1D5DB', borderRadius: 10, padding: '32px 24px', textAlign: 'center', cursor: 'pointer', background: file ? '#F0FDF4' : '#F9FAFB' }}>
                <FiUpload size={24} style={{ color: file ? '#15803D' : '#9CA3AF', marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: file ? '#15803D' : '#6B7280', margin: 0 }}>{file ? file.name : 'Clique para selecionar a planilha .xlsx'}</p>
                {file && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>{(file.size / 1024).toFixed(1)} KB</p>}
              </div>
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {/* STEP 2: Preview */}
          {step === 'preview' && preview && (
            <div>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Total linhas', value: preview.total, color: '#111' },
                  { label: 'OK', value: preview.ok, color: '#15803D' },
                  { label: 'Erros', value: preview.errors, color: preview.errors > 0 ? '#B91C1C' : '#15803D' },
                  { label: 'Débitos', value: fmtBRL(preview.totalDebits), color: '#B91C1C' },
                  { label: 'Créditos', value: fmtBRL(preview.totalCredits), color: '#15803D' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 3 }}>{k.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Tabela de linhas */}
              <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['#', 'Data', 'Descrição', 'Valor', 'Tipo', 'Cta Débito', 'Cta Crédito', 'Status'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', borderBottom: '0.5px solid #E5E7EB' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l: any) => (
                      <tr key={l.row} style={{ borderBottom: '0.5px solid #F5F5F5', background: l.status === 'error' ? '#FEF2F2' : l.status === 'warn' ? '#FFFBEB' : '#fff' }}>
                        <td style={{ padding: '6px 10px', color: '#9CA3AF' }}>{l.row}</td>
                        <td style={{ padding: '6px 10px' }}>{fmtDate(l.date)}</td>
                        <td style={{ padding: '6px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: l.type === 'DEBIT' ? '#B91C1C' : '#15803D' }}>{fmtBRL(l.value)}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: l.type === 'DEBIT' ? '#FEF2F2' : '#F0FDF4', color: l.type === 'DEBIT' ? '#B91C1C' : '#15803D' }}>{l.type === 'DEBIT' ? 'Débito' : 'Crédito'}</span>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {l.debitAccount
                            ? <span style={{ color: '#15803D' }}>{l.debitAccount.reducedCode ?? l.debitAccount.code} — {l.debitAccount.name}</span>
                            : <span style={{ color: '#B91C1C' }}>⚠ {l.debitCode || 'vazio'}</span>}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {l.creditAccount
                            ? <span style={{ color: '#15803D' }}>{l.creditAccount.reducedCode ?? l.creditAccount.code} — {l.creditAccount.name}</span>
                            : <span style={{ color: '#B91C1C' }}>⚠ {l.creditCode || 'vazio'}</span>}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {l.status === 'ok'    && <FiCheckCircle size={14} color="#15803D" />}
                          {l.status === 'warn'  && <FiAlertTriangle size={14} color="#D97706" />}
                          {l.status === 'error' && <FiXCircle size={14} color="#B91C1C" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.errors > 0 && (
                <div style={{ marginTop: 12, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#B91C1C' }}>
                  ⚠ {preview.errors} linha(s) com contas não encontradas. Corrija a planilha antes de importar.
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Done */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <FiCheckCircle size={40} color="#15803D" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>Importação concluída</h3>
              <p style={{ fontSize: 13, color: '#6B7280' }}>{result.imported} lançamentos gerados. {result.errors?.length > 0 ? `${result.errors.length} erros.` : ''}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          {step === 'upload' && (
            <button onClick={handlePreview} disabled={!file || loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: !file || loading ? 0.5 : 1 }}>
              {loading ? 'Processando...' : 'Validar Planilha'}
            </button>
          )}
          {step === 'preview' && (
            <button onClick={handleConfirm} disabled={loading || !canConfirm} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: canConfirm ? '#111' : '#9CA3AF', color: '#fff', fontSize: 13, cursor: canConfirm ? 'pointer' : 'not-allowed', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Importando...' : 'Confirmar Importação'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};