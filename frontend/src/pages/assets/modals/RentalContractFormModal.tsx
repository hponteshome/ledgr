// ============================================================
// LEDGR — frontend/src/pages/assets/modals/RentalContractFormModal.tsx
// Novo Contrato de Locação — cria RentalContract vinculado ao FixedAsset
// ============================================================
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { ModalWrapper, ModalFooter, Field } from './ModalComponents';
import { SmartDateInput } from '../../../components/SmartDateInput';
import type { FixedAsset } from '../types/asset.types';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

const inputSt = 'w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500';

const GUARANTEE_OPTIONS = [
    { value: '', label: 'Nenhuma / não informada' },
    { value: 'FIANCA', label: 'Fiança' },
    { value: 'SEGURO_FIANCA', label: 'Seguro Fiança' },
    { value: 'CAUCAO', label: 'Caução' },
    { value: 'OUTROS', label: 'Outros' },
];

const READJUSTMENT_OPTIONS = [
    { value: '', label: 'Nenhum / não informado' },
    { value: 'IGPM', label: 'IGP-M' },
    { value: 'IPCA', label: 'IPCA' },
    { value: 'INPC', label: 'INPC' },
    { value: 'IGPDI', label: 'IGP-DI' },
    { value: 'OUTRO', label: 'Outro' },
];

