// src/pages/companies/corporate/atas/age/AgeView.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiArrowLeft, FiEdit2, FiClock, FiPrinter,
    FiShare2, FiAlignLeft, FiMessageSquare, FiDownload,
} from 'react-icons/fi';
import api from '@/services/api';
import { DOC_STYLES, RenderDocument } from '@/components/DocumentStylePicker';
import { useCompany } from '@/contexts/CompanyContext';

interface AgeData {
    id: string;
    title: string;
    status: string;
    content?: string;
    date?: string;
    bookNumber?: string;
    notes?: string;
    currentVersion?: number;
    current_version?: number;
    createdAt: string;
    updatedAt: string;
    fileUrl?: string;
    description?: string;  // guarda styleId
    versions?: { version: number; changeNote?: string; createdAt: string }[];
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    RASCUNHO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Rascunho' },
    EM_REVISAO: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Em Revisão' },
    AGUARDANDO_ASSINATURA: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Ag. Assinatura' },
    ASSINADO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Assinado' },
    REGISTRADO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Registrado' },
    ARQUIVADO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Arquivado' },
};

const DELIB_LABELS: Record<string, string> = {
    transformacao: 'Transformação do tipo societário',
    fusao: 'Fusão de sociedades',
    cisao: 'Cisão (total ou parcial)',
    alteracao_capital: 'Alteração do capital social',
    eleicao_diretores: 'Eleição / posse de diretores',
    aprovacao_contas: 'Aprovação de contas / balanço',
    alteracao_estatuto: 'Alteração do estatuto social',
    outros: 'Outros assuntos',
};

export const AgeView: React.FC = () => {
    const { id, docId } = useParams<{ id: string; docId: string }>();
    const navigate = useNavigate();
    const { activeCompany } = useCompany();
    const companyId = activeCompany?.id ?? id ?? '';

    const [age, setAge] = useState<AgeData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!docId) { setLoading(false); return; }
        api.get(`/documents/${docId}`)
            .then(({ data }) => setAge(data))
            .catch(() => setAge(null))
            .finally(() => setLoading(false));
    }, [docId]);

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
    );

    if (!age) return (
        <div className="max-w-4xl mx-auto p-6 text-center">
            <p className="text-gray-500 mb-4">Documento não encontrado.</p>
            <button
                onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}`)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >Voltar à lista</button>
        </div>
    );

    // Parse campos extras do notes
    let extra: { local?: string; quorum?: string; deliberacoes?: string[] } = {};
    try { extra = JSON.parse(age.notes ?? '{}'); } catch { }

    const version = age.currentVersion ?? age.current_version ?? 1;
    const changeNote = age.versions?.[0]?.changeNote;
    const statusBadge = STATUS_BADGE[age.status] ?? STATUS_BADGE['RASCUNHO'];

    return (
        <div className="max-w-5xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}`)}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    ><FiArrowLeft size={20} /></button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Assembleia Geral Extraordinária</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {activeCompany?.legalName || activeCompany?.tradeName || 'Empresa'} • Versão {version}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}/historico/${docId}`)}
                        className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    ><FiClock size={18} /><span className="hidden sm:inline text-sm">Histórico</span></button>
                    <button onClick={() => window.print()} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Imprimir">
                        <FiPrinter size={18} />
                    </button>
                    <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Compartilhar">
                        <FiShare2 size={18} />
                    </button>
                    <button
                        onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}/editar/${age.id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    ><FiEdit2 size={18} />Alterar</button>
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
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Data da Assembleia</p>
                        <p className="text-gray-800">
                            {age.date ? new Date(age.date).toLocaleDateString('pt-BR') : '—'}
                        </p>
                    </div>
                    {extra.local && (
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Local</p>
                            <p className="text-gray-800">{extra.local}</p>
                        </div>
                    )}
                    {extra.quorum && (
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Quórum</p>
                            <p className="text-gray-800">{extra.quorum}</p>
                        </div>
                    )}
                    {age.bookNumber && (
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Nº Livro/Registro</p>
                            <p className="text-gray-800">{age.bookNumber}</p>
                        </div>
                    )}
                </div>

                {/* Deliberações */}
                {extra.deliberacoes && extra.deliberacoes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Deliberações</p>
                        <div className="flex flex-wrap gap-2">
                            {extra.deliberacoes.map(d => (
                                <span key={d} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                                    {DELIB_LABELS[d] ?? d}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Nota de alteração */}
                {changeNote && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-start gap-2">
                        <FiMessageSquare size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Nota da última alteração</p>
                            <p className="text-sm text-gray-600 italic">"{changeNote}"</p>
                        </div>
                    </div>
                )}
            </div>


            {/* Badge do estilo */}
            {age.description && age.description !== 'minimalista' && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Estilo:</p>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                        {DOC_STYLES.find(s => s.id === age.description)?.name ?? age.description}
                    </span>
                </div>
            )}

            {/* Texto da Ata */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                    <FiAlignLeft className="text-blue-600" />
                    <h2 className="text-base font-semibold text-gray-800">Texto da Ata</h2>
                </div>
                <div className="p-6">
                    {age.content ? (
                        <div className="w-full min-h-[520px] border border-gray-200 rounded-lg overflow-y-auto">
                            <RenderDocument
                                style={DOC_STYLES.find(s => s.id === (age.description ?? 'minimalista')) ?? DOC_STYLES[0]}
                                content={age.content}
                                companyName={activeCompany?.legalName || activeCompany?.tradeName || 'Empresa'}
                                docTitle={age.title}
                                cnpj={activeCompany?.cnpj}
                                registerInfo={
                                    (activeCompany as any)?.registerOrg
                                        ? ((activeCompany as any).registerOrg.toLowerCase().includes('jucesp')
                                            ? `NIRE: ${(activeCompany as any).registerNumber ?? ''}`
                                            : `${(activeCompany as any).registerOrg}${(activeCompany as any).registerNumber ? ` nº ${(activeCompany as any).registerNumber}` : ''}`)
                                        : ((activeCompany as any)?.nire ? `NIRE: ${(activeCompany as any).nire}` : undefined)
                                }
                            />
                        </div>
                    ) : (
                        <p className="text-gray-400 text-center py-12">Nenhum conteúdo disponível.</p>
                    )}
                </div>
            </div>

            {/* Rodapé */}
            <div className="mt-6 text-sm text-gray-400 flex items-center justify-between">
                <span>Última atualização: {new Date(age.updatedAt).toLocaleString('pt-BR')}</span>
                {age.fileUrl && (
                    <button
                        onClick={() => window.open(age.fileUrl)}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
                    ><FiDownload size={16} />Baixar PDF</button>
                )}
            </div>
        </div>
    );
};