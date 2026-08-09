// frontend/src/components/SideBar.tsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiChevronLeft, FiChevronDown, FiChevronRight, FiMenu, FiHelpCircle, FiLogOut,
  FiStar,
} from 'react-icons/fi';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { ImportBalancesModal } from './accounting/ImportBalancesModal';
import { useSidebarTree, MenuItem } from '../contexts/SidebarTreeContext';
import { useFavorites } from '../hooks/useFavorites';
import { HelpCenter } from './help/HelpCenter';
import { contextualHelp } from '../help/helpContent';

const MySwal = withReactContent(Swal);

// Estagio 1 do roadmap de navegacao (docs/LEDGR-benchmark-ux-navegacao.md):
// sidebar de dois niveis - rail estreito (Nivel 1, modulos fixos) + painel
// contextual (Nivel 2, rotinas do modulo ativo), substituindo o antigo
// accordion de coluna unica. `open` agora controla se o painel de Nivel 2
// fica visivel; o rail de Nivel 1 fica sempre visivel.
// Estagio 2: adiciona favoritos (estrela por rotina + painel "Favoritos"
// fixo no topo do rail) e o atalho de busca global (Ctrl/Cmd+K).

const RAIL_WIDTH = 80;   // px - mesma largura do antigo estado "colapsado"
const PANEL_WIDTH = 240; // px - coluna de Nivel 2
const FAVORITES_KEY = '__favorites__';