function fmtNum(val: string | number | undefined): string {
    if (val === undefined || val === null || val === '') return '';
    const n = typeof val === 'string' ? parseFloat(val.replace(/\./g, '').replace(',', '.')) : Number(val);
    if (isNaN(n)) return String(val);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toNum(v: string): number | undefined {
    if (!v) return undefined;
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? undefined : n;
}

// Calcula data final a partir do inicio + N meses, menos 1 dia (convencao de
// prazo fixo em contratos de locacao: 12 meses a partir de 26/06/25 termina em
// 25/06/26, nao 26/06/26). Calculo local (sem tocar backend/pg), string pura.
function calcEndDate(startDateStr: string, months: number): string {
    const parts = startDateStr.split('-').map(Number);
    const [y, m, d] = parts;
    if (!y || !m || !d || !months) return '';
    const end = new Date(y, m - 1 + months, d);
    end.setDate(end.getDate() - 1);
    const yy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

export function RentalContractFormModal({ asset, contractId, documentStatus, onClose, onSuccess }: {
    asset: FixedAsset; contractId?: string; documentStatus?: string | null; onClose: () => void; onSuccess: () => void;
}) {
    const { token } = useAuth();
    const { activeCompany } = useCompany();

    const [tenantName, setTenantName] = useState('');
    const [tenantTaxId, setTenantTaxId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [vigenciaMeses, setVigenciaMeses] = useState('');
    const [rentAmountDisplay, setRentAmountDisplay] = useState('');
    const [dueDay, setDueDay] = useState('10');
    const [firstDueDate, setFirstDueDate] = useState('');
    const [guaranteeType, setGuaranteeType] = useState('');
    const [guaranteeDescription, setGuaranteeDescription] = useState('');
    const [readjustmentIndex, setReadjustmentIndex] = useState('');
    const [readjustmentPeriodMonths, setReadjustmentPeriodMonths] = useState('12');
    const [contractNumber, setContractNumber] = useState('');
    const [notes, setNotes] = useState('');

    const [loadingInitial, setLoadingInitial] = useState(!!contractId);

    useEffect(() => {
        if (!contractId) return;
        setLoadingInitial(true);
        fetch(`${API}/rental-contracts/${contractId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-company-id': activeCompany?.id ?? '',
            },
        })
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => {
                setTenantName(data.tenantName ?? '');
                setTenantTaxId(data.tenantTaxId ?? '');
                setStartDate(data.startDate ? String(data.startDate).slice(0, 10) : '');
                setEndDate(data.endDate ? String(data.endDate).slice(0, 10) : '');
                setRentAmountDisplay(fmtNum(data.rentAmount));
                setDueDay(data.dueDay ? String(data.dueDay) : '10');
                setFirstDueDate(data.firstDueDate ? String(data.firstDueDate).slice(0, 10) : '');
                setGuaranteeType(data.guaranteeType ?? '');
                setGuaranteeDescription(data.guaranteeDescription ?? '');
                setReadjustmentIndex(data.readjustmentIndex ?? '');
                setReadjustmentPeriodMonths(data.readjustmentPeriodMonths ? String(data.readjustmentPeriodMonths) : '12');
                setContractNumber(data.contractNumber ?? '');
                setNotes(data.notes ?? '');
            })
            .catch(() => setError('Não foi possível carregar os dados do contrato.'))
            .finally(() => setLoadingInitial(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contractId]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const months = parseInt(vigenciaMeses, 10);
        if (!startDate || !months || months <= 0) return;
        setEndDate(calcEndDate(startDate, months));
    }, [startDate, vigenciaMeses]);

    async function handleSave() {
        setError('');

        if (!tenantName.trim()) { setError('Informe o nome do locatário.'); return; }
        if (!startDate) { setError('Informe a data de início do contrato.'); return; }
        const rentAmount = toNum(rentAmountDisplay);
        if (!rentAmount || rentAmount <= 0) { setError('Informe um valor de aluguel válido.'); return; }
        const dueDayNum = parseInt(dueDay, 10);
        if (!dueDayNum || dueDayNum < 1 || dueDayNum > 31) { setError('Dia de vencimento inválido (1 a 31).'); return; }
        if (!firstDueDate) { setError('Informe a data do primeiro vencimento.'); return; }

        const payload: any = {
            fixedAssetId: asset.id,
            tenantName: tenantName.trim(),
            tenantTaxId: tenantTaxId.trim() || undefined,
            startDate,
            endDate: endDate || undefined,
            rentAmount,
            dueDay: dueDayNum,
            firstDueDate,
            guaranteeType: guaranteeType || undefined,
            guaranteeDescription: guaranteeDescription.trim() || undefined,
            readjustmentIndex: readjustmentIndex || undefined,
            readjustmentPeriodMonths: readjustmentIndex ? (parseInt(readjustmentPeriodMonths, 10) || undefined) : undefined,
            contractNumber: contractNumber.trim() || undefined,
            notes: notes.trim() || undefined,
        };

        setLoading(true);
        try {
            const url = contractId ? `${API}/rental-contracts/${contractId}` : `${API}/rental-contracts`;
            const method = contractId ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'x-company-id': activeCompany?.id ?? '',
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message ?? `Erro ${res.status}`);
            }
            if (contractId && documentStatus === 'RASCUNHO') {
                const regenRes = await fetch(`${API}/rental-contracts/${contractId}/generate-document`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'x-company-id': activeCompany?.id ?? '',
                    },
                });
                if (regenRes.ok) {
                    toast.success('Rascunho atualizado automaticamente.');
                }
            }
            onSuccess();
        } catch (e: any) {
            setError(e.message ?? 'Não foi possível salvar o contrato.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <ModalWrapper title={contractId ? `Editar Contrato de Locação — ${asset.internalCode}` : `Novo Contrato de Locação — ${asset.internalCode}`} onClose={onClose}>
            <div className="p-6 space-y-4">
                {error && (
                    <div className="bg-[#FCEBEB] text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
                )}

                <Field label="Locatário" required>
                    <input className={inputSt} value={tenantName} onChange={e => setTenantName(e.target.value)}
                        placeholder="Nome do locatário" />
                </Field>

                <Field label="CPF/CNPJ do Locatário">
                    <input className={inputSt} value={tenantTaxId} onChange={e => setTenantTaxId(e.target.value)}
                        placeholder="Opcional" />
                </Field>

                <div className="grid grid-cols-3 gap-4">
                    <Field label="Início do Contrato" required>
                        <SmartDateInput className={inputSt} value={startDate} onChange={setStartDate} />
                    </Field>
                    <Field label="Período de Vigência (meses)">
                        <input
                            type="number" min={1} className={inputSt}
                            placeholder="Ex: 12" value={vigenciaMeses}
                            onChange={e => setVigenciaMeses(e.target.value)}
                        />
                    </Field>
                    <Field label="Término / Vigência">
                        <SmartDateInput className={inputSt} value={endDate} onChange={setEndDate} />
                    </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Valor do Aluguel" required>
                        <input
                            type="text" inputMode="decimal" className={inputSt}
                            placeholder="0,00" value={rentAmountDisplay}
                            onChange={e => setRentAmountDisplay(e.target.value.replace(/[^\d,]/g, ''))}
                            onBlur={() => setRentAmountDisplay(fmtNum(rentAmountDisplay))}
                        />
                    </Field>
                    <Field label="Dia de Vencimento" required>
                        <input type="number" min={1} max={31} className={inputSt} value={dueDay}
                            onChange={e => setDueDay(e.target.value)} />
                    </Field>
                </div>

                <Field label="Data do Primeiro Vencimento" required>
                    <SmartDateInput className={inputSt} value={firstDueDate} onChange={setFirstDueDate} />
                </Field>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <Field label="Garantia">
                        <select className={inputSt} value={guaranteeType} onChange={e => setGuaranteeType(e.target.value)}>
                            {GUARANTEE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    {guaranteeType && (
                        <Field label="Detalhe da Garantia">
                            <input className={inputSt} value={guaranteeDescription}
                                onChange={e => setGuaranteeDescription(e.target.value)} />
                        </Field>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Índice de Reajuste">
                        <select className={inputSt} value={readjustmentIndex} onChange={e => setReadjustmentIndex(e.target.value)}>
                            {READJUSTMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    {readjustmentIndex && (
                        <Field label="Periodicidade (meses)">
                            <input type="number" min={1} className={inputSt} value={readjustmentPeriodMonths}
                                onChange={e => setReadjustmentPeriodMonths(e.target.value)} />
                        </Field>
                    )}
                </div>

                <Field label="Nº do Contrato">
                    <input className={inputSt} value={contractNumber} onChange={e => setContractNumber(e.target.value)}
                        placeholder="Opcional" />
                </Field>

                <Field label="Observações">
                    <textarea className={inputSt} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
                </Field>
            </div>

            <ModalFooter onClose={onClose} onSave={handleSave} loading={loading || loadingInitial} label={contractId ? "Salvar Alterações" : "Salvar Contrato"} />
        </ModalWrapper>
    );
}