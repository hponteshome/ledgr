// ============================================================
// LEDGR — src/pages/finance/components/FiscalDocumentTable.tsx
// ============================================================
import React, { useEffect, useState } from 'react';
import {
  FiscalDocument, FiscalDocumentType, IntegrationStatus,
  FISCAL_DOC_TYPE_LABEL, INTEGRATION_STATUS_LABEL, FinanceSummary,
} from '../../pages/finance/types/finance';
import { useFiscalDocuments } from '../../pages/finance/hooks/useFinance';

const FIN = '#1A4A3A';
const FIN_MID = '#2E7D5C';
const FIN_LIGHT = '#E8F5EE';
const FIN_ACCENT = '#3DAA7A';

interface Props {
  onNewDocument: () => void;
}

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'NFE', label: 'NF-e' },
  { key: 'NFSE', label: 'NFS-e' },
  { key: 'CONSUMO', label: 'Consumo' },
  { key: 'PENDING', label: 'Pendentes' },
];

function fmtBRL(v: string | number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function FiscalDocumentTable({ onNewDocument }: Props) {
  const { fetchDocuments, reintegrate, loading } = useFiscalDocuments();
  const [docs, setDocs] = useState<FiscalDocument[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentMonth] = useState(new Date().toISOString().slice(0, 7));

  const load = async () => {
    const filters: Record<string, string> = { competenceMonth: currentMonth };
    if (search) filters.search = search;
    if (typeFilter === 'PENDING') filters.integrationStatus = 'PENDING';
    else if (typeFilter) filters.documentType = typeFilter;

    const res = await fetchDocuments(filters);
    if (res) {
      setDocs(res.data);
      setSummary(res.summary);
    }
  };

  useEffect(() => { load(); }, [search, typeFilter]);

  const handleReintegrate = async (id: string) => {
    await reintegrate(id);
    load();
  };

  const isOverdue = (dueDate: string) => new Date(dueDate) < new Date();

  return (
    <div>
      {/* Banner de integração */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
        background: '#f5f5f5', borderRadius: 8, borderLeft: `3px solid ${FIN_ACCENT}`,
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 11, color: '#666', marginRight: 4 }}>Ao lançar:</span>
        {[
          { icon: '🧾', label: 'Doc. Fiscal', color: FIN },
          { icon: '📋', label: 'Ctas a Pagar', color: '#185FA5' },
          { icon: '📒', label: 'Contábil', color: '#3B6D11' },
          { icon: '📅', label: 'Agenda', color: '#854F0B' },
        ].map((node, i, arr) => (
          <React.Fragment key={node.label}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '6px 10px', borderRadius: 7, background: '#fff',
              border: `1px solid #e0e0e0`, borderTop: `2px solid ${node.color}`,
              fontSize: 10, fontWeight: 600, color: node.color, minWidth: 58, textAlign: 'center',
            }}>
              <span>{node.icon}</span>
              {node.label}
            </div>
            {i < arr.length - 1 && <span style={{ color: '#bbb', fontSize: 14 }}>→</span>}
          </React.Fragment>
        ))}
      </div>

      {/* Cards de resumo */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
          <SummaryCard label={`Lançamentos — ${currentMonth}`} value={String(summary.totalDocuments)} sub={`${docs.length} exibidos`} />
          <SummaryCard label="Total a Pagar" value={fmtBRL(summary.totalAmount)} sub="nos próx. 30 dias" color="#BA7517" />
          <SummaryCard label="Vencidos" value={fmtBRL(summary.overdueAmount)} sub={`${summary.overdueCount} documentos`} color="#A32D2D" />
          <SummaryCard label="Integrações OK" value={`${summary.integrationRate}%`} sub="AP + Contábil + Agenda" color={FIN_MID} />
        </div>
      )}

      {/* Tabela */}
      <div style={{ border: '1px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px', background: '#fff', borderBottom: '1px solid #e0e0e0',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f5f5f5', borderRadius: 5, padding: '5px 10px',
            fontSize: 12, color: '#888', width: 220,
          }}>
            🔍
            <input
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, width: '100%' }}
              placeholder="Buscar fornecedor, número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {TYPE_FILTERS.map(({ key, label }) => (
              <button key={key} onClick={() => setTypeFilter(key)} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer',
                background: typeFilter === key ? FIN_LIGHT : '#f5f5f5',
                color: typeFilter === key ? FIN : '#888',
                border: typeFilter === key ? `1px solid ${FIN_ACCENT}` : '1px solid #e0e0e0',
                fontWeight: typeFilter === key ? 600 : 400,
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: FIN }}>
              {['Data', 'Tipo', 'Nº Doc.', 'Fornecedor / Prestador', 'Vencimento', 'Valor', 'Status', 'Integrações', ''].map((h) => (
                <th key={h} style={{ padding: '8px 11px', textAlign: 'left', fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.9)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#888' }}>Carregando...</td></tr>
            )}
            {!loading && docs.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>Nenhum documento encontrado.</td></tr>
            )}
            {docs.map((doc) => (
              <tr key={doc.id} style={{ borderBottom: '1px solid #f0f0f0' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = FIN_LIGHT)}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                <td style={{ padding: '7px 11px', color: '#777' }}>{fmtDate(doc.issueDate)}</td>
                <td style={{ padding: '7px 11px' }}>
                  <TypePill type={doc.documentType} />
                </td>
                <td style={{ padding: '7px 11px', fontFamily: 'monospace', fontSize: 11, color: '#555' }}>
                  {doc.documentNumber ?? '—'}
                </td>
                <td style={{ padding: '7px 11px', fontWeight: 500 }}>{doc.issuerName}</td>
                <td style={{ padding: '7px 11px', color: isOverdue(doc.dueDate) ? '#A32D2D' : '#777', fontWeight: isOverdue(doc.dueDate) ? 600 : 400 }}>
                  {fmtDate(doc.dueDate)}
                </td>
                <td style={{ padding: '7px 11px', fontWeight: 600 }}>{fmtBRL(doc.netAmount)}</td>
                <td style={{ padding: '7px 11px' }}>
                  <StatusPill status={doc.integrationStatus} />
                </td>
                <td style={{ padding: '7px 11px' }}>
                  <IntegrationDots doc={doc} />
                </td>
                <td style={{ padding: '7px 11px' }}>
                  {doc.integrationStatus !== 'INTEGRATED' ? (
                    <button onClick={() => handleReintegrate(doc.id)} style={{
                      fontSize: 11, padding: '3px 8px', border: '1px solid #ddd',
                      borderRadius: 5, background: '#fff', cursor: 'pointer',
                      color: '#A32D2D',
                    }}>Integrar</button>
                  ) : (
                    <button style={{
                      fontSize: 11, padding: '3px 8px', border: '1px solid #ddd',
                      borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#666',
                    }}>Ver</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────
function SummaryCard({ label, value, sub, color = '#111' }: {
  label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '11px 13px' }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function TypePill({ type }: { type: FiscalDocumentType }) {
  const colors: Record<FiscalDocumentType, { bg: string; text: string }> = {
    NFE: { bg: '#EAF3DE', text: '#3B6D11' },
    NFSE: { bg: '#EAF3DE', text: '#3B6D11' },
    FATURA: { bg: '#E6F1FB', text: '#185FA5' },
    DUPLICATA: { bg: '#E6F1FB', text: '#185FA5' },
    BOLETO: { bg: '#E6F1FB', text: '#185FA5' },
    CONSUMO: { bg: '#FAEEDA', text: '#854F0B' },
    OUTROS: { bg: '#F1EFE8', text: '#5F5E5A' },
  };
  const c = colors[type] ?? colors.OUTROS;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 20, fontSize: 10, fontWeight: 600,
      background: c.bg, color: c.text,
    }}>{FISCAL_DOC_TYPE_LABEL[type]}</span>
  );
}

function StatusPill({ status }: { status: IntegrationStatus }) {
  const c: Record<IntegrationStatus, { bg: string; text: string }> = {
    INTEGRATED: { bg: '#EAF3DE', text: '#3B6D11' },
    PENDING: { bg: '#FAEEDA', text: '#854F0B' },
    ERROR: { bg: '#FCEBEB', text: '#A32D2D' },
    MANUAL: { bg: '#F1EFE8', text: '#5F5E5A' },
  };
  const s = c[status];
  return (
    <span style={{
      display: 'inline-flex', padding: '2px 8px', borderRadius: 20,
      fontSize: 10, fontWeight: 600, background: s.bg, color: s.text,
    }}>{INTEGRATION_STATUS_LABEL[status]}</span>
  );
}

function IntegrationDots({ doc }: { doc: FiscalDocument }) {
  const dots = [
    { key: 'AP', active: !!doc.apEntryId, bg: '#E6F1FB', text: '#185FA5' },
    { key: 'CT', active: !!doc.journalEntryId, bg: '#EAF3DE', text: '#3B6D11' },
    { key: 'FS', active: doc.integrationStatus === 'INTEGRATED', bg: FIN_LIGHT, text: FIN },
  ];
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {dots.map(({ key, active, bg, text }) => (
        <div key={key} style={{
          width: 18, height: 18, borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, fontWeight: 700,
          background: active ? bg : '#f0f0f0',
          color: active ? text : '#bbb',
        }}>{key}</div>
      ))}
    </div>
  );
}
