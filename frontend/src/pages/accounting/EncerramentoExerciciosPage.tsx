// frontend/src/pages/accounting/EncerramentoExerciciosPage.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';
import { EncerramentoExercicioModal, classificarFechamento } from './EncerramentoExercicioModal';

interface Exercicio {
  year: number;
  status: 'ENCERRADO' | 'ABERTO';
  closedAt: string | null;
  totalAtivo: number;
  totalPassivoPL: number;
  resultado: number;
  diferenca: number;
  equilibrado: boolean;
  fechamentos: { date: string; resultado: number; resultadoTipo: 'LUCRO' | 'PREJUIZO' | 'NEUTRO' }[];
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

  // NOVO (16/09/2026): tabela mais compacta (padding reduzido) + coluna de
  // data/hora do encerramento (createdAt do lancamento de fechamento).
  const thSt: React.CSSProperties = { padding: '6px 10px', fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdSt: React.CSSProperties = { padding: '7px 10px' };
  const fmtDataHora = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

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
                <th style={thSt}>Exercício</th>
                <th style={thSt}>Status</th>
                <th style={thSt}>Fechamentos</th>
                <th style={thSt}>Encerrado em</th>
                <th style={{ ...thSt, textAlign: 'right' }}>Resultado</th>
                <th style={thSt}>Situação Patrimonial</th>
                <th style={{ ...thSt, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {exercicios.map(ex => (
                <tr key={ex.year} style={{ borderTop: '1px solid #F3F4F6' }}>
                  <td style={{ ...tdSt, fontWeight: 700, fontFamily: 'monospace' }}>{ex.year}</td>
                  <td style={tdSt}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: ex.status === 'ENCERRADO' ? '#DCFCE7' : '#FEF3C7',
                      color: ex.status === 'ENCERRADO' ? '#15803D' : '#92400E',
                    }}>
                      {ex.status === 'ENCERRADO' ? 'Encerrado' : 'Aberto'}
                    </span>
                  </td>
                  <td style={tdSt}>
                    {ex.fechamentos.length === 0 ? (
                      <span style={{ color: '#D1D5DB', fontSize: 12 }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {ex.fechamentos.map(f => {
                          const t = classificarFechamento(f.date, ex.year);
                          const [fy, fm, fd] = f.date.split('-');
                          return (
                            <span key={f.date} title={`${f.resultadoTipo === 'PREJUIZO' ? 'Prejuízo' : 'Lucro'} de R$ ${fmtBRL(f.resultado)}`}
                              style={{
                                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                                background: t.bg, color: t.color,
                              }}>
                              {fd}/{fm}/{fy} · {t.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdSt, color: '#6B7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtDataHora(ex.closedAt)}
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap', color: ex.resultado >= 0 ? '#15803D' : '#B91C1C' }}>
                    {ex.resultado >= 0 ? '' : '–'}{fmtBRL(ex.resultado)}
                  </td>
                  <td style={tdSt}>
                    {ex.equilibrado ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16A34A', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <FiCheckCircle size={13} /> Equilibrado
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#DC2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        <FiAlertTriangle size={13} /> Diferença: R$ {fmtBRL(ex.diferenca)}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdSt, textAlign: 'right' }}>
                    {/* Exercicio ja encerrado: sem "Encerrar". Mantem "Gerenciar" (botao
                        discreto) porque o modal e o unico lugar de reverter o encerramento
                        e de ver/criar/reverter balancos intermediarios. */}
                    <button onClick={() => setModalYear(ex.year)}
                      style={ex.status === 'ENCERRADO'
                        ? { padding: '5px 12px', background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }
                        : { padding: '5px 12px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                      {ex.status === 'ENCERRADO' ? 'Gerenciar' : 'Encerrar'}
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
          onClose={() => { setModalYear(null); carregar(); }}
          onDone={() => { setModalYear(null); carregar(); }}
        />
      )}
    </div>
  );
};

export default EncerramentoExerciciosPage;
