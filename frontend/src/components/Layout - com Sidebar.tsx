import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Header } from './Header';
import {
  FiHome, FiBriefcase, FiUsers, FiDollarSign,
  FiFileText, FiLogOut, FiMenu, FiChevronLeft,
  FiActivity, FiSettings, FiFolder // ← ADICIONADO FiFolder para Documentos
} from 'react-icons/fi';

export const Layout: React.FC = () => {
  const { signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { path: '/app/dashboard', icon: FiHome, label: 'Dashboard' },
    { path: '/app/companies', icon: FiBriefcase, label: 'Companies' },
    { path: '/app/users', icon: FiUsers, label: 'Users' },
    { path: '/app/profiles', icon: FiUsers, label: 'Profiles' },
    { path: '/app/financial', icon: FiDollarSign, label: 'Financial' },
    { path: '/app/documents', icon: FiFolder, label: 'Documentos' }, // ← NOVO LINK
    { path: '/app/tax', icon: FiFileText, label: 'Tax' },
    { path: '/app/audit', icon: FiActivity, label: 'Audit' },
    { path: '/app/settings', icon: FiSettings, label: 'Settings' },
  ];

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* SIDEBAR */}
      <aside
        className={`bg-white border-r border-gray-200 flex flex-col h-full fixed left-0 top-0 z-50 shadow-sm transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'
          }`}
      >
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
          {sidebarOpen ? (
            <span className="text-2xl font-black tracking-tighter text-blue-600 ml-2">
              LEDGR
            </span>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm">
                L
              </div>
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
          <div className="flex justify-center py-4 border-b border-gray-50 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-all"
            >
              <FiMenu size={18} />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 py-6 px-3 overflow-y-auto">
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
                  className={`flex-shrink-0 ${isActive ? 'text-white' : 'group-hover:scale-110 transition-transform'
                    }`}
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
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
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

      {/* ÁREA DE CONTEÚDO - COM MARGEM FORÇADA */}
      <div
        className={`flex-1 flex flex-col h-full transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'
          }`}
        style={{ marginLeft: sidebarOpen ? '16rem' : '5rem' }}
      >
        {/* HEADER - AGORA RELATIVO À ÁREA DE CONTEÚDO */}
        <Header sidebarOpen={sidebarOpen} />

        {/* MAIN CONTENT - COM PADDING TOP CORRETO PARA O HEADER */}
        <main className="flex-1 overflow-y-auto mt-16">
          <div className="h-full w-full p-6 lg:p-10">
            <div className="max-w-[1600px] mx-auto">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};