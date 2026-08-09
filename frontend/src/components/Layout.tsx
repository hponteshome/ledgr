// src/components/Layout.tsx
import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { Header } from './Header';
import { Sidebar, SIDEBAR_RAIL_WIDTH, SIDEBAR_PANEL_WIDTH } from './SideBar';
import { CommandPalette } from './CommandPalette';
import { Breadcrumbs } from './Breadcrumbs';
import { FiAlertTriangle } from 'react-icons/fi';
import { Toaster, toast } from 'react-hot-toast';
import { SidebarPermissionsProvider } from '../contexts/SidebarPermissionsContext';
import { SidebarTreeProvider } from '../contexts/SidebarTreeContext';
import { useTrackRecentNav } from '../hooks/useRecentNav';
const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

const RecentNavTracker: React.FC = () => {
  useTrackRecentNav();
  return null;
};

export const Layout: React.FC = () => {
  const { user } = useAuth();
  const { loading } = useCompany();

  // Listener global SSE para notificacoes de sistema (Master Admin apenas)
  useEffect(() => {
    const isMaster = (user as any)?.profile?.permissions?.all === true;
    if (!isMaster) return;
    const token = localStorage.getItem('@ledgr:token');
    if (!token) return;
    const es = new EventSource(`${API}/chat/stream?token=${token}`);
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'NEW_MESSAGE' && event.message?.type === 'SYSTEM') {
          toast(event.message.body ?? 'Nova notificacao do sistema', { icon: '\u{1F514}', duration: 6000 });
        }
      } catch {}
    };
    return () => es.close();
  }, [user]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

  const contentMargin = sidebarOpen ? SIDEBAR_RAIL_WIDTH + SIDEBAR_PANEL_WIDTH : SIDEBAR_RAIL_WIDTH;

  return (
    <SidebarPermissionsProvider>
    <SidebarTreeProvider>
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      {user && <RecentNavTracker />}
      {user && <CommandPalette />}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(prev => !prev)} />
      <div
        className="flex-1 flex flex-col h-full transition-all duration-200"
        style={{ marginLeft: contentMargin }}
      >
        <Header sidebarOpen={sidebarOpen} />

        {/* Banner de aviso quando não autenticado */}
        {!user && (
          <div style={{
            position: 'fixed', top: 64, left: contentMargin, right: 0,
            background: '#FEF3C7', borderBottom: '1px solid #F59E0B',
            padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
            zIndex: 40, transition: 'left 0.2s',
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
              <Breadcrumbs />
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </div>
    </SidebarTreeProvider>
    </SidebarPermissionsProvider>
  );
};

