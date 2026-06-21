// frontend/src/contexts/SidebarPermissionsContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useCompany } from './CompanyContext';

interface SidebarPermissionsContextValue {
  allowed: string[];
  loading: boolean;
  canView: (path: string) => boolean;
  invalidate: () => void;
}

const SidebarPermissionsContext = createContext<SidebarPermissionsContextValue>({
  allowed: [],
  loading: false,
  canView: () => true,
  invalidate: () => {},
});

export const SidebarPermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const [allowed, setAllowed] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const lastFetchedKey = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMasterAdmin =
    (user as any)?.profile?.permissions?.all === true ||
    (user as any)?.permissions?.all === true;
  const userId = (user as any)?.id ?? '';
  const companyId = activeCompany?.id ?? '';

  const doFetch = useCallback((key: string, cId: string) => {
    lastFetchedKey.current = key;
    setLoading(true);
    api.get('/sidebar-permissions/resolve', {
      headers: { 'x-company-id': cId },
    })
      .then(r => setAllowed(r.data))
      .catch(() => setAllowed([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { setAllowed([]); return; }
    if (isMasterAdmin) { setAllowed(['*']); return; }
    // Aguardar empresa ativa estar definida antes de chamar a API
    if (!companyId) return;
    const key = `${userId}-${companyId}`;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (key === lastFetchedKey.current) return;
      doFetch(key, companyId);
    }, 150);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [userId, companyId, isMasterAdmin, user, doFetch]);

  const invalidate = useCallback(() => {
    lastFetchedKey.current = '';
    const key = `${userId}-${companyId}`;
    doFetch(key, companyId);
  }, [doFetch, userId, companyId]);

  const canView = useCallback((path: string): boolean => {
    if (allowed.includes('*')) return true;
    return allowed.some(p => path === p || path.startsWith(p + '/'));
  }, [allowed]);

  return (
    <SidebarPermissionsContext.Provider value={{ allowed, loading, canView, invalidate }}>
      {children}
    </SidebarPermissionsContext.Provider>
  );
};

export const useSidebarPermissions = () => useContext(SidebarPermissionsContext);
