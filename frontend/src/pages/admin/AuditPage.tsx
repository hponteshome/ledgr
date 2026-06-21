// frontend/src/pages/admin/AuditPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { FiShield, FiSearch, FiChevronDown, FiChevronUp, FiUser, FiClock } from 'react-icons/fi';
import api from '../../services/api';

interface AuditEntry {
  id: string;
  action: string;
  targetId: string | null;
  before: any;
  after: any;
  ip: string | null;
  createdAt: string;
  actor: { fullName: string; email: string } | null;
}

interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

const fmtDate = (s: string) => {
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const actionColor = (action: string) => {
  if (action.includes('DELETE') || action.includes('REMOVE')) return 'bg-red-50 text-red-700';
  if (action.includes('CREATE') || action.includes('REGISTER')) return 'bg-green-50 text-green-700';
  if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-50 text-blue-700';
  if (action.includes('LOGIN') || action.includes('AUTH')) return 'bg-purple-50 text-purple-700';
  return 'bg-gray-100 text-gray-600';
};

const JsonDiff: React.FC<{ before: any; after: any }> = ({ before, after }) => {
  if (!before && !after) return null;
  return (
    <div className="grid grid-cols-2 gap-2 mt-2">
      {before && (
        <div>
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">Antes</p>
          <pre className="text-[11px] bg-red-50 border border-red-100 rounded-lg p-2 overflow-auto max-h-40 text-red-800 whitespace-pre-wrap">
            {JSON.stringify(before, null, 2)}
          </pre>
        </div>
      )}
      {after && (
        <div>
          <p className="text-[10px] font-semibold text-green-500 uppercase tracking-wider mb-1">Depois</p>
          <pre className="text-[11px] bg-green-50 border border-green-100 rounded-lg p-2 overflow-auto max-h-40 text-green-800 whitespace-pre-wrap">
            {JSON.stringify(after, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [filters, setFilters] = useState({
    action: '',
    actorId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
  });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: filters.page, limit: 50 };
      if (filters.action)   params.action   = filters.action;
      if (filters.actorId)  params.actorId  = filters.actorId;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo)   params.dateTo   = filters.dateTo;
      const { data } = await api.get<AuditResponse>('/audit', { params });
      setEntries(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const setFilter = (k: string, v: any) => setFilters(f => ({ ...f, [k]: v, page: 1 }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
            <FiShield className="text-purple-600" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Auditoria & Logs</h1>
            <p className="text-sm text-gray-500">{total.toLocaleString('pt-BR')} registros encontrados</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 grid grid-cols-4 gap-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="Filtrar por ação..."
            value={filters.action}
            onChange={e => setFilter('action', e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="relative">
          <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text"
            placeholder="ID do usuário..."
            value={filters.actorId}
            onChange={e => setFilter('actorId', e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={e => setFilter('dateFrom', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={e => setFilter('dateTo', e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Data/Hora</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Ação</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Usuário</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Alvo</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">IP</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400 text-sm">Carregando...</td></tr>
            )}
            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <FiShield className="mx-auto text-gray-200 mb-3" size={36} />
                  <p className="text-gray-400 text-sm">Nenhum registro encontrado</p>
                  <p className="text-gray-300 text-xs mt-1">Ajuste os filtros ou aguarde novas ações no sistema</p>
                </td>
              </tr>
            )}
            {!loading && entries.map(entry => (
              <React.Fragment key={entry.id}>
                <tr
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <FiClock size={12} />
                      {fmtDate(entry.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${actionColor(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-700">{entry.actor?.fullName ?? '—'}</div>
                    <div className="text-xs text-gray-400">{entry.actor?.email ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{entry.targetId ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{entry.ip ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {expanded === entry.id ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                  </td>
                </tr>
                {expanded === entry.id && (entry.before || entry.after) && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-6 pb-4">
                      <JsonDiff before={entry.before} after={entry.after} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">Página {filters.page} de {pages}</span>
            <div className="flex gap-2">
              <button
                disabled={filters.page === 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >Anterior</button>
              <button
                disabled={filters.page >= pages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50"
              >Próxima</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
