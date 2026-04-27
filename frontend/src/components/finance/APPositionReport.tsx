// ============================================================
// LEDGR — apps/web/src/pages/finance/components/APPositionReport.tsx
// Relatório de Posição / Aging de Contas a Pagar
// ============================================================
import React, { useEffect, useState } from 'react';
import { useAccountsPayable } from '../../pages/finance/hooks/useAccountsPayable';
import type { APPositionReport as ReportData } from '../../pages/finance/types/accounts-payable';
import { fmtBRL } from '../../pages/finance/types/accounts-payable';

const FIN = '#1A4A3A';
const FIN_MID = '#2E7D5C';
const FIN_LIGHT = '#E8F5EE';
const FIN_ACCENT = '#3DAA7A';

const BUCKET_CONFIG = [
  { key: 'overdue90plus', label: '> 90 dias atraso', color: '#6B0000', bg: '#FFCDD2' },
  { key: 'overdue60_90', label: '61–90 dias atraso', color: '#A32D2D', bg: '#FFCDD2' },
  { key: 'overdue30_60', label: '31–60 dias atraso', color: '#C0392B', bg: '#FFECEC' },
  { key: 'overdue1_30', label: '1–30 dias atraso', color: '#E57373', bg: '#FFF5F5' },
  { key: 'dueToday', label: 'Vence hoje', color: '#854F0B', bg: '#FAEEDA' },
  { key: 'due7', label: 'Próx. 7 dias', color: '#BA7517', bg: '#FEF3CD' },
  { key: 'due30', label: 'Próx. 8–30 dias', color: '#185FA5', bg: '#E6F1FB' },
  { key: 'dueFuture', label: 'Acima de 30 dias', color: '#555', bg: '#F5F5F5' },
];

export function APPositionReport() {
  const { fetchPositionReport, loading } = useAccountsPayable();
  const [report, setReport] = useState<ReportData | null>(null);
  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10));

  const load = async () => {
    try {
      const data = await fetchPositionReport(refDate);
      setReport(data);
    } catch { }
  };

  useEffect(() => { load(); }, [refDate]);

  if (loading && !report) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#aaa' }}>
      Gerando relatório...
    </div>
  );

  const grand = Number(report?.grandTotal ?? 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Relatório de Posição AP</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            Aging de contas a pagar em aberto na data de referência
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: '#666' }}>Data de referência:</label>
          <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
            style={{ border: '1px solid #ddd', borderRadius: 6, padding: '5px 8px', fontSize: 12 }} />
          <button onClick={load} style={{
            background: FIN, color: '#fff', border: 'none',
            borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
          }}>Atualizar</button>
        </div>
      </div>

      {report && (
        <>
          {/* KPI Total */}
          <div style={{
            background: FIN, color: '#fff', borderRadius: 10,
            padding: '16px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.65 }}>Total em aberto</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtBRL(grand)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, opacity: 0.65 }}>Títulos</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{report.totalTitles}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, opacity: 0.65 }}>Referência</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>
                {new Date(report.refDate).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Aging */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10 }}>
                AGING — DISTRIBUIÇÃO POR PRAZO
              </div>
              <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
                {BUCKET_CONFIG.map(({ key, label, color, bg }) => {
                  const bucket = (report.buckets as any)[key];
                  const pct = grand > 0 ? (Number(bucket.total) / grand) * 100 : 0;
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center',
                      padding: '8px 12px', borderBottom: '1px solid #f0f0f0',
                      background: bucket.count > 0 ? bg : '#fff',
                      opacity: bucket.count === 0 ? 0.45 : 1,
                    }}>
                      <div style={{ width: 130, fontSize: 11, fontWeight: 600, color }}>{label}</div>
                      <div style={{ flex: 1, margin: '0 10px' }}>
                        <div style={{ height: 6, borderRadius: 3, background: '#eee', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
                        </div>
                      </div>
                      <div style={{ width: 32, fontSize: 11, color: '#888', textAlign: 'center' }}>
                        {bucket.count}
                      </div>
                      <div style={{ width: 100, fontSize: 12, fontWeight: 600, color, textAlign: 'right' }}>
                        {fmtBRL(bucket.total)}
                      </div>
                      <div style={{ width: 38, fontSize: 10, color: '#aaa', textAlign: 'right' }}>
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Coluna direita: Top fornecedores + Por categoria */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Top fornecedores */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10 }}>
                  TOP FORNECEDORES EM ABERTO
                </div>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
                  {report.topSuppliers.slice(0, 8).map((s, i) => {
                    const pct = grand > 0 ? (Number(s.total) / grand) * 100 : 0;
                    return (
                      <div key={s.name} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px', borderBottom: '1px solid #f0f0f0',
                      }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', background: FIN_LIGHT,
                          color: FIN, fontSize: 10, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#aaa', flexShrink: 0 }}>{pct.toFixed(0)}%</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: FIN, flexShrink: 0, width: 90, textAlign: 'right' }}>
                          {fmtBRL(s.total)}
                        </div>
                      </div>
                    );
                  })}
                  {report.topSuppliers.length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', color: '#aaa', fontSize: 12 }}>
                      Nenhum título em aberto.
                    </div>
                  )}
                </div>
              </div>

              {/* Por categoria */}
              {report.byCategory.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10 }}>
                    POR CATEGORIA / ORIGEM
                  </div>
                  <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
                    {report.byCategory.map(cat => {
                      const pct = grand > 0 ? (Number(cat.total) / grand) * 100 : 0;
                      return (
                        <div key={cat.name} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 12px', borderBottom: '1px solid #f0f0f0',
                        }}>
                          <div style={{ flex: 1, fontSize: 11 }}>{cat.name}</div>
                          <div style={{ flex: 1, margin: '0 8px' }}>
                            <div style={{ height: 4, borderRadius: 2, background: '#eee' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: FIN_ACCENT, borderRadius: 2 }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: FIN, width: 90, textAlign: 'right' }}>
                            {fmtBRL(cat.total)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
