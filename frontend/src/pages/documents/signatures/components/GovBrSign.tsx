// src/pages/documents/signatures/GovBrSign.tsx
import React, { useState } from 'react';
import { FiShield, FiCheckCircle, FiAlertCircle, FiExternalLink } from 'react-icons/fi';

interface GovBrSignProps {
    documentId: string;
    onSuccess: () => void;
    onError: (error: string) => void;
}

export const GovBrSign: React.FC<GovBrSignProps> = ({ documentId, onSuccess, onError }) => {
    const [loading, setLoading] = useState(false);
    const [accountLevel, setAccountLevel] = useState<'bronze' | 'prata' | 'ouro' | null>(null);
    const [showInfo, setShowInfo] = useState(false);

    const verifyAccountLevel = async () => {
        // Simulação - substituir pela chamada real à API do Gov.br
        return new Promise<'bronze' | 'prata' | 'ouro'>((resolve) => {
            setTimeout(() => resolve('ouro'), 1000);
        });
    };

    const handleGovBrSign = async () => {
        setLoading(true);

        try {
            const level = await verifyAccountLevel();
            setAccountLevel(level);

            if (level !== 'prata' && level !== 'ouro') {
                onError('É necessário conta Gov.br nível Prata ou Ouro para assinar documentos com validade jurídica');
                return;
            }

            // Simular redirecionamento para o Gov.br
            const govBrUrl = `https://acesso.gov.br/assinatura?document=${documentId}`;
            window.open(govBrUrl, '_blank');

            // Simular retorno bem-sucedido
            setTimeout(() => {
                onSuccess();
            }, 3000);

        } catch (error) {
            onError('Erro ao iniciar assinatura com Gov.br');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        <FiShield size={24} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">Assinar com Gov.br</h3>
                        <p className="text-sm text-gray-500">
                            Utilize sua conta gov.br (nível Prata ou Ouro) para assinar com validade jurídica
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700">Níveis de conta exigidos:</h4>
                        <button
                            onClick={() => setShowInfo(!showInfo)}
                            className="text-xs text-blue-600 hover:text-blue-700"
                        >
                            {showInfo ? 'Ocultar' : 'Saiba mais'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${accountLevel === 'prata' ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="text-sm text-gray-600">Prata - Validação facial ou bancos conveniados</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${accountLevel === 'ouro' ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="text-sm text-gray-600">Ouro - Certificado digital ICP-Brasil</span>
                        </div>
                    </div>

                    {showInfo && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                            <p className="font-medium mb-1">Como obter nível Prata ou Ouro:</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Prata: Validação facial pelo aplicativo Gov.br ou credenciamento em bancos</li>
                                <li>Ouro: Certificado digital ICP-Brasil (A1 ou A3) emitido por autoridades certificadoras</li>
                            </ul>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleGovBrSign}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 transition-colors"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            Redirecionando para Gov.br...
                        </>
                    ) : (
                        <>
                            <FiShield size={18} />
                            Assinar com Gov.br
                            <FiExternalLink size={16} className="opacity-70" />
                        </>
                    )}
                </button>

                <p className="text-xs text-gray-400 text-center mt-3">
                    Ao assinar, você declara concordar com os termos e condições, garantindo autenticidade,
                    integridade e não repúdio do documento conforme MP 2.200-2 e Decreto 10.543/2020.
                </p>
            </div>
        </div>
    );
};