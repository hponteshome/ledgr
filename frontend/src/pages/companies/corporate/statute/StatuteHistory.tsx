// src/pages/companies/corporate/statute/StatuteHistory.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiClock, FiEye, FiMessageSquare } from 'react-icons/fi';
import api from '../../../../services/api';
import { useCompany } from '../../../../contexts/CompanyContext';

interface DocumentVersion {
    id: string;
    version: number;
    changeNote?: string;
    createdAt: string;
    content?: string;
}

export const StatuteHistory: React.FC = () => {
    const { id, docId } = useParams<{ id: string; docId: string }>();
    const navigate = useNavigate();
    const { activeCompany } = useCompany();
    const companyId = activeCompany?.id ?? id ?? '';

    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        if (!docId) { setLoading(false); return; }
        api.get(`/documents/${docId}/versions`)
            .then(r => setVersions(r.data))
            .catch(err => console.error('Erro ao carregar versões:', err))
            .finally(() => setLoading(false));
    }, [docId]);

    const toggleContent = (versionId: string) =>
        setExpanded(prev => prev === versionId ? null : versionId);

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate(
                        docId
                            ? `/app/companies/corporate/statute/${companyId}/view/${docId}`
                            : `/app/companies/corporate/statute/${companyId}`
                    )}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                    <FiArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Histórico de Versões</h1>
            </div>

            {loading && (
                <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
            )}

            {!loading && versions.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
                    Nenhuma versão encontrada para este documento.
                </div>
            )}

            {!loading && versions.length > 0 && (
                <div className="relative">
                    {/* Linha vertical da timeline */}
                    <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" />

                    <div className="space-y-4">
                        {versions.map((v, idx) => (
                            <div key={v.id} className="relative flex gap-4">
                                {/* Bolinha da timeline */}
                                <div className={`
                                    relative z-10 flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold
                                    ${idx === 0
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-gray-300 text-gray-500'}
                                `}>
                                    v{v.version}
                                </div>

                                {/* Card */}
                                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-1">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FiClock size={13} className="text-gray-400" />
                                                <span className="text-xs text-gray-400">
                                                    {new Date(v.createdAt).toLocaleString('pt-BR')}
                                                </span>
                                                {idx === 0 && (
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
                                                        Atual
                                                    </span>
                                                )}
                                            </div>
                                            {v.changeNote && (
                                                <div className="flex items-start gap-1.5 mt-2">
                                                    <FiMessageSquare size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                                    <p className="text-sm text-gray-600 italic">"{v.changeNote}"</p>
                                                </div>
                                            )}
                                            {!v.changeNote && (
                                                <p className="text-sm text-gray-300 mt-1">Sem nota de alteração</p>
                                            )}
                                        </div>
                                        {v.content && (
                                            <button
                                                onClick={() => toggleContent(v.id)}
                                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
                                            >
                                                <FiEye size={13} />
                                                {expanded === v.id ? 'Fechar' : 'Ver conteúdo'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Conteúdo expansível */}
                                    {expanded === v.id && v.content && (
                                        <textarea
                                            readOnly
                                            value={v.content}
                                            className="mt-3 w-full h-48 px-3 py-2 text-xs text-gray-600 font-mono
                                                       border border-gray-200 rounded-lg bg-gray-50
                                                       resize-none focus:outline-none overflow-y-auto"
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};