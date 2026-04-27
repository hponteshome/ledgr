import React, { useState, useEffect } from 'react';
import { FiBriefcase, FiChevronDown, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { Link, useNavigate } from 'react-router-dom';

export const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const { empresaAtiva, empresas, selecionarEmpresa } = useEmpresa();
  const navigate = useNavigate();
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);

  // Dados do usuário do localStorage como fallback
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Se user do context estiver vazio, pega do localStorage
    if (!user) {
      const storedUser = localStorage.getItem('@ledgr:user');
      if (storedUser) {
        try {
          setUserData(JSON.parse(storedUser));
        } catch (e) {
          console.error('Erro ao parsear usuário do localStorage:', e);
        }
      }
    } else {
      setUserData(user);
    }
  }, [user]);

  const currentUser = user || userData;
  const userName = currentUser?.nome || currentUser?.nomeCompleto || 'Usuário';
  const userEmail = currentUser?.email || 'usuario@ledgr.com.br';

  const handleLogout = () => {
    signOut();
    setIsUserOpen(false);
    navigate('/login');
  };

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.company-dropdown') && !target.closest('.company-trigger')) {
        setIsCompanyOpen(false);
      }
      if (!target.closest('.user-dropdown') && !target.closest('.user-trigger')) {
        setIsUserOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20 fixed top-0 right-0 left-64 transition-all duration-300 shadow-sm">
      
      {/* INFO DO USUÁRIO - ESQUERDA */}
      <div className="flex items-center gap-4">
        <div className="hidden lg:block">
          <p className="text-sm font-bold text-gray-800 leading-tight">
            {userName}
          </p>
          <p className="text-xs text-gray-500">{userEmail}</p>
        </div>
      </div>

      {/* CENTRO - SELETOR DE EMPRESA */}
      <div className="relative company-trigger">
        <button
          onClick={() => setIsCompanyOpen(!isCompanyOpen)}
          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg transition-all border border-transparent hover:border-gray-200"
        >
          <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <FiBriefcase size={18} />
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-bold text-gray-800 leading-tight">
              {empresaAtiva?.razaoSocial || 'Selecionar Empresa'}
            </p>
            <p className="text-xs text-gray-500">
              {empresaAtiva?.cnpj || 'Nenhuma empresa selecionada'}
            </p>
          </div>
          <FiChevronDown 
            size={16} 
            className={`text-gray-400 transition-transform duration-200 ${isCompanyOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {/* DROPDOWN DE EMPRESAS */}
        {isCompanyOpen && (
          <div className="company-dropdown absolute top-full left-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Minhas Empresas
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto py-1">
              {empresas && empresas.length > 0 ? (
                empresas.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => {
                      selecionarEmpresa(emp);
                      setIsCompanyOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                      empresaAtiva?.id === emp.id
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-medium text-sm">{emp.razaoSocial}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{emp.cnpj}</div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-8 text-center">
                  <FiBriefcase className="mx-auto text-gray-300 mb-2" size={32} />
                  <p className="text-sm text-gray-500">Nenhuma empresa cadastrada</p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 mt-1 pt-1">
              <Link
                to="/app/empresas/nova"
                onClick={() => setIsCompanyOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-blue-600 font-semibold text-sm hover:bg-blue-50 rounded-lg transition-colors"
              >
                <FiBriefcase size={16} />
                Cadastrar Nova Empresa
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* DIREITA - MENU DE USUÁRIO */}
      <div className="relative user-trigger">
        <button
          onClick={() => setIsUserOpen(!isUserOpen)}
          className="flex items-center gap-3 hover:bg-gray-50 px-3 py-2 rounded-lg transition-all border border-transparent hover:border-gray-200"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-gray-800 leading-tight">
              {userName}
            </p>
            <p className="text-xs text-gray-500">{userEmail}</p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
            {userName.charAt(0).toUpperCase()}
          </div>
        </button>

        {/* DROPDOWN DO USUÁRIO */}
        {isUserOpen && (
          <div className="user-dropdown absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            
            {/* Info do Usuário */}
            <div className="px-3 py-3 border-b border-gray-100">
              <p className="font-semibold text-gray-800 text-sm">{userName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{userEmail}</p>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              <Link
                to="/app/perfil"
                onClick={() => setIsUserOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
              >
                <FiUser size={16} className="text-gray-400" />
                Meu Perfil
              </Link>
              <Link
                to="/app/configuracoes"
                onClick={() => setIsUserOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
              >
                <FiSettings size={16} className="text-gray-400" />
                Configurações
              </Link>
            </div>

            {/* Botão Sair */}
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 text-red-600 rounded-lg text-sm font-semibold transition-colors"
              >
                <FiLogOut size={16} />
                Sair do Sistema
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
