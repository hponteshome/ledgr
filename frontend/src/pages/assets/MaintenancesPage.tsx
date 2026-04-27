// frontend/src/pages/assets/MaintenancesPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Plus, AlertTriangle } from 'lucide-react';
import { MaintenanceModal } from './modals/MaintenanceModal';
import { MAINTENANCE_TYPE_LABELS, MAINTENANCE_STATUS_LABELS } from './types/asset.types';
import { formatCurrency, formatDate } from '../../utils/formatters';

const API = 'http://localhost:3000';

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED:   'bg-yellow-50 text-yellow-800',
  IN_PROGRESS: 'bg-blue-50 text-blue-800',
  COMPLETED:   'bg-green-50 text-green-800',
  CANCELLED:   'bg-gray-100 text-gray-500',
};

export default function MaintenancesPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal]       = useState(false);

  const token   = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const headers = { Authorization: `Bearer ${token}`, 'x-company-id': company.id ?? '' };

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/assets/maintenances/overdue`, { headers });
      if (!res.ok) throw new Error('Erro ao carregar');
      // overdue endpoint — complementar com findAll sem assetId
      const overdue = await res.json();
      // buscar todas as manutenções via findAll sem assetId
      const allRes = await fetch(`${API}/assets/maintenances`, { headers });
      const all = allRes.ok ? await allRes.json() : [];
      // merge deduplicado
      const map = new Map();
      [...all, ...overdue].forEach((m: any) => map.set(m.id, m));
      setData(Array.from(map.values()));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = statusFilter ? data.filter(m => m.status === statusFilter) : data;

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wrench size={22} color="#EA580C" />
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: '#111', margin: 0 }}>Ordens de Serviço</h1>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Manutenções de todos os ativos</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
        >
          <Plus size={14} /> Nova OS
        </button>
      </div>

      {/* Filtro status */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '0.5px solid', cursor: 'pointer',
              borderColor: statusFilter === s ? '#111' : '#E5E7EB',
              background: statusFilter === s ? '#111' : '#fff',
              color: statusFilter === s ? '#fff' : '#374151' }}
          >
            {s === '' ? 'Todos' : MAINTENANCE_STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', color: '#B91C1C', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Tabela */}
      <div style={{ border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F9FAFB' }}>
              {['OS Nº', 'Título', 'Ativo', 'Tipo', 'Data Prevista', 'Valor Orçado', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', borderBottom: '0.5px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Carregando...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Nenhuma OS encontrada</td></tr>
            )}
            {filtered.map((m: any) => (
              <tr key={m.id}
                style={{ borderBottom: '0.5px solid #F5F5F5', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
                onClick={() => navigate(`/app/assets/${m.assetId}`)}
              >
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#6B7280' }}>{m.serviceOrderNo || '—'}</td>
                <td style={{ padding: '10px 14px', color: '#111', fontWeight: 500 }}>{m.title}</td>
                <td style={{ padding: '10px 14px', color: '#2563EB', fontSize: 12 }}>
                  {m.asset?.internalCode} — {m.asset?.description}
                </td>
                <td style={{ padding: '10px 14px', color: '#374151' }}>{MAINTENANCE_TYPE_LABELS[m.type] ?? m.type}</td>
                <td style={{ padding: '10px 14px', color: '#374151' }}>{formatDate(m.scheduledDate)}</td>
                <td style={{ padding: '10px 14px', color: '#374151' }}>{m.estimatedCost ? formatCurrency(m.estimatedCost) : '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}
                    className={STATUS_COLORS[m.status] ?? 'bg-gray-100 text-gray-500'}>
                    {MAINTENANCE_STATUS_LABELS[m.status] ?? m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <MaintenanceModal
          assetId=""
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
