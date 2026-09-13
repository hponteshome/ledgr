// frontend/src/pages/accounting/ImportLotesPage.tsx
// NOVO (10/09/2026): listagem dos lotes de importacao - cada lote tem
// numero sequencial unico por empresa+ano (qualquer tipo: Manual/IOB/ECD).
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';

interface ImportLote {
  id: string;
  ano: number;
  numero: number;
  nomeArquivo: string | null;
  tipo: string;
  quantidadeLancamentos: number;
  totalDebito: string;
  totalCredito: string;
  createdAt: string;
  createdByName: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  IOB: 'IOB',
  ECD: 'ECD',
};

const COLUNAS: { label: string; key: string | null }[] = [
  { label: 'Nº Lote', key: 'numero' },
  { label: 'Ano', key: 'ano' },
  { label: 'Tipo', key: 'tipo' },
  { label: 'Arquivo', key: 'nomeArquivo' },
  { label: 'Lançamentos', key: 'quantidadeLancamentos' },
  { label: 'Total Débito', key: 'totalDebito' },
  { label: 'Total Crédito', key: 'totalCredito' },
  { label: 'Importado em', key: 'createdAt' },
  { label: 'Por', key: 'createdByName' },
  { label: 'Ações', key: null },
];

const fmtMoeda = (v: string) =>
  Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtData = (v: string) =>
  new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export const ImportLotesPage: React.FC = () => {
  const navigate = useNavigate();
  const [lotes, setLotes] = useState<ImportLote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ano, setAno] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<ImportLote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<string>('ano');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ImportLote[]>('/accounting/import-lotes', {
        params: ano ? { ano } : {},
      });
      setLotes(resp.data);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao carregar os lotes de importação.');
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const resp = await api.delete(`/accounting/import-lotes/${confirmDelete.id}`);
      toast.success(resp.data?.message || 'Lote excluído.');
      setConfirmDelete(null);
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao excluir o lote.');
    } finally {
      setDeleting(false);
    }
  };

  const sortedLotes = [...lotes].sort((a, b) => {
    let valA: any = (a as any)[sortKey];
    let valB: any = (b as any)[sortKey];
    if (sortKey === 'totalDebito' || sortKey === 'totalCredito') {
      valA = Number(valA); valB = Number(valB);
    }
    if (valA == null) valA = '';
    if (valB == null) valB = '';
    if (typeof valA === 'string' && typeof valB === 'string') {
      const cmp = valA.localeCompare(valB, 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    }
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 4, fontSize: 12, color: '#9CA3AF' }}>
        Contabilidade / Importação
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Lotes de Importação</h1>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
        Cada lote (arquivo importado) recebe um número sequencial único por ano — consta no
        Diário e no Razão junto com os lançamentos que o compõem.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>ANO</div>
          <input
            type="number"
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            placeholder="Todos"
            style={{ width: 100, padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 13 }}
          />
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#FEF2F2', color: '#B91C1C', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {COLUNAS.map(({ label: h, key }) => (
                <th
                  key={h}
                  onClick={key ? () => handleSort(key) : undefined}
                  style={{
                    padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase',
                    letterSpacing: '0.3px', textAlign: h === 'Total Débito' || h === 'Total Crédito' || h === 'Lançamentos' || h === 'Ações' ? 'right' : 'left',
                    borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                    cursor: key ? 'pointer' : 'default', userSelect: 'none',
                  }}
                >
                  {h}
                  {key && (
                    <span style={{ marginLeft: 4, opacity: sortKey === key ? 1 : 0.3, fontSize: 9 }}>
                      {sortKey === key ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Carregando...</td></tr>
            ) : sortedLotes.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Nenhum lote de importação registrado ainda.</td></tr>
            ) : (
              sortedLotes.map(l => (
                <tr key={l.id}>
                  <td style={{ padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6' }}>
                    <button
                      onClick={() => navigate(`/app/accounting/journal?importLoteId=${l.id}&loteLabel=${encodeURIComponent(`Lote ${l.numero}/${l.ano} — ${l.nomeArquivo || 'sem nome'}`)}`)}
                      style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563EB', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: 13 }}
                      title="Abrir lançamentos deste lote"
                    >
                      {l.numero}
                    </button>
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6' }}>{l.ano}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10,
                      background: '#EFF6FF', color: '#1D4ED8',
                    }}>
                      {TIPO_LABEL[l.tipo] || l.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 13, color: '#374151', borderBottom: '0.5px solid #F3F4F6' }}>
                    {l.nomeArquivo || '-'}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', borderBottom: '0.5px solid #F3F4F6' }}>
                    {l.quantidadeLancamentos}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace', color: '#2563EB', borderBottom: '0.5px solid #F3F4F6' }}>
                    {fmtMoeda(l.totalDebito)}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace', color: '#15803D', borderBottom: '0.5px solid #F3F4F6' }}>
                    {fmtMoeda(l.totalCredito)}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#9CA3AF', borderBottom: '0.5px solid #F3F4F6', whiteSpace: 'nowrap' }}>
                    {fmtData(l.createdAt)}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#6B7280', borderBottom: '0.5px solid #F3F4F6' }}>
                    {l.createdByName || '-'}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '0.5px solid #F3F4F6' }}>
                    <button
                      onClick={() => setConfirmDelete(l)}
                      title="Excluir lote integralmente"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#B91C1C', padding: 4 }}
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FiAlertTriangle size={20} color="#B91C1C" />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: 0 }}>Excluir lote definitivamente</h3>
            </div>
            <p style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>
              Isso vai apagar <strong>permanentemente</strong> o lote <strong>{confirmDelete.numero}/{confirmDelete.ano}</strong>
              {confirmDelete.nomeArquivo ? <> ({confirmDelete.nomeArquivo})</> : null} e os <strong>{confirmDelete.quantidadeLancamentos} lançamento(s)</strong> vinculados a ele.
            </p>
            <p style={{ fontSize: 13, color: '#B91C1C', marginBottom: 20 }}>
              Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#B91C1C', color: '#fff', fontSize: 13, fontWeight: 500, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? 'Excluindo...' : 'Excluir Definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportLotesPage;
