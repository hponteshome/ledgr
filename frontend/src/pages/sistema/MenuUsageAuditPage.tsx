// frontend/src/pages/sistema/MenuUsageAuditPage.tsx
// Auditoria de uso do menu (Estagio 3 do roadmap de navegacao -
// docs/LEDGR-benchmark-ux-navegacao.md): mostra quais rotinas do catalogo
// (sidebar_items) sao mais/menos usadas, pra apoiar decisoes futuras de
// reordenacao/poda do menu. Contagem global (todos os usuarios/empresas).
import { useEffect, useState } from 'react';
import { FiBarChart2, FiRefreshCw, FiAlertTriangle } from 'react-icons/fi';
import api from '../../services/api';

interface UsageItem {
  path: string;
  label: string;
  moduleLabel: string;
  hitCount: number;
  lastUsedAt: string | null;
}

interface Report {
  items: UsageItem[];
  totalCatalogRoutes: number;
  neverUsedCount: number;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MenuUsageAuditPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/menu-usage/report');
      setReport(data);
    } catch {
      setError('Erro ao carregar relatório de uso do menu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const mostUsed = report?.items.filter(i => i.hitCount > 0) ?? [];
  const neverUsed = report?.items.filter(i => i.hitCount === 0) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <FiBarChart2 className="text-blue-600" /> Auditoria de Uso do Menu
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Contagem global de navegação por rotina — apoia decisões de reordenação e poda do menu conforme o produto cresce.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:opacity-50">
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Rotinas no catálogo</p>
            <p className="text-3xl font-black text-gray-800">{report.totalCatalogRoutes}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold text-gray-400 uppercase mb-1">Já utilizadas</p>
            <p className="text-3xl font-black text-green-600">{mostUsed.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 bg-amber-50 shadow-sm p-5">
            <p className="text-xs font-bold text-amber-600 uppercase mb-1 flex items-center gap-1.5">
              <FiAlertTriangle size={12} /> Nunca utilizadas
            </p>
            <p className="text-3xl font-black text-amber-700">{report.neverUsedCount}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700">Mais utilizadas</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase">Rotina</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase">Módulo</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase text-right">Usos</th>
              <th className="px-5 py-3 text-xs font-bold text-gray-400 uppercase text-right">Último uso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">Carregando...</td></tr>
            )}
            {!loading && mostUsed.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Nenhuma rotina utilizada ainda.</td></tr>
            )}
            {mostUsed.map(item => (
              <tr key={item.path} className="hover:bg-gray-50/50">
                <td className="px-5 py-3">
                  <div className="font-semibold text-gray-800 text-sm">{item.label}</div>
                  <div className="text-[11px] text-gray-400 font-mono">{item.path}</div>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500">{item.moduleLabel}</td>
                <td className="px-5 py-3 text-right">
                  <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 bg-blue-50 text-blue-700 text-xs font-black rounded-full">
                    {item.hitCount}
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-xs text-gray-400">{formatDate(item.lastUsedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {neverUsed.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <FiAlertTriangle size={14} className="text-amber-500" />
            <h2 className="text-sm font-bold text-gray-700">Nunca utilizadas — candidatas a revisão/poda</h2>
          </div>
          <div className="p-5 flex flex-wrap gap-2">
            {neverUsed.map(item => (
              <span key={item.path} title={item.path}
                className="text-xs bg-gray-50 border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg">
                {item.label} <span className="text-gray-300">·</span> <span className="text-gray-400">{item.moduleLabel}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
