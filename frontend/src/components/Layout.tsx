// src/components/Layout.tsx
import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { Header } from './Header';
import { Sidebar } from './SideBar';
import { FiLogOut, FiAlertTriangle } from 'react-icons/fi';
import { Toaster } from 'react-hot-toast';
import { SidebarPermissionsProvider } from '../contexts/SidebarPermissionsContext';

export const Layout: React.FC = () => {
  const { signOut, user } = useAuth();
  const { loading } = useCompany();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#F8FAFC',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, border: '3px solid #E5E7EB',
          borderTop: '3px solid #111', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>Conectando ao servidor...</div>
        <div style={{ fontSize: 12, color: '#9CA3AF' }}>Aguarde enquanto o sistema inicializa</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(prev => !prev)} />
      <div
        className={`fixed bottom-0 left-0 z-50 p-4 border-t border-gray-100 bg-white transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}
      >
        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center'} py-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors group`}
        >
          <FiLogOut size={20} className="group-hover:translate-x-1 transition-transform" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
      <div
        className={`flex-1 flex flex-col h-full transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}
        style={{ marginLeft: sidebarOpen ? '16rem' : '5rem' }}
      >
        <Header sidebarOpen={sidebarOpen} />

        {/* Banner de aviso quando não autenticado */}
        {!user && (
          <div style={{
            position: 'fixed', top: 64, left: sidebarOpen ? '16rem' : '5rem', right: 0,
            background: '#FEF3C7', borderBottom: '1px solid #F59E0B',
            padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
            zIndex: 40, transition: 'left 0.3s',
          }}>
            <FiAlertTriangle size={16} color="#D97706" />
            <span style={{ fontSize: 13, color: '#92400E', fontWeight: 500 }}>
              Você não está autenticado. Faça login no canto superior direito para utilizar o sistema.
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto" style={{ marginTop: !user ? 104 : 64 }}>
          <div className="h-full w-full p-6 lg:p-10">
            <div className="max-w-[1600px] mx-auto">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </div>
    </SidebarPermissionsProvider>
  );
};

