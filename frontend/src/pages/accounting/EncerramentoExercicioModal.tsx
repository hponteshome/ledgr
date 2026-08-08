// frontend/src/pages/accounting/EncerramentoExercicioModal.tsx
import React, { useEffect, useState } from 'react';
import { FiX, FiCheckCircle, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import api from '../../services/api';

interface Props {
  defaultYear: number;
  onClose: () => void;
  onDone: () => void;
}

interface PreviewAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  saldo: number;
  zeragemTipo: 'DEBIT' | 'CREDIT';
  zeragemValor: number;
}

interface PreviewResult {
  year: number;
  accounts: PreviewAccount[];
  totalDebito: number;
  totalCredito: number;
  resultado: number;
  resultadoTipo: 'LUCRO' | 'PREJUIZO' | 'NEUTRO';
  missingConfig: string[];
  podeEncerrar: boolean;
  jaEncerrado: boolean;
}

const fmtBRL = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const EncerramentoExercicioModal: React.FC<Props> = ({ defaultYear, onClose, onDone }) => {
  const [year, setYear] = useState(defaultYear);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState('');

  const loadPreview = async (y: number) => {
    setLoading(true); setError(''); setPreview(null);
    try {
      const r = await api.get('/accounting/encerramento/preview', { params: { year: y } });
      setPreview(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao calcular a prévia do encerramento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPreview(year); }, [year]);

  const handleConfirm = async () => {
    if (!preview?.podeEncerrar) return;
    setConfirming(true); setError('');
    try {
      await api.post('/accounting/encerramento/confirmar', { year });
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao confirmar o encerramento.');
    } finally {
      setConfirming(false);
    }
  };

  const handleRevert = async () => {
    if (!preview?.jaEncerrado) return;
    if (!window.confirm(`Reverter o encerramento de ${year}? Os lançamentos de encerramento serão excluídos (soft-delete, ficam no histórico).`)) return;
    setReverting(true); setError('');
    try {
      await api.post('/accounting/encerramento/reverter', { year });
      await loadPreview(year);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao reverter o encerramento.');
    } finally {
      setReverting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ECFDF5', borderRadius: '14px 14px 0 0', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#047857' }}>◆ Contábil</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Encerramento de Exercício</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {/* Ano */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Exercício</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value, 10) || defaultYear)}
              style={{ width: 120, height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '0 10px', fontSize: 13 }}
            />
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: 13, padding: '24px 0' }}>
              <FiLoader className="animate-spin" size={16} /> Calculando prévia...
            </div>
          )}

          {error && (
            <div style={{ background: '#FCEBEB', border: '0.5px solid #F5C6C6', borderRadius: 8, padding: 12, marginBottom: 16, color: '#B91C1C', fontSize: 13 }}>
              {error}
            </div>
          )}

          {preview && !loading && (
            <>
              {preview.jaEncerrado && (
                <div style={{ background: '#FEF3C7', border: '0.5px solid #FDE68A', borderRadius: 8, padding: 12, marginBottom: 16, color: '#92400E', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <FiAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>O exercício {preview.year} já possui lançamento de encerramento. Não é possível encerrar novamente.</span>
                  </div>
                  <button
                    onClick={handleRevert}
                    disabled={reverting}
                    style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 6, border: '0.5px solid #DC2626', background: '#fff', color: '#DC2626', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {reverting ? 'Revertendo...' : 'Reverter Encerramento'}
                  </button>
                </div>
              )}

              {preview.missingConfig.length > 0 && (
                <div style={{ background: '#FEF3C7', border: '0.5px solid #FDE68A', borderRadius: 8, padding: 12, marginBottom: 16, color: '#92400E', fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <FiAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    Configure antes, na aba Contábil da empresa: <strong>{preview.missingConfig.join(', ')}</strong>.
                  </span>
                </div>
              )}

              {preview.accounts.length === 0 && !preview.jaEncerrado && (
                <div style={{ color: '#6B7280', fontSize: 13, padding: '16px 0' }}>
                  Nenhuma conta de Receita/Despesa com movimento em {preview.year}.
                </div>
              )}

              {preview.accounts.length > 0 && (
                <>
                  <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          <th style={{ textAlign: 'left', padding: '6px 10px', color: '#6B7280', fontWeight: 600 }}>Conta</th>
                          <th style={{ textAlign: 'right', padding: '6px 10px', color: '#6B7280', fontWeight: 600 }}>Valor</th>
                          <th style={{ textAlign: 'center', padding: '6px 10px', color: '#6B7280', fontWeight: 600 }}>D/C</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.accounts.map((a, i) => (
                          <tr key={a.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA', borderTop: '0.5px solid #F5F5F5' }}>
                            <td style={{ padding: '6px 10px', color: '#374151' }}>
                              <span style={{ fontFamily: 'monospace', color: '#1D4ED8', marginRight: 6 }}>{a.code}</span>
                              {a.name}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#374151' }}>{fmtBRL(a.zeragemValor)}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: '#6B7280' }}>{a.zeragemTipo === 'DEBIT' ? 'D' : 'C'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 16px', borderRadius: 8,
                    background: preview.resultadoTipo === 'LUCRO' ? '#ECFDF5' : preview.resultadoTipo === 'PREJUIZO' ? '#FEF2F2' : '#F9FAFB',
                    border: `0.5px solid ${preview.resultadoTipo === 'LUCRO' ? '#A7F3D0' : preview.resultadoTipo === 'PREJUIZO' ? '#FECACA' : '#E5E7EB'}`,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
                      {preview.resultadoTipo === 'LUCRO' ? 'Lucro do Exercício' : preview.resultadoTipo === 'PREJUIZO' ? 'Prejuízo do Exercício' : 'Resultado do Exercício'}
                    </span>
                    <span style={{
                      fontSize: 15, fontWeight: 600,
                      color: preview.resultadoTipo === 'LUCRO' ? '#047857' : preview.resultadoTipo === 'PREJUIZO' ? '#B91C1C' : '#374151',
                    }}>
                      R$ {fmtBRL(preview.resultado)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#FAFAFA', borderRadius: '0 0 14px 14px', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!preview?.podeEncerrar || confirming}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: preview?.podeEncerrar ? '#047857' : '#D1D5DB',
              color: '#fff', fontSize: 13, fontWeight: 500,
              cursor: preview?.podeEncerrar ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {confirming ? <FiLoader className="animate-spin" size={14} /> : <FiCheckCircle size={14} />}
            {confirming ? 'Encerrando...' : 'Confirmar Encerramento'}
          </button>
        </div>
      </div>
    </div>
  );
};
