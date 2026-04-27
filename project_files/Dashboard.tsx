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

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    empresas: 0,
    usuarios: 0,
    lancamentos: 0,
    nfes: 0
  });
  const [empresasRecentes, setEmpresasRecentes] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    try {
      setLoading(true);

      // Carregar empresas e usuários simultaneamente para melhor performance
      const [empresasRes, usuariosRes] = await Promise.all([
        api.get('/empresas'),
        api.get('/usuarios')
      ]);

      const empresas = empresasRes.data || [];
      const usuarios = usuariosRes.data || [];

      setStats({
        empresas: empresas.length,
        usuarios: usuarios.length,
        lancamentos: 1243,
        nfes: 342
      });

      // Ordenação garantindo que as datas sejam válidas
      const recentes = [...empresas]
        .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
        .slice(0, 5);

      setEmpresasRecentes(recentes);

    } catch (error) {
      console.error('❌ Erro no dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

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
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Data n/a';

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffHours < 1) return 'Agora mesmo';
      if (diffHours < 24) return `Há ${diffHours}h`;
      if (diffDays < 7) return `Há ${diffDays}d`;

      return date.toLocaleDateString('pt-BR');
    } catch {
      return 'Data n/a';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Sincronizando LEDGR...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Dashboard</h1>
          <p className="text-gray-500">Bem-vindo ao painel de controle</p>
        </div>
        <button
          onClick={carregarDados}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 font-semibold"
        >
          <FiActivity size={18} className="text-blue-600" />
          Atualizar
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
          title="Lançamentos"
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

        {/* EMPRESAS RECENTES */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center bg-white">
            <h2 className="text-lg font-bold text-gray-800">Empresas Recentes</h2>
            <Link to="/app/empresas" className="text-blue-600 text-sm font-bold hover:underline">Ver todas</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Empresa</th>
                  <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">CNPJ</th>
                  <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Regime</th>
                  <th className="px-6 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {empresasRecentes.map((empresa) => (
                  <tr key={empresa.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-700 text-sm">{empresa.razaoSocial}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-500">{formatCNPJ(empresa.cnpj)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-black rounded-lg uppercase ${getRegimeBadge(empresa.regimeTributario)}`}>
                        {empresa.regimeTributario?.replace('_', ' ') || 'Padrão'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1 font-bold">
                        <FiClock size={12} /> {formatDate(empresa.criadoEm)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SIDEBAR DIREITA */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="font-black text-gray-800 mb-4 flex items-center gap-2 uppercase text-xs tracking-widest text-blue-600">
              Atividades
            </h3>
            <div className="space-y-4">
              {empresasRecentes.slice(0, 3).map((empresa) => (
                <div key={empresa.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiBriefcase size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">Nova Empresa</p>
                    <p className="text-[10px] text-gray-500 truncate">{empresa.razaoSocial}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 text-white shadow-xl shadow-gray-200">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-400 text-sm">Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Backend API</span>
                <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Database</span>
                <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase">Ready</span>
              </div>
            </div>
            <Link to="/app/empresas/nova" className="mt-6 w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all">
              Nova Empresa <FiTrendingUp />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};