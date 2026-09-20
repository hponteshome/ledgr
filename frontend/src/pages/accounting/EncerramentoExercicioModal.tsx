// frontend/src/pages/accounting/EncerramentoExercicioModal.tsx
import React, { useEffect, useState } from 'react';
import { FiX, FiCheckCircle, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import api from '../../services/api';
import { SmartDateInput } from '../../components/SmartDateInput';

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
  closingDate: string;
  accounts: PreviewAccount[];
  totalDebito: number;
  totalCredito: number;
  resultado: number;
  resultadoTipo: 'LUCRO' | 'PREJUIZO' | 'NEUTRO';
  missingConfig: string[];
  podeEncerrar: boolean;
  jaEncerrado: boolean;
}

interface FechamentoDoAno {
  date: string;
  resultado: number;
  resultadoTipo: 'LUCRO' | 'PREJUIZO' | 'NEUTRO';
}

const fmtBRL = (v: number) =>
  (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Classifica o fechamento pela data: 31/12 = Anual; fim de trimestre
// (31/03, 30/06, 30/09) = Trimestral; qualquer outra data = Intermediario.
export type TipoFechamento = 'Anual' | 'Trimestral' | 'Intermediário';
export const classificarFechamento = (date: string, year: number): { label: TipoFechamento; bg: string; color: string } => {
  const md = date.slice(5);
  if (date === `${year}-12-31`) return { label: 'Anual', bg: '#DCFCE7', color: '#15803D' };
  if (md === '03-31' || md === '06-30' || md === '09-30') return { label: 'Trimestral', bg: '#DBEAFE', color: '#1D4ED8' };
  return { label: 'Intermediário', bg: '#FEF3C7', color: '#92400E' };
};

export const EncerramentoExercicioModal: React.FC<Props> = ({ defaultYear, onClose, onDone }) => {
  const [year, setYear] = useState(defaultYear);
  // NOVO (18/09/2026): balanco intermediario - data de fechamento flexivel
  // em vez de sempre 31/12 (ex: 30/06 pra um balanco avulso). Muda o ano
  // -> volta pro default 31/12 daquele ano; usuario pode sobrescrever.
  const [closingDate, setClosingDate] = useState(`${defaultYear}-12-31`);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [fechamentosDoAno, setFechamentosDoAno] = useState<FechamentoDoAno[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const loadPreview = async (y: number, cd: string) => {
    setLoading(true); setError(''); setPreview(null);
    try {
      const r = await api.get('/accounting/encerramento/preview', { params: { year: y, closingDate: cd } });
      setPreview(r.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao calcular a prévia do encerramento.');
    } finally {
      setLoading(false);
    }
  };

  // NOVO (18/09/2026): todos os fechamentos ja gravados naquele ano (anual
  // + intermediarios), pra ver/gerenciar tudo num so lugar sem precisar
  // ficar trocando a data as cegas pra descobrir o que ja foi feito.
  const loadFechamentos = async (y: number) => {
    try {
      const r = await api.get('/accounting/encerramento/fechamentos', { params: { year: y } });
      setFechamentosDoAno(r.data || []);
    } catch {
      setFechamentosDoAno([]);
    }
  };

  // CORRIGIDO (18/09/2026): so reseta a data de fechamento quando o ANO
  // de fato mudou - antes resetava a cada evento onChange do campo
  // "Exercicio", inclusive re-digitando o mesmo ano, apagando silenciosamente
  // uma data de fechamento intermediaria ja escolhida pelo usuario.
  const handleYearChange = (y: number) => {
    if (y === year) return;
    setYear(y);
    setClosingDate(`${y}-12-31`);
  };

  useEffect(() => { loadPreview(year, closingDate); }, [year, closingDate]);
  useEffect(() => { loadFechamentos(year); }, [year]);
  // some ao trocar de exercicio/data (a mensagem de reversao vale so p/ a data revertida)
  useEffect(() => { setAviso(''); }, [year, closingDate]);

  const handleConfirm = async () => {
    if (!preview?.podeEncerrar) return;
    setConfirming(true); setError('');
    try {
      const r = await api.post('/accounting/encerramento/confirmar', { year, closingDate });
      // NOVO (16/09/2026): a data de encerramento de um ano nunca pode ser
      // anterior a de um ano posterior ja encerrado - o backend reabre em
      // cascata os anos seguintes automaticamente; avisa aqui pra nao passar
      // despercebido.
      const anosReabertos: number[] = r.data?.anosReabertos || [];
      if (anosReabertos.length > 0) {
        window.alert(`Atenção: o(s) exercício(s) ${anosReabertos.join(', ')} foi(ram) reaberto(s) automaticamente, pois o resultado de ${year} muda a situação acumulada deles. Revise e encerre-os novamente quando apropriado.`);
      }
      onDone();
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;
      setError(
        (Array.isArray(msg) ? msg.join('; ') : msg) ||
        (status
          ? `Erro ao confirmar o encerramento (HTTP ${status}). Veja o log da API.`
          : `Erro ao confirmar o encerramento (${e?.message || 'sem resposta da API'}). Veja o log da API e confira se o encerramento chegou a ser gravado antes de tentar de novo.`)
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleRevert = async () => {
    if (!preview?.jaEncerrado) return;
    if (!window.confirm(`Reverter o encerramento em ${closingDate}? Os lançamentos de encerramento serão excluídos (soft-delete, ficam no histórico). Atenção: os encerramentos de datas POSTERIORES também serão revertidos.`)) return;
    setReverting(true); setError('');
    try {
      const r = await api.post('/accounting/encerramento/reverter', { year, closingDate });
      const posteriores: string[] = r.data?.datasPosterioresRevertidas || [];
      await loadPreview(year, closingDate);
      await loadFechamentos(year);
      setAviso(
        `Encerramento de ${closingDate.split('-').reverse().join('/')} revertido com sucesso.` +
        (posteriores.length > 0 ? ` Também foram revertidos os encerramentos posteriores: ${posteriores.map(d => d.split('-').reverse().join('/')).join(', ')}.` : '') +
        ' Clique em "Fechar" para voltar à lista.'
      );
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
          {/* Ano + Data de fechamento */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Exercício</label>
              <input
                type="number"
                value={year}
                onChange={e => handleYearChange(parseInt(e.target.value, 10) || defaultYear)}
                style={{ width: 120, height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '0 10px', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Data de Fechamento</label>
              <SmartDateInput
                value={closingDate}
                onChange={v => setClosingDate(v)}
                style={{ width: 160, height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '0 10px', fontSize: 13 }}
              />
              {closingDate !== `${year}-12-31` && (
                <p style={{ fontSize: 10, color: '#B45309', marginTop: 3 }}>Balanço intermediário (fora do fechamento anual em 31/12).</p>
              )}
            </div>
          </div>

          {/* NOVO (18/09/2026): todos os fechamentos ja gravados nesse ano
              (anual + intermediarios) num so lugar - clicar em "Selecionar"
              carrega aquela data no campo acima, habilitando o botao
              "Reverter Encerramento" que ja existe mais abaixo. */}
          {fechamentosDoAno.length > 0 && (
            <div style={{ marginBottom: 16, border: '0.5px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ padding: '8px 12px', background: '#F9FAFB', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                Fechamentos já gravados em {year}
              </div>
              {fechamentosDoAno.map(f => (
                <div key={f.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '0.5px solid #F3F4F6', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'monospace' }}>{f.date.split('-').reverse().join('/')}</span>
                    <span style={{ fontSize: 10, background: classificarFechamento(f.date, year).bg, color: classificarFechamento(f.date, year).color, padding: '2px 6px', borderRadius: 10 }}>
                      {classificarFechamento(f.date, year).label}
                    </span>
                    <span style={{ color: f.resultadoTipo === 'PREJUIZO' ? '#B91C1C' : '#15803D', fontWeight: 500 }}>
                      {f.resultadoTipo === 'PREJUIZO' ? '(' : ''}{fmtBRL(f.resultado)}{f.resultadoTipo === 'PREJUIZO' ? ')' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => setClosingDate(f.date)}
                    disabled={f.date === closingDate}
                    style={{ fontSize: 12, color: f.date === closingDate ? '#9CA3AF' : '#2563EB', background: 'none', border: 'none', cursor: f.date === closingDate ? 'default' : 'pointer' }}
                  >
                    {f.date === closingDate ? 'Selecionado' : 'Selecionar'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6B7280', fontSize: 13, padding: '24px 0' }}>
              <FiLoader className="animate-spin" size={16} /> Calculando prévia...
            </div>
          )}

          {aviso && (
            <div style={{ background: '#ECFDF5', border: '0.5px solid #A7F3D0', borderRadius: 8, padding: 12, marginBottom: 16, color: '#047857', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <FiCheckCircle size={15} style={{ flexShrink: 0 }} />
              <span>{aviso}</span>
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
            Fechar
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
