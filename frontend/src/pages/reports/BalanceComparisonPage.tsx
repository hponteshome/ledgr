// frontend/src/pages/reports/BalanceComparisonPage.tsx
// REESCRITO 25/08/2026: anos fixos (2014-2020, hardcoded) substituidos por
// selecao de periodo (mes/ano inicial e final) - sistema gera automaticamente
// um fim-de-mes por mes no intervalo. Backend reescrito (BalanceComparisonService)
// para reaproveitar a logica ja validada do Balancete em vez do agrupamento
// bruto por ano do antigo BalancesService.getBalanceComparison.
import React, { useState, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';

interface ContaRow {
  conta: string;
  descricao: string;
  level: number;
  isAnalytic: boolean;
  saldos: Record<string, number>;
}

interface ContaRowAnual {
  conta: string;
  descricao: string;
  level: number;
  isAnalytic: boolean;
  saldoAnterior: number;
  saldos: Record<string, number>;
  movimentos: Record<string, number>;
}

type SortKey = 'conta' | string;
type SortDir = 'asc' | 'desc';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function formatPeriodo(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MESES[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

export const BalanceComparisonPage = () => {
  const { activeCompany } = useCompany();
  const anoAtual = new Date().getFullYear();

  const [mesIni, setMesIni] = useState(1);
  const [anoIni, setAnoIni] = useState(anoAtual - 1);
  const [mesFim, setMesFim] = useState(new Date().getMonth() + 1);
  const [anoFim, setAnoFim] = useState(anoAtual);

  const [periodos, setPeriodos] = useState<string[]>([]);
  const [data, setData] = useState<ContaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [gerado, setGerado] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('conta');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [apenasMovimentacao, setApenasMovimentacao] = useState(false);

  // NOVO: visao anual com movimento intercalado (12/09/2026)
  const [viewMode, setViewMode] = useState<'mensal' | 'anual'>('mensal');
  const [anoIniAnual, setAnoIniAnual] = useState(anoAtual - 2);
  const [anoFimAnual, setAnoFimAnual] = useState(anoAtual);
  const [anosAnuais, setAnosAnuais] = useState<number[]>([]);
  const [dataAnual, setDataAnual] = useState<ContaRowAnual[]>([]);

  const loadReport = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const startMonth = `${anoIni}-${String(mesIni).padStart(2, '0')}`;
      const endMonth = `${anoFim}-${String(mesFim).padStart(2, '0')}`;
      const res = await api.get(`reports/balance-comparison/${activeCompany.id}`, {
        params: { startMonth, endMonth },
      });
      setPeriodos(res.data?.periodos || []);
      setData(res.data?.contas || []);
      setGerado(true);
    } catch (err) {
      console.error('Erro ao carregar relatório', err);
      setData([]);
      setPeriodos([]);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, mesIni, anoIni, mesFim, anoFim]);

  const loadReportAnual = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const res = await api.get(`reports/balance-comparison/${activeCompany.id}/anual`, {
        params: { anoInicio: anoIniAnual, anoFim: anoFimAnual },
      });
      setAnosAnuais(res.data?.anos || []);
      setDataAnual(res.data?.contas || []);
      setGerado(true);
    } catch (err) {
      console.error('Erro ao carregar relatório anual', err);
      setDataAnual([]);
      setAnosAnuais([]);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, anoIniAnual, anoFimAnual]);

  const handleGerar = () => {
    viewMode === 'mensal' ? loadReport() : loadReportAnual();
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // NOVO (09/09/2026): "exibir apenas movimentacoes" esconde contas cujo
  // saldo e zero em TODOS os meses do periodo selecionado - reduz ruido de
  // contas cadastradas mas sem uso real. Linhas sinteticas ja vem com o
  // saldo somado dos descendentes, entao o filtro plano funciona sem
  // precisar de logica de arvore.
  const dataFiltrada = apenasMovimentacao
    ? data.filter((row) => periodos.some((p) => (row.saldos?.[p] ?? 0) !== 0))
    : data;

  const sorted = [...dataFiltrada].sort((a, b) => {
    let valA: string | number;
    let valB: string | number;
    if (sortKey === 'conta') {
      valA = a.conta; valB = b.conta;
    } else {
      valA = a.saldos?.[sortKey] ?? 0;
      valB = b.saldos?.[sortKey] ?? 0;
    }
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDir === 'asc' ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
    }
    return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
  });

  const dataFiltradaAnual = apenasMovimentacao
    ? dataAnual.filter((row) => anosAnuais.some((a) => Math.abs(row.movimentos?.[a as any] ?? 0) >= 0.005))
    : dataAnual;

  const sortedAnual = [...dataFiltradaAnual].sort((a, b) => {
    let valA: string | number;
    let valB: string | number;
    if (sortKey === 'conta') {
      valA = a.conta; valB = b.conta;
    } else if (sortKey === 'saldoAnterior') {
      valA = a.saldoAnterior; valB = b.saldoAnterior;
    } else if (sortKey.startsWith('mov-')) {
      const ano = sortKey.slice(4);
      valA = a.movimentos?.[ano as any] ?? 0; valB = b.movimentos?.[ano as any] ?? 0;
    } else if (sortKey.startsWith('saldo-')) {
      const ano = sortKey.slice(6);
      valA = a.saldos?.[ano as any] ?? 0; valB = b.saldos?.[ano as any] ?? 0;
    } else {
      valA = 0; valB = 0;
    }
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDir === 'asc' ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
    }
    return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    const active = sortKey === col;
    return (
      <span style={{ marginLeft: 4, display: 'inline-flex', flexDirection: 'column', gap: 1, verticalAlign: 'middle' }}>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M4 0L8 5H0L4 0Z" fill={active && sortDir === 'asc' ? '#0369A1' : '#CBD5E1'} /></svg>
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M4 5L0 0H8L4 5Z" fill={active && sortDir === 'desc' ? '#0369A1' : '#CBD5E1'} /></svg>
      </span>
    );
  };

  const exportToCSV = () => {
    if (viewMode === 'anual') {
      if (dataAnual.length === 0) return;
      const anoAnteriorLbl = anosAnuais[0] ? anosAnuais[0] - 1 : anoIniAnual - 1;
      const headers = [
        'Conta', 'Descricao', `Saldo Anterior (Dez ${anoAnteriorLbl})`,
        ...anosAnuais.flatMap(a => [`Movimento ${a}`, `Saldo ${a}`]),
      ];
      const csvRows = sortedAnual.map(row => [
        `"${row.conta}"`, `"${row.descricao}"`, row.saldoAnterior,
        ...anosAnuais.flatMap(a => [row.movimentos?.[a as any] ?? 0, row.saldos?.[a as any] ?? 0]),
      ].join(','));
      const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Comparativo_Saldos_Anual_${activeCompany?.legalName || activeCompany?.tradeName || 'Relatorio'}.csv`);
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (data.length === 0) return;
    const headers = ['Conta', 'Descricao', ...periodos.map(formatPeriodo)];
    const csvRows = sorted.map(row => [
      `"${row.conta}"`, `"${row.descricao}"`,
      ...periodos.map(p => row.saldos?.[p] ?? 0),
    ].join(','));
    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Comparativo_Saldos_${activeCompany?.legalName || activeCompany?.tradeName || 'Relatorio'}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const thBase: React.CSSProperties = {
    padding: '10px 14px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '0.3px', color: '#6B7280', background: '#F9FAFB',
    borderBottom: '0.5px solid #E5E7EB', whiteSpace: 'nowrap', cursor: 'pointer',
    userSelect: 'none', position: 'sticky', top: 0, zIndex: 10,
  };
  const thFixed: React.CSSProperties = { ...thBase, left: 0, zIndex: 20, minWidth: 320, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' };
  const selSt: React.CSSProperties = { padding: '6px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 };

  const anos = Array.from({ length: 15 }, (_, i) => anoAtual - 12 + i);

  return (
    <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
      <header style={{ marginBottom: 20 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F0F9FF', color: '#0369A1', marginBottom: 6 }}>
          ◆ Contábil
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: 0 }}>Comparativo de Saldos</h1>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          Saldo de cada conta ao final de cada mês do período selecionado — inclui histórico ECD e lançamentos LEDGR.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => { setViewMode('mensal'); setGerado(false); }}
          style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', background: viewMode === 'mensal' ? '#111827' : '#fff',
            color: viewMode === 'mensal' ? '#fff' : '#6B7280',
          }}
        >
          Mensal
        </button>
        <button
          onClick={() => { setViewMode('anual'); setGerado(false); }}
          style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #E5E7EB', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', background: viewMode === 'anual' ? '#111827' : '#fff',
            color: viewMode === 'anual' ? '#fff' : '#6B7280',
          }}
        >
          Anual
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {viewMode === 'mensal' ? (
          <>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>DE</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select style={selSt} value={mesIni} onChange={e => setMesIni(parseInt(e.target.value, 10))}>
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select style={selSt} value={anoIni} onChange={e => setAnoIni(parseInt(e.target.value, 10))}>
                  {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ATÉ</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select style={selSt} value={mesFim} onChange={e => setMesFim(parseInt(e.target.value, 10))}>
                  {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select style={selSt} value={anoFim} onChange={e => setAnoFim(parseInt(e.target.value, 10))}>
                  {anos.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ANO DE</div>
              <select style={selSt} value={anoIniAnual} onChange={e => setAnoIniAnual(parseInt(e.target.value, 10))}>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ANO ATÉ</div>
              <select style={selSt} value={anoFimAnual} onChange={e => setAnoFimAnual(parseInt(e.target.value, 10))}>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', cursor: 'pointer', paddingBottom: 8 }}>
          <input
            type="checkbox"
            checked={apenasMovimentacao}
            onChange={(e) => setApenasMovimentacao(e.target.checked)}
          />
          Exibir apenas movimentações
        </label>
        <button
          onClick={handleGerar}
          disabled={loading}
          style={{ padding: '8px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Gerando...' : 'Gerar Comparativo'}
        </button>
        {gerado && (
          <button
            onClick={exportToCSV}
            disabled={data.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: data.length === 0 ? 'default' : 'pointer' }}
          >
            Exportar CSV
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
          <div style={{ width: 32, height: 32, border: '2px solid #E5E7EB', borderTopColor: '#0369A1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>Processando saldos…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : !gerado ? (
        <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
          Escolha o período e clique em "Gerar Comparativo".
        </div>
      ) : viewMode === 'mensal' && data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
          Nenhum dado encontrado para esta empresa no período selecionado.
        </div>
      ) : viewMode === 'anual' && dataAnual.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
          Nenhum dado encontrado para esta empresa no período selecionado.
        </div>
      ) : viewMode === 'mensal' ? (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={thFixed} onClick={() => handleSort('conta')}>Conta <SortIcon col="conta" /></th>
                {periodos.map(p => (
                  <th key={p} style={{ ...thBase, textAlign: 'right', minWidth: 100 }} onClick={() => handleSort(p)}>
                    {formatPeriodo(p)} <SortIcon col={p} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={row.conta}
                  style={{ background: row.isAnalytic ? (i % 2 === 0 ? '#fff' : '#FAFAFA') : '#F3F4F6' }}
                >
                  <td style={{
                    padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5', position: 'sticky', left: 0,
                    background: 'inherit', zIndex: 5, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)',
                    fontFamily: 'monospace', paddingLeft: 14 + (row.level - 1) * 14,
                    fontWeight: row.isAnalytic ? 400 : 600,
                  }}>
                    <span style={{ color: '#0369A1' }}>{row.conta}</span>
                    <span style={{ marginLeft: 8, color: '#374151', fontFamily: 'inherit', fontSize: 12, textTransform: row.isAnalytic ? 'none' : 'uppercase' }}>
                      {row.descricao}
                    </span>
                  </td>
                  {periodos.map(p => {
                    const val = row.saldos?.[p] ?? 0;
                    return (
                      <td key={`${row.conta}-${p}`} style={{
                        padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: val < 0 ? '#B91C1C' : val === 0 ? '#D1D5DB' : '#374151', fontSize: 12,
                      }}>
                        {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={thFixed} onClick={() => handleSort('conta')}>Conta <SortIcon col="conta" /></th>
                <th style={{ ...thBase, textAlign: 'right', minWidth: 110 }} onClick={() => handleSort('saldoAnterior')}>
                  Saldo Anterior<br />(Dez/{anosAnuais[0] ? anosAnuais[0] - 1 : anoIniAnual - 1})
                  <SortIcon col="saldoAnterior" />
                </th>
                {anosAnuais.map(ano => (
                  <React.Fragment key={ano}>
                    <th style={{ ...thBase, textAlign: 'right', minWidth: 100, color: '#9CA3AF' }} onClick={() => handleSort(`mov-${ano}`)}>
                      Movimento {ano} <SortIcon col={`mov-${ano}`} />
                    </th>
                    <th style={{ ...thBase, textAlign: 'right', minWidth: 110 }} onClick={() => handleSort(`saldo-${ano}`)}>
                      Saldo {ano} <SortIcon col={`saldo-${ano}`} />
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedAnual.map((row, i) => (
                <tr
                  key={row.conta}
                  style={{ background: row.isAnalytic ? (i % 2 === 0 ? '#fff' : '#FAFAFA') : '#F3F4F6' }}
                >
                  <td style={{
                    padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5', position: 'sticky', left: 0,
                    background: 'inherit', zIndex: 5, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)',
                    fontFamily: 'monospace', paddingLeft: 14 + (row.level - 1) * 14,
                    fontWeight: row.isAnalytic ? 400 : 600,
                  }}>
                    <span style={{ color: '#0369A1' }}>{row.conta}</span>
                    <span style={{ marginLeft: 8, color: '#374151', fontFamily: 'inherit', fontSize: 12, textTransform: row.isAnalytic ? 'none' : 'uppercase' }}>
                      {row.descricao}
                    </span>
                  </td>
                  <td style={{
                    padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums', fontWeight: 500,
                    color: row.saldoAnterior < 0 ? '#B91C1C' : row.saldoAnterior === 0 ? '#D1D5DB' : '#374151', fontSize: 12,
                  }}>
                    {row.saldoAnterior.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {anosAnuais.map(ano => {
                    const mov = row.movimentos?.[ano as any] ?? 0;
                    const sal = row.saldos?.[ano as any] ?? 0;
                    return (
                      <React.Fragment key={ano}>
                        <td style={{
                          padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: mov < 0 ? '#B91C1C' : mov === 0 ? '#D1D5DB' : '#6B7280', fontSize: 12,
                        }}>
                          {mov.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{
                          padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums', fontWeight: 500,
                          color: sal < 0 ? '#B91C1C' : sal === 0 ? '#D1D5DB' : '#374151', fontSize: 12,
                        }}>
                          {sal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </React.Fragment>
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

export default BalanceComparisonPage;
