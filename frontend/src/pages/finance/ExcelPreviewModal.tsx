// frontend/src/pages/finance/ExcelPreviewModal.tsx
import React, { useState, useRef, useMemo } from 'react';
import { FiX, FiUpload, FiCheckCircle, FiAlertTriangle, FiXCircle, FiFilter } from 'react-icons/fi';

interface Props { onClose: () => void; onSuccess: () => void; companyId: string; token: string; }

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

function fmtBRL(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDate(s: string) { if (!s) return ''; try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return s; } }

// Limite configurado no backend para /bank-import/preview-excel e /bank-import/upload-excel
// (ver apps/api/src/modules/finance/bank-import.controller.ts) - manter em sincronia
const MAX_EXCEL_SIZE_MB = 60;
function humanFileSize(bytes: number) { return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; }
function friendlyUploadError(res: Response, data: any, file: File | null): string {
  if (res.status === 413) {
    const atual = file ? ` (arquivo enviado: ${humanFileSize(file.size)})` : '';
    return `Arquivo muito grande${atual}. O limite para planilhas mapeadas é de ${MAX_EXCEL_SIZE_MB}MB.`;
  }
  return data?.message ?? 'Erro ao processar a planilha.';
}

export const ExcelPreviewModal: React.FC<Props> = ({ onClose, onSuccess, companyId, token }) => {
  const [step, setStep]       = useState<'upload' | 'preview' | 'done'>('upload');
  const [file, setFile]       = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [result,  setResult]  = useState<any>(null);
  const [filter,  setFilter]  = useState<'all' | 'ok' | 'error' | 'warn'>('all');
  const [search,  setSearch]  = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const headers = { Authorization: `Bearer ${token}`, 'x-company-id': companyId };

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API}/bank-import/preview-excel`, { method: 'POST', headers, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyUploadError(res, data, file));
      setPreview(data);
      setStep('preview');
      if (data.errors > 0) setFilter('error');
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`${API}/bank-import/upload-excel`, { method: 'POST', headers, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyUploadError(res, data, file));
      setResult(data);
      setStep('done');
      onSuccess();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  const filteredLines = useMemo(() => {
    if (!preview?.lines) return [];
    return preview.lines.filter((l: any) => {
      const matchStatus = filter === 'all' || l.status === filter;
      const matchSearch = !search || l.description?.toLowerCase().includes(search.toLowerCase())
        || l.debitCode?.includes(search) || l.creditCode?.includes(search)
        || l.referencia?.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [preview, filter, search]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 1000, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>

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
                Selecione a planilha Excel LM com colunas: <strong>Data, Histórico, Crédito (R$), Débito (R$), Referência, débito, crédito</strong>.
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 12 }}>
                {[
                  { label: 'Total linhas', value: preview.total,      color: '#111',     f: 'all'   },
                  { label: 'OK',           value: preview.ok,         color: '#15803D',  f: 'ok'    },
                  { label: 'Erros',        value: preview.errors,     color: preview.errors > 0 ? '#B91C1C' : '#15803D', f: 'error' },
                  { label: 'Débitos',      value: fmtBRL(preview.totalDebits),  color: '#B91C1C',  f: null },
                  { label: 'Créditos',     value: fmtBRL(preview.totalCredits), color: '#15803D',  f: null },
                ].map(k => (
                  <div key={k.label}
                    onClick={() => k.f && setFilter(k.f as any)}
                    style={{ background: filter === k.f ? '#EFF6FF' : '#F9FAFB', border: `0.5px solid ${filter === k.f ? '#BFDBFE' : '#E5E7EB'}`, borderRadius: 8, padding: '8px 12px', cursor: k.f ? 'pointer' : 'default' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 3 }}>{k.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Filtros */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                <FiFilter size={13} color="#6B7280" />
                {(['all','ok','error','warn'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{ padding: '4px 12px', borderRadius: 20, border: '0.5px solid', fontSize: 11, cursor: 'pointer',
                      borderColor: filter === f ? '#111' : '#D1D5DB',
                      background: filter === f ? '#111' : '#fff',
                      color: filter === f ? '#fff' : '#374151', fontWeight: filter === f ? 600 : 400 }}>
                    {f === 'all' ? 'Todos' : f === 'ok' ? 'OK' : f === 'error' ? 'Erros' : 'Avisos'}
                  </button>
                ))}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar descrição, conta, referência..."
                  style={{ marginLeft: 'auto', height: 28, border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '0 10px', fontSize: 12, outline: 'none', width: 260 }} />
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{filteredLines.length} linhas</span>
              </div>

              {/* Tabela */}
              <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['#', 'Data', 'Descrição', 'Referência', 'Valor', 'Tipo', 'Cta Débito', 'Cta Crédito', 'St'].map(h => (
                        <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', borderBottom: '0.5px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.map((l: any) => (
                      <tr key={l.row} style={{ borderBottom: '0.5px solid #F5F5F5', background: l.status === 'error' ? '#FEF2F2' : l.status === 'warn' ? '#FFFBEB' : '#fff' }}>
                        <td style={{ padding: '5px 8px', color: '#9CA3AF', fontSize: 10 }}>{l.row}</td>
                        <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{fmtDate(l.date)}</td>
                        <td style={{ padding: '5px 8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.description}>{l.description}</td>
                        <td style={{ padding: '5px 8px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.referencia
                            ? <span style={{ fontSize: 10, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 6px', borderRadius: 10, fontWeight: 500 }}>{l.referencia}</span>
                            : <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', whiteSpace: 'nowrap', color: l.type === 'DEBIT' ? '#B91C1C' : '#15803D' }}>{fmtBRL(l.value)}</td>
                        <td style={{ padding: '5px 8px' }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: l.type === 'DEBIT' ? '#FEF2F2' : '#F0FDF4', color: l.type === 'DEBIT' ? '#B91C1C' : '#15803D' }}>
                            {l.type === 'DEBIT' ? 'D' : 'C'}
                          </span>
                        </td>
                        <td style={{ padding: '5px 8px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.debitAccount
                            ? <span style={{ color: '#15803D' }}>{l.debitAccount.reducedCode ?? l.debitAccount.code} — {l.debitAccount.name}</span>
                            : <span style={{ color: '#B91C1C', fontWeight: 600 }}>⚠ {l.debitCode || 'vazio'}</span>}
                        </td>
                        <td style={{ padding: '5px 8px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.creditAccount
                            ? <span style={{ color: '#15803D' }}>{l.creditAccount.reducedCode ?? l.creditAccount.code} — {l.creditAccount.name}</span>
                            : <span style={{ color: '#B91C1C', fontWeight: 600 }}>⚠ {l.creditCode || 'vazio'}</span>}
                        </td>
                        <td style={{ padding: '5px 8px' }}>
                          {l.status === 'ok'    && <FiCheckCircle size={13} color="#15803D" />}
                          {l.status === 'warn'  && <FiAlertTriangle size={13} color="#D97706" />}
                          {l.status === 'error' && <FiXCircle size={13} color="#B91C1C" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.errors > 0 && (
                <div style={{ marginTop: 10, background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#B91C1C' }}>
                  ⚠ {preview.errors} linha(s) com contas não encontradas. Linhas com erro serão ignoradas na importação.
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Done */}
          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <FiCheckCircle size={40} color="#15803D" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>Importação concluída</h3>
              <p style={{ fontSize: 13, color: '#6B7280' }}>{result.imported} lançamentos gerados. {result.errors?.length > 0 ? `${result.errors.length} linha(s) com erro ignoradas.` : 'Sem erros.'}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>
            {step === 'preview' && preview?.errors > 0 && `${preview.errors} linha(s) com erro serão ignoradas`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
              {step === 'done' ? 'Fechar' : 'Cancelar'}
            </button>
            {step === 'upload' && (
              <button onClick={handlePreview} disabled={!file || loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: !file || loading ? 0.5 : 1 }}>
                {loading ? 'Processando...' : 'Validar Planilha'}
              </button>
            )}
            {step === 'preview' && (
              <button onClick={handleConfirm} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
                {loading ? 'Importando...' : `Confirmar Importação${preview?.errors > 0 ? ` (${preview.ok} OK)` : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
