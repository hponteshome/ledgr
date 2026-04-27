// src/pages/companies/corporate/statute/StatuteView.tsx
import React, { useState, useEffect } from 'react';
import {
    FiFileText, FiEdit2, FiClock,
    FiDownload, FiPrinter, FiShare2, FiBook,
    FiChevronDown, FiChevronRight, FiArrowLeft,
    FiAlignLeft, FiMessageSquare,
} from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import { StatuteArticle } from './StatuteArticle';
import { Statute, Chapter } from './types';
import api from '../../../../services/api';
import { useCompany } from '../../../../contexts/CompanyContext';

interface DocumentVersion {
    version: number;
    changeNote?: string;
    createdAt: string;
}

interface DocumentRecord {
    id: string;
    companyId: string;
    type: string;
    title: string;
    description?: string;
    content?: string;
    status: string;
    currentVersion?: number;
    current_version?: number;
    date?: string;
    createdAt: string;
    updatedAt: string;
    fileUrl?: string;
    bookNumber?: string;
    notes?: string;
    versions?: DocumentVersion[];
}

type StatuteWithMeta = Statute & {
    rawContent?: string;
    changeNote?: string;
};

function parseContent(content?: string): { isStructured: boolean; chapters: Chapter[] } {
    if (!content?.trim()) return { isStructured: false, chapters: [] };
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].articles) {
            return { isStructured: true, chapters: parsed };
        }
    } catch { /* texto puro */ }
    return { isStructured: false, chapters: [] };
}

function documentToStatute(doc: DocumentRecord, companyName: string): StatuteWithMeta {
    const { isStructured, chapters } = parseContent(doc.content);
    const lastVersion = doc.versions?.[0];
    return {
        id: doc.id,
        companyId: doc.companyId,
        companyName,
        version: doc.currentVersion ?? doc.current_version ?? 1,
        approvalDate: doc.date ?? doc.createdAt,
        registrationDate: doc.date,
        registrationNumber: doc.bookNumber ?? '',
        notaryOffice: doc.notes ?? '',
        status: mapStatus(doc.status),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        fileUrl: doc.fileUrl,
        chapters,
        rawContent: isStructured ? undefined : (doc.content ?? ''),
        changeNote: lastVersion?.changeNote,
    };
}

function mapStatus(status: string): string {
    const map: Record<string, string> = {
        RASCUNHO: 'draft', APROVADO: 'approved',
        REGISTRADO: 'registered', ARQUIVADO: 'archived',
        draft: 'draft', approved: 'approved',
        registered: 'registered', archived: 'archived',
    };
    return map[status] ?? 'draft';
}

