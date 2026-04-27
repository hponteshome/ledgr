import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext'; // Atualizado para CompanyContext

// 1. Interface alinhada com o Prisma/Backend 1.0
interface Company {
  id: string;
  corporateName: string; // Refatorado: razao_social -> corporateName
  cnpj: string;
  taxRegime: string;     // Refatorado: regime_tributario -> taxRegime
  createdAt: string;
}

export const Dashboard: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth(); // 'user' contém 'fullName' do backend
  const { activeCompany } = useCompany(); // Traduzido: empresaAtiva -> activeCompany

  useEffect(() => {
    // Busca dados apenas se o token e a empresa selecionada existirem
    if (token && activeCompany) {
      fetchCompanies();
    }
  }, [token, activeCompany]);

  const fetchCompanies = async () => {
    if (!activeCompany) return;

    try {
      setLoading(true);
      const response = await axios.get('http://localhost:3000/companies', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-company-id': activeCompany.id // Mantendo o header de contexto
        }
      });

      // Sincronizado com os últimos registros retornados pelo backend
      setCompanies(response.data.slice(0, 3));
    } catch (error) {
      console.error('Error fetching companies:', error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCNPJ = (value: string) => {
    return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const getTaxBadge = (regime: string) => {
    const regimes: Record<string, { bg: string; text: string }> = {
      'SIMPLES_NACIONAL': { bg: 'bg-purple-100', text: 'text-purple-800' },
      'LUCRO_REAL': { bg: 'bg-blue-100', text: 'text-blue-800' },
      'LUCRO_PRESUMIDO': { bg: 'bg-green-100', text: 'text-green-800' },
    };
    return regimes[regime] || { bg: 'bg-gray-100', text: 'text-gray-800' };
  };

  return (
    <div className="space-y-8 p-4">
      {/* CABEÇALHO DINÂMICO */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {/* Usa fullName do User Summary */}
            Welcome back, {user?.fullName?.split(' ')[0] || 'User'}!
          </h1>
          <p className="text-gray-500 mt-1">Ledgr System Overview</p>
        </div>
        <button
          onClick={fetchCompanies}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* KPIs - Refletindo a Company Ativa traduzida */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="text-sm text-gray-500 font-medium">Active Entity</div>
          <div className="text-xl font-bold text-blue-600 truncate">
            {activeCompany?.corporateName || 'None Selected'}
          </div>
        </div>
      </div>

      {/* TABELA DE EMPRESAS RECENTES */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Recent Companies</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Tax ID (CNPJ)</th>
                <th className="px-6 py-3 text-xs font-semibold text-gray-600 uppercase">Regime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-400">Loading...</td></tr>
              ) : (
                companies.map((c) => {
                  const badge = getTaxBadge(c.taxRegime);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">{c.corporateName}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">{formatCNPJ(c.cnpj)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                          {c.taxRegime?.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};