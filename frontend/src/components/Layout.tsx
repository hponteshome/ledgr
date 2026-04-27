// src/components/Layout.tsx
import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Header } from './Header';
import { Sidebar } from './SideBar';
import { FiLogOut } from 'react-icons/fi';

export const Layout: React.FC = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {/* SIDEBAR */}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(prev => !prev)} />

      {/* Botão Sign Out — fora do Sidebar para manter posicionamento fixo */}
      <div
        className={`fixed bottom-0 left-0 z-50 p-4 border-t border-gray-100 bg-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'
          }`}
      >
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center'
            } py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors group`}
        >
          <FiLogOut size={20} className="group-hover:translate-x-1 transition-transform" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      <div
        className={`flex-1 flex flex-col h-full transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'
          }`}
        style={{ marginLeft: sidebarOpen ? '16rem' : '5rem' }}
      >
        <Header sidebarOpen={sidebarOpen} />

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