import React, { useState, useEffect } from 'react';
import {
  FiTrendingUp, FiFileText, FiCheckCircle, FiClock,
  FiAlertCircle, FiCalendar, FiBriefcase, FiUsers,
  FiDollarSign, FiBell, FiArrowUpRight, FiArrowDownRight,
  FiActivity
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import api from '../services/api';
import { Link } from 'react-router-dom';

interface ObrigacaoFiscal {
  id: string;
  titulo: string;
  descricao: string;
  dataVencimento: string;
  status: 'pendente' | 'concluido' | 'atrasado' | 'atencao';
  empresaId?: string;
  empresaNome?: string;
}

interface Estatisticas {
  totalEmpresas: number;
  empresasAtivas: number;
  empresasInativas: number;
  totalUsuarios: number;
  usuariosAtivos: number;
  obrigacoesPendentes: number;
  obrigacoesAtrasadas: number;
  obrigacoesConcluidas: number;
  empresasPorRegime: {
    simples: number;
    lucroPresumido: number;
    lucroReal: number;
  };
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { companies, activeCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Estatisticas>({
    totalEmpresas: 0,
    empresasAtivas: 0,
    empresasInativas: 0,
    totalUsuarios: 0,
    usuariosAtivos: 0,
    obrigacoesPendentes: 0,
    obrigacoesAtrasadas: 0,
    obrigacoesConcluidas: 0,
    empresasPorRegime: {
      simples: 0,
      lucroPresumido: 0,
      lucroReal: 0
    }
  });

  const [obrigacoesProximas, setObrigacoesProximas] = useState<ObrigacaoFiscal[]>([]);
  const [ultimasAtividades, setUltimasAtividades] = useState<any[]>([]);
  const [empresasRecentes, setEmpresasRecentes] = useState<any[]>([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Carregar dados em paralelo para performance
      const [
        empresasRes,
        usuariosRes,
        obrigacoesRes,
        auditoriaRes
      ] = await Promise.allSettled([
        api.get('/companies'),
        api.get('/users'),
        api.get('/obrigacoes?proximas=5'), // Ajuste conforme sua API
        api.get('/audit?ultimas=5')
      ]);

      // Processar empresas
      if (empresasRes.status === 'fulfilled') {
        const empresas = empresasRes.value.data;
        setEmpresasRecentes(empresas.slice(0, 5));

        const ativas = empresas.filter((e: any) => e.status === 'active').length;
        const simples = empresas.filter((e: any) => e.taxRegime === 'SIMPLES_NACIONAL').length;
        const lucroPresumido = empresas.filter((e: any) => e.taxRegime === 'LUCRO_PRESUMIDO').length;
        const lucroReal = empresas.filter((e: any) => e.taxRegime === 'LUCRO_REAL').length;

        setStats(prev => ({
          ...prev,
          totalEmpresas: empresas.length,
          empresasAtivas: ativas,
          empresasInativas: empresas.length - ativas,
          empresasPorRegime: {
            simples,
            lucroPresumido,
            lucroReal
          }
        }));
      }

      // Processar usuários
      if (usuariosRes.status === 'fulfilled') {
        const usuarios = usuariosRes.value.data;
        const ativos = usuarios.filter((u: any) => u.status === 'active').length;

        setStats(prev => ({
          ...prev,
          totalUsuarios: usuarios.length,
          usuariosAtivos: ativos
        }));
      }

      // Processar obrigações
      if (obrigacoesRes.status === 'fulfilled') {
        const obrigacoes = obrigacoesRes.value.data;
        setObrigacoesProximas(obrigacoes);

        const pendentes = obrigacoes.filter((o: any) => o.status === 'pendente').length;
        const atrasadas = obrigacoes.filter((o: any) => o.status === 'atrasado').length;
        const concluidas = obrigacoes.filter((o: any) => o.status === 'concluido').length;

        setStats(prev => ({
          ...prev,
          obrigacoesPendentes: pendentes,
          obrigacoesAtrasadas: atrasadas,
          obrigacoesConcluidas: concluidas
        }));
      }

      // Processar auditoria (últimas atividades)
      if (auditoriaRes.status === 'fulfilled') {
        setUltimasAtividades(auditoriaRes.value.data);
      }

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    const cores = {
      pendente: 'text-yellow-600 bg-yellow-50',
      atrasado: 'text-red-600 bg-red-50',
      concluido: 'text-green-600 bg-green-50',
      atencao: 'text-orange-600 bg-orange-50'
    };
    return cores[status as keyof typeof cores] || 'text-gray-600 bg-gray-50';
  };

  const getDiasRestantes = (dataVencimento: string) => {
    const hoje = new Date();
    const vencimento = new Date(dataVencimento);
    const diff = Math.ceil((vencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-gray-500">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Bem-vindo, {user?.fullName?.split(' ')[0] || 'Usuário'}!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Ledgr System Overview - {activeCompany?.legalName || 'Sistema'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Última atualização:</span>
          <span className="text-sm font-semibold text-gray-700">
            {new Date().toLocaleDateString('pt-BR')}
          </span>
        </div>
      </div>

      {/* CARDS DE ESTATÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card Empresas */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Empresas</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {stats.totalEmpresas}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <FiCheckCircle size={10} />
                  {stats.empresasAtivas} ativas
                </span>
                <span className="text-xs text-gray-300">|</span>
                <span className="text-xs text-red-600">
                  {stats.empresasInativas} inativas
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              <FiBriefcase size={24} />
            </div>
          </div>
        </div>

        {/* Card Usuários */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Usuários</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {stats.totalUsuarios}
              </p>
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <FiUsers size={12} />
                {stats.usuariosAtivos} ativos no sistema
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
              <FiUsers size={24} />
            </div>
          </div>
        </div>

        {/* Card Obrigações */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Obrigações</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {stats.obrigacoesPendentes + stats.obrigacoesAtrasadas}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-yellow-600 flex items-center gap-1">
                  <FiClock size={10} />
                  {stats.obrigacoesPendentes} pendentes
                </span>
                {stats.obrigacoesAtrasadas > 0 && (
                  <>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <FiAlertCircle size={10} />
                      {stats.obrigacoesAtrasadas} atrasadas
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600">
              <FiFileText size={24} />
            </div>
          </div>
        </div>

        {/* Card Regimes Tributários */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Regimes</p>
              <div className="space-y-1 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Simples:</span>
                  <span className="font-semibold">{stats.empresasPorRegime.simples}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Lucro Pres.:</span>
                  <span className="font-semibold">{stats.empresasPorRegime.lucroPresumido}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Lucro Real:</span>
                  <span className="font-semibold">{stats.empresasPorRegime.lucroReal}</span>
                </div>
              </div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
              <FiTrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* GRID DE 2 COLUNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA - OBRIGAÇÕES FISCAIS (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Próximas Obrigações */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FiCalendar className="text-blue-600" />
                Próximas Obrigações Fiscais
              </h2>
              <Link to="/app/obrigacoes" className="text-sm text-blue-600 hover:text-blue-700">
                Ver todas
              </Link>
            </div>

            <div className="divide-y divide-gray-200">
              {obrigacoesProximas.length > 0 ? (
                obrigacoesProximas.map((obr) => {
                  const dias = getDiasRestantes(obr.dataVencimento);
                  return (
                    <div key={obr.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg
                          ${dias <= 0 ? 'bg-red-100 text-red-600' :
                            dias <= 5 ? 'bg-yellow-100 text-yellow-600' :
                              'bg-green-100 text-green-600'}`}>
                          {new Date(obr.dataVencimento).getDate()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(obr.status)}`}>
                              {obr.status === 'atrasado' ? 'Atrasada' :
                                obr.status === 'atencao' ? 'Atenção' :
                                  obr.status === 'concluido' ? 'Concluída' : 'Pendente'}
                            </span>
                            <h3 className="font-semibold text-gray-800">{obr.titulo}</h3>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{obr.descricao}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-gray-400">
                              Vencimento: {formatarData(obr.dataVencimento)}
                            </span>
                            <span className={`font-semibold ${dias < 0 ? 'text-red-600' :
                                dias === 0 ? 'text-orange-600' :
                                  'text-gray-600'
                              }`}>
                              {dias < 0 ? `${Math.abs(dias)} dias atrasado` :
                                dias === 0 ? 'Hoje' :
                                  `${dias} dias restantes`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <FiCheckCircle size={32} className="mx-auto mb-2 text-gray-300" />
                  <p>Nenhuma obrigação pendente</p>
                </div>
              )}
            </div>
          </div>

          {/* Empresas Recentes */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FiBriefcase className="text-blue-600" />
                Empresas Recentes
              </h2>
              <Link to="/app/companies" className="text-sm text-blue-600 hover:text-blue-700">
                Ver todas
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">CNPJ</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Regime</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {empresasRecentes.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-800">{emp.legalName}</p>
                          {emp.tradeName && (
                            <p className="text-xs text-gray-500">{emp.tradeName}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600">
                        {emp.taxId}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {emp.taxRegime === 'SIMPLES_NACIONAL' ? 'Simples Nacional' :
                            emp.taxRegime === 'LUCRO_PRESUMIDO' ? 'Lucro Presumido' :
                              emp.taxRegime === 'LUCRO_REAL' ? 'Lucro Real' : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                          {emp.status === 'active' ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA - LEMBRETES E ATIVIDADES (1/3) */}
        <div className="space-y-6">
          {/* Lembretes Rápidos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FiBell className="text-blue-600" />
                Lembretes
              </h2>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                  <FiFileText size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">DCTF Web</p>
                  <p className="text-xs text-gray-600 mt-1">Vence em 5 dias</p>
                  <button className="text-xs text-blue-600 hover:text-blue-700 mt-2 font-medium">
                    Visualizar
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600 flex-shrink-0">
                  <FiAlertCircle size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">GFIP</p>
                  <p className="text-xs text-gray-600 mt-1">Atrasada há 2 dias</p>
                  <button className="text-xs text-red-600 hover:text-red-700 mt-2 font-medium">
                    Regularizar
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600 flex-shrink-0">
                  <FiCheckCircle size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">EFD ICMS/IPI</p>
                  <p className="text-xs text-gray-600 mt-1">Concluída em 05/03</p>
                  <button className="text-xs text-green-600 hover:text-green-700 mt-2 font-medium">
                    Ver comprovante
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo por Regime */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FiActivity className="text-blue-600" />
                Resumo por Regime
              </h2>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Simples Nacional</span>
                <span className="text-sm font-semibold text-gray-800">
                  {stats.empresasPorRegime.simples}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${(stats.empresasPorRegime.simples / stats.totalEmpresas) * 100 || 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-600">Lucro Presumido</span>
                <span className="text-sm font-semibold text-gray-800">
                  {stats.empresasPorRegime.lucroPresumido}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(stats.empresasPorRegime.lucroPresumido / stats.totalEmpresas) * 100 || 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-600">Lucro Real</span>
                <span className="text-sm font-semibold text-gray-800">
                  {stats.empresasPorRegime.lucroReal}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${(stats.empresasPorRegime.lucroReal / stats.totalEmpresas) * 100 || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800">Atalhos</h2>
            </div>

            <div className="p-4 grid grid-cols-2 gap-2">
              <Link
                to="/app/companies/new"
                className="p-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-center transition-colors group"
              >
                <FiBriefcase className="mx-auto text-gray-400 group-hover:text-blue-600 mb-1" size={20} />
                <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600">
                  Nova Empresa
                </span>
              </Link>

              <Link
                to="/app/users/new"
                className="p-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-center transition-colors group"
              >
                <FiUsers className="mx-auto text-gray-400 group-hover:text-blue-600 mb-1" size={20} />
                <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600">
                  Novo Usuário
                </span>
              </Link>

              <Link
                to="/app/obrigacoes"
                className="p-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-center transition-colors group"
              >
                <FiFileText className="mx-auto text-gray-400 group-hover:text-blue-600 mb-1" size={20} />
                <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600">
                  Obrigações
                </span>
              </Link>

              <Link
                to="/app/audit"
                className="p-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-center transition-colors group"
              >
                <FiActivity className="mx-auto text-gray-400 group-hover:text-blue-600 mb-1" size={20} />
                <span className="text-xs font-medium text-gray-600 group-hover:text-blue-600">
                  Auditoria
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};