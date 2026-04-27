// ============================================================
// LEDGR — src/pages/finance/components/FiscalDocumentModal.tsx
// ============================================================
import React, { useState, useEffect } from 'react';
import { FiscalDocumentFormData, FiscalDocumentType, FISCAL_DOC_TYPE_LABEL } from '../../pages/finance/types/finance';
import { useFiscalDocuments } from '../../pages/finance/hooks/useFinance';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_FORM: FiscalDocumentFormData = {
  documentType: 'NFE',
  documentNumber: '',
  accessKey: '',
  issuerCnpj: '',
  issuerName: '',
  issuerStateReg: '',
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  competenceMonth: new Date().toISOString().slice(0, 7),
  grossAmount: '',
  discountAmount: '0.00',
  netAmount: '',
  irAmount: '0.00',
  pisAmount: '0.00',
  cofinsAmount: '0.00',
  csllAmount: '0.00',
  issAmount: '0.00',
  inssAmount: '0.00',
  expenseAccountId: '',
  costCenter: '',
  notes: '',
  attachmentUrl: '',
};

const FIN_COLOR = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

export function FiscalDocumentModal({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState<FiscalDocumentFormData>(EMPTY_FORM);
  const [step, setStep] = useState<1 | 2>(1);
  const { createDocument, loading, error } = useFiscalDocuments();

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setStep(1);
    }
  }, [open]);

  // Recalcula netAmount automaticamente
  useEffect(() => {
    const gross = parseFloat(form.grossAmount) || 0;
    const discount = parseFloat(form.discountAmount) || 0;
    const ir = parseFloat(form.irAmount) || 0;
    const pis = parseFloat(form.pisAmount) || 0;
    const cofins = parseFloat(form.cofinsAmount) || 0;
    const csll = parseFloat(form.csllAmount) || 0;
    const iss = parseFloat(form.issAmount) || 0;
    const inss = parseFloat(form.inssAmount) || 0;
    const net = gross - discount - ir - pis - cofins - csll - iss - inss;
    setForm((f) => ({ ...f, netAmount: net > 0 ? net.toFixed(2) : '0.00' }));
  }, [
    form.grossAmount, form.discountAmount, form.irAmount,
    form.pisAmount, form.cofinsAmount, form.csllAmount,
    form.issAmount, form.inssAmount,
  ]);

  const isConsumo = form.documentType === 'CONSUMO';

  const handleChange = (field: keyof FiscalDocumentFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    try {
      await createDocument(form);
      onSuccess();
      onClose();
    } catch {
      // error já capturado no hook
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 680, maxHeight: '90vh',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{
          background: FIN_COLOR, padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
              Lançar Documento Fiscal
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
              Passo {step} de 2 — {step === 1 ? 'Identificação do Documento' : 'Valores e Retenções'}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 16,
          }}>×</button>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0' }}>
          {[1, 2].map((s) => (
            <div key={s} style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              fontSize: 12, fontWeight: step === s ? 600 : 400,
              color: step === s ? FIN_COLOR : '#888',
              borderBottom: `2px solid ${step === s ? FIN_ACCENT : 'transparent'}`,
              background: step === s ? FIN_LIGHT : '#fff',
              cursor: 'pointer',
            }} onClick={() => step > s && setStep(s as 1 | 2)}>
              {s === 1 ? '1. Identificação' : '2. Valores e Retenções'}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FCEBEB', color: '#A32D2D', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, marginBottom: 16,
              border: '1px solid #F09595',
            }}>
              ⚠ {error}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Tipo */}
              <FormRow label="Tipo de Documento *">
                <select
                  value={form.documentType}
                  onChange={(e) => handleChange('documentType', e.target.value as FiscalDocumentType)}
                  style={inputStyle}
                >
                  {(Object.keys(FISCAL_DOC_TYPE_LABEL) as FiscalDocumentType[]).map((t) => (
                    <option key={t} value={t}>{FISCAL_DOC_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </FormRow>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {!isConsumo && (
                  <FormRow label="Número do Documento">
                    <input
                      style={inputStyle}
                      placeholder="ex: 000.047"
                      value={form.documentNumber}
                      onChange={(e) => handleChange('documentNumber', e.target.value)}
                    />
                  </FormRow>
                )}
                <FormRow label="Competência *">
                  <input
                    style={inputStyle}
                    type="month"
                    value={form.competenceMonth}
                    onChange={(e) => handleChange('competenceMonth', e.target.value)}
                  />
                </FormRow>
              </div>

              {/* Chave NF-e */}
              {(form.documentType === 'NFE' || form.documentType === 'NFSE') && (
                <FormRow label="Chave de Acesso (44 dígitos)">
                  <input
                    style={inputStyle}
                    placeholder="00000000000000000000000000000000000000000000"
                    maxLength={44}
                    value={form.accessKey}
                    onChange={(e) => handleChange('accessKey', e.target.value.replace(/\D/g, ''))}
                  />
                </FormRow>
              )}

              {/* Emitente */}
              <div style={{
                background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px',
                borderLeft: `3px solid ${FIN_ACCENT}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: FIN_COLOR, marginBottom: 10 }}>
                  EMITENTE / FORNECEDOR
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                  <FormRow label="CNPJ *">
                    <input
                      style={inputStyle}
                      placeholder="00.000.000/0000-00"
                      value={form.issuerCnpj}
                      onChange={(e) => handleChange('issuerCnpj', e.target.value)}
                    />
                  </FormRow>
                  <FormRow label="Razão Social *">
                    <input
                      style={inputStyle}
                      placeholder="Nome do fornecedor"
                      value={form.issuerName}
                      onChange={(e) => handleChange('issuerName', e.target.value)}
                    />
                  </FormRow>
                </div>
              </div>

              {/* Datas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <FormRow label="Data de Emissão *">
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => handleChange('issueDate', e.target.value)}
                  />
                </FormRow>
                <FormRow label="Data de Vencimento *">
                  <input
                    style={inputStyle}
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => handleChange('dueDate', e.target.value)}
                  />
                </FormRow>
              </div>

              {/* Notas */}
              <FormRow label="Observações">
                <textarea
                  style={{ ...inputStyle, height: 64, resize: 'vertical' }}
                  placeholder="Observações sobre o documento..."
                  value={form.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                />
              </FormRow>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Valores principais */}
              <div style={{
                background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px',
                borderLeft: `3px solid ${FIN_ACCENT}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: FIN_COLOR, marginBottom: 10 }}>
                  VALORES PRINCIPAIS
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <FormRow label="Valor Bruto *">
                    <input style={inputStyle} type="number" step="0.01" placeholder="0,00"
                      value={form.grossAmount}
                      onChange={(e) => handleChange('grossAmount', e.target.value)} />
                  </FormRow>
                  <FormRow label="Desconto">
                    <input style={inputStyle} type="number" step="0.01" placeholder="0,00"
                      value={form.discountAmount}
                      onChange={(e) => handleChange('discountAmount', e.target.value)} />
                  </FormRow>
                  <FormRow label="Valor Líquido">
                    <input style={{ ...inputStyle, background: '#f5f5f5', color: FIN_COLOR, fontWeight: 600 }}
                      readOnly value={form.netAmount} />
                  </FormRow>
                </div>
              </div>

              {/* Retenções */}
              <div style={{ borderRadius: 8, padding: '12px 14px', border: '1px solid #e0e0e0' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 10 }}>
                  RETENÇÕES (deixe 0,00 se não houver)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {[
                    { key: 'irAmount', label: 'IR Retido' },
                    { key: 'pisAmount', label: 'PIS' },
                    { key: 'cofinsAmount', label: 'COFINS' },
                    { key: 'csllAmount', label: 'CSLL' },
                    { key: 'issAmount', label: 'ISS Retido' },
                    { key: 'inssAmount', label: 'INSS' },
                  ].map(({ key, label }) => (
                    <FormRow key={key} label={label}>
                      <input style={inputStyle} type="number" step="0.01" placeholder="0,00"
                        value={(form as any)[key]}
                        onChange={(e) => handleChange(key as any, e.target.value)} />
                    </FormRow>
                  ))}
                </div>
              </div>

              {/* Resumo da integração */}
              <div style={{
                background: '#E8F0FA', borderRadius: 8, padding: '12px 14px',
                border: '1px solid #B5D4F4',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1A3A5C', marginBottom: 8 }}>
                  📋 AO CONFIRMAR, SERÁ GERADO AUTOMATICAMENTE:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { label: 'Título AP', desc: `R$ ${form.netAmount || '0,00'}`, color: '#185FA5', bg: '#E6F1FB' },
                    { label: 'Lançamento Contábil', desc: 'Débito + Crédito', color: '#3B6D11', bg: '#EAF3DE' },
                    { label: 'Evento na Agenda', desc: `Venc. ${form.dueDate || '—'}`, color: FIN_COLOR, bg: FIN_LIGHT },
                  ].map(({ label, desc, color, bg }) => (
                    <div key={label} style={{
                      flex: 1, background: bg, borderRadius: 6, padding: '8px 10px',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color }}>{label}</div>
                      <div style={{ fontSize: 11, color, opacity: 0.75 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #e0e0e0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fafafa',
        }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid #ddd',
            borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
          }}>Cancelar</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step === 2 && (
              <button onClick={() => setStep(1)} style={{
                background: 'transparent', border: `1px solid ${FIN_ACCENT}`,
                color: FIN_COLOR, borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
              }}>← Voltar</button>
            )}
            {step === 1 ? (
              <button onClick={() => setStep(2)} style={{
                background: FIN_COLOR, color: '#fff', border: 'none',
                borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Próximo →</button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} style={{
                background: loading ? '#aaa' : FIN_ACCENT, color: '#fff', border: 'none',
                borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Salvando...' : '✓ Confirmar e Integrar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers de UI ─────────────────────────────────────────────
function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #ddd',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  outline: 'none',
  background: '#fff',
};
