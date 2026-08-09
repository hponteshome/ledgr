// frontend/src/hooks/useRecentNav.ts
// Rastreia as ultimas rotinas navegadas (por usuario, via localStorage) para
// alimentar a lista de "recentes" do Command Palette (Estagio 2 do roadmap de
// navegacao) - preenchida em qualquer navegacao, nao so pelas acionadas via
// Ctrl/Cmd+K.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebarTree, FlatMenuEntry } from '../contexts/SidebarTreeContext';

const MAX_RECENT = 8;

function storageKey(userId: string) {
  return `@ledgr:recentNav:${userId}`;
}

function readRecent(userId: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeRecent(userId: string, paths: string[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(paths));
  } catch { /* silencioso - localStorage indisponivel/cheio */ }
}

/** Chamado uma vez, em Layout.tsx, para gravar a navegacao a cada troca de rota. */
export function useTrackRecentNav() {
  const location = useLocation();
  const { user } = useAuth();
  const { flat } = useSidebarTree();
  const userId = (user as any)?.id ?? '';

  useEffect(() => {
    if (!userId || flat.length === 0) return;
    const match = flat.find(e => location.pathname === e.path.split('?')[0]);
    if (!match) return;
    const current = readRecent(userId).filter(p => p !== match.path);
    current.unshift(match.path);
    writeRecent(userId, current.slice(0, MAX_RECENT));
  }, [location.pathname, userId, flat]);
}

/**
 * Consumido pelo CommandPalette para exibir os itens recentes resolvidos.
 * `refreshKey` deve mudar toda vez que o palette abre - o componente fica
 * montado o tempo todo (so alterna visibilidade), entao um useEffect preso
 * so ao mount nunca pegaria navegacoes feitas enquanto ele estava fechado.
 */
export function useRecentNav(refreshKey: unknown): FlatMenuEntry[] {
  const { user } = useAuth();
  const { flat } = useSidebarTree();
  const userId = (user as any)?.id ?? '';
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    if (userId) setPaths(readRecent(userId));
  }, [userId, refreshKey]);

  const byPath = new Map(flat.map(e => [e.path, e]));
  return paths.map(p => byPath.get(p)).filter(Boolean) as FlatMenuEntry[];
}
