// frontend/src/pages/sistema/CalculadoraCorrecaoPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const INDICADORES = [
  { key: 'SELIC', label: 'Selic' },
  { key: 'IPCA',  label: 'IPCA' },
  { key: 'IGPM',  label: 'IGP-M' },
  { key: 'IGPDI', label: 'IGP-DI' },
  { key: 'INPC',  label: 'INPC' },
  { key: 'TR',    label: 'TR' },
];

const MESES = [
  '01 - Janeiro', '02 - Fevereiro', '03 - Marco', '04 - Abril', '05 - Maio', '06 - Junho',
  '07 - Julho', '08 - Agosto', '09 - Setembro', '10 - Outubro', '11 - Novembro', '12 - Dezembro',
];

const S = {
  page:  { padding: '24px 0', fontFamily: 'var(--font-sans,system-ui)', fontSize: 14, color: 'var(--color-text-primary)', maxWidth: 720 } as React.CSSProperties,
  card:  { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 } as React.CSSProperties,
  input: { height: 32, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 9px', fontSize: 13, background: 'var(--color-background-primary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' as const } as React.CSSProperties,
  label: { fontSize: 10, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 },
  btn:   { height: 30, border: '0.5px solid var(--color-border-secondary)', borderRadius: 6, padding: '0 12px', fontSize: 12, cursor: 'pointer', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' } as React.CSSProperties,
  btnP:  { height: 34, border: 'none', borderRadius: 6, padding: '0 18px', fontSize: 13, cursor: 'pointer', background: '#111', color: '#fff', fontWeight: 600 } as React.CSSProperties,
  th:    { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, padding: '7px 10px', textAlign: 'right' as const, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  thL:   { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', fontSize: 10, fontWeight: 500, textTransform: 'uppercase' as const, padding: '7px 10px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)' },
  td:    { padding: '6px 10px', textAlign: 'right' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12 },
  tdL:   { padding: '6px 10px', textAlign: 'left' as const, borderBottom: '0.5px solid var(--color-border-tertiary)', fontSize: 12 },
};

function parseBR(v: string): number {
  return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
}
function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtComp(s: string): string {
  const [y, m] = s.split('-');
  return m + '/' + y;
}

export default function CalculadoraCorrecaoPage() {
  const navigate = useNavigate();
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 16 }, (_, i) => String(anoAtual - i));

  const [indicador, setIndicador] = useState('IGPM');
  const [valorOriginal, setValorOriginal] = useState('');
  const [mesIni, setMesIni] = useState('01');
  const [anoIni, setAnoIni] = useState(String(anoAtual - 1));
  const [mesFim, setMesFim] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [anoFim, setAnoFim] = useState(String(anoAtual));
  const [incluirInicio, setIncluirInicio] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<any>(null);

  async function handleCalcular() {
    setErro('');
    setResultado(null);
    const competenciaInicio = anoIni + '-' + mesIni;
    const competenciaFim = anoFim + '-' + mesFim;
    if (competenciaInicio > competenciaFim) { setErro('A competencia inicial deve ser anterior ou igual a final.'); return; }
    const valor = parseBR(valorOriginal);
    if (!valor) { setErro('Informe o valor original a ser corrigido.'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/tabelas-legais/indicadores/calcular', {
        indicador, competenciaInicio, competenciaFim, incluirInicio, valorOriginal: valor,
      });
      setResultado(data);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Erro ao calcular a correcao.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#0891B2', background: '#ECFEFF', padding: '2px 8px', borderRadius: 4 }}>SISTEMA</span>
            <h1 style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Calculadora de Correcao Monetaria</h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
            Atualiza um valor original aplicando o acumulado do indicador economico entre duas competencias.
          </p>
        </div>
        <button style={S.btn} onClick={() => navigate('/app/sistema/indicadores')}>Voltar para Indicadores</button>
      </div>

      <div style={S.card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.label}>Valor Original (R$)</label>
            <input style={S.input} placeholder="Ex: 5.000,00" value={valorOriginal} onChange={e => setValorOriginal(e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Indicador</label>
            <select style={S.input} value={indicador} onChange={e => setIndicador(e.target.value)}>
              {INDICADORES.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={S.label}>Mes Inicio</label>
            <select style={S.input} value={mesIni} onChange={e => setMesIni(e.target.value)}>
              {MESES.map(m => <option key={m} value={m.substring(0, 2)}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Ano Inicio</label>
            <select style={S.input} value={anoIni} onChange={e => setAnoIni(e.target.value)}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Mes Fim</label>
            <select style={S.input} value={mesFim} onChange={e => setMesFim(e.target.value)}>
              {MESES.map(m => <option key={m} value={m.substring(0, 2)}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Ano Fim</label>
            <select style={S.input} value={anoFim} onChange={e => setAnoFim(e.target.value)}>
              {anos.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={incluirInicio} onChange={e => setIncluirInicio(e.target.checked)} />
          Incluir o indice da competencia inicial no calculo (padrao: correcao conta a partir do mes seguinte)
        </label>

        {erro && <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 12 }}>{erro}</div>}

        <button style={S.btnP} onClick={handleCalcular} disabled={loading}>
          {loading ? 'Calculando...' : 'Calcular'}
        </button>
      </div>

      {resultado && (
        <>
          <div style={{ ...S.card, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <div>
              <div style={S.label}>Valor Original</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>R$ {fmtBRL(resultado.valorOriginal)}</div>
            </div>
            <div>
              <div style={S.label}>Fator Acumulado</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{resultado.fator.toFixed(6)}</div>
            </div>
            <div>
              <div style={S.label}>Variacao (%)</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: resultado.percentualAcumulado >= 0 ? '#15803D' : '#B91C1C' }}>
                {resultado.percentualAcumulado.toFixed(4)}%
              </div>
            </div>
            <div>
              <div style={S.label}>Valor Corrigido</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0891B2' }}>R$ {fmtBRL(resultado.valorCorrigido)}</div>
            </div>
          </div>

          {resultado.competenciasFaltantes?.length > 0 && (
            <div style={{ ...S.card, background: '#FFFBEB', border: '0.5px solid #FDE68A' }}>
              <span style={{ fontSize: 12, color: '#92400E' }}>
                Atencao: competencias sem taxa cadastrada para {INDICADORES.find(i => i.key === resultado.indicador)?.label}: {resultado.competenciasFaltantes.map(fmtComp).join(', ')}. O calculo desconsiderou esses meses -- cadastre-os em "Indicadores Economicos" para maior precisao.
              </span>
            </div>
          )}

          <div style={S.card}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
              Detalhamento mes a mes
            </p>
            <div style={{ overflowX: 'auto', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={S.thL}>Competencia</th>
                  <th style={S.th}>Taxa Mensal (%)</th>
                  <th style={S.th}>Fator Acumulado</th>
                </tr></thead>
                <tbody>
                  {resultado.meses.map((m: any, idx: number) => (
                    <tr key={m.competencia} style={{ background: idx % 2 === 0 ? 'var(--color-background-primary)' : 'var(--color-background-secondary)' }}>
                      <td style={S.tdL}>{fmtComp(m.competencia)}</td>
                      <td style={S.td}>{m.taxaMensal.toFixed(4)}%</td>
                      <td style={S.td}>{m.fatorAcumulado.toFixed(6)}</td>
                    </tr>
                  ))}
                  {resultado.meses.length === 0 && (
                    <tr><td colSpan={3} style={{ ...S.tdL, textAlign: 'center' as const, color: 'var(--color-text-secondary)' }}>Nenhuma taxa aplicada no periodo selecionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
