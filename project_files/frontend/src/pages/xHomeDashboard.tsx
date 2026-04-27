import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FiBriefcase,
  FiUsers,
  FiDollarSign,
  FiFileText,
  FiLogIn,
  FiUserPlus,
  FiMail,
  FiLock,
  FiArrowRight,
  FiCheckCircle,
  FiTrendingUp,
  FiShield,
  FiClock
} from 'react-icons/fi';

export const HomeDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: FiBriefcase,
      title: 'Gestão de Empresas',
      description: 'Cadastre e gerencie múltiplas empresas com informações completas, CNPJ, endereço e contato.',
      color: 'blue',
      stats: '12 empresas ativas'
    },
    {
      icon: FiUsers,
      title: 'Controle de Usuários',
      description: 'Gerencie permissões, perfis de acesso e equipes com níveis hierárquicos personalizados.',
      color: 'green',
      stats: '8 usuários cadastrados'
    },
    {
      icon: FiDollarSign,
      title: 'Gestão Financeira',
      description: 'Acompanhe receitas, despesas, fluxo de caixa e gere relatórios financeiros em tempo real.',
      color: 'yellow',
      stats: 'R$ 150K em movimentações'
    },
    {
      icon: FiFileText,
      title: 'Documentos Fiscais',
      description: 'Emita e gerencie notas fiscais, obrigações acessórias e mantenha tudo organizado.',
      color: 'purple',
      stats: '234 documentos'
    }
  ];

  const benefits = [
    {
      icon: FiTrendingUp,
      title: 'Escalável',
      description: 'Cresça sem limites, nossa plataforma acompanha seu negócio'
    },
    {
      icon: FiShield,
      title: 'Seguro',
      description: 'Dados criptografados e protegidos com as melhores práticas'
    },
    {
      icon: FiClock,
      title: '24/7',
      description: 'Disponível o tempo todo, com suporte dedicado'
    }
  ];

  const stats = [
    { value: '500+', label: 'Empresas ativas' },
    { value: '2k+', label: 'Usuários' },
    { value: '50k+', label: 'Documentos processados' },
    { value: '99.9%', label: 'Uptime' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* NAVBAR */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Ledgr
              </span>
            </div>

            {/* Menu - Desktop */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-blue-600 transition-colors">Recursos</a>
              <a href="#benefits" className="text-gray-600 hover:text-blue-600 transition-colors">Benefícios</a>
              <a href="#pricing" className="text-gray-600 hover:text-blue-600 transition-colors">Preços</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 transition-colors">Contato</a>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              {user ? (
                <button
                  onClick={() => navigate('/app/dashboard')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <span>Dashboard</span>
                  <FiArrowRight />
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <FiLogIn />
                    <span>Entrar</span>
                  </Link>
                  <Link
                    to="/registro"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <FiUserPlus />
                    <span>Cadastrar</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 opacity-50"></div>
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-20 w-64 h-64 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
              Gestão Empresarial
              <span className="block text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text">
                Simplificada e Eficiente
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-10">
              Plataforma completa para gerenciar empresas, finanças, documentos e muito mais.
              Tudo que você precisa em um só lugar.
            </p>

            {!user && (
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  to="/registro"
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
                >
                  <FiUserPlus size={20} />
                  Começar agora gratuitamente
                </Link>
                <Link
                  to="/login"
                  className="px-8 py-4 border-2 border-blue-600 text-blue-600 text-lg font-semibold rounded-xl hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                >
                  <FiLogIn size={20} />
                  Já tenho conta
                </Link>
              </div>
            )}

            {user && (
              <button
                onClick={() => navigate('/app/dashboard')}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-lg font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 mx-auto"
              >
                <FiArrowRight size={20} />
                Acessar Dashboard
              </button>
            )}
          </div>
        </div>
      </section>

      {/* STATS SECTION */}
      <section className="bg-white border-y border-gray-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-2">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Tudo que você precisa em um só lugar
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Plataforma completa com módulos integrados para gestão total do seu negócio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const colorClasses = {
                blue: 'bg-blue-50 text-blue-600',
                green: 'bg-green-50 text-green-600',
                yellow: 'bg-yellow-50 text-yellow-600',
                purple: 'bg-purple-50 text-purple-600'
              };

              return (
                <div
                  key={index}
                  className="group relative bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2"
                >
                  <div className={`${colorClasses[feature.color as keyof typeof colorClasses]} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 mb-4 leading-relaxed">
                    {feature.description}
                  </p>
                  <div className="flex items-center text-sm font-medium text-gray-500">
                    <FiCheckCircle className="mr-2 text-green-500" />
                    {feature.stats}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BENEFITS SECTION */}
      <section id="benefits" className="bg-gray-50 py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Por que escolher o Ledgr?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Uma plataforma pensada para crescer junto com seu negócio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div key={index} className="text-center">
                  <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Icon size={40} className="text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3">{benefit.title}</h3>
                  <p className="text-gray-600">{benefit.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      {!user && (
        <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              Pronto para começar?
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              Crie sua conta gratuitamente e tenha acesso a todas as funcionalidades por 30 dias.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                to="/registro"
                className="px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2"
              >
                <FiUserPlus size={20} />
                Criar conta gratuita
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 border-2 border-white text-white text-lg font-semibold rounded-xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <FiLogIn size={20} />
                Já tenho conta
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <span className="text-2xl font-bold text-white mb-4 block">Ledgr</span>
              <p className="text-sm">
                Plataforma completa para gestão empresarial, finanças e documentos.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Produto</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">Recursos</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Preços</a></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacidade</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Termos</a></li>
                <li><a href="/security" className="hover:text-white transition-colors">Segurança</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Contato</h4>
              <ul className="space-y-2">
                <li>contato@ledgr.com</li>
                <li>(11) 99999-9999</li>
                <li>São Paulo, SP</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-sm">
            <p>© {new Date().getFullYear()} Ledgr. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};