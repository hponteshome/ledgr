// frontend/src/contexts/SidebarTreeContext.tsx
// Fonte unica dos dados de menu (arvore de sidebar_items + filtro de permissao +
// itens dinamicos de Societario), compartilhada entre SideBar, Breadcrumbs e
// CommandPalette (Estagio 2 do roadmap de navegacao). Antes vivia so dentro do
// SideBar.tsx - extraido pra evitar 3 fetches/calculos duplicados da mesma arvore.
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useCompany } from './CompanyContext';
import { useSidebarPermissions } from './SidebarPermissionsContext';
import { iconRegistry } from '../config/iconRegistry';
import { FiCircle } from 'react-icons/fi';
import api from '../services/api';

export interface SubItem {
  path: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
  isImport?: boolean;
  children?: SubItem[];
}

export interface MenuItem {
  path: string;
  icon: React.ElementType;
  label: string;
  dividerBefore?: string;
  children?: SubItem[];
}

export interface FlatMenuEntry {
  path: string;
  label: string;
  icon: React.ElementType;
  moduleLabel: string;
  trail: string[]; // rotulos do modulo ate o item, nesta ordem (usado nos breadcrumbs)
  disabled?: boolean;
}

interface RawTreeNode {
  id: string;
  path: string;
  label: string;
  module: string;
  icon: string;
  ordem: number;
  dividerBefore: string | null;
  disabled: boolean;
  actionType: string;
  resource: string | null;
  children: RawTreeNode[];
}

function mapNode(node: RawTreeNode): SubItem {
  const sub: SubItem = {
    path: node.path,
    label: node.label,
    icon: iconRegistry[node.icon] ?? FiCircle,
    disabled: node.disabled,
  };
  if (node.children && node.children.length > 0) {
    sub.children = node.children.map(mapNode);
  }
  return sub;
}

function flatten(menu: MenuItem[]): FlatMenuEntry[] {
  const out: FlatMenuEntry[] = [];
  const walk = (items: SubItem[], moduleLabel: string, trailPrefix: string[]) => {
    for (const item of items) {
      if (item.isImport) continue; // acao contextual, nao e uma rota navegavel
      const trail = [...trailPrefix, item.label];
      if (item.path && item.path !== '#') {
        out.push({ path: item.path, label: item.label, icon: item.icon, moduleLabel, trail, disabled: item.disabled });
      }
      if (item.children) walk(item.children, moduleLabel, trail);
    }
  };
  for (const mod of menu) {
    if (mod.path && mod.path !== '#') {
      out.push({ path: mod.path, label: mod.label, icon: mod.icon, moduleLabel: mod.label, trail: [mod.label] });
    }
    if (mod.children) walk(mod.children, mod.label, [mod.label]);
  }
  return out;
}

interface SidebarTreeContextValue {
  rawMenu: MenuItem[];       // sem filtro de permissao (uso interno raro)
  menu: MenuItem[];          // filtrado por permissao - o que o SideBar renderiza
  flat: FlatMenuEntry[];     // lista achatada e filtrada - usada por breadcrumbs/command palette
  loading: boolean;
}

const SidebarTreeContext = createContext<SidebarTreeContextValue>({
  rawMenu: [], menu: [], flat: [], loading: true,
});

export const SidebarTreeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activeCompany } = useCompany();
  const cid = activeCompany?.id ?? '';
  const { canView, loading: permLoading } = useSidebarPermissions();
  const [tree, setTree] = useState<RawTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);

  useEffect(() => {
    if (!user) { setTree([]); setTreeLoading(false); return; }
    setTreeLoading(true);
    api.get('/sidebar-permissions/tree')
      .then(r => setTree(r.data))
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false));
  }, [user]);

  const rawMenu = useMemo<MenuItem[]>(() => {
    // 'Mensagens' saiu da arvore dinamica - vira icone fixo no Header.tsx
    return tree.filter(node => node.path !== '/app/chat').map(node => {
      let children = node.children && node.children.length > 0
        ? node.children.map(mapNode)
        : undefined;

      // Subitens dinamicos de Societario (dependem da empresa ativa - fora do catalogo de banco)
      if (node.path === '/app/societario') {
        const dynamicChildren: SubItem[] = [
          { path: cid ? `/app/societario/${cid}/apresentacao` : '#', label: 'Apresentação Institucional', icon: iconRegistry['FiBriefcase'], disabled: !cid },
          { path: cid ? `/app/companies/corporate/statute/${cid}` : '#', label: 'Estatuto Social', icon: iconRegistry['FiBook'], disabled: !cid },
          { path: cid ? `/app/companies/corporate/contratos/${cid}` : '#', label: 'Contrato Social', icon: iconRegistry['FiFileText'], disabled: !cid },
        ];
        children = [...dynamicChildren, ...(children ?? [])];
      }

      return {
        path: node.path,
        icon: iconRegistry[node.icon] ?? FiCircle,
        label: node.label,
        dividerBefore: node.dividerBefore ?? undefined,
        children,
      };
    });
  }, [tree, cid]);

  const menu = useMemo(() => {
    if (permLoading) return rawMenu;
    return rawMenu
      .map(item => {
        if (!item.children) {
          return canView(item.path) ? item : null;
        }
        const filteredChildren = item.children
          .map(child => {
            if (!child.children) {
              return canView(child.path) ? child : null;
            }
            const filteredGc = child.children.filter(gc => canView(gc.path));
            if (filteredGc.length === 0 && !canView(child.path)) return null;
            return { ...child, children: filteredGc };
          })
          .filter(Boolean) as typeof item.children;
        if (filteredChildren.length === 0 && !canView(item.path)) return null;
        return { ...item, children: filteredChildren };
      })
      .filter(Boolean) as typeof rawMenu;
  }, [rawMenu, canView, permLoading]);

  const flat = useMemo(() => flatten(menu).filter(e => !e.disabled), [menu]);

  return (
    <SidebarTreeContext.Provider value={{ rawMenu, menu, flat, loading: treeLoading || permLoading }}>
      {children}
    </SidebarTreeContext.Provider>
  );
};

export const useSidebarTree = () => useContext(SidebarTreeContext);
