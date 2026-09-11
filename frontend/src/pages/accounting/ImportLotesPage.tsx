// frontend/src/pages/accounting/ImportLotesPage.tsx
// NOVO (10/09/2026): listagem dos lotes de importacao - cada lote tem
// numero sequencial unico por empresa+ano (qualquer tipo: Manual/IOB/ECD).
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
              {['Nº Lote', 'Ano', 'Tipo', 'Arquivo', 'Lançamentos', 'Total Débito', 'Total Crédito', 'Importado em', 'Por'].map(h => (
                <th key={h} style={{
                  padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase',
                  letterSpacing: '0.3px', textAlign: h === 'Total Débito' || h === 'Total Crédito' || h === 'Lançamentos' ? 'right' : 'left',
                  borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Carregando...</td></tr>
            ) : lotes.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#9CA3AF' }}>Nenhum lote de importação registrado ainda.</td></tr>
            ) : (
              lotes.map(l => (
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ImportLotesPage;
