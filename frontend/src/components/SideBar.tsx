import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiChevronLeft, FiChevronDown, FiChevronRight, FiMenu, FiHelpCircle, FiLogOut, FiCircle,
} from 'react-icons/fi';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { ImportBalancesModal } from './accounting/ImportBalancesModal';
import { useSidebarPermissions } from '../contexts/SidebarPermissionsContext';
import { HelpCenter } from './help/HelpCenter';
import { contextualHelp } from '../help/helpContent';
import { iconRegistry } from '../config/iconRegistry';
import api from '../services/api';

const MySwal = withReactContent(Swal);

interface SubItem {
  path: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
  isImport?: boolean;
  children?: SubItem[];
}

interface MenuItem {
  path: string;
  icon: React.ElementType;
  label: string;
  dividerBefore?: string;
  children?: SubItem[];
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

export const Sidebar: React.FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const cid = activeCompany?.id ?? '';
  const { canView, allowed, loading: permLoading } = useSidebarPermissions();

  const [showImportModal, setShowImportModal] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tree, setTree] = useState<RawTreeNode[]>([]);
  const helpSlug = Object.entries(contextualHelp).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1];

  useEffect(() => {
    if (!user) { setTree([]); return; }
    api.get('/sidebar-permissions/tree')
      .then(r => setTree(r.data))
      .catch(() => setTree([]));
  }, [user]);

  const menuItems = useMemo<MenuItem[]>(() => {
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

  const filteredMenu = useMemo(() => {
    if (permLoading) return menuItems;
    return menuItems
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
      .filter(Boolean) as typeof menuItems;
  }, [menuItems, canView, permLoading]);

  useEffect(() => {
    const currentPath = location.pathname;
    const toExpand: string[] = [];

    menuItems.forEach(item => {
      if (item.children) {
        const childMatch = item.children.some(child => {
          if (currentPath.startsWith(child.path.split('?')[0])) return true;
          if (child.children) {
            return child.children.some(gc => currentPath.startsWith(gc.path.split('?')[0]));
          }
          return false;
        });
        if (childMatch) toExpand.push(item.path);

        item.children.forEach(child => {
          if (child.children) {
            const gcMatch = child.children.some(gc => currentPath.startsWith(gc.path.split('?')[0]));
            if (gcMatch) toExpand.push(child.path);
          }
        });
      }
    });

    if (toExpand.length > 0) setExpanded(toExpand);
  }, [location.pathname, menuItems]);

  const handleSignOut = async () => {
    const result = await MySwal.fire({
      title: 'Sair do Sistema?',
      text: 'Sua sessão será encerrada.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#111111',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, sair',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      signOut();
      navigate('/auth/login');
    }
  };

  const handleParentClick = (path: string) => {
    if (!open) {
      onToggle();
      setExpanded([path]);
    } else {
      setExpanded(prev => prev.includes(path) ? [] : [path]);
    }
  };

  return (
    <>
      <aside className={`bg-white border-r-[0.5px] border-gray-200 flex flex-col h-full fixed left-0 top-0 z-[60] transition-all duration-300 ${open ? 'w-64' : 'w-20'}`}>

        <div className="h-16 flex items-center justify-between px-5 border-b-[0.5px] border-gray-100 flex-shrink-0">
          {open ? (
            <>
              <span className="text-xl font-black tracking-tighter text-gray-900">LEDGR<span className="text-blue-600"></span></span>
              <button onClick={onToggle} className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors">
                <FiChevronLeft size={20} />
              </button>
            </>
          ) : (
            <button onClick={onToggle} title="Expandir Menu" className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold mx-auto hover:bg-gray-800 transition-colors">
              <FiMenu size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto custom-scrollbar">
          {filteredMenu.map((item) => {
            const active = location.pathname.startsWith(item.path);
            const isExp = expanded.includes(item.path);

            return (
              <div key={item.path}>
                {open && item.dividerBefore && (
                  <div className="px-3 pt-4 pb-1">
                    <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                      {item.dividerBefore}
                    </span>
                  </div>
                )}
                <div className="mb-1">
                  {item.children ? (
                    <button
                      onClick={() => handleParentClick(item.path)}
                      title={!open ? item.label : ''}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <item.icon size={20} className={active ? 'text-blue-600' : ''} />
                      {open && <span className="text-base font-medium flex-1 text-left">{item.label}</span>}
                      {open && (isExp ? <FiChevronDown size={30} /> : <FiChevronRight size={30} />)}
                    </button>
                  ) : (
                    <Link
                      to={item.path}
                      title={!open ? item.label : ''}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                      <item.icon size={20} className={active ? 'text-blue-600' : ''} />
                      {open && <span className="text-base font-medium flex-1 text-left">{item.label}</span>}
                    </Link>
                  )}

                  {open && isExp && item.children && (
                    <div className="ml-6 pl-4 border-l-[0.5px] border-gray-100 mt-1 space-y-1 overflow-hidden transition-all duration-300">
                      {item.children.map(child => (
                        child.isImport ? (
                          <button key="imp" onClick={() => setShowImportModal(true)}
                            className="w-full flex items-center gap-2 py-2 text-[15px] text-gray-400 hover:text-blue-600 font-medium text-left px-3">
                            <child.icon size={20} /> {child.label}
                          </button>
                        ) : child.children ? (
                          <div key={child.path}>
                            <button
                              onClick={() => setExpanded(prev =>
                                prev.includes(child.path) ? prev.filter(p => p !== child.path) : [...prev, child.path]
                              )}
                              className="w-full flex items-center gap-2 py-2 text-[15px] px-3 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            >
                              <child.icon size={20} />
                              <span className="flex-1 text-left">{child.label}</span>
                              {expanded.includes(child.path) ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
                            </button>
                            {expanded.includes(child.path) && (
                              <div className="ml-4 pl-3 border-l-[0.5px] border-gray-100 space-y-1">
                                {child.children.map(gc => (
                                  <Link key={gc.path} to={gc.path}
                                    className={`flex items-center gap-2 py-2 text-[14px] px-3 rounded-lg transition-all ${location.pathname === gc.path
                                      ? 'text-blue-600 font-bold bg-blue-50'
                                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                      }`}>
                                    <gc.icon size={16} /> {gc.label}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Link
                            key={child.path}
                            to={child.disabled ? '#' : child.path}
                            className={`flex items-center gap-2 py-2 text-[15px] px-3 rounded-lg transition-all ${child.disabled ? 'opacity-30 cursor-not-allowed'
                              : (location.pathname + location.search) === child.path
                                ? 'text-blue-600 font-bold bg-blue-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                              }`}>
                            <child.icon size={20} /> {child.label}
                          </Link>
                        )
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t-[0.5px] border-gray-100 flex-shrink-0">
          <button
            onClick={() => setHelpOpen(true)}
            title={!open ? 'Ajuda' : ''}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-gray-400 hover:text-gray-700 hover:bg-gray-50 ${!open && 'justify-center'}`}
          >
            <FiHelpCircle size={18} />
            {open && <span className="text-sm">Ajuda & Suporte</span>}
          </button>
          <button
            onClick={handleSignOut}
            title={!open ? 'Sair' : ''}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-red-500 hover:bg-red-50 ${!open && 'justify-center'}`}
          >
            <FiLogOut size={18} />
            {open && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>

        {helpOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setHelpOpen(false)} />
            <div className="fixed right-0 top-0 h-full w-96 max-w-full z-50 bg-white shadow-2xl flex flex-col animate-slide-in-right">
              <HelpCenter initialSlug={helpSlug} onClose={() => setHelpOpen(false)} />
            </div>
          </>
        )}
      </aside>

      {activeCompany && <ImportBalancesModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} companyId={activeCompany.id} />}
    </>
  );
};
