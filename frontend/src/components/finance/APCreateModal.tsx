// ============================================================
// LEDGR — apps/web/src/pages/finance/components/APCreateModal.tsx
// Modal de cadastro manual de titulo a pagar
// ============================================================
import React, { useState, useEffect } from 'react';
import { SmartDateInput } from '../SmartDateInput';
import { SmartMonthInput } from '../SmartMonthInput';
import { useAccountsPayable } from '../../pages/finance/hooks/useAccountsPayable';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

function today() { return new Date().toISOString().slice(0, 10); }
function currentCompetence() { return new Date().toISOString().slice(0, 7); }

export function APCreateModal({ onClose, onSuccess }: Props) {
  const { createAP, loading, error } = useAccountsPayable();

  const [title, setTitle] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCnpj, setSupplierCnpj] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');

  const [grossAmount, setGrossAmount] = useState('0.00');
  const [discountAmount, setDiscountAmount] = useState('0.00');
  const [netAmount, setNetAmount] = useState('0.00');

  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [competenceMonth, setCompetenceMonth] = useState(currentCompetence());

  const [parcelar, setParcelar] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('2');

  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');

  // Recalcula valor liquido automaticamente (bruto - desconto)
  useEffect(() => {
    const g = parseFloat(grossAmount) || 0;
    const d = parseFloat(discountAmount) || 0;
    const n = Math.max(g - d, 0);
    setNetAmount(n.toFixed(2));
  }, [grossAmount, discountAmount]);

  // Competencia acompanha o mes da emissao, ate o usuario mexer manualmente
  useEffect(() => {
    setCompetenceMonth(issueDate.slice(0, 7));
  }, [issueDate]);

  const handleSubmit = async () => {
    setValidationError('');
    if (!title.trim()) { setValidationError('Informe a descricao do titulo.'); return; }
    if (!(parseFloat(grossAmount) > 0)) { setValidationError('Informe um valor bruto maior que zero.'); return; }
    if (!issueDate || !dueDate) { setValidationError('Informe data de emissao e vencimento.'); return; }
    if (dueDate < issueDate) { setValidationError('Vencimento nao pode ser anterior a emissao.'); return; }
    if (parcelar && (parseInt(totalInstallments) < 2)) { setValidationError('Numero de parcelas deve ser 2 ou mais.'); return; }

    try {
      await createAP({
        title: title.trim(),
        origin: 'MANUAL',
        supplierName: supplierName.trim() || undefined,
        supplierCnpj: supplierCnpj.trim() || undefined,
        documentNumber: documentNumber.trim() || undefined,
        grossAmount: parseFloat(grossAmount),
        discountAmount: parseFloat(discountAmount) || 0,
        netAmount: parseFloat(netAmount),
        issueDate,
        dueDate,
        competenceMonth,
        totalInstallments: parcelar ? parseInt(totalInstallments) : undefined,
        notes: notes.trim() || undefined,
      });
      onSuccess();
    } catch { /* erro ja exposto via `error` do hook */ }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.42)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12,
        width: 560,
        maxHeight: '88vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Novo Titulo a Pagar</div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>Cadastro manual</div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15,
          }}>&times;</button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {(error || validationError) && (
            <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>
              {'\u26A0'} {validationError || error}
            </div>
          )}

          {/* Identificacao */}
          <div style={{ background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>IDENTIFICACAO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <Label>Descricao do Titulo *</Label>
                <input style={inputSt} placeholder="Ex: Aluguel sala comercial - Julho/2026"
                  value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <Label>Fornecedor</Label>
                  <input style={inputSt} placeholder="Nome do fornecedor"
                    value={supplierName} onChange={e => setSupplierName(e.target.value)} />
                </div>
                <div>
                  <Label>CNPJ/CPF</Label>
                  <input style={inputSt} placeholder="00.000.000/0000-00"
                    value={supplierCnpj} onChange={e => setSupplierCnpj(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Numero do Documento</Label>
                <input style={inputSt} placeholder="Nota fiscal, boleto, contrato..."
                  value={documentNumber} onChange={e => setDocumentNumber(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Valores */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8 }}>VALORES</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <Label>Valor Bruto (R$) *</Label>
                <input type="number" step="0.01" min="0" style={inputSt}
                  value={grossAmount} onChange={e => setGrossAmount(e.target.value)} />
              </div>
              <div>
                <Label>Desconto (R$)</Label>
                <input type="number" step="0.01" min="0" style={inputSt}
                  value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
              </div>
              <div>
                <Label>Valor Liquido (R$)</Label>
                <input type="number" step="0.01" min="0" style={{ ...inputSt, background: '#F5F5F5', fontWeight: 600 }}
                  value={netAmount} onChange={e => setNetAmount(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Datas */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8 }}>DATAS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <Label>Emissao *</Label>
                <SmartDateInput style={inputSt} value={issueDate} onChange={v => setIssueDate(v)} />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <SmartDateInput style={inputSt} value={dueDate} onChange={v => setDueDate(v)} />
              </div>
              <div>
                <Label>Competencia</Label>
                <SmartMonthInput style={inputSt} value={competenceMonth} onChange={v => setCompetenceMonth(v)} />
              </div>
            </div>
          </div>

          {/* Parcelamento */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#555' }}>
              <input type="checkbox" checked={parcelar} onChange={e => setParcelar(e.target.checked)} />
              Parcelar este titulo em multiplas parcelas
            </label>
            {parcelar && (
              <div style={{ marginTop: 8, width: 160 }}>
                <Label>Numero de Parcelas</Label>
                <input type="number" min="2" style={inputSt}
                  value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} />
                <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>
                  O valor liquido sera dividido igualmente entre as parcelas, com vencimentos mensais a partir do vencimento informado.
                </div>
              </div>
            )}
          </div>

          {/* Observacoes */}
          <div>
            <Label>Observacoes</Label>
            <textarea style={{ ...inputSt, minHeight: 60, resize: 'vertical' as const, fontFamily: 'inherit' }}
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '11px 18px', borderTop: '1px solid #eee',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          background: '#FAFAFA',
        }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid #ddd',
            borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            background: loading ? '#aaa' : FIN_ACCENT,
            color: '#fff', border: 'none', borderRadius: 7,
            padding: '7px 18px', fontSize: 12, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Salvando...' : '+ Criar Titulo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 3 }}>{children}</label>;
}

const inputSt: React.CSSProperties = {
  width: '100%', border: '1px solid #ddd', borderRadius: 6,
  padding: '7px 10px', fontSize: 13, outline: 'none', background: '#fff',
  boxSizing: 'border-box',
};
