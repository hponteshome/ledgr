import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { KPICard } from '../components/KPICard';
import { useEmpresa } from '../contexts/EmpresaContext';
import {
  FiBriefcase,
  FiUsers,
  FiDollarSign,
  FiFileText,
  FiTrendingUp,
  FiArrowRight,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
  FiActivity,
  FiRefreshCw
} from 'react-icons/fi';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface DashboardData {
  empresas: {
    total: number;
    ativas: number;
    inativas: number;
    ultimas: Array<{
      id: string;
      razaoSocial: string;
      cnpj: string;
      status: string;
      createdAt: string;
    }>;
  };
  usuarios: {
    total: number;
    ativos: number;
    admin: number;
    comuns: number;
  };
  financeiro: {
    saldo: number;
    receitas: number;
    despesas: number;
    pendentes: number;
  };
  documentos: {
    total: number;
    emitidos: number;
    pendentes: number;
    vencidos: number;
  };
  atividades: Array<{
    id: string;
    tipo: 'empresa' | 'usuario' | 'documento' | 'financeiro';
    acao: string;
    descricao: string;
    data: string;
    usuario: string;
  }>;
}

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('semana');
  const { empresaAtiva } = useEmpresa();

  useEffect(() => {
    carregarDados();
  }, [periodo, empresaAtiva]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError(null);

      let empresas = [];
      let usuarios = [];

      // Tentar carregar empresas
      try {
        const empresasRes = await api.get('/empresas');
        empresas = empresasRes.data || [];
        console.log('Empresas carregadas:', empresas.length);
      } catch (err) {
        console.warn('Erro ao carregar empresas, usando dados mockados:', err);
        // Dados mockados para empresas
        empresas = [
          { id: '1', razaoSocial: 'Empresa ABC Ltda', cnpj: '12.345.678/0001-90', status: 'ativo', createdAt: new Date().toISOString() },
          { id: '2', razaoSocial: 'Holding Ledgr S.A', cnpj: '98.765.432/0001-10', status: 'ativo', createdAt: new Date().toISOString() },
          { id: '3', razaoSocial: 'Tech Solutions ME', cnpj: '11.222.333/0001-44', status: 'inativo', createdAt: new Date().toISOString() },
        ];
      }

      // Tentar carregar usuários
      try {
        const usuariosRes = await api.get('/usuarios');
        usuarios = usuariosRes.data || [];
        console.log('Usuários carregados:', usuarios.length);
      } catch (err) {
        console.warn('Erro ao carregar usuários, usando dados mockados:', err);
        // Dados mockados para usuários
        usuarios = [
          { id: '1', nome: 'Administrador', email: 'admin@ledgr.com', ativo: true, perfil: { nome: 'Administrador' } },
          { id: '2', nome: 'João Silva', email: 'joao@email.com', ativo: true, perfil: { nome: 'Usuário' } },
          { id: '3', nome: 'Maria Santos', email: 'maria@email.com', ativo: false, perfil: { nome: 'Usuário' } },
        ];
      }

      // Dados financeiros mockados
      const financeiro = {
        saldo: 152345.67,
        receitas: 45678.90,
        despesas: 32456.78,
        pendentes: 12345.67
      };

      // Dados de documentos mockados
      const documentos = {
        total: 234,
        emitidos: 187,
        pendentes: 32,
        vencidos: 15
      };

      // Atividades recentes mockadas
      const atividades = [
        {
          id: '1',
          tipo: 'empresa' as const,
          acao: 'criacao',
          descricao: 'Nova empresa cadastrada: Empresa ABC Ltda',
          data: new Date().toISOString(),
          usuario: 'admin@ledgr.com'
        },
        {
          id: '2',
          tipo: 'usuario' as const,
          acao: 'atualizacao',
          descricao: 'Usuário João Silva atualizou perfil',
          data: new Date(Date.now() - 3600000).toISOString(),
          usuario: 'joao@email.com'
        },
        {
          id: '3',
          tipo: 'documento' as const,
          acao: 'emissao',
          descricao: 'Nota fiscal #12345 emitida',
          data: new Date(Date.now() - 7200000).toISOString(),
          usuario: 'sistema@ledgr.com'
        },
        {
          id: '4',
          tipo: 'financeiro' as const,
          acao: 'pagamento',
          descricao: 'Pagamento recebido de R$ 5.000,00',
          data: new Date(Date.now() - 86400000).toISOString(),
          usuario: 'financeiro@ledgr.com'
        }
      ];

      setData({
        empresas: {
          total: empresas.length,
          ativas: empresas.filter((e: any) => e.status === 'ativo').length,
          inativas: empresas.filter((e: any) => e.status !== 'ativo').length,
          ultimas: empresas.slice(0, 5).map((e: any) => ({
            id: e.id,
            razaoSocial: e.razaoSocial || e.nome || 'Empresa sem nome',
            cnpj: e.cnpj || '00.000.000/0000-00',
            status: e.status || 'ativo',
            createdAt: e.createdAt || new Date().toISOString()
          }))
        },
        usuarios: {
          total: usuarios.length,
          ativos: usuarios.filter((u: any) => u.ativo).length,
          admin: usuarios.filter((u: any) => u.perfil?.nome === 'Administrador').length,
          comuns: usuarios.filter((u: any) => u.perfil?.nome !== 'Administrador').length
        },
        financeiro,
        documentos,
        atividades
      });

    } catch (error) {
      console.error('Erro crítico ao carregar dashboard:', error);
      setError('Não foi possível carregar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return date;
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'ativo'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  const getActivityIcon = (tipo: string) => {
    switch (tipo) {
      case 'empresa': return <FiBriefcase className="text-blue-500" />;
      case 'usuario': return <FiUsers className="text-green-500" />;
      case 'documento': return <FiFileText className="text-purple-500" />;
      case 'financeiro': return <FiDollarSign className="text-yellow-500" />;
      default: return <FiActivity className="text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-500">Carregando dashboard...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <FiAlertCircle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Erro ao carregar dados</h3>
        <p className="mt-2 text-gray-500">{error}</p>
        <button
          onClick={carregarDados}
          className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiRefreshCw className="mr-2" />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <FiAlertCircle className="mx-auto h-12 w-12 text-yellow-500" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Nenhum dado disponível</h3>
        <p className="mt-2 text-gray-500">Não há dados para exibir no momento.</p>
        <button
          onClick={carregarDados}
          className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiRefreshCw className="mr-2" />
          Recarregar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Cabeçalho com período */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            {empresaAtiva ? `Empresa: ${empresaAtiva.razaoSocial}` : 'Visão geral do sistema'}
          </p>
        </div>

        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          {(['hoje', 'semana', 'mes'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${periodo === p
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Esta Semana' : 'Este Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <FiBriefcase className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-400">Total</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500">Empresas</h3>
          <div className="flex items-end justify-between mt-2">
            <p className="text-3xl font-bold text-gray-900">{data.empresas.total}</p>
            <div className="text-sm">
              <span className="text-green-600 font-medium">{data.empresas.ativas} ativas</span>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-gray-500">
            <FiTrendingUp className="mr-1 text-green-500" />
            <span>{data.empresas.ativas} ativas, {data.empresas.inativas} inativas</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <FiUsers className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-400">Ativos</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500">Usuários</h3>
          <div className="flex items-end justify-between mt-2">
            <p className="text-3xl font-bold text-gray-900">{data.usuarios.total}</p>
            <div className="text-sm">
              <span className="text-green-600 font-medium">{data.usuarios.ativos} ativos</span>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-gray-500">
            <FiUsers className="mr-1 text-blue-500" />
            <span>{data.usuarios.admin} admin • {data.usuarios.comuns} usuários</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-xl">
              <FiDollarSign className="h-6 w-6 text-yellow-600" />
            </div>
            <span className="text-xs font-medium text-gray-400">Saldo</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500">Financeiro</h3>
          <div className="flex items-end justify-between mt-2">
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(data.financeiro.saldo)}</p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-green-600">Receitas: {formatCurrency(data.financeiro.receitas)}</span>
            <span className="text-red-600">Despesas: {formatCurrency(data.financeiro.despesas)}</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <FiFileText className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-gray-400">Docs</span>
          </div>
          <h3 className="text-sm font-medium text-gray-500">Documentos</h3>
          <div className="flex items-end justify-between mt-2">
            <p className="text-3xl font-bold text-gray-900">{data.documentos.total}</p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-green-600">{data.documentos.emitidos} emitidos</span>
            <span className="text-yellow-600">{data.documentos.pendentes} pendentes</span>
            <span className="text-red-600">{data.documentos.vencidos} vencidos</span>
          </div>
        </div>
      </div>

      {/* Grid de 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Últimas Empresas */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Últimas Empresas Cadastradas</h2>
              <Link
                to="/app/empresas"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Ver todas <FiArrowRight />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Razão Social</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">CNPJ</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase">Cadastro</th>
                  <th className="text-right py-3 px-6 text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.empresas.ultimas.length > 0 ? (
                  data.empresas.ultimas.map((empresa) => (
                    <tr key={empresa.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <p className="text-sm font-medium text-gray-800">{empresa.razaoSocial}</p>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">{empresa.cnpj}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(empresa.status)}`}>
                          {empresa.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <FiClock size={12} />
                          {formatDate(empresa.createdAt)}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link
                          to={`/app/empresas/${empresa.id}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Gerenciar
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Nenhuma empresa cadastrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Atividades Recentes */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">Atividades Recentes</h2>
          </div>

          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {data.atividades.map((atividade) => (
              <div key={atividade.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    {getActivityIcon(atividade.tipo)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{atividade.descricao}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{atividade.usuario}</span>
                      <span>•</span>
                      <span>{formatDate(atividade.data)}</span>
                    </div>
                  </div>
                  {atividade.acao === 'criacao' && <FiCheckCircle className="text-green-500" />}
                  {atividade.acao === 'atualizacao' && <FiActivity className="text-blue-500" />}
                  {atividade.acao === 'emissao' && <FiFileText className="text-purple-500" />}
                  {atividade.acao === 'pagamento' && <FiDollarSign className="text-yellow-500" />}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-100 text-center">
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Ver todas as atividades
            </button>
          </div>
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-800">Resumo Financeiro</h2>
          <Link
            to="/app/financeiro"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Ver detalhes <FiArrowRight />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Saldo Total</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.financeiro.saldo)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Receitas (período)</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(data.financeiro.receitas)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Despesas (período)</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(data.financeiro.despesas)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Pendentes</p>
            <p className="text-xl font-bold text-yellow-600">{formatCurrency(data.financeiro.pendentes)}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm">
            <FiTrendingUp className="text-green-500" />
            <span className="text-gray-600">Lucro no período:</span>
            <span className="font-bold text-green-600">
              {formatCurrency(data.financeiro.receitas - data.financeiro.despesas)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};