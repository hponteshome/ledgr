// src/pages/documents/DocumentView.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiArrowLeft, FiDownload, FiEdit2, FiFile,
    FiCalendar, FiUser, FiBriefcase, FiTag,
    FiClock, FiCheckCircle, FiXCircle, FiAlertCircle,
    FiPrinter, FiShare2
} from 'react-icons/fi';
import api from '@/services/api';

export const DocumentView: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [document, setDocument] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadDocument();
    }, [id]);

    const loadDocument = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/documents/${id}`);
            setDocument(response.data);
        } catch (error: any) {
            console.error('Erro ao carregar documento:', error);
            setError(error.response?.data?.message || 'Erro ao carregar documento');
        } finally {
            setLoading(false);
        }
    };

    const getStatusConfig = (status: string) => {
        const statusMap: Record<string, { bg: string; text: string; label: string; icon: any }> = {
            draft: {
                bg: 'bg-gray-100',
                text: 'text-gray-700',
                label: 'Rascunho',
                icon: FiClock
            },
            signed: {
                bg: 'bg-green-100',
                text: 'text-green-700',
                label: 'Assinado',
                icon: FiCheckCircle
            },
            registered: {
                bg: 'bg-blue-100',
                text: 'text-blue-700',
                label: 'Registrado',
                icon: FiCheckCircle
            },
            archived: {
                bg: 'bg-yellow-100',
                text: 'text-yellow-700',
                label: 'Arquivado',
                icon: FiAlertCircle
            }
        };
        return statusMap[status] || statusMap.draft;
    };

    const getTypeInfo = (type: string) => {
        const typeMap: Record<string, { label: string; color: string }> = {
            ATA: { label: 'Ata', color: 'bg-purple-100 text-purple-700' },
            CONTRATO: { label: 'Contrato', color: 'bg-blue-100 text-blue-700' },
            ALTERACAO: { label: 'Alteração', color: 'bg-yellow-100 text-yellow-700' },
            ASSEMBLEIA: { label: 'Assembleia', color: 'bg-green-100 text-green-700' },
            FISCAL: { label: 'Fiscal', color: 'bg-red-100 text-red-700' },
            TRABALHISTA: { label: 'Trabalhista', color: 'bg-orange-100 text-orange-700' },
            CONTABIL: { label: 'Contábil', color: 'bg-indigo-100 text-indigo-700' },
            OUTRO: { label: 'Outro', color: 'bg-gray-100 text-gray-700' }
        };
        return typeMap[type] || typeMap.OUTRO;
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatDateTime = (date: string) => {
        return new Date(date).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (error || !document) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <p className="font-bold">Erro ao carregar documento</p>
                    <p className="text-sm mt-1">{error || 'Documento não encontrado'}</p>
                    <button
                        onClick={() => navigate('/app/documents')}
                        className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        Voltar para lista
                    </button>
                </div>
            </div>
        );
    }

    const status = getStatusConfig(document.status);
    const StatusIcon = status.icon;
    const typeInfo = getTypeInfo(document.type);

    return (
        <div className="max-w-5xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/app/documents')}
                        className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Voltar"
                    >
                        <FiArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Detalhes do Documento</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Visualize todas as informações do documento
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate(`/app/documents/edit/${id}`)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <FiEdit2 size={16} />
                        Editar
                    </button>
                    {document.fileUrl && (
                        <>
                            <button
                                onClick={() => window.open(document.fileUrl, '_blank')}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <FiDownload size={16} />
                                Download
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Imprimir"
                            >
                                <FiPrinter size={18} />
                            </button>
                            <button
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="Compartilhar"
                            >
                                <FiShare2 size={18} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="grid grid-cols-3 gap-6">
                {/* Coluna Principal - 2/3 */}
                <div className="col-span-2 space-y-6">
                    {/* Card de Informações Básicas */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-800">Informações do Documento</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Descrição</label>
                                <p className="text-gray-800">{document.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Tipo</label>
                                    <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${typeInfo.color}`}>
                                        {typeInfo.label}
                                    </span>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Status</label>
                                    <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.text}`}>
                                        <StatusIcon size={12} />
                                        {status.label}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Data do Documento</label>
                                    <p className="text-gray-800">{formatDate(document.date)}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Data de Criação</label>
                                    <p className="text-gray-800">{formatDateTime(document.createdAt)}</p>
                                </div>
                            </div>

                            {document.notes && (
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Observações</label>
                                    <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{document.notes}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card de Livro Societário (se aplicável) */}
                    {['ATA', 'CONTRATO', 'ALTERACAO', 'ASSEMBLEIA'].includes(document.type) && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                                <h2 className="text-lg font-semibold text-gray-800">Livro Societário</h2>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Número do Livro</label>
                                        <p className="text-gray-800 font-medium">{document.bookNumber || '—'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Número de Registro</label>
                                        <p className="text-gray-800 font-medium">{document.registrationNumber || '—'}</p>
                                    </div>
                                    {document.registrationDate && (
                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-400 uppercase mb-1">Data de Registro</label>
                                            <p className="text-gray-800">{formatDate(document.registrationDate)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Coluna Lateral - 1/3 */}
                <div className="space-y-6">
                    {/* Card da Empresa */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-800">Empresa</h2>
                        </div>
                        <div className="p-6">
                            {document.company ? (
                                <div>
                                    <p className="font-semibold text-gray-800">{document.company.legalName}</p>
                                    <p className="text-sm text-gray-500 mt-1">{document.company.taxId}</p>
                                    <button
                                        onClick={() => navigate(`/app/companies/show/${document.company.id}`)}
                                        className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        Ver detalhes da empresa →
                                    </button>
                                </div>
                            ) : (
                                <p className="text-gray-400">Empresa não informada</p>
                            )}
                        </div>
                    </div>

                    {/* Card de Metadados */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-800">Metadados</h2>
                        </div>
                        <div className="p-6 space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Criado por</label>
                                <p className="text-sm text-gray-800 mt-1">
                                    {document.createdBy?.fullName || 'Sistema'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">ID do Documento</label>
                                <p className="text-xs font-mono text-gray-500 mt-1 break-all">{document.id}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-400 uppercase">Última atualização</label>
                                <p className="text-sm text-gray-800 mt-1">{formatDateTime(document.updatedAt)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Card de Ações Rápidas */}
                    {document.fileUrl && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                                <h2 className="text-lg font-semibold text-gray-800">Ações</h2>
                            </div>
                            <div className="p-4 space-y-2">
                                <button
                                    onClick={() => window.open(document.fileUrl, '_blank')}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    <FiFile size={16} />
                                    Visualizar Arquivo
                                </button>
                                <button
                                    onClick={() => {/* Implementar histórico */ }}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                >
                                    <FiClock size={16} />
                                    Ver Histórico
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};