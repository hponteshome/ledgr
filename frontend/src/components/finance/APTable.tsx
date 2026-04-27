// ============================================================
// LEDGR — apps/web/src/pages/finance/components/APTable.tsx
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import {
  AccountsPayable, APStatus, APOrigin,
  AP_STATUS_LABEL, AP_STATUS_COLORS, AP_ORIGIN_LABEL,
  getAgingStatus, remaining, fmtBRL, fmtDate,
  type APSummary,
} from '../../pages/finance/types/accounts-payable';
import { useAccountsPayable } from '../../pages/finance/hooks/useAccountsPayable';

const FIN = '#1A4A3A';
const FIN_MID = '#2E7D5C';
const FIN_LIGHT = '#E8F5EE';
const FIN_ACCENT = '#3DAA7A';

// ── Aging quick-filters ───────────────────────────────────────
const AGING_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'overdue', label: '⚠ Vencidos' },
  { key: 'today', label: 'Vence hoje' },
  { key: 'week', label: 'Próx. 7 dias' },
  { key: 'month', label: 'Próx. 30 dias' },
];

const STATUS_FILTERS: APStatus[] = ['OPEN', 'PARTIAL', 'PAID', 'CANCELLED'];

interface Props {
  onPay: (ap: AccountsPayable) => void;
  onBatch: (selected: AccountsPayable[]) => void;
  onNew: () => void;
  onDetail: (ap: AccountsPayable) => void;
  refresh: number;
}

