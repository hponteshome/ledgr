// src/pages/persons/PersonList.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiSearch, FiUser, FiEdit2, FiTrash2, FiExternalLink, FiEye } from 'react-icons/fi';
import api from '@/services/api';

interface Person {
  id: string;
  cpf: string;
  fullName: string;
  nickname?: string;
  email?: string;
  phone1?: string;
  city?: string;
  state?: string;
  maritalStatus?: string;
  oabNumber?: string; oabState?: string;
  crcNumber?: string; crcState?: string;
  creaNumber?: string; creaState?: string;
  coreconNumber?: string; coreconState?: string;
  isActive: boolean;
  companyLinks: Array<{
    id: string;
    role: string;
    endDate: string | null;
    company: { id: string; tradeName: string; legalName: string };
  }>;
}

const MARITAL: Record<string, string> = {
  SOLTEIRO: 'Solteiro(a)', CASADO: 'Casado(a)', UNIAO_ESTAVEL: 'União estável',
  SEPARADO: 'Separado(a)', DIVORCIADO: 'Divorciado(a)', VIUVO: 'Viúvo(a)',
};

function registroPrincipal(p: Person): string | null {
  if (p.oabNumber) return `OAB/${p.oabState ?? ''} ${p.oabNumber}`;
  if (p.crcNumber) return `CRC/${p.crcState ?? ''} ${p.crcNumber}`;
  if (p.creaNumber) return `CREA/${p.creaState ?? ''} ${p.creaNumber}`;
  if (p.coreconNumber) return `CORECON/${p.coreconState ?? ''} ${p.coreconNumber}`;
  return null;
}

export const PersonList: React.FC = () => {
  const navigate = useNavigate();
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (q) params.set('search', q);
      const { data } = await api.get(`/persons?${params}`);
      setPersons(data.data);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, search); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(1, search);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover "${name}"? Esta ação não pode ser desfeita.`)) return;
    await api.delete(`/persons/${id}`);
    load(page, search);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pessoas Físicas</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Base central de qualificação — {total} {total === 1 ? 'pessoa' : 'pessoas'}
          </p>
        </div>
        <button
          onClick={() => navigate('/app/persons/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <FiPlus size={16} /> Nova Pessoa
        </button>
      </div>

      {/* Busca */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF ou e-mail…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
          />
        </div>
      </form>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : persons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FiUser size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Nenhuma pessoa encontrada.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">CPF</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Registro</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Vínculos ativos</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Cidade</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {persons.map(p => {
                const reg = registroPrincipal(p);
                const ativos = p.companyLinks.filter(l => !l.endDate);
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-blue-600">
                            {p.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 leading-tight">{p.fullName}</p>
                          {p.email && <p className="text-xs text-gray-400">{p.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.cpf}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {reg
                        ? <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">{reg}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {ativos.length === 0
                          ? <span className="text-gray-300 text-xs">—</span>
                          : ativos.slice(0, 2).map(l => (
                            <span key={l.id} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                              {l.company.tradeName} · {l.role}
                            </span>
                          ))}
                        {ativos.length > 2 && (
                          <span className="text-xs text-gray-400">+{ativos.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                      {p.city && p.state ? `${p.city}/${p.state}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => navigate(`/app/persons/${p.id}/view`)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Visualizar"
                          >
                            <FiEye size={14} />
                          </button>
                          <button
                            onClick={() => navigate(`/app/persons/${p.id}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Editar"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.fullName)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Remover"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => load(p, search)}
              className={`w-8 h-8 rounded text-sm font-medium transition-colors
                ${p === page
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};