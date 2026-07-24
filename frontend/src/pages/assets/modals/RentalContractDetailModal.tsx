// ============================================================
// LEDGR — frontend/src/pages/assets/modals/RentalContractDetailModal.tsx
// Quadro Resumo do Contrato de Locação — visualização rápida (somente leitura)
// ============================================================
import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { ModalWrapper, Field } from './ModalComponents';
import type { FixedAsset } from '../types/asset.types';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

const GUARANTEE_LABELS: Record<string, string> = {
    FIANCA: 'Fiança',
    SEGURO_FIANCA: 'Seguro Fiança',
    CAUCAO: 'Caução',
    OUTROS: 'Outros',
};

const READJUSTMENT_LABELS: Record<string, string> = {
    IGPM: 'IGP-M',
    IPCA: 'IPCA',
    INPC: 'INPC',
    IGPDI: 'IGP-DI',
    OUTRO: 'Outro',
};

const STATUS_LABELS: Record<string, string> = {
    ATIVO: 'Ativo',
    ENCERRADO: 'Encerrado',
    RESCINDIDO: 'Rescindido',
};

const STATUS_COLORS: Record<string, string> = {
    ATIVO: 'bg-green-100 text-green-700',
    ENCERRADO: 'bg-gray-100 text-gray-600',
    RESCINDIDO: 'bg-red-100 text-red-700',
};

function fmtCurrency(v: number | string | undefined): string {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (n === undefined || isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(v: string | undefined): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function RentalContractDetailModal({ asset, onClose }: { asset: FixedAsset; onClose: () => void }) {
    const { token } = useAuth();
    const { activeCompany } = useCompany();
    const [contract, setContract] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const contractId = asset.rentalContracts?.[0]?.id;

    useEffect(() => {
        if (!contractId) { setError('Contrato não encontrado.'); setLoading(false); return; }
        fetch(`${API}/rental-contracts/${contractId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-company-id': activeCompany?.id ?? '',
            },
        })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setContract(data))
            .catch(() => setError('Não foi possível carregar os detalhes do contrato.'))
            .finally(() => setLoading(false));
    }, [contractId, token, activeCompany?.id]);

    return (
        <ModalWrapper title={`Quadro Resumo — ${asset.internalCode}`} onClose={onClose}>
            <div className="p-6 space-y-4">
                {loading && (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader className="w-5 h-5 animate-spin" />
                    </div>
                )}

                {!loading && error && (
                    <div className="text-sm text-red-600 py-6 text-center">{error}</div>
                )}

                {!loading && contract && (
                    <>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-gray-900">{contract.tenantName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[contract.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                {STATUS_LABELS[contract.status] ?? contract.status}
                            </span>
                        </div>

                        {contract.tenantTaxId && (
                            <div className="text-xs text-gray-500">CPF/CNPJ: {contract.tenantTaxId}</div>
                        )}

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                            <Field label="Valor do Aluguel">
                                <div className="text-sm text-gray-900">{fmtCurrency(contract.rentAmount)}</div>
                            </Field>
                            <Field label="Vencimento">
                                <div className="text-sm text-gray-900">Todo dia {contract.dueDay}</div>
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Início do Contrato">
                                <div className="text-sm text-gray-900">{fmtDate(contract.startDate)}</div>
                            </Field>
                            <Field label="Término / Vigência">
                                <div className="text-sm text-gray-900">{contract.endDate ? fmtDate(contract.endDate) : 'Indeterminado'}</div>
                            </Field>
                        </div>

                        {contract.guaranteeType && (
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Garantia">
                                    <div className="text-sm text-gray-900">{GUARANTEE_LABELS[contract.guaranteeType] ?? contract.guaranteeType}</div>
                                </Field>
                                {contract.guaranteeDescription && (
                                    <Field label="Detalhe da Garantia">
                                        <div className="text-sm text-gray-900">{contract.guaranteeDescription}</div>
                                    </Field>
                                )}
                            </div>
                        )}

                        {contract.readjustmentIndex && (
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Índice de Reajuste">
                                    <div className="text-sm text-gray-900">
                                        {READJUSTMENT_LABELS[contract.readjustmentIndex] ?? contract.readjustmentIndex}
                                        {contract.readjustmentIndex === 'OUTRO' && contract.readjustmentIndexOther ? ` (${contract.readjustmentIndexOther})` : ''}
                                    </div>
                                </Field>
                                {contract.readjustmentPeriodMonths && (
                                    <Field label="Periodicidade">
                                        <div className="text-sm text-gray-900">A cada {contract.readjustmentPeriodMonths} meses</div>
                                    </Field>
                                )}
                            </div>
                        )}

                        {contract.contractNumber && (
                            <Field label="Nº do Contrato">
                                <div className="text-sm text-gray-900">{contract.contractNumber}</div>
                            </Field>
                        )}

                        {contract.documentId && (
                            <div className="pt-3 border-t border-gray-100 text-xs text-gray-500">
                                Contrato completo arquivado em Arquivos Digitais.
                            </div>
                        )}
                    </>
                )}
            </div>
        </ModalWrapper>
    );
}