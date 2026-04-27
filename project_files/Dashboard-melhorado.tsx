import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { KPICard } from '../components/KPICard';
import api from '../services/api';
import {
  FiBriefcase,
  FiUsers,
  FiDollarSign,
  FiFileText,
  FiActivity,
  FiTrendingUp,
  FiClock,
  FiCheckCircle
} from 'react-icons/fi';

interface DashboardStats {
  empresas: number;
  usuarios: number;
  lancamentos: number;
  nfes: number;
}

interface Empresa {
  id: string;
  razaoSocial: string;
  cnpj: string;
  regimeTributario?: string;
  criadoEm: string;
}

interface AtividadeRecente {
  id: string;
  tipo: 'empresa' | 'usuario' | 'nfe' | 'lancamento';
  descricao: string;
  timestamp: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    empresas: 0,
    usuarios: 0,
    lancamentos: 0,
    nfes: 0
  });
  const [empresasRecentes, setEmpresasRecentes] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Carregar empresas
      const empresasResponse = await api.get('/empresas');
      const empresas = empresasResponse.data;

      // Carregar usuários
      const usuariosResponse = await api.get('/usuarios');
      const usuarios = usuariosResponse.data;

      // Atualizar estatísticas
      setStats({
        empresas: empresas.length,
        usuarios: usuarios.length,
        lancamentos: 1243, // Mock - substituir por dados reais
        nfes: 342 // Mock - substituir por dados reais
      });

      // Pegar as 5 empresas mais recentes
      const recentes = empresas
        .sort((a: Empresa, b: Empresa) => 
          new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
        )
        .slice(0, 5);
      
      setEmpresasRecentes(recentes);

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Há poucos minutos';
    if (diffHours < 24) return `Há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    if (diffDays < 7) return `Há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    
    return date.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h1>
          <p className="text-gray-500">Visão geral do sistema LEDGR</p>
        </div>
        <button 
          onClick={carregarDados}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <FiActivity size={18} />
          Atualizar Dados
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Empresas Ativas"
          value={stats.empresas}
          icon={FiBriefcase}
          color="bg-blue-600"
          link="/app/empresas"
          trend={{ value: 12, positive: true }}
        />
        <KPICard
          title="Usuários Ativos"
          value={stats.usuarios}
          icon={FiUsers}
          color="bg-purple-600"
          link="/app/usuarios"
          trend={{ value: 8, positive: true }}
        />
        <KPICard
          title="Lançamentos (Mês)"
          value={stats.lancamentos.toLocaleString('pt-BR')}
          icon={FiDollarSign}
          color="bg-green-600"
          link="/app/financeiro"
          trend={{ value: 24, positive: true }}
        />
        <KPICard
          title="NF-e Emitidas"
          value={stats.nfes}
          icon={FiFileText}
          color="bg-orange-600"
          link="/app/fiscal"
          trend={{ value: 18, positive: true }}
        />
      </div>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* EMPRESAS RECENTES - 2/3 da largura */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Empresas Recentes</h2>
              <p className="text-sm text-gray-500 mt-1">Últimas empresas cadastradas</p>
            </div>
            <Link 
              to="/app/empresas"
              className="text-blue-600 text-sm font-semibold hover:text-blue-700 flex items-center gap-1"
            >
              Ver Todas
              <FiTrendingUp size={16} />
            </Link>
          </div>

          {empresasRecentes.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiBriefcase className="text-gray-400 text-2xl" />
              </div>
              <p className="text-gray-500 mb-4">Nenhuma empresa cadastrada ainda</p>
              <Link
                to="/app/empresas/nova"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FiBriefcase /> Cadastrar Primeira Empresa
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Empresa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      CNPJ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Regime
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Cadastro
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {empresasRecentes.map((empresa) => (
                    <tr key={empresa.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800 text-sm">
                          {empresa.razaoSocial}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono text-gray-600">
                          {formatCNPJ(empresa.cnpj)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRegimeBadge(empresa.regimeTributario)}`}>
                          {empresa.regimeTributario?.replace('_', ' ') || 'Não definido'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <FiClock size={12} />
                          {formatDate(empresa.criadoEm)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SIDEBAR DIREITA - 1/3 da largura */}
        <div className="space-y-6">
          
          {/* ATIVIDADES RECENTES */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FiActivity className="text-blue-600" />
              Atividades Recentes
            </h3>
            <div className="space-y-4">
              {empresasRecentes.slice(0, 3).map((empresa, index) => (
                <div key={empresa.id} className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiBriefcase size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      Nova empresa cadastrada
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {empresa.razaoSocial}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(empresa.criadoEm)}
                    </p>
                  </div>
                </div>
              ))}
              
              {empresasRecentes.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhuma atividade recente
                </p>
              )}
            </div>
          </div>

          {/* STATUS DO SISTEMA */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FiCheckCircle className="text-green-600" />
              Status do Sistema
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">API Backend</span>
                </div>
                <span className="text-xs text-green-600 font-semibold">Operacional</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Banco de Dados</span>
                </div>
                <span className="text-xs text-green-600 font-semibold">Operacional</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">Integração SEFAZ</span>
                </div>
                <span className="text-xs text-green-600 font-semibold">Operacional</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-gray-700">Consulta RFB</span>
                </div>
                <span className="text-xs text-yellow-600 font-semibold">Parcial</span>
              </div>
            </div>
          </div>

          {/* AÇÕES RÁPIDAS */}
          <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-6 text-white">
            <h3 className="text-lg font-bold mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              <Link
                to="/app/empresas/nova"
                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-between group"
              >
                <span className="text-sm font-medium">Nova Empresa</span>
                <FiBriefcase className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/app/usuarios"
                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-between group"
              >
                <span className="text-sm font-medium">Gerenciar Usuários</span>
                <FiUsers className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/app/fiscal"
                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-between group"
              >
                <span className="text-sm font-medium">Emitir NF-e</span>
                <FiFileText className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
