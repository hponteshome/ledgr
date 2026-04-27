import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { 
  FiPlus, 
  FiEdit2, 
  FiTrash2, 
  FiBriefcase,
  FiSearch,
  FiFilter,
  FiDownload,
  FiRefreshCw
} from 'react-icons/fi';

interface Empresa {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  telefone1?: string;
  email?: string;
  regimeTributario?: string;
  porte?: string;
  uf?: string;
  municipio?: string;
  criadoEm: string;
}

export const EmpresaLista: React.FC = () => {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroRegime, setFiltroRegime] = useState('');

  useEffect(() => {
    carregarEmpresas();
  }, []);

  const carregarEmpresas = async () => {
    try {
      setLoading(true);
      const response = await api.get('/empresas');
      console.log('✅ Empresas carregadas:', response.data);
      setEmpresas(response.data);
    } catch (error) {
      console.error('❌ Erro ao carregar empresas:', error);
      alert('Erro ao carregar empresas. Verifique a conexão com o backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, razaoSocial: string) => {
    if (!window.confirm(`Deseja realmente excluir a empresa "${razaoSocial}"?`)) return;

    try {
      await api.delete(`/empresas/${id}`);
      alert('✅ Empresa excluída com sucesso!');
      carregarEmpresas();
    } catch (error) {
      console.error('❌ Erro ao excluir:', error);
      alert('❌ Erro ao excluir empresa.');
    }
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return '';
    const numeros = cnpj.replace(/\D/g, '');
    return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  };

  const getRegimeBadge = (regime?: string) => {
    const badges = {
      'SIMPLES_NACIONAL': 'bg-purple-100 text-purple-800',
      'LUCRO_PRESUMIDO': 'bg-green-100 text-green-800',
      'LUCRO_REAL': 'bg-blue-100 text-blue-800',
    };
    return badges[regime as keyof typeof badges] || 'bg-gray-100 text-gray-800';
  };

  const empresasFiltradas = empresas.filter(empresa => {
    const matchSearch = 
      empresa.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      empresa.cnpj.includes(searchTerm) ||
      (empresa.nomeFantasia?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchRegime = !filtroRegime || empresa.regimeTributario === filtroRegime;
    
    return matchSearch && matchRegime;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* HEADER COM TÍTULO E AÇÕES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Empresas</h1>
          <p className="text-gray-500">
            {empresasFiltradas.length} {empresasFiltradas.length === 1 ? 'empresa encontrada' : 'empresas encontradas'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={carregarEmpresas}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 transition-colors"
          >
            <FiRefreshCw size={18} />
            Atualizar
          </button>
          <Link
            to="/app/empresas/nova"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-md shadow-blue-200"
          >
            <FiPlus size={18} />
            Nova Empresa
          </Link>
        </div>
      </div>

      {/* BARRA DE BUSCA E FILTROS */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          
          {/* Campo de Busca */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por razão social, CNPJ ou nome fantasia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por Regime */}
          <div className="relative sm:w-64">
            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={filtroRegime}
              onChange={(e) => setFiltroRegime(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Todos os Regimes</option>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="LUCRO_REAL">Lucro Real</option>
            </select>
          </div>
        </div>
      </div>

      {/* LISTA DE EMPRESAS */}
      {empresasFiltradas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiBriefcase className="text-gray-400 text-3xl" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {searchTerm || filtroRegime ? 'Nenhuma empresa encontrada' : 'Nenhuma empresa cadastrada'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filtroRegime 
              ? 'Tente ajustar os filtros de busca'
              : 'Comece cadastrando sua primeira empresa'
            }
          </p>
          {!searchTerm && !filtroRegime && (
            <Link
              to="/app/empresas/nova"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiPlus /> Cadastrar Primeira Empresa
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    CNPJ
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Localização
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Regime
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {empresasFiltradas.map((empresa) => (
                  <tr key={empresa.id} className="hover:bg-gray-50 transition-colors">
                    
                    {/* EMPRESA */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FiBriefcase size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">
                            {empresa.razaoSocial}
                          </div>
                          {empresa.nomeFantasia && empresa.nomeFantasia !== empresa.razaoSocial && (
                            <div className="text-sm text-gray-500">
                              {empresa.nomeFantasia}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* CNPJ */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-gray-700">
                        {formatCNPJ(empresa.cnpj)}
                      </span>
                    </td>

                    {/* LOCALIZAÇÃO */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700">
                        {empresa.municipio && empresa.uf 
                          ? `${empresa.municipio}/${empresa.uf}`
                          : empresa.uf || '-'
                        }
                      </div>
                    </td>

                    {/* REGIME */}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getRegimeBadge(empresa.regimeTributario)}`}>
                        {empresa.regimeTributario 
                          ? empresa.regimeTributario.replace('_', ' ')
                          : 'Não definido'
                        }
                      </span>
                    </td>

                    {/* CONTATO */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">
                        {empresa.telefone1 && (
                          <div>{empresa.telefone1}</div>
                        )}
                        {empresa.email && (
                          <div className="text-xs text-gray-500">{empresa.email}</div>
                        )}
                        {!empresa.telefone1 && !empresa.email && '-'}
                      </div>
                    </td>

                    {/* AÇÕES */}
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/app/empresas/${empresa.id}/editar`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <FiEdit2 size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(empresa.id, empresa.razaoSocial)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER DA TABELA */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Mostrando <span className="font-semibold">{empresasFiltradas.length}</span> {empresasFiltradas.length === 1 ? 'empresa' : 'empresas'}
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <FiDownload size={16} />
              Exportar Lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
