// frontend/src/pages/finance/FluxoCaixaPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const AC = '#0369A1';
const AC_SURF = '#F0F9FF';

function fmtBRL(v: any) { return Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

const BAR_MAX_H = 80;

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const h = max > 0 ? Math.max(4, (value / max) * BAR_MAX_H) : 4;
  return <div style={{ width: 12, height: h, background: color, borderRadius: 3, alignSelf: 'flex-end' }} />;
}

export default function FluxoCaixaPage() {
  const year = new Date().getFullYear();
  const [from, setFrom]       = useState(`${year}-01`);
  const [to, setTo]           = useState(`${year}-12`);
  const [propertyId, setPropertyId] = useState('');
  const [fixedAssets, setFixedAssets] = useState<any[]>([]);
  const [minYear, setMinYear] = useState(2021);
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [bancario, setBancario] = useState<any>(null);
  const [view, setView]       = useState<'mensal'|'grafico'|'bancario'>('mensal');

  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const parseYM = (ym: string) => ({ y: ym.split('-')[0], m: ym.split('-')[1] });
  const fromP = parseYM(from); const toP = parseYM(to);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { from, to };
      if (propertyId) params.fixedAssetId = propertyId;
      const { data: d } = await api.get('/finance/cashflow/summary', { params });
      setData(d);
    } catch { }
    finally { setLoading(false); }
  }, [from, to, propertyId]);

  useEffect(() => {
    if (view !== 'bancario') return;
    api.get('/finance/cashflow/bancario', { params: { from, to } })
      .then(r => setBancario(r.data))
      .catch(() => {});
  }, [view, from, to]);

  useEffect(() => {
    const t = setTimeout(() => load(), 400);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.get('/finance/cashflow/min-year').then(r => setMinYear(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/assets', { params: { group: 'REAL_ESTATE', status: 'ACTIVE' } }).then(r => setFixedAssets(r.data?.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const months: any[] = data?.months ?? [];
  const totals        = data?.totals ?? {};
  const maxInflow  = Math.max(...months.map((m: any) => m.inflow.predicted), 1);
  const maxOutflow = Math.max(...months.map((m: any) => m.outflow.predicted), 1);
  const maxAll     = Math.max(maxInflow, maxOutflow);

  const S = {
    th: { padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' as const, background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', textAlign: 'left' as const },
    td: { padding: '10px 12px', fontSize: 13, color: '#374151', borderBottom: '0.5px solid #F5F5F5' },
    input: { border: '0.5px solid #E5E7EB', borderRadius: 6, padding: '6px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #E5E7EB', padding: '14px 24px', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: AC }}>◆ Financeiro</span>
        <h1 style={{ fontSize: 18, fontWeight: 600, color: '#111', margin: '2px 0 12px' }}>Fluxo de Caixa Gerencial</h1>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 3 }}>De</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={fromP.m} onChange={e => setFrom(fromP.y + '-' + e.target.value)} style={{ ...S.input, width: 80 }}>
                {MESES.map((ml, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{ml}</option>)}
              </select>
              <select value={fromP.y} onChange={e => setFrom(e.target.value + '-' + fromP.m)} style={{ ...S.input, width: 80 }}>
                {Array.from({ length: new Date().getFullYear() - minYear + 2 }, (_,i) => minYear + i).map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 3 }}>Até</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <select value={toP.m} onChange={e => setTo(toP.y + '-' + e.target.value)} style={{ ...S.input, width: 80 }}>
                {MESES.map((ml, i) => <option key={i} value={String(i+1).padStart(2,'0')}>{ml}</option>)}
              </select>
              <select value={toP.y} onChange={e => setTo(e.target.value + '-' + toP.m)} style={{ ...S.input, width: 80 }}>
                {Array.from({ length: new Date().getFullYear() - minYear + 2 }, (_,i) => minYear + i).map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 3 }}>Imóvel</label>
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)} style={{ ...S.input, width: 220 }}>
              <option value="">Todos os imóveis</option>
              {fixedAssets.map((a: any) => <option key={a.id} value={a.id}>{a.internalCode} — {a.description?.substring(0,40)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 18 }}>
            {(['mensal','grafico','bancario'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '6px 14px', borderRadius: 6, border: `0.5px solid ${view===v ? AC : '#E5E7EB'}`, background: view===v ? AC : '#fff', color: view===v ? '#fff' : '#374151', fontSize: 12, cursor: 'pointer', fontWeight: view===v ? 600 : 400 }}>
                {v === 'mensal' ? '📋 Tabela' : v === 'grafico' ? '📊 Gráfico' : '🏦 Bancário'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, padding: '14px 24px', background: AC_SURF, flexShrink: 0 }}>
        {[
          { label: 'Receita Prevista',  value: totals.inflowPredicted,  color: '#15803D' },
          { label: 'Receita Realizada', value: totals.inflowRealized,   color: '#15803D' },
          { label: 'Despesa Prevista',  value: totals.outflowPredicted, color: '#B91C1C' },
          { label: 'Despesa Realizada', value: totals.outflowRealized,  color: '#B91C1C' },
          { label: 'Saldo Previsto',    value: totals.balancePredicted, color: totals.balancePredicted >= 0 ? '#0369A1' : '#B91C1C' },
          { label: 'Saldo Realizado',   value: totals.balanceRealized,  color: totals.balanceRealized  >= 0 ? '#0369A1' : '#B91C1C' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: k.color }}>{fmtBRL(k.value)}</div>
          </div>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Carregando...</div>
        ) : months.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Nenhum dado no período selecionado.</div>
        ) : view === 'mensal' ? (
          /* Tabela mensal */
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Mês','Receita Prev.','Receita Real.','Despesa Prev.','Despesa Real.','Saldo Prev.','Saldo Real.','Acumulado'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m: any) => {
                const balOk = m.balance.realized >= 0;
                return (
                  <tr key={m.month}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{m.label}</td>
                    <td style={{ ...S.td, color: '#15803D', fontFamily: 'monospace' }}>{fmtBRL(m.inflow.predicted)}</td>
                    <td style={{ ...S.td, color: '#15803D', fontFamily: 'monospace' }}>{fmtBRL(m.inflow.realized)}</td>
                    <td style={{ ...S.td, color: '#B91C1C', fontFamily: 'monospace' }}>{fmtBRL(m.outflow.predicted)}</td>
                    <td style={{ ...S.td, color: '#B91C1C', fontFamily: 'monospace' }}>{fmtBRL(m.outflow.realized)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: m.balance.predicted >= 0 ? '#0369A1' : '#B91C1C', fontWeight: 600 }}>{fmtBRL(m.balance.predicted)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: balOk ? '#0369A1' : '#B91C1C', fontWeight: 600 }}>{fmtBRL(m.balance.realized)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: m.balance.cumulative >= 0 ? '#111' : '#B91C1C', fontWeight: 700 }}>{fmtBRL(m.balance.cumulative)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Gráfico de barras */
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', padding: '20px 0', overflowX: 'auto' }}>
            {months.map((m: any) => (
              <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: BAR_MAX_H }}>
                  <Bar value={m.inflow.predicted}  max={maxAll} color="#86EFAC" />
                  <Bar value={m.inflow.realized}   max={maxAll} color="#15803D" />
                  <Bar value={m.outflow.predicted} max={maxAll} color="#FCA5A5" />
                  <Bar value={m.outflow.realized}  max={maxAll} color="#B91C1C" />
                </div>
                <div style={{ fontSize: 10, color: '#6B7280', textAlign: 'center' }}>{m.label}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: m.balance.realized >= 0 ? '#0369A1' : '#B91C1C' }}>{fmtBRL(m.balance.realized)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Legenda gráfico */}
        {view === 'grafico' && (
          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { color: '#86EFAC', label: 'Receita Prevista' },
              { color: '#15803D', label: 'Receita Realizada' },
              { color: '#FCA5A5', label: 'Despesa Prevista' },
              { color: '#B91C1C', label: 'Despesa Realizada' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
                <span style={{ fontSize: 12, color: '#6B7280' }}>{l.label}</span>
              </div>
            ))}
          </div>
        )}
        {/* Tab: Bancário */}
        {view === 'bancario' && bancario && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Total Entradas', value: bancario.totals.credits, color: '#15803D' },
                { label: 'Total Saídas',   value: bancario.totals.debits,  color: '#B91C1C' },
                { label: 'Saldo Período',  value: bancario.totals.balance, color: bancario.totals.balance >= 0 ? '#0369A1' : '#B91C1C' },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', borderTop: '3px solid ' + k.color }}>
                  <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{fmtBRL(k.value)}</div>
                </div>
              ))}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Mês','Entradas','Saídas','Saldo','Acumulado','Transações'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {bancario.months.map((m: any) => (
                  <tr key={m.month}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{m.label}</td>
                    <td style={{ ...S.td, color: '#15803D', fontFamily: 'monospace' }}>{fmtBRL(m.credits)}</td>
                    <td style={{ ...S.td, color: '#B91C1C', fontFamily: 'monospace' }}>{fmtBRL(m.debits)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 600, color: m.balance >= 0 ? '#0369A1' : '#B91C1C' }}>{fmtBRL(m.balance)}</td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: m.cumulative >= 0 ? '#111' : '#B91C1C' }}>{fmtBRL(m.cumulative)}</td>
                    <td style={{ ...S.td, color: '#6B7280' }}>{m.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {view === 'bancario' && !bancario && (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Carregando dados bancários...</div>
        )}
      </div>
    </div>
  );
}