export const Sidebar: React.FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const { menu: filteredMenu, flat } = useSidebarTree();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();

  const [showImportModal, setShowImportModal] = useState(false);
  const [activeModulePath, setActiveModulePath] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]); // sub-accordion de 3o nivel (dentro do painel)
  const [helpOpen, setHelpOpen] = useState(false);
  const helpSlug = Object.entries(contextualHelp).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1];

  // Sincroniza o modulo ativo (Nivel 1) e o sub-accordion (3o nivel) com a rota atual -
  // cobre navegacao direta por URL, nao so clique no menu.
  useEffect(() => {
    const currentPath = location.pathname;
    let matchedModule: string | null = null;
    const toExpand: string[] = [];

    filteredMenu.forEach(item => {
      if (!item.children) return;
      const childMatch = item.children.some(child => {
        if (currentPath.startsWith(child.path.split('?')[0])) return true;
        if (child.children) {
          return child.children.some(gc => currentPath.startsWith(gc.path.split('?')[0]));
        }
        return false;
      });
      if (childMatch) matchedModule = item.path;

      item.children.forEach(child => {
        if (child.children) {
          const gcMatch = child.children.some(gc => currentPath.startsWith(gc.path.split('?')[0]));
          if (gcMatch) toExpand.push(child.path);
        }
      });
    });

    if (matchedModule) setActiveModulePath(matchedModule);
    if (toExpand.length > 0) setExpanded(toExpand);
  }, [location.pathname, filteredMenu]);

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

  const activeModule = filteredMenu.find(item => item.path === activeModulePath);
  const favoritesActive = open && activeModulePath === FAVORITES_KEY;
  const favoriteEntries = flat.filter(e => favorites.includes(e.path));

  const handleRailClick = (item: MenuItem) => {
    if (item.children) {
      if (!open) onToggle();
      setActiveModulePath(prev => (prev === item.path && open ? prev : item.path));
    } else {
      setActiveModulePath(null);
      navigate(item.path);
    }
  };

  const handleFavoritesClick = () => {
    if (!open) onToggle();
    setActiveModulePath(prev => (prev === FAVORITES_KEY && open ? prev : FAVORITES_KEY));
  };

  return (
    <>
      {/* ── Nivel 1 — rail de modulos, sempre visivel ─────────────────────── */}
      <aside className="bg-white border-r-[0.5px] border-gray-200 flex flex-col h-full fixed left-0 top-0 z-[61]" style={{ width: RAIL_WIDTH }}>
        <div className="h-16 flex items-center justify-center border-b-[0.5px] border-gray-100 flex-shrink-0">
          <button onClick={onToggle} title={open ? 'Recolher menu' : 'Expandir menu'} className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white hover:bg-gray-800 transition-colors">
            {open ? <FiChevronLeft size={18} /> : <FiMenu size={18} />}
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto custom-scrollbar flex flex-col items-center gap-1">
          <button
            onClick={handleFavoritesClick}
            title="Favoritos"
            className={`w-14 h-12 flex items-center justify-center rounded-xl transition-all duration-150 ${
              favoritesActive ? 'bg-gray-100 text-amber-500' : 'text-gray-400 hover:bg-gray-50 hover:text-amber-500'
            }`}
          >
            <FiStar size={20} fill={favoritesActive || favorites.length > 0 ? 'currentColor' : 'none'} />
          </button>

          <div className="w-8 h-px bg-gray-100 my-1" />

          {filteredMenu.map((item, idx) => {
            const active = location.pathname.startsWith(item.path);
            const isModuleOpen = open && activeModulePath === item.path;
            const showDivider = item.dividerBefore && idx > 0;
            return (
              <React.Fragment key={item.path}>
                {showDivider && <div className="w-8 h-px bg-gray-100 my-1.5" />}
                <button
                  onClick={() => handleRailClick(item)}
                  title={item.label}
                  className={`relative w-14 h-12 flex items-center justify-center rounded-xl transition-all duration-150 ${
                    active
                      ? 'bg-blue-50 text-blue-600'
                      : isModuleOpen
                        ? 'bg-gray-100 text-gray-700'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] bg-blue-600 rounded-r" />}
                  <item.icon size={22} />
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="border-t-[0.5px] border-gray-100 flex-shrink-0 py-2 flex flex-col items-center gap-1">
          <button
            onClick={() => setHelpOpen(true)}
            title="Ajuda & Suporte"
            className="w-14 h-12 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
          >
            <FiHelpCircle size={20} />
          </button>
          <button
            onClick={handleSignOut}
            title="Sair"
            className="w-14 h-12 flex items-center justify-center rounded-xl text-red-500 hover:bg-red-50 transition-all"
          >
            <FiLogOut size={20} />
          </button>
        </div>
      </aside>

      {/* ── Nivel 2 — painel de Favoritos (cross-modulo) ──────────────────── */}
      {favoritesActive && (
        <aside
          className="bg-white border-r-[0.5px] border-gray-200 flex flex-col h-full fixed top-0 z-[60] transition-all duration-200"
          style={{ left: RAIL_WIDTH, width: PANEL_WIDTH }}
        >
          <div className="h-16 flex items-center gap-2 px-5 border-b-[0.5px] border-gray-100 flex-shrink-0">
            <FiStar size={16} className="text-amber-500" fill="currentColor" />
            <span className="text-base font-bold text-gray-900 truncate">Favoritos</span>
          </div>
          <nav className="flex-1 py-3 px-3 overflow-y-auto custom-scrollbar space-y-1">
            {favoriteEntries.length === 0 ? (
              <p className="text-[13px] text-gray-400 px-3 py-4 leading-relaxed">
                Nenhum favorito ainda. Passe o mouse sobre uma rotina no painel do módulo e clique na estrela para fixar aqui.
              </p>
            ) : favoriteEntries.map(entry => (
              <Link key={entry.path} to={entry.path}
                className={`flex items-center gap-2 py-2 text-[15px] px-3 rounded-lg transition-all ${
                  location.pathname === entry.path
                    ? 'text-blue-600 font-bold bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <entry.icon size={18} />
                <span className="flex-1 truncate">{entry.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
      )}

      {/* ── Nivel 2 — painel contextual do modulo ativo ───────────────────── */}
      {open && activeModule?.children && (
        <aside
          className="bg-white border-r-[0.5px] border-gray-200 flex flex-col h-full fixed top-0 z-[60] transition-all duration-200"
          style={{ left: RAIL_WIDTH, width: PANEL_WIDTH }}
        >
          <div className="h-16 flex items-center px-5 border-b-[0.5px] border-gray-100 flex-shrink-0">
            <span className="text-base font-bold text-gray-900 truncate">{activeModule.label}</span>
          </div>

          <nav className="flex-1 py-3 px-3 overflow-y-auto custom-scrollbar space-y-1">
            {activeModule.children.map(child => (
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
                        <div key={gc.path} className="group relative flex items-center">
                          <Link to={gc.path}
                            className={`flex-1 flex items-center gap-2 py-2 pl-3 pr-7 text-[14px] rounded-lg transition-all ${location.pathname === gc.path
                              ? 'text-blue-600 font-bold bg-blue-50'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                              }`}>
                            <gc.icon size={16} /> {gc.label}
                          </Link>
                          <button
                            onClick={() => toggleFavorite(gc.path)}
                            title={isFavorite(gc.path) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                            className={`absolute right-1.5 p-1 rounded transition-opacity ${
                              isFavorite(gc.path) ? 'opacity-100 text-amber-500' : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-amber-500'
                            }`}
                          >
                            <FiStar size={13} fill={isFavorite(gc.path) ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div key={child.path} className="group relative flex items-center">
                  <Link
                    to={child.disabled ? '#' : child.path}
                    className={`flex-1 flex items-center gap-2 py-2 pl-3 pr-7 text-[15px] rounded-lg transition-all ${child.disabled ? 'opacity-30 cursor-not-allowed'
                      : (location.pathname + location.search) === child.path
                        ? 'text-blue-600 font-bold bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}>
                    <child.icon size={20} /> {child.label}
                  </Link>
                  {!child.disabled && (
                    <button
                      onClick={() => toggleFavorite(child.path)}
                      title={isFavorite(child.path) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      className={`absolute right-1.5 p-1 rounded transition-opacity ${
                        isFavorite(child.path) ? 'opacity-100 text-amber-500' : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-amber-500'
                      }`}
                    >
                      <FiStar size={14} fill={isFavorite(child.path) ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
              )
            ))}
          </nav>
        </aside>
      )}

      {helpOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setHelpOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-96 max-w-full z-50 bg-white shadow-2xl flex flex-col animate-slide-in-right">
            <HelpCenter initialSlug={helpSlug} onClose={() => setHelpOpen(false)} />
          </div>
        </>
      )}

      {activeCompany && <ImportBalancesModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} companyId={activeCompany.id} />}
    </>
  );
};

export const SIDEBAR_RAIL_WIDTH = RAIL_WIDTH;
export const SIDEBAR_PANEL_WIDTH = PANEL_WIDTH;
