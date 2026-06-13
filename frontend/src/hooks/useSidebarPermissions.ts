import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';

let cache: string[] | null = null;
let cacheKey = '';

export function useSidebarPermissions() {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const [allowed, setAllowed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setAllowed([]); setLoading(false); return; }

    const key = `${user.id}-${activeCompany?.id ?? ''}`;
    if (cache && cacheKey === key) { setAllowed(cache); setLoading(false); return; }

    setLoading(true);
    api.get('/sidebar-permissions/resolve', {
      headers: { 'x-company-id': activeCompany?.id ?? '' },
    })
      .then(r => {
        cache = r.data;
        cacheKey = key;
        setAllowed(r.data);
      })
      .catch(() => setAllowed([]))
      .finally(() => setLoading(false));
  }, [user?.id, activeCompany?.id]);

  // Invalidar cache (chamar apos salvar permissoes)
  function invalidate() { cache = null; cacheKey = ''; }

  function canView(path: string): boolean {
    // Master admin ja vem com tudo no resolve
    return allowed.includes(path);
  }

  return { allowed, loading, canView, invalidate };
}
