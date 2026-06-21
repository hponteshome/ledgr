// frontend/src/components/help/HelpArticleView.tsx
import React from 'react';
import { FiAlertTriangle, FiInfo, FiArrowRight } from 'react-icons/fi';
import { HelpArticle, helpContent } from '../../help/helpContent';

interface Props {
  article: HelpArticle;
  onNavigate: (slug: string) => void;
}

export const HelpArticleView: React.FC<Props> = ({ article, onNavigate }) => (
  <div className="flex flex-col gap-4">
    <div>
      <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1">{article.section}</p>
      <h2 className="text-xl font-bold text-gray-900">{article.title}</h2>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed">{article.intro}</p>
    </div>

    {article.content.map((block, i) => {
      if (block.type === 'text') return (
        <p key={i} className="text-sm text-gray-700 leading-relaxed">{block.text}</p>
      );

      if (block.type === 'tip') return (
        <div key={i} className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
          <FiInfo className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-blue-700 leading-relaxed">{block.text}</p>
        </div>
      );

      if (block.type === 'warning') return (
        <div key={i} className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <FiAlertTriangle className="text-amber-500 flex-shrink-0 mt-0.5" size={16} />
          <p className="text-sm text-amber-700 leading-relaxed">{block.text}</p>
        </div>
      );

      if (block.type === 'list') return (
        <ul key={i} className="flex flex-col gap-1.5">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm text-gray-700">
              <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
              {item}
            </li>
          ))}
        </ul>
      );

      if (block.type === 'steps') return (
        <ol key={i} className="flex flex-col gap-3">
          {block.items.map((item, j) => (
            <li key={j} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {j + 1}
              </span>
              <p className="text-sm text-gray-700 leading-relaxed">{item}</p>
            </li>
          ))}
        </ol>
      );

      if (block.type === 'table') return (
        <div key={i} className="overflow-hidden rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {block.headers.map((h, j) => (
                  <th key={j} className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, j) => (
                <tr key={j} className="border-t border-gray-50">
                  {row.map((cell, k) => (
                    <td key={k} className={`px-3 py-2 text-gray-700 ${k === 0 ? 'font-medium' : ''}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

      return null;
    })}

    {article.related && article.related.length > 0 && (
      <div className="border-t border-gray-100 pt-4 mt-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Artigos relacionados</p>
        <div className="flex flex-col gap-2">
          {article.related.map(slug => {
            const rel = helpContent[slug];
            if (!rel) return null;
            return (
              <button key={slug} onClick={() => onNavigate(slug)}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-colors text-left">
                <div>
                  <p className="text-xs text-purple-400 font-medium">{rel.section}</p>
                  <p className="text-sm text-gray-700 font-medium">{rel.title}</p>
                </div>
                <FiArrowRight className="text-gray-300 flex-shrink-0" size={16} />
              </button>
            );
          })}
        </div>
      </div>
    )}
  </div>
);
