// src/pages/companies/corporate/statute/StatuteArticle.tsx
import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { Article } from './types';

interface StatuteArticleProps {
    article: Article;
    chapterNumber: number;
    expanded?: boolean;
}

export const StatuteArticle: React.FC<StatuteArticleProps> = ({
    article,
    chapterNumber,
    expanded = false
}) => {
    const [isExpanded, setIsExpanded] = useState(expanded);

    return (
        <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
            <div
                className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-500">Art. {article.number}</span>
                    {article.title && (
                        <h4 className="font-medium text-gray-800">{article.title}</h4>
                    )}
                </div>
                <button className="text-gray-400 hover:text-gray-600">
                    {isExpanded ? <FiChevronUp size={18} /> : <FiChevronDown size={18} />}
                </button>
            </div>

            {isExpanded && (
                <div className="p-4 bg-white">
                    <p className="text-gray-700 leading-relaxed">{article.content}</p>

                    {article.paragraphs && article.paragraphs.length > 0 && (
                        <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-200">
                            {article.paragraphs.map((p) => (
                                <div key={p.id}>
                                    <p className="text-sm text-gray-600">
                                        <span className="font-mono text-gray-500 mr-2">§ {p.number}</span>
                                        {p.content}
                                    </p>
                                    {p.items && p.items.length > 0 && (
                                        <ul className="mt-1 space-y-1 pl-6 list-disc text-sm text-gray-600">
                                            {p.items.map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};