// ============================================================
// LEDGR — frontend/src/pages/assets/modals/RentalContractDetailModal.tsx
// Quadro Resumo do Contrato de Locação — visualização + geração do Contrato Completo
// ============================================================
import { useState, useEffect } from 'react';
import { Loader, FileText, CheckCircle, Edit3, Lock } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { ModalWrapper, Field } from './ModalComponents';
import { DocumentViewModal } from '../../documentos/DocumentViewModal';
import { RentalContractFormModal } from './RentalContractFormModal';

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

const MARITAL_STATUS_OPTIONS = [
    { value: 'SOLTEIRO', label: 'Solteiro(a)' },
    { value: 'CASADO', label: 'Casado(a)' },
    { value: 'UNIAO_ESTAVEL', label: 'União Estável' },
    { value: 'SEPARADO', label: 'Separado(a) Judicialmente' },
    { value: 'DIVORCIADO', label: 'Divorciado(a)' },
    { value: 'VIUVO', label: 'Viúvo(a)' },
];

const DOC_STATUS_LABELS: Record<string, string> = {
    RASCUNHO: 'Rascunho',
    EM_REVISAO: 'Em Revisão',
    AGUARDANDO_ASSINATURA: 'Aguardando Assinatura',
    ASSINADO: 'Assinado',
    REGISTRADO: 'Registrado',
    ARQUIVADO: 'Arquivado',
    CANCELADO: 'Cancelado',
};

type QualField = { key: string; label: string; type: 'text' | 'select' | 'cep'; maxLength?: number };

const QUALIFICATION_FIELDS: QualField[] = [
    { key: 'tenantRg', label: 'RG', type: 'text' },
    { key: 'tenantProfession', label: 'Profissão', type: 'text' },
    { key: 'tenantMaritalStatus', label: 'Estado Civil', type: 'select' },
    { key: 'tenantNationality', label: 'Nacionalidade', type: 'text' },
    { key: 'tenantStreet', label: 'Logradouro', type: 'text' },
    { key: 'tenantNumber', label: 'Número', type: 'text' },
    { key: 'tenantComplement', label: 'Complemento', type: 'text' },
    { key: 'tenantNeighborhood', label: 'Bairro', type: 'text' },
    { key: 'tenantCity', label: 'Cidade', type: 'text' },
    { key: 'tenantState', label: 'UF', type: 'text', maxLength: 2 },
    { key: 'tenantZipCode', label: 'CEP', type: 'cep' },
];

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

function daysInMonth(year: number, month1to12: number): number {
    return new Date(year, month1to12, 0).getDate();
}

// Prazo de vigencia por extenso (anos/meses/dias), contagem INCLUSIVA -
// um contrato configurado como '12 meses' (que grava endDate = inicio + 12
// meses - 1 dia, convencao ja validada) deve aparecer aqui como '1 ano', nao
// '11 meses e 30 dias' - por isso soma-se 1 dia ao endDate antes do calculo.
function formatVigencia(startStr: string | undefined, endStr: string | undefined | null): string {
    if (!startStr || !endStr) return 'Indeterminado';
    const [y1, m1, d1] = startStr.slice(0, 10).split('-').map(Number);
    let [y2, m2, d2] = endStr.slice(0, 10).split('-').map(Number);
    if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return '—';

    d2 += 1;
    if (d2 > daysInMonth(y2, m2)) {
        d2 = 1;
        m2 += 1;
        if (m2 > 12) { m2 = 1; y2 += 1; }
    }

    let years = y2 - y1;
    let months = m2 - m1;
    let days = d2 - d1;

    if (days < 0) {
        months -= 1;
        const prevMonth = m2 - 1 <= 0 ? 12 : m2 - 1;
        const prevMonthYear = m2 - 1 <= 0 ? y2 - 1 : y2;
        days += daysInMonth(prevMonthYear, prevMonth);
    }
    if (months < 0) {
        years -= 1;
        months += 12;
    }

    const totalMonths = years * 12 + months;
    const parts: string[] = [];
    if (totalMonths > 0) parts.push(`${totalMonths} ${totalMonths === 1 ? 'mês' : 'meses'}`);
    if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
    if (parts.length === 0) return '0 dias';
    if (parts.length === 1) return parts[0];
    return parts.join(' e ');
}

