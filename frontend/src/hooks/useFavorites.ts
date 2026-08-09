// frontend/src/hooks/useFavorites.ts
// Favoritos por usuario (Estagio 2 do roadmap de navegacao) - localStorage,
// nao e um dado compartilhado entre usuarios/empresas como sidebar_items,
// entao nao precisa de endpoint de backend pra essa 1a versao.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function storageKey(userId: string) {
  return `@ledgr:favorites:${userId}`;
}

function read(userId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const { user } = useAuth();
  const userId = (user as any)?.id ?? '';
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => { if (userId) setFavorites(read(userId)); }, [userId]);

  const persist = useCallback((next: string[]) => {
    setFavorites(next);
    if (userId) {
      try { localStorage.setItem(storageKey(userId), JSON.stringify(next)); } catch { /* silencioso */ }
    }
  }, [userId]);

  const isFavorite = useCallback((path: string) => favorites.includes(path), [favorites]);

  const toggleFavorite = useCallback((path: string) => {
    persist(isFavorite(path) ? favorites.filter(p => p !== path) : [...favorites, path]);
  }, [favorites, isFavorite, persist]);

  return { favorites, isFavorite, toggleFavorite };
}
