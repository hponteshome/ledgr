// src/pages/documents/DocumentsList.tsx
import React from 'react';
import {
    FiFileText, FiBook, FiUsers, FiBriefcase,
    FiCalendar, FiPieChart, FiShield, FiAward,
    FiArrowRight, FiClock, FiCheckCircle
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

interface DocumentBlock {
    id: string;
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    href: string;
    count?: number;
    badge?: string;
}

export const DocumentsList: React.FC = () => {
    const navigate = useNavigate();

    const documentBlocks: DocumentBlock[] = [
        {
            id: 'corporate-books',
            title: 'Livros Societários',
            description: 'Atas, assembleias, alterações contratuais e documentos societários',
            icon: FiBook,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            href: '/app/documents/corporate-books',
            count: 12,
            badge: 'Última: 05/03'
        },
        {
            id: 'contracts',
            title: 'Contratos',
            description: 'Contratos sociais, aditivos, distratos e acordos de sócios',
            icon: FiFileText,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            href: '/app/documents/contracts',
            count: 8,
            badge: '3 pendentes'
        },
        {
            id: 'financial-docs',
            title: 'Documentos Financeiros',
            description: 'Balanços, DRE, demonstrações contábeis e relatórios fiscais',
            icon: FiPieChart,
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            href: '/app/documents/financial',
            count: 24,
            badge: 'Novo'
        },
        {
            id: 'legal-docs',
            title: 'Documentos Legais',
            description: 'Alvarás, licenças, certidões e documentos de regularidade',
            icon: FiShield,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            href: '/app/documents/legal',
            count: 6,
            badge: '2 vencendo'
        },
        {
            id: 'shareholders',
            title: 'Acionistas e Participações',
            description: 'Registro de acionistas, transferências e participações societárias',
            icon: FiUsers,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
            href: '/app/societario/livros/acionistas',
            count: 5,
            badge: 'Atualizado'
        },
        {
            id: 'statute',
            title: 'Estatuto Social',
            description: 'Estatuto vigente e alterações, consolidações e arquivos históricos',
            icon: FiBriefcase,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            href: '/app/companies/corporate/statute/1',
            count: 1,
            badge: 'Vigente'
        },
        {
            id: 'meetings',
            title: 'Assembleias e Reuniões',
            description: 'Atas de assembleias, reuniões de sócios e deliberações',
            icon: FiCalendar,
            color: 'text-pink-600',
            bgColor: 'bg-pink-50',
            href: '/app/companies/corporate/meetings',
            count: 4,
            badge: 'Próxima: 15/03'
        },
        {
            id: 'signatures',
            title: 'Assinaturas Digitais',
            description: 'Documentos pendentes de assinatura e histórico de assinaturas',
            icon: FiAward,
            color: 'text-cyan-600',
            bgColor: 'bg-cyan-50',
            href: '/app/documents/signatures',
            count: 3,
            badge: 'Aguardando'
        }
    ];

    const recentDocuments = [
        { name: 'Ata de Assembleia - 05/03/2026', type: 'ATA', status: 'Concluído' },
        { name: 'Alteração Contratual - 03/03/2026', type: 'ALTERACAO', status: 'Pendente' },
        { name: 'Balanço Mensal - Fevereiro/2026', type: 'FINANCEIRO', status: 'Concluído' },
    ];

    const getStatusColor = (status: string) => {
        return status === 'Concluído' ? 'text-green-600' : 'text-yellow-600';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Documentos</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gerencie todos os documentos e livros da sua empresa
                    </p>
                </div>
                <button
                    onClick={() => navigate('/app/documents/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <FiFileText size={18} />
                    Novo Documento
                </button>
            </div>

            {/* Cards de Resumo Rápido */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                            <FiBook size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Livros Societários</p>
                            <p className="text-xl font-bold text-gray-800">12</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                            <FiCheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Assinaturas</p>
                            <p className="text-xl font-bold text-gray-800">3</p>
                            <p className="text-xs text-yellow-600">pendentes</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                            <FiFileText size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Contratos</p>
                            <p className="text-xl font-bold text-gray-800">8</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                            <FiClock size={20} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Vencimentos</p>
                            <p className="text-xl font-bold text-gray-800">5</p>
                            <p className="text-xs text-red-600">próximos 30 dias</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid de Blocos de Documentos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {documentBlocks.map((block) => {
                    const Icon = block.icon;
                    return (
                        <div
                            key={block.id}
                            onClick={() => navigate(block.href)}
                            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden"
                        >
                            <div className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`w-12 h-12 ${block.bgColor} rounded-lg flex items-center justify-center ${block.color}`}>
                                        <Icon size={24} />
                                    </div>
                                    {block.badge && (
                                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                                            {block.badge}
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-semibold text-gray-800 mb-1">{block.title}</h3>
                                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{block.description}</p>

                                <div className="flex items-center justify-between mt-2">
                                    {block.count !== undefined && (
                                        <span className="text-sm font-medium text-gray-600">
                                            {block.count} {block.count === 1 ? 'item' : 'itens'}
                                        </span>
                                    )}
                                    <span className="text-blue-600 group-hover:translate-x-1 transition-transform flex items-center gap-1 text-sm font-medium">
                                        Acessar
                                        <FiArrowRight size={16} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Documentos Recentes */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-800">Documentos Recentes</h2>
                    <button className="text-sm text-blue-600 hover:text-blue-700">Ver todos</button>
                </div>

                <div className="divide-y divide-gray-200">
                    {recentDocuments.map((doc, index) => (
                        <div key={index} className="px-6 py-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                                    <FiFileText size={16} />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800">{doc.name}</p>
                                    <p className="text-xs text-gray-400">{doc.type}</p>
                                </div>
                            </div>
                            <span className={`text-sm font-medium ${getStatusColor(doc.status)}`}>
                                {doc.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};