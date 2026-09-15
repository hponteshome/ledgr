// frontend/src/pages/accounting/EncerramentoExerciciosPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';
import { EncerramentoExercicioModal } from './EncerramentoExercicioModal';

interface Exercicio {
  year: number;
  status: 'ENCERRADO' | 'ABERTO';
  totalAtivo: number;
  totalPassivoPL: number;
  resultado: number;
  diferenca: number;
  equilibrado: boolean;
}

const fmtBRL = (v: number) =>
  Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EncerramentoExerciciosPage: React.FC = () => {
  const [exercicios, setExercicios] = useState<Exercicio[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalYear, setModalYear] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/accounting/encerramento/exercicios');
      setExercicios(r.data || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: '#9CA3AF' }}>Contabilidade</div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Encerramento de Exercícios</h1>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
        Situação de encerramento e equilíbrio patrimonial (Ativo x Passivo + PL) de cada exercício.
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Carregando...</div>
        ) : exercicios.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nenhum exercício com movimento contábil.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                <th style={{ padding: '8px 16px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'left' }}>Exercício</th>
                <th style={{ padding: '8px 16px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '8px 16px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'right' }}>Resultado do Exercício</th>
                <th style={{ padding: '8px 16px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'left' }}>Situação Patrimonial</th>
                <th style={{ padding: '8px 16px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {exercicios.map(ex => (
                <tr key={ex.year} style={{ borderTop: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 700, fontFamily: 'monospace' }}>{ex.year}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                      background: ex.status === 'ENCERRADO' ? '#DCFCE7' : '#FEF3C7',
                      color: ex.status === 'ENCERRADO' ? '#15803D' : '#92400E',
                    }}>
                      {ex.status === 'ENCERRADO' ? 'Encerrado' : 'Aberto'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: ex.resultado >= 0 ? '#15803D' : '#B91C1C' }}>
                    {ex.resultado >= 0 ? '' : '–'}{fmtBRL(ex.resultado)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    {ex.equilibrado ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16A34A', fontWeight: 600 }}>
                        <FiCheckCircle size={14} /> Equilibrado
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#DC2626', fontWeight: 600 }}>
                        <FiAlertTriangle size={14} /> Diferença: R$ {fmtBRL(ex.diferenca)}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button onClick={() => setModalYear(ex.year)}
                      style={{ padding: '6px 14px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalYear !== null && (
        <EncerramentoExercicioModal
          defaultYear={modalYear}
          onClose={() => setModalYear(null)}
          onDone={() => { setModalYear(null); carregar(); }}
        />
      )}
    </div>
  );
};

export default EncerramentoExerciciosPage;
