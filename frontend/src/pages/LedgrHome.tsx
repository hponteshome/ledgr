import React from 'react';
import { FiCalendar, FiTrendingUp, FiBriefcase, FiCheckCircle } from 'react-icons/fi';

export const LedgrHome: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] p-6 lg:p-10">
      <div className="max-w-[1600px] mx-auto space-y-8">

        {/* Hero Section */}
        <div className="text-center">
          <h1 className="text-4xl font-black text-gray-800 mb-4">
            Bem-vindo ao LEDGR
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Sistema de Gestão Empresarial Completo
          </p>
          <p className="text-gray-500">
            Para escritórios de contabilidade, advocacia e administradoras
          </p>
        </div>

        {/* Grid de Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Card 1 - Agenda Fiscal */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
              <FiCalendar size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Agenda Fiscal</h3>
            <p className="text-sm text-gray-600">
              Acompanhe todos os prazos e obrigações fiscais em um só lugar
            </p>
          </div>

          {/* Card 2 - Indicadores */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4">
              <FiTrendingUp size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Indicadores</h3>
            <p className="text-sm text-gray-600">
              Análise em tempo real do desempenho de suas empresas
            </p>
          </div>

          {/* Card 3 - Multiempresa */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4">
              <FiBriefcase size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Multiempresa</h3>
            <p className="text-sm text-gray-600">
              Gerencie múltiplas empresas com facilidade e eficiência
            </p>
          </div>

          {/* Card 4 - Compliance */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-4">
              <FiCheckCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Compliance</h3>
            <p className="text-sm text-gray-600">
              Total conformidade com SPED, NF-e, NFS-e e demais obrigações
            </p>
          </div>
        </div>

        {/* Agenda Fiscal em Destaque */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <FiCalendar className="text-blue-600" size={28} />
            Agenda Fiscal - Março 2026
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Obrigação 1 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">DIA 10</span>
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-semibold">
                  Próximo
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">DCTF Web</h4>
              <p className="text-xs text-gray-600">
                Declaração de Débitos e Créditos Tributários Federais
              </p>
            </div>

            {/* Obrigação 2 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">DIA 15</span>
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-semibold">
                  Atenção
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">GFIP</h4>
              <p className="text-xs text-gray-600">
                Guia de Recolhimento do FGTS e Informações à Previdência Social
              </p>
            </div>

            {/* Obrigação 3 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">DIA 20</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                  Agendado
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">EFD ICMS/IPI</h4>
              <p className="text-xs text-gray-600">
                Escrituração Fiscal Digital do ICMS e do IPI
              </p>
            </div>
          </div>
        </div>

        {/* Indicadores Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Indicador 1 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Empresas Ativas</span>
              <FiBriefcase className="text-blue-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">1.247</p>
            <p className="text-xs text-green-600 font-semibold">+12% vs mês anterior</p>
          </div>

          {/* Indicador 2 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">NF-e Emitidas</span>
              <FiTrendingUp className="text-green-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">45.892</p>
            <p className="text-xs text-green-600 font-semibold">+8% vs mês anterior</p>
          </div>

          {/* Indicador 3 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">Compliance</span>
              <FiCheckCircle className="text-purple-600" size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">98.5%</p>
            <p className="text-xs text-green-600 font-semibold">Obrigações em dia</p>
          </div>
        </div>
      </div>
    </div>
  );
};