// frontend/src/components/Breadcrumbs.tsx
// Breadcrumbs para hierarquias profundas (3+ niveis) - Estagio 2 do roadmap
// de navegacao. So renderiza quando a rota atual corresponde a um item com
// 3 ou mais niveis na arvore do menu (modulo > rotina > sub-rotina); em
// niveis mais rasos o cabecalho do painel de Nivel 2 ja da esse contexto.
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { useSidebarTree } from '../contexts/SidebarTreeContext';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const { flat } = useSidebarTree();

  // Match exato primeiro; se nao houver, usa o prefixo mais longo (rotas com :id/params)
  const exact = flat.find(e => location.pathname === e.path.split('?')[0]);
  const match = exact ?? flat
    .filter(e => location.pathname.startsWith(e.path.split('?')[0] + '/') || location.pathname === e.path.split('?')[0])
    .sort((a, b) => b.path.length - a.path.length)[0];

  if (!match || match.trail.length < 3) return null;

  return (
    <nav className="flex items-center gap-1.5 text-[13px] text-gray-500 mb-4 flex-wrap" aria-label="breadcrumb">
      {match.trail.map((label, idx) => {
        const isLast = idx === match.trail.length - 1;
        return (
          <React.Fragment key={idx}>
            {idx > 0 && <FiChevronRight size={12} className="text-gray-300 flex-shrink-0" />}
            {isLast ? (
              <span className="font-semibold text-gray-800">{label}</span>
            ) : idx === 0 ? (
              <span className="text-gray-400">{label}</span>
            ) : (
              <Link to={match.path} className="text-gray-500 hover:text-blue-600 transition-colors">{label}</Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
