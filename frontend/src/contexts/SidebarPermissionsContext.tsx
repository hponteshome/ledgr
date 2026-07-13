// frontend/src/contexts/SidebarPermissionsContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useCompany } from './CompanyContext';

type Level = 'NONE' | 'VIEW' | 'EDIT' | 'DELETE';
type Entry = { path: string; level: Level };

const LEVEL_RANK: Record<Level, number> = { NONE: 0, VIEW: 1, EDIT: 2, DELETE: 3 };

interface SidebarPermissionsContextValue {
  allowed: Entry[];
  loading: boolean;
  canView: (path: string) => boolean;
  canEdit: (path: string) => boolean;
  canDelete: (path: string) => boolean;
  levelOf: (path: string) => Level;
  invalidate: () => void;
}

const SidebarPermissionsContext = createContext<SidebarPermissionsContextValue>({
  allowed: [],
  loading: false,
  canView: () => true,
  canEdit: () => true,
  canDelete: () => true,
  levelOf: () => 'DELETE',
  invalidate: () => {},
});

export const SidebarPermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const [allowed, setAllowed] = useState<Entry[]>([]);
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
    if (isMasterAdmin) { setAllowed([{ path: '*', level: 'DELETE' }]); return; }
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

  const levelOf = useCallback((path: string): Level => {
    const wildcard = allowed.find(a => a.path === '*');
    if (wildcard) return wildcard.level;
    let best: Level = 'NONE';
    for (const a of allowed) {
      if (path === a.path || path.startsWith(a.path + '/')) {
        if (LEVEL_RANK[a.level] > LEVEL_RANK[best]) best = a.level;
      }
    }
    return best;
  }, [allowed]);

  const hasAtLeast = useCallback((path: string, min: Level): boolean => {
    if (loading || allowed.length === 0) return true; // bootstrap: sem config = acesso liberado
    return LEVEL_RANK[levelOf(path)] >= LEVEL_RANK[min];
  }, [loading, allowed, levelOf]);

  const canView = useCallback((path: string) => hasAtLeast(path, 'VIEW'), [hasAtLeast]);
  const canEdit = useCallback((path: string) => hasAtLeast(path, 'EDIT'), [hasAtLeast]);
  const canDelete = useCallback((path: string) => hasAtLeast(path, 'DELETE'), [hasAtLeast]);

  return (
    <SidebarPermissionsContext.Provider value={{ allowed, loading, canView, canEdit, canDelete, levelOf, invalidate }}>
      {children}
    </SidebarPermissionsContext.Provider>
  );
};

export const useSidebarPermissions = () => useContext(SidebarPermissionsContext);
