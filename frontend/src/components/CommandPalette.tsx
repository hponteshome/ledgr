// frontend/src/components/CommandPalette.tsx
// Command palette global (Ctrl/Cmd+K) - Estagio 2 do roadmap de navegacao
// (docs/LEDGR-benchmark-ux-navegacao.md): "lacuna clara do mercado, nenhuma
// das 3 referencias (Conta Azul, Omie, Nibo) tem esse recurso completo".
// Navega para qualquer rotina de qualquer modulo, e tambem troca de empresa
// ativa, com sugestao de itens recentes antes de digitar.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiCornerDownLeft, FiBriefcase, FiClock, FiX } from 'react-icons/fi';
import { useSidebarTree } from '../contexts/SidebarTreeContext';
import { useRecentNav } from '../hooks/useRecentNav';
import { useCompany } from '../contexts/CompanyContext';

export const OPEN_COMMAND_PALETTE_EVENT = 'ledgr:open-command-palette';

type Action =
  | { kind: 'nav'; key: string; label: string; moduleLabel: string; icon: React.ElementType; path: string }
  | { kind: 'company'; key: string; label: string; taxId?: string; id: string | null };

export const CommandPalette: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { flat } = useSidebarTree();
  const recent = useRecentNav(open);
  const { companies, activeCompany, selectCompany } = useCompany();

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const handleOpenEvent = () => setOpen(true);
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  const companyActions: Action[] = useMemo(() => (companies || []).map(c => ({
    kind: 'company', key: `company-${c.id}`, id: c.id,
    label: c.legalName || (c as any).razao_social || '—',
    taxId: c.taxId || (c as any).cnpj,
  })), [companies]);

  const navActions: Action[] = useMemo(() => flat.map(e => ({
    kind: 'nav', key: `nav-${e.path}`, label: e.label, moduleLabel: e.moduleLabel, icon: e.icon, path: e.path,
  })), [flat]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return recent.map(e => ({
        kind: 'nav' as const, key: `recent-${e.path}`, label: e.label, moduleLabel: e.moduleLabel, icon: e.icon, path: e.path,
      }));
    }
    const matchNav = navActions.filter(a =>
      a.kind === 'nav' && (a.label.toLowerCase().includes(q) || a.moduleLabel.toLowerCase().includes(q))
    );
    const matchCompany = q.length >= 2 ? companyActions.filter(a =>
      a.kind === 'company' && (a.label.toLowerCase().includes(q) || a.taxId?.toLowerCase().includes(q))
    ) : [];
    return [...matchNav, ...matchCompany].slice(0, 30);
  }, [query, navActions, companyActions, recent]);

  const runAction = (action: Action) => {
    if (action.kind === 'nav') {
      navigate(action.path);
    } else {
      const company = (companies || []).find(c => c.id === action.id) ?? null;
      selectCompany(company);
      setTimeout(() => navigate(0), 50);
    }
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const action = results[selected];
      if (action) runAction(action);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <FiSearch className="text-gray-400 flex-shrink-0" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar rotina ou empresa..."
            className="flex-1 outline-none text-[15px] text-gray-800 placeholder:text-gray-400"
          />
          <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
            <FiX size={18} />
          </button>
        </div>

        <div className="max-h-[360px] overflow-y-auto py-2">
          {!query.trim() && results.length > 0 && (
            <div className="px-4 pb-1 pt-1 text-[11px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <FiClock size={11} /> Recentes
            </div>
          )}

          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              {query.trim() ? 'Nenhum resultado encontrado.' : 'Comece a digitar para buscar em todos os módulos...'}
            </div>
          )}

          {results.map((action, idx) => {
            const isSel = idx === selected;
            if (action.kind === 'nav') {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  onMouseEnter={() => setSelected(idx)}
                  onClick={() => runAction(action)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <Icon size={17} className={isSel ? 'text-blue-600' : 'text-gray-400'} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-[14px] truncate ${isSel ? 'text-blue-700 font-semibold' : 'text-gray-800'}`}>{action.label}</div>
                    <div className="text-[11px] text-gray-400 truncate">{action.moduleLabel}</div>
                  </div>
                  {isSel && <FiCornerDownLeft size={14} className="text-blue-400 flex-shrink-0" />}
                </button>
              );
            }
            return (
              <button
                key={action.key}
                onMouseEnter={() => setSelected(idx)}
                onClick={() => runAction(action)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              >
                <FiBriefcase size={17} className={isSel ? 'text-blue-600' : 'text-gray-400'} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[14px] truncate ${isSel ? 'text-blue-700 font-semibold' : 'text-gray-800'}`}>{action.label}</div>
                  <div className="text-[11px] text-gray-400 truncate">
                    {action.id === activeCompany?.id ? 'Empresa ativa' : `Trocar empresa · ${action.taxId ?? ''}`}
                  </div>
                </div>
                {isSel && <FiCornerDownLeft size={14} className="text-blue-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-100 rounded font-mono">esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
};