export const StatuteView: React.FC = () => {
    const { id, docId } = useParams<{ id: string; docId: string }>();
    const navigate = useNavigate();
    const { activeCompany } = useCompany();
    const companyId = activeCompany?.id ?? id ?? '';

    const [loading, setLoading] = useState(true);
    const [statute, setStatute] = useState<StatuteWithMeta | null>(null);
    const [expandedChapters, setExpandedChapters] = useState<number[]>([1]);

    useEffect(() => {
        if (!docId) { setLoading(false); return; }
        const load = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/documents/${docId}`);
                const companyName = activeCompany?.legalName || activeCompany?.tradeName || 'Empresa';
                setStatute(documentToStatute(data, companyName));
            } catch (error) {
                console.error('Erro ao carregar estatuto:', error);
                setStatute(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [docId, activeCompany?.id]);

    const toggleChapter = (n: number) =>
        setExpandedChapters(prev =>
            prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
        );

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Rascunho' },
            approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aprovado' },
            registered: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Registrado' },
            archived: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Arquivado' },
        };
        return badges[status] ?? badges.draft;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (!statute) {
        return (
            <div className="max-w-4xl mx-auto p-6 text-center">
                <FiFileText size={48} className="mx-auto text-gray-300 mb-3" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Documento não encontrado</h2>
                <p className="text-gray-500 mb-6">Não foi possível carregar o estatuto solicitado.</p>
                <button
                    onClick={() => navigate(`/app/companies/corporate/statute/${companyId}`)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Voltar à lista
                </button>
            </div>
        );
    }

    const statusBadge = getStatusBadge(statute.status);
    const isStructured = statute.chapters.length > 0;

    return (
        <div className="max-w-5xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/app/companies/corporate/statute/${companyId}`)}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Voltar"
                    >
                        <FiArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Estatuto Social</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {statute.companyName} • Versão {statute.version}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate(`/app/companies/corporate/statute/${companyId}/history/${statute.id}`)}
                        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        <FiClock size={18} />
                        <span className="hidden sm:inline text-sm">Histórico</span>
                    </button>
                    <button onClick={() => window.print()} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Imprimir">
                        <FiPrinter size={18} />
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Compartilhar">
                        <FiShare2 size={18} />
                    </button>
                    <button
                        onClick={() => navigate(`/app/companies/corporate/statute/${companyId}/edit/${statute.id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <FiEdit2 size={18} />
                        Alterar
                    </button>
                </div>
            </div>

            {/* Card de Informações */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</p>
                        <span className={`inline-block px-3 py-1 text-sm rounded-full ${statusBadge.bg} ${statusBadge.text}`}>
                            {statusBadge.label}
                        </span>
                    </div>
                    <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Data de Aprovação</p>
                        <p className="text-gray-800">
                            {statute.approvalDate
                                ? new Date(statute.approvalDate).toLocaleDateString('pt-BR')
                                : '—'}
                        </p>
                    </div>
                    {statute.registrationNumber && (
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Nº Registro</p>
                            <p className="text-gray-800">{statute.registrationNumber}</p>
                        </div>
                    )}
                    {statute.notaryOffice && (
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Cartório</p>
                            <p className="text-gray-800">{statute.notaryOffice}</p>
                        </div>
                    )}
                </div>

                {/* Nota de alteração — linha separada, só aparece se existir */}
                {statute.changeNote && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2">
                        <FiMessageSquare size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Nota da última alteração</p>
                            <p className="text-sm text-gray-600 italic">"{statute.changeNote}"</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Conteúdo */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        {isStructured
                            ? <><FiBook className="text-blue-600" /> Capítulos</>
                            : <><FiAlignLeft className="text-blue-600" /> Conteúdo do Estatuto</>
                        }
                    </h2>
                    {isStructured && (
                        <span className="text-sm text-gray-500">
                            {statute.chapters.reduce((acc, c) => acc + c.articles.length, 0)} artigos
                        </span>
                    )}
                </div>

                <div className="p-6">
                    {/* Texto puro */}
                    {!isStructured && (
                        statute.rawContent ? (
                            <textarea
                                readOnly
                                value={statute.rawContent}
                                className="w-full h-[520px] px-4 py-3 text-sm text-gray-700 leading-relaxed
                                           font-mono border border-gray-200 rounded-lg bg-gray-50
                                           resize-none focus:outline-none overflow-y-auto"
                            />
                        ) : (
                            <p className="text-gray-400 text-center py-12">
                                Nenhum conteúdo disponível para este estatuto.
                            </p>
                        )
                    )}

                    {/* JSON estruturado */}
                    {isStructured && (
                        <div className="space-y-4">
                            {statute.chapters.map((chapter) => (
                                <div key={chapter.number} className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div
                                        className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => toggleChapter(chapter.number)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-mono text-gray-500">Capítulo {chapter.number}</span>
                                            <h3 className="font-semibold text-gray-800">{chapter.title}</h3>
                                        </div>
                                        <button className="text-gray-400 hover:text-gray-600">
                                            {expandedChapters.includes(chapter.number)
                                                ? <FiChevronDown size={20} />
                                                : <FiChevronRight size={20} />}
                                        </button>
                                    </div>
                                    {expandedChapters.includes(chapter.number) && (
                                        <div className="p-4 bg-white space-y-3">
                                            {chapter.articles.map((article) => (
                                                <StatuteArticle
                                                    key={article.id}
                                                    article={article}
                                                    chapterNumber={chapter.number}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Rodapé */}
            <div className="mt-6 text-sm text-gray-400 flex items-center justify-between">
                <span>Última atualização: {new Date(statute.updatedAt).toLocaleString('pt-BR')}</span>
                {statute.fileUrl && (
                    <button
                        onClick={() => window.open(statute.fileUrl)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                    >
                        <FiDownload size={16} />
                        Baixar PDF
                    </button>
                )}
            </div>
        </div>
    );
};