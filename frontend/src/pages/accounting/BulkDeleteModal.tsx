// frontend/src/pages/accounting/BulkDeleteModal.tsx
import React, { useState } from 'react';
import { FiX, FiTrash2, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import api from '../../services/api';

interface Props {
  companyId: string;
  defaultFrom: string;
  defaultTo: string;
  onClose: () => void;
  onDeleted: () => void;
}

export const BulkDeleteModal: React.FC<Props> = ({ defaultFrom, defaultTo, onClose, onDeleted }) => {
  const [dateFrom, setDateFrom]   = useState(defaultFrom);
  const [dateTo, setDateTo]       = useState(defaultTo);
  const [sources, setSources]     = useState<string[]>(['ACCOUNTING', 'ECD_IMPORT', 'BANK_IMPORT', 'FISCAL']);
  const [preview, setPreview]     = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [confirming, setConfirming] = useState(false);

  const toggleSource = (s: string) =>
    setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handlePreview = async () => {
    setLoading(true); setPreview(null);
    try {
      const r = await api.post('/accounting/journal/bulk-delete', {
        dateFrom, dateTo, sources, dryRun: true,
      });
      setPreview(r.data);
    } catch (e: any) { alert(e.response?.data?.message || 'Erro'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await api.post('/accounting/journal/bulk-delete', {
        dateFrom, dateTo, sources, dryRun: false,
      });
      onDeleted();
    } catch (e: any) { alert(e.response?.data?.message || 'Erro ao excluir'); }
    finally { setConfirming(false); }
  };

  const srcLabels: Record<string, string> = {
    ACCOUNTING: 'Manual', ECD_IMPORT: 'ECD', BANK_IMPORT: 'Banco', FISCAL: 'Fiscal',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FEF2F2', borderRadius: '14px 14px 0 0' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#B91C1C' }}>◆ Contábil</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#111' }}>Excluir Lançamentos por Período</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}><FiX size={18} /></button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Período */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Data inicial</label>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPreview(null); }} max="9999-12-31"
                style={{ width: '100%', height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '0 10px', fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Data final</label>
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPreview(null); }} max="9999-12-31"
                style={{ width: '100%', height: 34, border: '0.5px solid #D1D5DB', borderRadius: 8, padding: '0 10px', fontSize: 13 }} />
            </div>
          </div>

          {/* Fontes */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 8 }}>Fontes a excluir</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(srcLabels).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer',
                  padding: '4px 10px', borderRadius: 20, border: '0.5px solid #E5E7EB',
                  background: sources.includes(key) ? '#FEF2F2' : '#F9FAFB',
                  color: sources.includes(key) ? '#B91C1C' : '#6B7280' }}>
                  <input type="checkbox" checked={sources.includes(key)} onChange={() => { toggleSource(key); setPreview(null); }} style={{ accentColor: '#B91C1C' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <FiAlertTriangle size={13} color="#B91C1C" />
                <span style={{ fontSize: 12, fontWeight: 500, color: '#B91C1C' }}>
                  {preview.count} lançamentos ({preview.itemCount} partidas) · R$ {Number(preview.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p style={{ fontSize: 11, color: '#B91C1C', margin: 0 }}>
                Período: {preview.periodStart} até {preview.periodEnd}
              </p>
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            {!preview ? (
              <button onClick={handlePreview} disabled={loading || !dateFrom || !dateTo || sources.length === 0}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1 }}>
                {loading ? <FiLoader size={13} className="animate-spin" /> : <FiTrash2 size={13} />} Visualizar
              </button>
            ) : (
              <button onClick={handleConfirm} disabled={confirming || preview.count === 0}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#B91C1C', color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: confirming ? 0.6 : 1 }}>
                {confirming ? <FiLoader size={13} /> : <FiTrash2 size={13} />} Confirmar Exclusão
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
