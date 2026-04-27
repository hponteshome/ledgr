import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus,
  FiArrowRight,
  FiSearch,
  FiInfo,
  FiBriefcase,
  FiUsers,
  FiSettings
} from 'react-icons/fi';

export const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();

  const atalhos = [
    { label: 'Nova Empresa', icon: FiBriefcase, path: '/app/empresas/novo', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Novo Usuário', icon: FiUsers, path: '/app/usuarios/novo', color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Configurações', icon: FiSettings, path: '/app/configuracoes', color: 'text-purple-600', bg: 'bg-purple-50' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. SEÇÃO DE BOAS-VINDAS PERSONALIZADA */}
      <section className="relative overflow-hidden bg-blue-600 rounded-3xl p-8 text-white shadow-lg shadow-blue-200">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Bem-vindo ao Painel Ledgr</h1>
            <p className="text-blue-100 max-w-md">
              Sua central de controle para gestão multi-empresas e conformidade fiscal.
              O que deseja fazer hoje?
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/app/empresas')}
              className="px-6 py-3 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-sm"
            >
              Listar Empresas <FiArrowRight />
            </button>
          </div>
        </div>
        {/* Elemento Visual de Fundo */}
        <div className="absolute -right-10 -bottom-10 opacity-10">
          <FiBriefcase size={250} />
        </div>
      </section>

      {/* 2. GRID DE ATALHOS RÁPIDOS */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FiPlus className="text-blue-500" /> Ações Rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {atalhos.map((item, idx) => (
            <button
              key={idx}
              onClick={() => navigate(item.path)}
              className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className={`${item.bg} ${item.color} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  <item.icon size={24} />
                </div>
                <span className="font-bold text-gray-700">{item.label}</span>
              </div>
              <FiArrowRight className="text-gray-300 group-hover:text-blue-500" />
            </button>
          ))}
        </div>
      </section>

      {/* 3. ÁREA DE INFORMAÇÕES DO SISTEMA (CONFORME SEU LOG) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Painel de Status */}
        <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <FiInfo className="text-blue-500" /> Status da Conta
            </h3>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">Ativo</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Perfil de Acesso:</span>
              <span className="font-bold text-gray-700">Administrador Master</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Permissões:</span>
              <span className="font-bold text-blue-600 uppercase">Acesso Total (All)</span>
            </div>
            <div className="pt-4 border-t border-gray-50">
              <p className="text-xs text-gray-400 italic">
                Nota: Como administrador, você tem acesso para gerenciar todas as empresas e usuários do ecossistema Ledgr.
              </p>
            </div>
          </div>
        </section>

        {/* Painel de Busca Rápida */}
        <section className="bg-gray-900 p-6 rounded-3xl text-white shadow-xl">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-400">
            <FiSearch /> Pesquisa Global
          </h3>
          <p className="text-sm text-gray-400 mb-6">
            Localize empresas, CNPJs ou usuários rapidamente.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Digite o CNPJ ou Nome..."
              className="w-full bg-gray-800 border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button className="absolute right-3 top-2.5 p-1.5 bg-blue-600 rounded-lg">
              <FiSearch size={14} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};