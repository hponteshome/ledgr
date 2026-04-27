import React, { useState, useEffect } from 'react';
import {
    FiBook, FiPlus, FiDownload, FiEye, FiEdit2,
    FiTrash2, FiFileText, FiCheckCircle, FiClock,
    FiAlertCircle, FiSearch
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import api from '../../services/api';

interface CorporateBook {
    id: string;
    companyId: string;
    companyName: string;
    type: 'ATA' | 'CONTRATO' | 'ALTERACAO' | 'ASSEMBLEIA' | 'OUTRO';
    bookNumber: number;
    description: string;
    date: string;
    status: 'draft' | 'signed' | 'registered' | 'archived';
    fileUrl?: string;
    fileSize?: number;
    digitalSignature?: string;
    registrationNumber?: string;
    registrationDate?: string;
    createdAt: string;
    updatedAt: string;
}

export const CorporateBooks: React.FC = () => {
    const navigate = useNavigate();
    const { activeCompany } = useCompany();
    const [books, setBooks] = useState<CorporateBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        loadBooks();
    }, [activeCompany]);

    const loadBooks = async () => {
        try {
            setLoading(true);
            // TODO: Ajustar endpoint conforme sua API
            const response = await api.get(`/corporate-books?companyId=${activeCompany?.id}`);
            setBooks(response.data);
        } catch (error) {
            console.error('Erro ao carregar livros societários:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const statusMap = {
            draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Rascunho' },
            signed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Assinado' },
            registered: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Registrado' },
            archived: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Arquivado' }
        };
        return statusMap[status as keyof typeof statusMap] || statusMap.draft;
    };

    const getTypeBadge = (type: string) => {
        const typeMap = {
            ATA: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Ata' },
            CONTRATO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Contrato' },
            ALTERACAO: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Alteração' },
            ASSEMBLEIA: { bg: 'bg-green-100', text: 'text-green-700', label: 'Assembleia' },
            OUTRO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Outro' }
        };
        return typeMap[type as keyof typeof typeMap] || typeMap.OUTRO;
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const filteredBooks = books.filter(book => {
        const matchesSearch = book.description.toLowerCase().includes(search.toLowerCase()) ||
            book.companyName.toLowerCase().includes(search.toLowerCase());
        const matchesType = filterType === 'all' || book.type === filterType;
        const matchesStatus = filterStatus === 'all' || book.status === filterStatus;
        return matchesSearch && matchesType && matchesStatus;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Livros Societários</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gerencie atas, contratos e documentos societários
                    </p>
                </div>
                <button
                    onClick={() => navigate('/app/documents/corporate-books/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <FiPlus size={18} />
                    Novo Livro
                </button>
            </div>

            {/* Filtros e Busca */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por descrição ou empresa..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos os tipos</option>
                        <option value="ATA">Atas</option>
                        <option value="CONTRATO">Contratos</option>
                        <option value="ALTERACAO">Alterações</option>
                        <option value="ASSEMBLEIA">Assembleias</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos os status</option>
                        <option value="draft">Rascunho</option>
                        <option value="signed">Assinado</option>
                        <option value="registered">Registrado</option>
                        <option value="archived">Arquivado</option>
                    </select>

                    <button
                        onClick={loadBooks}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Lista de Livros */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Nº</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Descrição</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Empresa</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Arquivo</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredBooks.length > 0 ? (
                                filteredBooks.map((book) => {
                                    const status = getStatusBadge(book.status);
                                    const type = getTypeBadge(book.type);
                                    return (
                                        <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${type.bg} ${type.text}`}>
                                                    {type.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-600">
                                                #{book.bookNumber}
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-gray-800">{book.description}</p>
                                                {book.registrationNumber && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Reg: {book.registrationNumber}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {book.companyName}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {new Date(book.date).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.text}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {book.fileUrl ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <FiFileText size={14} className="text-blue-600" />
                                                        <span className="text-xs text-gray-500">
                                                            {formatFileSize(book.fileSize)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    {book.fileUrl && (
                                                        <button
                                                            onClick={() => window.open(book.fileUrl)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                            title="Visualizar"
                                                        >
                                                            <FiEye size={16} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => navigate(`/app/documents/corporate-books/edit/${book.id}`)}
                                                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg"
                                                        title="Editar"
                                                    >
                                                        <FiEdit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => {/* Implementar download */ }}
                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                                        title="Download"
                                                    >
                                                        <FiDownload size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        <FiBook size={48} className="mx-auto mb-3 text-gray-300" />
                                        <p>Nenhum livro societário encontrado</p>
                                        <button
                                            onClick={() => navigate('/app/documents/corporate-books/new')}
                                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                        >
                                            Criar primeiro livro
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};