import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiBriefcase } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

// Interface atualizada para o padrão Ledgr 1.0 (English Names)
interface Company {
  id: string;
  legalName: string;      // ← CORRIGIDO: legalName (era corporateName)
  tradeName: string;
  taxId: string;
  status: string;
  isSede: boolean;
  createdAt: string;
}

export const CompanyList: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadCompanies = async () => {
    try {
      setLoading(true);
      console.log('🔍 [DEBUG] Requesting company list: /companies/available');

      const response = await api.get('/companies/available');
      console.log('📦 [DEBUG] Data received:', response.data);

      // Mapeamento correto para a interface Company
      const normalizedCompanies: Company[] = response.data.map((emp: any) => ({
        id: emp.id,
        legalName: emp.legalName || emp.razao_social || 'NO LEGAL NAME',
        tradeName: emp.tradeName || emp.nome_fantasia || '',
        taxId: emp.taxId || emp.cnpj || '',
        status: (emp.status || emp.situacao || 'INACTIVE').toUpperCase(),
        isSede: emp.isSede ?? false,
        createdAt: emp.createdAt || emp.criado_em || new Date().toISOString()
      }));

      setCompanies(normalizedCompanies);
    } catch (error) {
      console.error('❌ [ERROR] Failed to load companies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const formatCNPJ = (cnpj: string | undefined) => {
    if (!cnpj) return '—';
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const filteredCompanies = companies.filter(emp =>
    emp.legalName.toLowerCase().includes(search.toLowerCase()) ||
    emp.tradeName.toLowerCase().includes(search.toLowerCase()) ||
    emp.taxId.includes(search)
  );

  const handleEdit = (id: string) => {
    console.log('📝 [DEBUG] Navigating to edit company ID:', id);
    navigate(`/app/companies/${id}/edit`);
  };

  const handleDelete = async (id: string, legalName: string) => {
    if (window.confirm(`Do you really want to delete the company "${legalName}"?`)) {
      try {
        console.log('🗑️ [DEBUG] Requesting deletion of company ID:', id);
        await api.delete(`/companies/${id}`);
        alert('Company successfully deleted!');
        loadCompanies();
      } catch (error) {
        console.error('❌ [ERROR] Failed to delete:', error);
        alert('Error deleting company');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Companies</h1>
          <p className="text-sm text-gray-500">Manage registered companies in the system</p>
        </div>
        <button
          onClick={() => navigate('/app/companies/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          <FiPlus size={18} />
          New Company
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search by corporate name, trade name or CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FiBriefcase className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500">
            {search ? 'No companies found with these criteria' : 'No companies registered yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Corporate Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CNPJ</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Registered At</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center font-bold">
                        {company.legalName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{company.legalName}</p>
                        {company.tradeName && company.tradeName !== company.legalName && (
                          <p className="text-xs text-gray-500">{company.tradeName}</p>
                        )}
                        {company.isSede && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Headquarters
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-600">{formatCNPJ(company.taxId)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full font-bold ${company.status === 'ACTIVE' || company.status === 'ATIVA'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                      {company.status === 'ACTIVE' || company.status === 'ATIVA' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(company.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(company.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      {!company.isSede && (
                        <button
                          onClick={() => handleDelete(company.id, company.legalName)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer with Counters */}
      <div className="flex items-center justify-between text-sm text-gray-600 border-t border-gray-100 pt-4">
        <p>
          Showing <strong>{filteredCompanies.length}</strong> of <strong>{companies.length}</strong> companies
        </p>
      </div>
    </div>
  );
};