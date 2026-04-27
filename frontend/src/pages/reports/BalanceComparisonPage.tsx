// frontend/src/pages/reports/BalanceComparisonPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';

interface BalanceRow {
  conta: string;
  descricao: string;
  saldos: Record<number, number>;
}

type SortKey = 'conta' | number;
type SortDir = 'asc' | 'desc';

export const BalanceComparisonPage = () => {
  const { activeCompany } = useCompany();
  const [data, setData] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('conta');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const years = [2014, 2015, 2016, 2017, 2018, 2019, 2020];

  const loadReport = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`reports/balance-comparison/${activeCompany.id}`);
      setData(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar relatório', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => { loadReport(); }, [loadReport]);

  // ── Ordenação ──────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = [...data].sort((a, b) => {
    let valA: string | number;
    let valB: string | number;

    if (sortKey === 'conta') {
      valA = a.conta;
      valB = b.conta;
    } else {
      valA = a.saldos?.[sortKey] ?? 0;
      valB = b.saldos?.[sortKey] ?? 0;
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDir === 'asc'
        ? valA.localeCompare(valB, 'pt-BR')
        : valB.localeCompare(valA, 'pt-BR');
    }

    return sortDir === 'asc'
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number);
  });

  // ── Ícone de ordenação ─────────────────────────────────────
  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = sortKey === col;
    return (
      <span style={{ marginLeft: 4, display: 'inline-flex', flexDirection: 'column', gap: 1, verticalAlign: 'middle' }}>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
          <path d="M4 0L8 5H0L4 0Z"
            fill={active && sortDir === 'asc' ? '#0369A1' : '#CBD5E1'} />
        </svg>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
          <path d="M4 5L0 0H8L4 5Z"
            fill={active && sortDir === 'desc' ? '#0369A1' : '#CBD5E1'} />
        </svg>
      </span>
    );
  };

  // ── Export CSV ─────────────────────────────────────────────
  const exportToCSV = () => {
    if (data.length === 0) return;
    const headers = ['Conta', 'Descricao', ...years.map(y => y.toString())];
    const csvRows = sorted.map(row => [
      `"${row.conta}"`,
      `"${row.descricao}"`,
      ...years.map(year => row.saldos?.[year] ?? 0),
    ].join(','));
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Mapa_Saldos_ECD_${activeCompany?.name || 'Relatorio'}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Estilo base dos th ─────────────────────────────────────
  const thBase: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
    color: '#6B7280',
    background: '#F9FAFB',
    borderBottom: '0.5px solid #E5E7EB',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  };

  const thFixed: React.CSSProperties = {
    ...thBase,
    left: 0,
    zIndex: 20,
    minWidth: 320,
    boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)',
  };

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>

      {/* Header */}
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, padding: '3px 10px',
              borderRadius: 20, background: '#F0F9FF', color: '#0369A1',
            }}>
              ◆ Contábil
            </span>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: 0 }}>
            Mapa de Saldos (ECD)
          </h1>
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
            Comparativo Anual: {years[0]} – {years[years.length - 1]}
          </p>
        </div>

        <button
          onClick={exportToCSV}
          disabled={loading || data.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: data.length === 0 ? '#E5E7EB' : '#111111',
            color: data.length === 0 ? '#9CA3AF' : '#fff',
            fontSize: 13, fontWeight: 500, cursor: data.length === 0 ? 'default' : 'pointer',
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </header>

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
          <div style={{
            width: 32, height: 32, border: '2px solid #E5E7EB',
            borderTopColor: '#0369A1', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>Processando saldos históricos…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        /* Vazio */
      ) : data.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 80,
          border: '0.5px dashed #E5E7EB', borderRadius: 10,
          color: '#9CA3AF', fontSize: 13,
        }}>
          Nenhum dado encontrado para esta empresa no período selecionado.
        </div>

        /* Tabela */
      ) : (
        <div style={{
          border: '0.5px solid #E5E7EB', borderRadius: 10,
          overflow: 'auto',           // scroll horizontal E vertical
          maxHeight: 'calc(100vh - 160px)',
        }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 13, tableLayout: 'auto',
          }}>
            <thead>
              <tr>
                {/* Coluna fixa — Conta Analítica */}
                <th
                  style={thFixed}
                  onClick={() => handleSort('conta')}
                >
                  Conta Analítica <SortIcon col="conta" />
                </th>

                {/* Colunas de ano */}
                {years.map(year => (
                  <th
                    key={year}
                    style={{ ...thBase, textAlign: 'right', minWidth: 110 }}
                    onClick={() => handleSort(year)}
                  >
                    {year} <SortIcon col={year} />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.conta}
                  style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F0F9FF')}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA')}
                >
                  {/* Célula fixa */}
                  <td style={{
                    padding: '9px 14px',
                    borderBottom: '0.5px solid #F5F5F5',
                    position: 'sticky', left: 0,
                    background: 'inherit',
                    zIndex: 5,
                    boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)',
                    fontFamily: 'monospace',
                  }}>
                    <span style={{ fontWeight: 500, color: '#0369A1' }}>{row.conta}</span>
                    <span style={{ marginLeft: 8, color: '#374151', fontFamily: 'inherit', fontSize: 12 }}>
                      {row.descricao}
                    </span>
                  </td>

                  {/* Células de saldo */}
                  {years.map(year => {
                    const val = row.saldos?.[year] ?? 0;
                    return (
                      <td
                        key={`${row.conta}-${year}`}
                        style={{
                          padding: '9px 14px',
                          borderBottom: '0.5px solid #F5F5F5',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: val < 0 ? '#B91C1C' : val === 0 ? '#D1D5DB' : '#374151',
                          fontSize: 12,
                        }}
                      >
                        {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};