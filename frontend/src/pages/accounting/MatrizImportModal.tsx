// frontend/src/pages/accounting/MatrizImportModal.tsx
// RENOMEADO 24/08/2026 (de IobImportModal.tsx): importa o Plano de Contas
// MATRIZ (formato proprio LEDGR).
// REESCRITO 25/08/2026: nao precisa mais de upload de arquivo - o backend le
// direto da tabela matriz_master_accounts (editada em Administracao do
// Sistema -> Plano de Contas Matriz).
import React, { useState } from 'react';
import { FiCheckCircle, FiXCircle, FiX } from 'react-icons/fi';

interface Props { onClose: () => void; onSuccess?: () => void; }

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

export const MatrizImportModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [step, setStep]       = useState<'inicio' | 'preview' | 'done'>('inicio');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult]   = useState<any>(null);
  const [incluirHotelaria, setIncluirHotelaria] = useState(false);

  const token   = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const headers = {
    Authorization: `Bearer ${token}`,
    'x-company-id': company.id ?? '',
    'Content-Type': 'application/json',
  };

  function body() {
    return JSON.stringify({ blocos: incluirHotelaria ? ['HOTELARIA'] : [] });
  }

  async function handleValidate() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/accounting/matriz/import-plano?dryRun=true`, { method: 'POST', headers, body: body() });
      const data = await res.json();
      setPreview(data);
      setStep('preview');
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/accounting/matriz/import-plano?dryRun=false`, { method: 'POST', headers, body: body() });
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
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1D4ED8' }}>◆ Contábil</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Importar Plano de Contas Matriz</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>

          {step === 'inicio' && (
            <div>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
                Aplica o Plano de Contas Matriz vigente (mantido em Administração do Sistema)
                a esta empresa. Contas ja existentes tem o código reduzido atualizado; contas
                novas sao criadas.
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#FFFBEB', border: '0.5px solid #FDE68A', borderRadius: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={incluirHotelaria} onChange={e => setIncluirHotelaria(e.target.checked)} />
                <span style={{ fontSize: 12, color: '#92400E' }}>
                  Incluir grupo de <strong>Operação Hoteleira</strong> (Receita, Custos e Despesas de hotel) — marque só se esta empresa for do ramo hoteleiro.
                </span>
              </label>
            </div>
          )}

          {step === 'preview' && preview && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'Total no plano', value: preview.stats?.total, color: '#111' },
                  { label: 'Contas mapeadas', value: preview.stats?.matched, color: '#15803D' },
                  { label: 'Contas a criar', value: preview.stats?.created, color: preview.stats?.created > 0 ? '#1D4ED8' : '#9CA3AF' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 500, color: k.color }}>{k.value ?? 0}</div>
                  </div>
                ))}
              </div>
              {preview.stats?.matched > 0 && (
                <div style={{ background: '#F0FDF4', border: '0.5px solid #BBF7D0', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FiCheckCircle size={13} color="#15803D" />
                    <span style={{ fontSize: 12, color: '#15803D' }}>{preview.stats.matched} contas terão o código reduzido atualizado.</span>
                  </div>
                </div>
              )}
              {preview.errors?.length > 0 && (
                <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: 12, marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#B91C1C', marginBottom: 6 }}>{preview.errors.length} erro(s)</div>
                  {preview.errors.slice(0, 10).map((e: any, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: '#B91C1C', fontFamily: 'monospace' }}>{e.message}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'done' && result && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {result.status === 'done' || result.status === 'partial' ? (
                <><FiCheckCircle size={40} color="#15803D" style={{ marginBottom: 12 }} />
                <h3 style={{ fontSize: 16, fontWeight: 500, color: '#111', margin: '0 0 8px' }}>Importação concluída</h3>
                <p style={{ fontSize: 13, color: '#6B7280' }}>{result.stats?.created > 0 ? `${result.stats.created} contas criadas. ` : ""}{result.stats?.matched > 0 ? `${result.stats.matched} contas atualizadas.` : ""}</p></>
              ) : (
                <><FiXCircle size={40} color="#B91C1C" style={{ marginBottom: 12 }} />
                <p style={{ fontSize: 13, color: '#B91C1C' }}>Erro na importação.</p></>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
            {step === 'done' ? 'Fechar' : 'Cancelar'}
          </button>
          {step === 'inicio' && (
            <button onClick={handleValidate} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Validando...' : 'Validar'}
            </button>
          )}
          {step === 'preview' && (
            <button onClick={handleConfirm} disabled={loading} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111', color: '#fff', fontSize: 13, cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Importando...' : 'Confirmar Importação'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
