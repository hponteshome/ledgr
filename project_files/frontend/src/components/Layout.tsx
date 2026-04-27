import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Header } from './Header';
import {
  FiHome, FiBriefcase, FiUsers, FiDollarSign,
  FiFileText, FiLogOut, FiMenu, FiChevronLeft,
  FiActivity, FiSettings
} from 'react-icons/fi';

export const Layout: React.FC = () => {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Itens de menu mapeados para as rotas do Ledgr 1.0
  const menuItems = [
    { path: '/app/dashboard', icon: FiHome, label: 'Dashboard' },
    { path: '/app/companies', icon: FiBriefcase, label: 'Companies' }, // Ajustado para English
    { path: '/app/users', icon: FiUsers, label: 'Users' },           // Ajustado para English
    { path: '/app/financial', icon: FiDollarSign, label: 'Financial' },
    { path: '/app/tax', icon: FiFileText, label: 'Tax' },
    { path: '/app/audit', icon: FiActivity, label: 'Audit' },
    { path: '/app/settings', icon: FiSettings, label: 'Settings' },
  ];

  const handleLogout = () => {
    signOut();
    navigate('/login');
    console.log('Log: Session terminated by user');
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* SIDEBAR FIXA */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0 z-50 shadow-sm transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'
          }`}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          {sidebarOpen ? (
            <span className="text-2xl font-black tracking-tighter text-blue-600 ml-2">
              LEDGR
            </span>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">L</div>
            </div>
          )}

          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <FiChevronLeft size={18} />
            </button>
          )}
        </div>

        {!sidebarOpen && (
          <div className="flex justify-center py-4 border-b border-gray-50">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
            >
              <FiMenu size={18} />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 py-6 px-3 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                title={!sidebarOpen ? item.label : ''}
                className={`flex items-center gap-3 px-4 py-3 my-1 rounded-xl transition-all duration-200 group ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-blue-600'
                  }`}
              >
                <item.icon
                  size={20}
                  className={`flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'}`}
                />
                {sidebarOpen && (
                  <span className="text-sm font-semibold tracking-wide truncate">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout Section */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center'
              } py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors group`}
          >
            <FiLogOut size={20} className="group-hover:translate-x-1 transition-transform" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO (Ocupa o restante da tela) */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'pl-64' : 'pl-20'
          }`}
      >
        {/* HEADER FIXO 
            Passamos o sidebarOpen para o Header ajustar sua margem esquerda interna se necessário 
        */}
        <Header sidebarOpen={sidebarOpen} />

        {/* MAIN CONTENT 
            mt-16 compensa o Header fixo de 64px (h-16).
            z-0 garante que modais e sidebar fiquem acima do conteúdo.
        */}
        <main className="flex-1 mt-16 z-0">
          <div className="p-6 lg:p-10 pb-20 max-w-[1600px] mx-auto animate-fadeIn">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

// CSS adicional sugerido (pode ser colocado no seu index.css):
// .animate-fadeIn { animation: fadeIn 0.3s ease-in-out; }
// @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }