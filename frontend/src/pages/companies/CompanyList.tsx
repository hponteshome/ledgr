import React, { useState, useEffect, useMemo } from 'react';
import {
  FiPlus, FiEye, FiEdit2, FiTrash2, FiSearch,
  FiBriefcase, FiChevronUp, FiChevronDown
} from 'react-icons/fi';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';

import { useNotification } from '../../components/hooks/useNotification';
import { useConfirm } from '../../components/hooks/useConfirm';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { handleApiError } from '../../utils/errorHandler';

interface Company {
  id: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  status: string;
  isSede: boolean;
  createdAt: string;
}

export const CompanyList: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Company; direction: 'asc' | 'desc' }>({
    key: 'legalName',
    direction: 'asc',
  });

  // Carregamento de dados
  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await api.get('/companies/available');

      const normalizedCompanies: Company[] = response.data.map((emp: any) => ({
        id: emp.id,
        legalName: emp.legalName || emp.razao_social || 'NO LEGAL NAME',
        tradeName: emp.tradeName || emp.nome_fantasia || '',
        taxId: emp.taxId || emp.cnpj || '',
        status: (emp.status || emp.situacao || 'INACTIVE').toUpperCase(),
        isSede: emp.isSede ?? emp.is_sede ?? false,
        createdAt: emp.createdAt || emp.criado_em || new Date().toISOString()
      }));

      setCompanies(normalizedCompanies);
      showNotification({
        type: 'success',
        message: `${normalizedCompanies.length} empresas carregadas com sucesso.`
      });
    } catch (error) {
      console.error('❌ [ERROR] Failed to load companies:', error);
      const errorInfo = handleApiError(error);
      showNotification({
        type: 'error',
        message: errorInfo.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  // Handlers
  const handleSort = (key: keyof Company) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleDelete = async (id: string, legalName: string) => {
    const userStr = localStorage.getItem('@ledgr:user');
    const user = userStr ? JSON.parse(userStr) : null;
    const profileName = user?.profile?.name || 'SEM PERFIL';

    // Verificar permissões antes de confirmar
    if (!user?.profile?.permissions?.all) {
      showNotification({
        type: 'warning',
        message: 'Apenas administradores podem excluir empresas.'
      });
      return;
    }

    // 🔥 CORREÇÃO: Buscar a empresa atual da lista
    const currentCompany = companies.find(c => c.id === id);

    // Verificar se é sede
    if (currentCompany?.isSede) {
      showNotification({
        type: 'warning',
        message: 'Matrizes não podem ser excluídas. Desative a empresa ou exclua as filiais primeiro.'
      });
      return;
    }

    const confirmed = await confirm({
      title: 'Confirmar exclusão',
      message: `👤 Perfil: ${profileName}\n\n⚠️ ATENÇÃO: A exclusão de "${legalName}" removerá dados fiscais e sócios.\n\nDeseja continuar?`,
      type: 'danger',
      confirmText: 'Sim, excluir permanentemente',
      cancelText: 'Não, cancelar'
    });

    if (!confirmed) return;

    try {
      const currentCompanyId = localStorage.getItem('@ledgr:companyId');

      console.log('🗑️ Deletando empresa:', id);
      console.log('🏢 Company ID atual:', currentCompanyId);

      const response = await api.delete(`/companies/${id}`, {
        headers: {
          'x-company-id': currentCompanyId
        }
      });

      console.log('✅ Status:', response.status);

      setCompanies(prev => prev.filter(c => c.id !== id));

      showNotification({
        type: 'success',
        message: `Empresa "${legalName}" excluída com sucesso.`
      });
    } catch (error: any) {
      console.error('❌ Erro detalhado:', error.response?.data);

      const errorInfo = handleApiError(error);

      let message = errorInfo.message;

      // Mensagens específicas para exclusão
      if (errorInfo.statusCode === 403) {
        message = 'Você não tem permissão para excluir esta empresa.';
      } else if (errorInfo.statusCode === 400 && errorInfo.message.includes('vínculos')) {
        message = 'Esta empresa possui vínculos (sócios/documentos) e não pode ser excluída.';
      }

      showNotification({
        type: 'error',
        message
      });
    }
  };

  // Lógica de Filtro e Ordenação (Memoizada para performance)
  const filteredAndSorted = useMemo(() => {
    return companies
      .filter(emp =>
        emp.legalName.toLowerCase().includes(search.toLowerCase()) ||
        emp.tradeName.toLowerCase().includes(search.toLowerCase()) ||
        emp.taxId.includes(search)
      )
      .sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [companies, search, sortConfig]);

  // Helpers de Formatação
  const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');

  return (
    <div className="space-y-6 w-full animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Companies</h1>
          <p className="text-sm text-gray-500">Manage registered business units and headquarters</p>
        </div>
        <button
          onClick={() => navigate('/app/companies/new')}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm font-semibold"
        >
          <FiPlus size={20} />
          New Company
        </button>
      </div>

      {/* Search */}
      <div className="relative group">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
        <input
          type="text"
          placeholder="Search by legal name, trade name or Tax ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white"
        />
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <span className="text-gray-500 font-medium">Loading units...</span>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center">
          <FiBriefcase className="mx-auto text-gray-200 mb-4" size={64} />
          <p className="text-gray-500 font-medium">
            {search ? 'No results match your search' : 'No companies found in the database'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  {[
                    { label: 'Company Details', key: 'legalName' },
                    { label: 'Tax ID', key: 'taxId' },
                    { label: 'Status', key: 'status' },
                    { label: 'Created At', key: 'createdAt' }
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key as keyof Company)}
                      className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:text-blue-600 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        {sortConfig.key === col.key ? (
                          sortConfig.direction === 'asc' ? <FiChevronUp /> : <FiChevronDown />
                        ) : null}
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAndSorted.map((company) => (
                  <tr key={company.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold shadow-sm">
                          {company.legalName.charAt(0)}
                        </div>
                        <div className="flex flex-col max-w-[250px]">
                          <span className="font-bold text-gray-800 truncate leading-tight">{company.legalName}</span>
                          <span className="text-xs text-gray-500 truncate">{company.tradeName || '---'}</span>
                          {company.isSede && (
                            <span className="mt-1 w-fit text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">
                              HQ
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link to={`/app/companies/show/${company.id}`} className="text-sm font-mono font-medium text-blue-600 hover:underline">
                        {company.taxId}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[10px] rounded-full font-black uppercase tracking-wide ${company.status === 'ACTIVE' || company.status === 'ATIVA'
                        ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {company.status === 'ACTIVE' || company.status === 'ATIVA' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(company.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/app/companies/show/${company.id}`}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                          title="View"
                        >
                          <FiEye size={18} />
                        </Link>
                        <Link
                          to={`/app/companies/edit/${company.id}`}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                          title="Edit"
                        >
                          <FiEdit2 size={18} />
                        </Link>
                        {!company.isSede && (
                          <button
                            onClick={() => handleDelete(company.id, company.legalName)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                            title="Delete"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
            <span>
              Showing <strong>{filteredAndSorted.length}</strong> of <strong>{companies.length}</strong> registered units
            </span>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        options={confirmState.options!}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};