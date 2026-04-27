// src/pages/documents/signatures/CertificateManager.tsx
import React, { useState, useEffect } from 'react';
import {
    FiAward, FiPlus, FiTrash2, FiRefreshCw,
    FiAlertCircle, FiCheckCircle, FiClock,
    FiShield, FiUser, FiBriefcase, FiFile,
    FiDownload, FiEye, FiX, FiUpload
} from 'react-icons/fi';

interface Certificate {
    id: string;
    type: 'A1' | 'A3';
    holderType: 'PF' | 'PJ';
    holderName: string;
    holderDocument: string;
    issuer: string;
    issuedAt: string;
    validUntil: string;
    status: 'valid' | 'expiring' | 'expired' | 'revoked';
    serialNumber: string;
    storageType: 'file' | 'token' | 'cloud';
    lastUsed?: string;
    companyId?: string;
}

export const CertificateManager: React.FC = () => {
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    useEffect(() => {
        loadCertificates();
    }, []);

    const loadCertificates = async () => {
        try {
            setLoading(true);
            // Simulação - substituir pela chamada real da API
            setTimeout(() => {
                setCertificates(mockCertificates);
                setLoading(false);
            }, 1000);
        } catch (error) {
            console.error('Erro ao carregar certificados:', error);
            setLoading(false);
        }
    };

    // Dados mockados para exemplo
    const mockCertificates: Certificate[] = [
        {
            id: '1',
            type: 'A3',
            holderType: 'PJ',
            holderName: 'HALLO ADMINISTRACAO E PARTICIPACOES LTDA',
            holderDocument: '07.432.458/0001-69',
            issuer: 'Certisign',
            issuedAt: '2025-01-15',
            validUntil: '2026-01-14',
            status: 'valid',
            serialNumber: 'ABC123XYZ789',
            storageType: 'token',
            lastUsed: '2026-03-08T14:30:00',
            companyId: '1'
        },
        {
            id: '2',
            type: 'A1',
            holderType: 'PF',
            holderName: 'HELENILTO AURELIANO PONTES',
            holderDocument: '123.456.789-00',
            issuer: 'SERPRO',
            issuedAt: '2025-06-20',
            validUntil: '2026-06-19',
            status: 'valid',
            serialNumber: 'DEF456UVW123',
            storageType: 'file',
            lastUsed: '2026-03-07T09:15:00'
        }
    ];

    const getStatusInfo = (status: string, validUntil: string) => {
        const daysUntil = Math.ceil((new Date(validUntil).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

        if (status === 'revoked') {
            return {
                bg: 'bg-red-100',
                text: 'text-red-700',
                icon: FiAlertCircle,
                label: 'Revogado'
            };
        }
        if (daysUntil < 0) {
            return {
                bg: 'bg-gray-100',
                text: 'text-gray-700',
                icon: FiClock,
                label: 'Expirado'
            };
        }
        if (daysUntil < 30) {
            return {
                bg: 'bg-yellow-100',
                text: 'text-yellow-700',
                icon: FiAlertCircle,
                label: `Vence em ${daysUntil} dias`
            };
        }
        return {
            bg: 'bg-green-100',
            text: 'text-green-700',
            icon: FiCheckCircle,
            label: 'Válido'
        };
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('pt-BR');
    };

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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Certificados Digitais</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gerencie certificados ICP-Brasil (A1/A3) para assinaturas digitais
                    </p>
                </div>
                <button
                    onClick={() => setShowInstallModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <FiPlus size={18} />
                    Instalar Certificado
                </button>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Total</p>
                            <p className="text-2xl font-bold text-gray-800">{certificates.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                            <FiAward size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Válidos</p>
                            <p className="text-2xl font-bold text-gray-800">
                                {certificates.filter(c => c.status === 'valid').length}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                            <FiCheckCircle size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">A vencer (30 dias)</p>
                            <p className="text-2xl font-bold text-gray-800">
                                {certificates.filter(c => c.status === 'expiring').length}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center text-yellow-600">
                            <FiAlertCircle size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Expirados</p>
                            <p className="text-2xl font-bold text-gray-800">
                                {certificates.filter(c => c.status === 'expired').length}
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                            <FiClock size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de Certificados */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-800">Certificados Instalados</h2>
                </div>

                <div className="divide-y divide-gray-200">
                    {certificates.map((cert) => {
                        const status = getStatusInfo(cert.status, cert.validUntil);
                        const StatusIcon = status.icon;

                        return (
                            <div key={cert.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cert.type === 'A3' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                                                }`}>
                                                {cert.type === 'A3' ? <FiShield size={20} /> : <FiAward size={20} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-gray-800">{cert.holderName}</h3>
                                                    <span className={`px-2 py-0.5 text-xs rounded-full ${cert.type === 'A3' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {cert.type}
                                                    </span>
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${status.bg} ${status.text}`}>
                                                        <StatusIcon size={10} />
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {cert.holderDocument} • Emitido por: {cert.issuer}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                                            <div>
                                                <p className="text-xs text-gray-400">Série</p>
                                                <p className="font-mono text-gray-600">{cert.serialNumber}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">Emitido em</p>
                                                <p className="text-gray-600">{formatDate(cert.issuedAt)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">Válido até</p>
                                                <p className="text-gray-600">{formatDate(cert.validUntil)}</p>
                                            </div>
                                        </div>

                                        {cert.lastUsed && (
                                            <p className="text-xs text-gray-400 mt-2">
                                                Último uso: {new Date(cert.lastUsed).toLocaleString()}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => setSelectedCertificate(cert)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                            title="Detalhes"
                                        >
                                            <FiEye size={18} />
                                        </button>
                                        <button
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                            title="Revogar"
                                        >
                                            <FiTrash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};