export function APTable({ onPay, onBatch, onNew, onDetail, refresh }: Props) {
  const { fetchAll, loading } = useAccountsPayable();

  const [data, setData] = useState<AccountsPayable[]>([]);
  const [summary, setSummary] = useState<APSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [aging, setAging] = useState('');
  const [statusFilter, setStatusFilter] = useState<APStatus | ''>('');
  const [originFilter, setOriginFilter] = useState<APOrigin | ''>('');

  const load = useCallback(async () => {
    const filters: Record<string, string> = {};
    if (search) filters.search = search;
    if (aging) filters.aging = aging;
    if (statusFilter) filters.status = statusFilter;
    if (originFilter) filters.origin = originFilter;
    try {
      const res = await fetchAll(filters);
      setData(res.data);
      setTotal(res.total);
      setSummary(res.summary);
      setSelected(new Set()); // limpa seleção ao recarregar
    } catch { }
  }, [search, aging, statusFilter, originFilter, refresh]);

  useEffect(() => { load(); }, [load]);

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(prev =>
      prev.size === data.length ? new Set() : new Set(data.map(d => d.id))
    );

  const selectedItems = data.filter(d => selected.has(d.id));
  const canBatch = selectedItems.length > 0 && selectedItems.every(
    ap => ap.status === 'OPEN' || ap.status === 'PARTIAL'
  );

  return (
    <div>
      {/* ── Cards de resumo ──────────────────────────────── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
          <SummaryCard label="Títulos em aberto" value={String(summary.open)}
            sub={fmtBRL(summary.totalOpen)} color="#185FA5" />
          <SummaryCard label="Vencidos" value={String(summary.overdue)}
            sub={fmtBRL(summary.totalOverdue)} color="#A32D2D" />
          <SummaryCard label="Vence em 7 dias" value={String(summary.dueWeek)}
            sub="atenção necessária" color="#854F0B" />
          <SummaryCard label="Pagos no período" value={String(summary.paidMonth)}
            sub="títulos liquidados" color={FIN_MID} />
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Busca */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#f5f5f5', borderRadius: 6,
          padding: '6px 10px', width: 240,
        }}>
          <span style={{ opacity: 0.4, fontSize: 13 }}>🔍</span>
          <input
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: '100%' }}
            placeholder="Fornecedor, título, nº doc..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtros aging */}
        <div style={{ display: 'flex', gap: 5 }}>
          {AGING_FILTERS.map(f => (
            <button key={f.key} onClick={() => setAging(f.key)} style={chipStyle(aging === f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', gap: 6 }}>
          {canBatch && (
            <button onClick={() => onBatch(selectedItems)} style={{
              background: '#854F0B', color: '#fff', border: 'none',
              borderRadius: 7, padding: '7px 12px', fontSize: 12,
              fontWeight: 600, cursor: 'pointer',
            }}>💳 Pagar {selectedItems.length} selecionados</button>
          )}
          <button onClick={onNew} style={{
            background: FIN, color: '#fff', border: 'none',
            borderRadius: 7, padding: '7px 14px', fontSize: 12,
            fontWeight: 600, cursor: 'pointer',
          }}>+ Novo Título</button>
        </div>
      </div>

      {/* Filtros secundários */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={selectStyle}>
          <option value="">Todos os status</option>
          {STATUS_FILTERS.map(s => <option key={s} value={s}>{AP_STATUS_LABEL[s]}</option>)}
        </select>
        <select value={originFilter} onChange={e => setOriginFilter(e.target.value as any)} style={selectStyle}>
          <option value="">Todas as origens</option>
          {Object.entries(AP_ORIGIN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* ── Tabela ───────────────────────────────────────── */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: FIN }}>
              <th style={th}>
                <input type="checkbox"
                  checked={selected.size === data.length && data.length > 0}
                  onChange={toggleAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              {['Vencimento', 'Título / Fornecedor', 'Origem', 'Valor', 'Pago', 'Restante', 'Status', 'Aging', ''].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: '#aaa' }}>
                Carregando...
              </td></tr>
            )}
            {!loading && data.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: '#bbb' }}>
                Nenhum título encontrado.
              </td></tr>
            )}
            {data.map(ap => {
              const aging = getAgingStatus(ap.dueDate, ap.status);
              const rest = remaining(ap);
              const isOver = aging.days < 0 && ap.status !== 'PAID' && ap.status !== 'CANCELLED';
              const sc = AP_STATUS_COLORS[ap.status];
              const isSelected = selected.has(ap.id);

              return (
                <tr key={ap.id}
                  style={{ borderBottom: '1px solid #f0f0f0', background: isSelected ? '#F0FFF4' : isOver ? '#FFF5F5' : '#fff' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = FIN_LIGHT; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#F0FFF4' : isOver ? '#FFF5F5' : '#fff'; }}
                >
                  {/* Checkbox */}
                  <td style={td}>
                    {(ap.status === 'OPEN' || ap.status === 'PARTIAL') && (
                      <input type="checkbox" checked={isSelected}
                        onChange={() => toggleSelect(ap.id)} style={{ cursor: 'pointer' }} />
                    )}
                  </td>

                  {/* Vencimento */}
                  <td style={{ ...td, fontWeight: isOver ? 600 : 400, color: isOver ? '#A32D2D' : '#555' }}>
                    {fmtDate(ap.dueDate)}
                    {ap.totalInstallments > 1 && (
                      <span style={{ fontSize: 9, color: '#888', marginLeft: 4 }}>
                        {ap.installmentNumber}/{ap.totalInstallments}
                      </span>
                    )}
                  </td>

                  {/* Título / Fornecedor */}
                  <td style={td}>
                    <div style={{ fontWeight: 500, color: '#111' }}>{ap.title}</div>
                    {ap.supplierName && (
                      <div style={{ fontSize: 10, color: '#888' }}>{ap.supplierName}</div>
                    )}
                  </td>

                  {/* Origem */}
                  <td style={td}>
                    <OriginBadge origin={ap.origin} />
                  </td>

                  {/* Valor bruto */}
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }}>
                    {fmtBRL(ap.netAmount)}
                  </td>

                  {/* Pago */}
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: FIN_MID }}>
                    {Number(ap.paidAmount) > 0 ? fmtBRL(ap.paidAmount) : '—'}
                  </td>

                  {/* Restante */}
                  <td style={{
                    ...td, fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
                    color: rest > 0 ? (isOver ? '#A32D2D' : '#111') : FIN_MID
                  }}>
                    {rest > 0 ? fmtBRL(rest) : '✓'}
                  </td>

                  {/* Status */}
                  <td style={td}>
                    <span style={{
                      display: 'inline-flex', padding: '2px 8px',
                      borderRadius: 20, fontSize: 10, fontWeight: 600,
                      background: sc.bg, color: sc.text,
                    }}>{AP_STATUS_LABEL[ap.status]}</span>
                  </td>

                  {/* Aging */}
                  <td style={{ ...td, fontWeight: 600, fontSize: 11, color: aging.color }}>
                    {aging.label}
                  </td>

                  {/* Ações */}
                  <td style={{ ...td, display: 'flex', gap: 4 }}>
                    <button onClick={() => onDetail(ap)} style={actionBtn('#555')}>
                      Detalhe
                    </button>
                    {(ap.status === 'OPEN' || ap.status === 'PARTIAL') && (
                      <button onClick={() => onPay(ap)} style={actionBtn(FIN_MID)}>
                        Baixar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Rodapé da tabela */}
        {total > 0 && (
          <div style={{
            padding: '8px 12px', background: '#FAFAFA',
            borderTop: '1px solid #f0f0f0',
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: '#888',
          }}>
            <span>{total} título{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</span>
            {selected.size > 0 && (
              <span style={{ color: FIN, fontWeight: 600 }}>
                {selected.size} selecionado{selected.size !== 1 ? 's' : ''} •{' '}
                {fmtBRL(selectedItems.reduce((s, ap) => s + remaining(ap), 0))} a pagar
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────
function SummaryCard({ label, value, sub, color = '#111' }: {
  label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div style={{ background: '#F5F5F5', borderRadius: 8, padding: '11px 13px' }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function OriginBadge({ origin }: { origin: APOrigin }) {
  const styles: Record<APOrigin, { bg: string; text: string }> = {
    FISCAL_DOCUMENT: { bg: '#E8F5EE', text: '#1A4A3A' },
    MANUAL: { bg: '#F1EFE8', text: '#5F5E5A' },
    PAYROLL: { bg: '#E6F1FB', text: '#185FA5' },
    BOLETO_IMPORT: { bg: '#FAEEDA', text: '#854F0B' },
  };
  const s = styles[origin] ?? styles.MANUAL;
  return (
    <span style={{
      display: 'inline-flex', padding: '2px 7px', borderRadius: 20,
      fontSize: 10, fontWeight: 600, background: s.bg, color: s.text
    }}>
      {AP_ORIGIN_LABEL[origin]}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────
const th: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left',
  fontWeight: 500, fontSize: 10, color: 'rgba(255,255,255,0.9)',
};
const td: React.CSSProperties = { padding: '7px 10px', verticalAlign: 'middle' };

const chipStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
  background: active ? '#FFCDD2' : '#f5f5f5',
  color: active ? '#8B0000' : '#777',
  border: active ? '1px solid #E57373' : '1px solid #e0e0e0',
  fontWeight: active ? 600 : 400,
});

const selectStyle: React.CSSProperties = {
  border: '1px solid #ddd', borderRadius: 6, padding: '5px 8px',
  fontSize: 12, background: '#fff', cursor: 'pointer', outline: 'none',
};

const actionBtn = (color: string): React.CSSProperties => ({
  fontSize: 11, padding: '3px 8px', border: `1px solid ${color}22`,
  borderRadius: 5, background: '#fff', color, cursor: 'pointer', fontWeight: 500,
});
