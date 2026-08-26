// frontend/src/pages/sped/LalurViewPage.tsx
// CRIADO 26/08/2026: visualizacao do LALUR (e-LALUR/e-LACS) importado via
// ECF - Parte B como pivot (conta x periodo, mesmo padrao do Comparativo de
// Saldos e da Tabela Comparativa ECD x Matriz) + Parte A filtravel por
// periodo (pode ter milhares de lancamentos por ano, nao renderiza tudo de
// uma vez).
import React, { useEffect, useState, useMemo } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';

interface ParteBConta {
  accountCode: string;
  tipoTributo: string;
  descricao: string;
  saldos: Record<string, { saldoInicial: number; movimento: number; balance: number }>;
}
interface ParteALancamento {
  period: string; code: string; description: string; value: number; type: string;
}
interface LalurData {
  periodos: string[];
  parteB: ParteBConta[];
  parteA: ParteALancamento[];
}

const tributoLabel: Record<string, string> = { I: 'IRPJ', C: 'CSLL' };

export const LalurViewPage: React.FC = () => {
  const { activeCompany } = useCompany();
  const [data, setData] = useState<LalurData | null>(null);
  const [loading, setLoading] = useState(false);
  const [periodoParteA, setPeriodoParteA] = useState<string>('');
  const [ocultarZerados, setOcultarZerados] = useState(true);

  useEffect(() => {
    if (!activeCompany?.id) return;
    setLoading(true);
    api.get(`/sped/ecf/lalur`)
      .then(res => {
        setData(res.data);
        const periodos: string[] = res.data?.periodos || [];
        if (periodos.length > 0) setPeriodoParteA(periodos[periodos.length - 1]);
      })
      .catch(err => { console.error('Erro ao carregar LALUR', err); setData(null); })
      .finally(() => setLoading(false));
  }, [activeCompany?.id]);

  const parteAFiltrada = useMemo(() => {
    if (!data) return [];
    return data.parteA.filter(a => a.period === periodoParteA && (!ocultarZerados || a.value !== 0));
  }, [data, periodoParteA, ocultarZerados]);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const thBase: React.CSSProperties = {
    padding: '9px 12px', fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    color: '#6B7280', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB', whiteSpace: 'nowrap',
  };
  const thFixed: React.CSSProperties = { ...thBase, position: 'sticky', left: 0, zIndex: 5, minWidth: 260, boxShadow: '2px 0 4px -1px rgba(0,0,0,0.06)' };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 80, gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '2px solid #E5E7EB', borderTopColor: '#0369A1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: 13, color: '#9CA3AF' }}>Carregando LALUR…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!data || data.parteB.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', padding: 80, border: '0.5px dashed #E5E7EB', borderRadius: 10, color: '#9CA3AF', fontSize: 13 }}>
          Nenhum dado de LALUR importado ainda para esta empresa. Importe uma ECF em "ECF — Escrituração Fiscal".
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#F0F9FF', color: '#0369A1', marginBottom: 6 }}>
          ◆ Fiscal
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111111', margin: 0 }}>LALUR — Livro de Apuração</h1>
        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' }}>
          Parte B: controle de saldos (prejuízo fiscal / base negativa CSLL). Parte A: ajustes ao lucro líquido por período.
        </p>
      </header>

      {/* ── Parte B: pivot conta x periodo, com saldo inicial/movimento/final ── */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Parte B — Controle de Saldos</h2>
      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
        Cada período mostra: saldo inicial (herdado do ano anterior) → movimento do ano → saldo final.
      </p>
      <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 460, marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...thFixed, rowSpan: 2 } as any} rowSpan={2}>Conta / Tributo</th>
              {data.periodos.map(p => (
                <th key={p} colSpan={3} style={{ ...thBase, textAlign: 'center', borderLeft: '1px solid #E5E7EB' }}>{p}</th>
              ))}
            </tr>
            <tr>
              {data.periodos.map(p => (
                <React.Fragment key={p}>
                  <th style={{ ...thBase, textAlign: 'right', minWidth: 110, borderLeft: '1px solid #E5E7EB', fontSize: 10, color: '#9CA3AF' }}>Inicial</th>
                  <th style={{ ...thBase, textAlign: 'right', minWidth: 100, fontSize: 10, color: '#059669' }}>Movimento</th>
                  <th style={{ ...thBase, textAlign: 'right', minWidth: 110, fontSize: 10, fontWeight: 700 }}>Final</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.parteB.map((c, i) => (
              <tr key={`${c.accountCode}-${c.tipoTributo}`} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <td style={{
                  padding: '8px 12px', borderBottom: '0.5px solid #F5F5F5', position: 'sticky', left: 0,
                  background: 'inherit', fontFamily: 'monospace', fontSize: 12,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 3, marginRight: 6,
                    background: c.tipoTributo === 'I' ? '#EFF6FF' : '#FDF4FF',
                    color: c.tipoTributo === 'I' ? '#1D4ED8' : '#A21CAF',
                  }}>
                    {tributoLabel[c.tipoTributo] || c.tipoTributo}
                  </span>
                  {c.accountCode} <span style={{ color: '#6B7280', fontFamily: 'inherit' }}>{c.descricao}</span>
                </td>
                {data.periodos.map(p => {
                  const s = c.saldos[p];
                  return (
                    <React.Fragment key={p}>
                      <td style={{ padding: '8px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: s ? '#9CA3AF' : '#D1D5DB', borderLeft: '1px solid #F3F4F6' }}>
                        {s ? fmt(s.saldoInicial) : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: s && s.movimento !== 0 ? '#059669' : '#D1D5DB' }}>
                        {s ? (s.movimento !== 0 ? `+${fmt(s.movimento)}` : '—') : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, fontWeight: 600, color: s ? '#374151' : '#D1D5DB' }}>
                        {s ? fmt(s.balance) : '—'}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Parte A: lancamentos filtraveis por periodo ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: 0 }}>Parte A — Ajustes ao Lucro Líquido</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B7280' }}>
            <input type="checkbox" checked={ocultarZerados} onChange={e => setOcultarZerados(e.target.checked)} />
            Ocultar lançamentos zerados
          </label>
          <select
            value={periodoParteA}
            onChange={e => setPeriodoParteA(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }}
          >
            {data.periodos.slice().reverse().map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
        {parteAFiltrada.length} lançamento(s) em {periodoParteA}
      </div>
      <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'auto', maxHeight: 420 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thBase}>Conta</th>
              <th style={thBase}>Descrição</th>
              <th style={{ ...thBase, textAlign: 'right' }}>Valor</th>
              <th style={thBase}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {parteAFiltrada.slice(0, 500).map((a, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontFamily: 'monospace', fontSize: 12 }}>{a.code}</td>
                <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 12 }}>{a.description}</td>
                <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmt(a.value)}</td>
                <td style={{ padding: '7px 12px', borderBottom: '0.5px solid #F5F5F5', fontSize: 11, color: '#9CA3AF' }}>{a.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {parteAFiltrada.length > 500 && (
          <div style={{ padding: 12, fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
            Mostrando os primeiros 500 de {parteAFiltrada.length} lançamentos.
          </div>
        )}
      </div>
    </div>
  );
};

export default LalurViewPage;
