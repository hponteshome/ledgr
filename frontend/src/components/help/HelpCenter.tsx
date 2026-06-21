// frontend/src/components/help/HelpCenter.tsx
import React, { useState, useMemo } from 'react';
import { FiSearch, FiX, FiChevronRight, FiArrowLeft } from 'react-icons/fi';
import { helpSections, helpContent } from '../../help/helpContent';
import { HelpArticleView } from './HelpArticleView';

interface Props {
  initialSlug?: string;
  onClose: () => void;
}

export const HelpCenter: React.FC<Props> = ({ initialSlug, onClose }) => {
  const [currentSlug, setCurrentSlug] = useState<string | null>(initialSlug ?? null);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const navigate = (slug: string) => {
    if (currentSlug) setHistory(h => [...h, currentSlug]);
    setCurrentSlug(slug);
    setSearch('');
  };

  const goBack = () => {
    if (history.length > 0) {
      setCurrentSlug(history[history.length - 1]);
      setHistory(h => h.slice(0, -1));
    } else {
      setCurrentSlug(null);
    }
  };

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return Object.entries(helpContent).filter(([, art]) =>
      art.title.toLowerCase().includes(q) ||
      art.intro.toLowerCase().includes(q) ||
      art.section.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search]);

  const currentArticle = currentSlug ? helpContent[currentSlug] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          {(currentSlug || history.length > 0) && (
            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <FiArrowLeft size={16} />
            </button>
          )}
          <h2 className="text-base font-bold text-gray-900">
            {currentArticle ? currentArticle.title : 'Central de Ajuda'}
          </h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <FiX size={18} />
        </button>
      </div>

      {/* Busca */}
      {!currentSlug && (
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Buscar ajuda..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400 bg-gray-50"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        {/* Resultados de busca */}
        {search && searchResults.length > 0 && (
          <div className="p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
            </p>
            {searchResults.map(([slug, art]) => (
              <button key={slug} onClick={() => navigate(slug)}
                className="flex items-center justify-between gap-2 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-colors text-left">
                <div>
                  <p className="text-xs text-purple-400 font-medium">{art.section}</p>
                  <p className="text-sm font-medium text-gray-800">{art.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{art.intro}</p>
                </div>
                <FiChevronRight className="text-gray-300 flex-shrink-0" size={16} />
              </button>
            ))}
          </div>
        )}

        {search && searchResults.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">Nenhum artigo encontrado para "{search}"</p>
            <button onClick={() => setSearch('')} className="text-xs text-purple-500 mt-2 hover:underline">Limpar busca</button>
          </div>
        )}

        {/* Índice de seções */}
        {!search && !currentSlug && (
          <div className="p-4 flex flex-col gap-5">
            {helpSections.map(section => (
              <div key={section.title}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{section.title}</p>
                <div className="flex flex-col gap-1">
                  {section.articles.map(art => (
                    <button key={art.slug} onClick={() => navigate(art.slug)}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg hover:bg-purple-50 hover:text-purple-700 transition-colors text-left group">
                      <span className="text-sm text-gray-700 group-hover:text-purple-700">{art.title}</span>
                      <FiChevronRight className="text-gray-300 group-hover:text-purple-400 flex-shrink-0" size={14} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Artigo */}
        {currentArticle && (
          <div className="p-5">
            <HelpArticleView article={currentArticle} onNavigate={navigate} />
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
        <p className="text-xs text-gray-400 text-center">
          Não encontrou o que procurava?{' '}
          <button onClick={() => navigate('primeiros-passos/bem-vindo')} className="text-purple-500 hover:underline">
            Ver guia completo
          </button>
        </p>
      </div>
    </div>
  );
};
