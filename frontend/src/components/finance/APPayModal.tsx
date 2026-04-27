// ============================================================
// LEDGR — apps/web/src/pages/finance/components/APPayModal.tsx
// Modal de baixa individual e em lote
// ============================================================
import React, { useState, useEffect } from 'react';
import {
  AccountsPayable, PaymentMethod,
  PAYMENT_METHOD_LABEL, remaining, fmtBRL, fmtDate,
} from '../../pages/finance/types/accounts-payable';
import { useAccountsPayable } from '../../pages/finance/hooks/useAccountsPayable';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

interface SingleProps {
  mode: 'single';
  ap: AccountsPayable;
  onClose: () => void;
  onSuccess: () => void;
}

interface BatchProps {
  mode: 'batch';
  items: AccountsPayable[];
  onClose: () => void;
  onSuccess: () => void;
}

type Props = SingleProps | BatchProps;

const PAYMENT_METHODS = Object.entries(PAYMENT_METHOD_LABEL) as [PaymentMethod, string][];

function today() { return new Date().toISOString().slice(0, 10); }

export function APPayModal(props: Props) {
  const { payAP, payBatch, loading, error } = useAccountsPayable();

  // Estado compartilhado para todos os itens do lote
  const [globalDate, setGlobalDate] = useState(today());
  const [globalMethod, setGlobalMethod] = useState<PaymentMethod>('PIX');
  const [globalReceipt, setGlobalReceipt] = useState('');

  // Estado por item (para lote com valores individuais)
  const isBatch = props.mode === 'batch';
  const items = isBatch ? props.items : [props.ap];

  const [itemValues, setItemValues] = useState<Record<string, {
    amount: string; discount: string; interest: string; fine: string;
  }>>({});

  useEffect(() => {
    const init: typeof itemValues = {};
    items.forEach(ap => {
      init[ap.id] = {
        amount: remaining(ap).toFixed(2),
        discount: '0.00',
        interest: '0.00',
        fine: '0.00',
      };
    });
    setItemValues(init);
  }, []);

  const totalToPay = items.reduce((s, ap) => {
    const v = itemValues[ap.id];
    return s + (v ? parseFloat(v.amount) || 0 : remaining(ap));
  }, 0);

  const handleSubmit = async () => {
    try {
      if (props.mode === 'single') {
        const v = itemValues[props.ap.id];
        await payAP(props.ap.id, {
          paidAt: globalDate,
          amount: v?.amount ?? remaining(props.ap).toFixed(2),
          discountApplied: v?.discount,
          interestApplied: v?.interest,
          fineApplied: v?.fine,
          paymentMethod: globalMethod,
          receiptRef: globalReceipt || undefined,
        });
      } else {
        const batchItems = items.map(ap => ({
          id: ap.id,
          paidAt: globalDate,
          amount: itemValues[ap.id]?.amount ?? remaining(ap).toFixed(2),
          paymentMethod: globalMethod,
          discountApplied: itemValues[ap.id]?.discount,
          receiptRef: globalReceipt || undefined,
        }));
        await payBatch(batchItems);
      }
      props.onSuccess();
    } catch { }
  };

  if (!Object.keys(itemValues).length) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.42)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12,
        width: isBatch ? 640 : 480,
        maxHeight: '88vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ background: FIN, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>
              {isBatch ? `Baixa em Lote — ${items.length} títulos` : 'Baixar Título'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 1 }}>
              {isBatch ? `Total: ${fmtBRL(totalToPay)}` : `${props.ap.title} · Restante: ${fmtBRL(remaining(props.ap))}`}
            </div>
          </div>
          <button onClick={props.onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
            borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 15,
          }}>×</button>
        </div>

        <div style={{ padding: 18, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {error && (
            <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 }}>
              ⚠ {error}
            </div>
          )}

          {/* Dados globais do pagamento */}
          <div style={{ background: FIN_LIGHT, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${FIN_ACCENT}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: FIN, marginBottom: 10 }}>DADOS DO PAGAMENTO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <Label>Data do Pagamento *</Label>
                <input type="date" style={inputSt} value={globalDate}
                  onChange={e => setGlobalDate(e.target.value)} />
              </div>
              <div>
                <Label>Forma de Pagamento *</Label>
                <select style={inputSt} value={globalMethod}
                  onChange={e => setGlobalMethod(e.target.value as PaymentMethod)}>
                  {PAYMENT_METHODS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <Label>Comprovante / Ref.</Label>
                <input style={inputSt} placeholder="Nº transação, chave PIX..."
                  value={globalReceipt} onChange={e => setGlobalReceipt(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Títulos */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8 }}>
              {isBatch ? 'TÍTULOS SELECIONADOS' : 'VALORES DO TÍTULO'}
            </div>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
              {/* Header da mini-tabela */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isBatch ? '2fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr',
                background: '#F5F5F5', padding: '6px 12px',
                fontSize: 10, fontWeight: 700, color: '#666',
                gap: 8,
              }}>
                <div>Título</div>
                <div>Restante</div>
                <div>Valor a pagar</div>
                {isBatch && <div>Desconto</div>}
                <div>Vencimento</div>
              </div>

              {items.map(ap => {
                const v = itemValues[ap.id];
                if (!v) return null;
                const rest = remaining(ap);

                return (
                  <div key={ap.id} style={{
                    display: 'grid',
                    gridTemplateColumns: isBatch ? '2fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr',
                    padding: '8px 12px', gap: 8,
                    borderTop: '1px solid #f0f0f0',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{ap.title}</div>
                      {ap.supplierName && <div style={{ fontSize: 10, color: '#888' }}>{ap.supplierName}</div>}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace' }}>{fmtBRL(rest)}</div>
                    <div>
                      <input type="number" step="0.01" style={{ ...inputSt, padding: '4px 7px', fontSize: 12 }}
                        value={v.amount}
                        onChange={e => setItemValues(prev => ({ ...prev, [ap.id]: { ...prev[ap.id], amount: e.target.value } }))}
                      />
                    </div>
                    {isBatch && (
                      <div>
                        <input type="number" step="0.01" placeholder="0,00"
                          style={{ ...inputSt, padding: '4px 7px', fontSize: 12 }}
                          value={v.discount}
                          onChange={e => setItemValues(prev => ({ ...prev, [ap.id]: { ...prev[ap.id], discount: e.target.value } }))}
                        />
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#666' }}>{fmtDate(ap.dueDate)}</div>
                  </div>
                );
              })}

              {/* Totalizador */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                padding: '8px 12px', background: '#FAFAFA',
                borderTop: '1px solid #e0e0e0', gap: 16,
              }}>
                <span style={{ fontSize: 12, color: '#666' }}>Total a pagar:</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: FIN }}>{fmtBRL(totalToPay)}</span>
              </div>
            </div>
          </div>

          {/* Desconto / Juros / Multa (apenas baixa individual) */}
          {!isBatch && (() => {
            const v = itemValues[props.ap.id];
            return v ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <Label>Desconto</Label>
                  <input type="number" step="0.01" placeholder="0,00" style={inputSt}
                    value={v.discount}
                    onChange={e => setItemValues(prev => ({ ...prev, [props.ap.id]: { ...prev[props.ap.id], discount: e.target.value } }))} />
                </div>
                <div>
                  <Label>Juros</Label>
                  <input type="number" step="0.01" placeholder="0,00" style={inputSt}
                    value={v.interest}
                    onChange={e => setItemValues(prev => ({ ...prev, [props.ap.id]: { ...prev[props.ap.id], interest: e.target.value } }))} />
                </div>
                <div>
                  <Label>Multa</Label>
                  <input type="number" step="0.01" placeholder="0,00" style={inputSt}
                    value={v.fine}
                    onChange={e => setItemValues(prev => ({ ...prev, [props.ap.id]: { ...prev[props.ap.id], fine: e.target.value } }))} />
                </div>
              </div>
            ) : null;
          })()}
        </div>

        {/* Footer */}
        <div style={{
          padding: '11px 18px', borderTop: '1px solid #eee',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          background: '#FAFAFA',
        }}>
          <button onClick={props.onClose} style={{
            background: 'transparent', border: '1px solid #ddd',
            borderRadius: 7, padding: '7px 14px', fontSize: 12, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            background: loading ? '#aaa' : FIN_ACCENT,
            color: '#fff', border: 'none', borderRadius: 7,
            padding: '7px 18px', fontSize: 12, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Processando…' : isBatch
              ? `✓ Confirmar ${items.length} baixas`
              : '✓ Confirmar pagamento'}
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
