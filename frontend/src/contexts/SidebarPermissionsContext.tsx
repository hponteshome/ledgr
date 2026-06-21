// frontend/src/contexts/SidebarPermissionsContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [cacheKey, setCacheKey] = useState('');

  const isMasterAdmin = (user as any)?.permissions?.all === true;

  const fetch = useCallback((key: string) => {
    if (!user) { setAllowed([]); setLoading(false); return; }
    if (isMasterAdmin) { setAllowed(['*']); setLoading(false); return; }
    setLoading(true);
    api.get('/sidebar-permissions/resolve', {
      headers: { 'x-company-id': activeCompany?.id ?? '' },
    })
      .then(r => { setAllowed(r.data); setCacheKey(key); })
      .catch(() => setAllowed([]))
      .finally(() => setLoading(false));
  }, [user, activeCompany?.id, isMasterAdmin]);

  useEffect(() => {
    if (!user) { setAllowed([]); return; }
    if (isMasterAdmin) { setAllowed(['*']); return; }
    const key = `${(user as any).id}-${activeCompany?.id ?? ''}`;
    if (key === cacheKey) return;
    fetch(key);
  }, [(user as any)?.id, activeCompany?.id, isMasterAdmin]);

  const invalidate = useCallback(() => {
    setCacheKey('');
    const key = `${(user as any)?.id}-${activeCompany?.id ?? ''}`;
    fetch(key);
  }, [fetch, user, activeCompany?.id]);

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