function formatCpfCnpj(value: string | undefined | null): string {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length === 11) {
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 14) {
        return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
    }
    return value;
}

function onlyDigits(v: string): string {
    return v.replace(/\D/g, '');
}

function fmtCepMask(v: string): string {
    const d = onlyDigits(v).slice(0, 8);
    if (d.length <= 5) return d;
    return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function RentalContractDetailModal({ contractId, title, onClose }: { contractId?: string; title: string; onClose: () => void }) {
    const { token } = useAuth();
    const { activeCompany } = useCompany();
    const [contract, setContract] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [qualifying, setQualifying] = useState(false);
    const [editingContract, setEditingContract] = useState(false);
    const [formValues, setFormValues] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [genError, setGenError] = useState('');
    const [genSuccess, setGenSuccess] = useState(false);
    const [viewDoc, setViewDoc] = useState(false);

    function loadContract() {
        if (!contractId) { setError('Contrato não encontrado.'); setLoading(false); return; }
        setLoading(true);
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
    }

    useEffect(() => {
        loadContract();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contractId, token, activeCompany?.id]);

    function missingQualificationFields(): QualField[] {
        if (!contract) return [];
        return QUALIFICATION_FIELDS.filter(f => !contract[f.key]);
    }

    async function handleGenerate() {
        setSaving(true);
        setGenError('');
        try {
            const res = await fetch(`${API}/rental-contracts/${contractId}/generate-document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-company-id': activeCompany?.id ?? '',
                },
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => null);
                throw new Error(errBody?.message ?? '');
            }
            await res.json();
            setGenSuccess(true);
            setQualifying(false);
            loadContract();
        } catch (e: any) {
            setGenError(e?.message || 'Não foi possível gerar o contrato. Verifique os dados e tente novamente.');
        } finally {
            setSaving(false);
        }
    }

    async function handleStartGenerate() {
        setGenError('');
        if (contract.documentId) {
            const docStatus = contract.document?.status;
            if (docStatus && docStatus !== 'RASCUNHO') {
                setGenError(
                    `Este contrato já possui um documento ${DOC_STATUS_LABELS[docStatus] ?? docStatus}. ` +
                    'Não é possível gerar novamente. Para reiniciar, exclua o documento em Arquivos Digitais primeiro.'
                );
                return;
            }
            const initial: Record<string, string> = {};
            QUALIFICATION_FIELDS.forEach(f => { initial[f.key] = contract[f.key] ?? ''; });
            setFormValues(initial);
            setQualifying(true);
            return;
        }
        const missing = missingQualificationFields();
        if (missing.length === 0) {
            await handleGenerate();
            return;
        }
        const initial: Record<string, string> = {};
        missing.forEach(f => { initial[f.key] = ''; });
        setFormValues(initial);
        setQualifying(true);
    }

    function handleClearAll() {
        const cleared: Record<string, string> = {};
        Object.keys(formValues).forEach(k => { cleared[k] = ''; });
        setFormValues(cleared);
    }

    async function handleSaveAndGenerate() {
        setSaving(true);
        setGenError('');
        try {
            const payload: Record<string, string> = {};
            Object.entries(formValues).forEach(([k, v]) => {
                payload[k] = k === 'tenantZipCode' ? onlyDigits(v) : v;
            });
            const patchRes = await fetch(`${API}/rental-contracts/${contractId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-company-id': activeCompany?.id ?? '',
                },
                body: JSON.stringify(payload),
            });
            if (!patchRes.ok) throw new Error();
            await handleGenerate();
        } catch {
            setGenError('Não foi possível salvar a qualificação do locatário. Verifique os campos e tente novamente.');
            setSaving(false);
        }
    }

    return (
        <>
        <ModalWrapper title={title} onClose={onClose}>
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
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[contract.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {STATUS_LABELS[contract.status] ?? contract.status}
                                </span>
                                {(!contract.document?.status || contract.document.status === 'RASCUNHO') ? (
                                    <button
                                        type="button"
                                        title="Editar Contrato"
                                        onClick={() => setEditingContract(true)}
                                        className="p-1 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <span
                                        title={`Documento já ${DOC_STATUS_LABELS[contract.document.status] ?? contract.document.status} — não é possível editar o contrato. Exclua o documento em Arquivos Digitais para reiniciar.`}
                                        className="p-1 text-gray-300 cursor-not-allowed"
                                    >
                                        <Lock className="w-4 h-4" />
                                    </span>
                                )}
                            </div>
                        </div>

                        {contract.tenantTaxId && (
                            <div className="text-xs text-gray-500">CPF/CNPJ: {formatCpfCnpj(contract.tenantTaxId)}</div>
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

                        <Field label="Prazo de Vigência">
                            <div className="text-sm text-gray-900">{formatVigencia(contract.startDate, contract.endDate)}</div>
                        </Field>

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

                        <div className="pt-3 border-t border-gray-100 space-y-3">
                            {contract.documentId && !qualifying && (
                                <div className="flex items-center justify-between gap-2 text-xs text-green-700 bg-green-50 rounded-md px-3 py-2">
                                    <span className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                        Contrato completo já gerado e arquivado em Arquivos Digitais.
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setViewDoc(true)}
                                        className="text-green-800 font-medium underline hover:text-green-900 whitespace-nowrap"
                                    >
                                        Ver contrato
                                    </button>
                                </div>
                            )}

                            {genSuccess && !contract.documentId && (
                                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-md px-3 py-2">
                                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                    Contrato gerado com sucesso.
                                </div>
                            )}

                            {genError && (
                                <div className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{genError}</div>
                            )}

                            {!qualifying && (
                                <button
                                    type="button"
                                    onClick={handleStartGenerate}
                                    disabled={saving}
                                    className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors"
                                >
                                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    {contract.documentId ? 'Gerar Contrato Novamente' : 'Gerar Contrato Completo'}
                                </button>
                            )}

                            {qualifying && (
                                <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="text-xs text-gray-600">
                                            {contract.documentId
                                                ? 'Revise os dados do locatário antes de gerar o contrato novamente:'
                                                : 'Para gerar o contrato completo, preencha os dados do locatário que ainda faltam:'}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearAll}
                                            className="text-[11px] text-gray-400 hover:text-red-600 underline whitespace-nowrap"
                                        >
                                            Limpar Tudo
                                        </button>
                                    </div>

                                    {QUALIFICATION_FIELDS.filter(f => f.key in formValues).map(f => (
                                        <div key={f.key}>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
                                            {f.type === 'select' ? (
                                                <select
                                                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                                    value={formValues[f.key] ?? ''}
                                                    onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                >
                                                    <option value="">Selecione...</option>
                                                    {MARITAL_STATUS_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    maxLength={f.maxLength}
                                                    className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                                                    value={f.type === 'cep' ? fmtCepMask(formValues[f.key] ?? '') : (formValues[f.key] ?? '')}
                                                    onChange={e => setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                />
                                            )}
                                        </div>
                                    ))}

                                    <div className="flex gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setQualifying(false)}
                                            disabled={saving}
                                            className="flex-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSaveAndGenerate}
                                            disabled={saving}
                                            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 rounded-lg px-4 py-2 transition-colors"
                                        >
                                            {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
                                            Salvar e Gerar Contrato
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </ModalWrapper>
        {editingContract && (
            <RentalContractFormModal
                asset={contract.fixedAsset}
                contractId={contractId}
                documentStatus={contract.document?.status ?? null}
                onClose={() => setEditingContract(false)}
                onSuccess={() => { setEditingContract(false); loadContract(); }}
            />
        )}
        {viewDoc && contract.documentId && (
            <DocumentViewModal
                documentId={contract.documentId}
                documentTitle={`Contrato de Locação - ${contract.tenantName}`}
                onClose={() => setViewDoc(false)}
            />
        )}
        </>
    );
}
