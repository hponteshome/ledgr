// ============================================================
// LEDGR — apps/web/src/pages/finance/ContasAPagarPage.tsx
// ============================================================
import React, { useState } from 'react';
import { APTable } from '../../components/finance/APTable';
import { APPayModal } from '../../components/finance/APPayModal';
import { APPositionReport } from '../../components/finance/APPositionReport';
import type { AccountsPayable } from '../../pages/finance/types/accounts-payable';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';

type Tab = 'titulos' | 'posicao';

export default function ContasAPagarPage() {
  const [tab, setTab] = useState<Tab>('titulos');
  const [payTarget, setPayTarget] = useState<AccountsPayable | null>(null);
  const [batchItems, setBatchItems] = useState<AccountsPayable[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setPayTarget(null);
    setBatchItems(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid #e0e0e0',
        background: '#fff', padding: '0 20px', flexShrink: 0,
      }}>
        {([
          { key: 'titulos', label: 'Títulos a Pagar' },
          { key: 'posicao', label: 'Posição / Aging' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <div key={key} onClick={() => setTab(key)} style={{
            padding: '11px 16px', fontSize: 13, cursor: 'pointer',
            color: tab === key ? FIN : '#888',
            borderBottom: `2px solid ${tab === key ? FIN_ACCENT : 'transparent'}`,
            fontWeight: tab === key ? 600 : 400,
          }}>{label}</div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {tab === 'titulos' && (
          <APTable
            key={refreshKey}
            onPay={ap => setPayTarget(ap)}
            onBatch={items => setBatchItems(items)}
            onNew={() => {/* APCreateModal — próxima fase */ }}
            onDetail={() => {/* APDetailDrawer — próxima fase */ }}
            refresh={refreshKey}
          />
        )}
        {tab === 'posicao' && <APPositionReport />}
      </div>

      {/* Modal de baixa individual */}
      {payTarget && (
        <APPayModal
          mode="single"
          ap={payTarget}
          onClose={() => setPayTarget(null)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Modal de baixa em lote */}
      {batchItems && (
        <APPayModal
          mode="batch"
          items={batchItems}
          onClose={() => setBatchItems(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
