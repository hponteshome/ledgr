// ============================================================
// LEDGR — frontend/src/pages/assets/modals/MaintenanceModal.tsx
// ============================================================
import { MAINTENANCE_TYPE_LABELS, MAINTENANCE_STATUS_LABELS } from '../types/asset.types';
import { useState } from 'react';
import { useAssetMutations } from '../hooks/useAssets';
import { ModalWrapper, ModalFooter, Field } from './ModalComponents';

export function MaintenanceModal({ assetId, maintenance, onClose, onSuccess }: {
    assetId: string; maintenance?: any; onClose: () => void; onSuccess: () => void;
}) {
    const { createMaintenance, updateMaintenance, loading } = useAssetMutations();
    const [error, setError] = useState('');
    const isEdit = !!maintenance;

    const [form, setForm] = useState({
        assetId,
        type: maintenance?.type ?? 'PREVENTIVE',
        title: maintenance?.title ?? '',
        description: maintenance?.description ?? '',
        providerName: maintenance?.providerName ?? '',
        providerCnpj: maintenance?.providerCnpj ?? '',
        contactInfo: maintenance?.contactInfo ?? '',
        scheduledDate: maintenance?.scheduledDate?.slice(0, 10) ?? '',
        estimatedCost: maintenance?.estimatedCost ?? '',
        capitalizable: maintenance?.capitalizable ?? false,
        serviceOrderNo: maintenance?.serviceOrderNo ?? '',
        notes: maintenance?.notes ?? '',
        // Se edição com conclusão:
        status: maintenance?.status ?? 'SCHEDULED',
        actualCost: maintenance?.actualCost ?? '',
        completedAt: maintenance?.completedAt?.slice(0, 10) ?? '',
    });

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    async function handleSubmit() {
        setError('');
        if (!form.title || !form.description || !form.scheduledDate) {
            setError('Preencha título, descrição e data prevista.');
            return;
        }
        try {
            if (isEdit) await updateMaintenance(maintenance.id, form);
            else await createMaintenance(form);
            onSuccess();
        } catch (e: any) { setError(e.message); }
    }

    const input = "w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <ModalWrapper title={isEdit ? 'Editar OS' : 'Nova Ordem de Serviço'} onClose={onClose}>
            <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Tipo *">
                        <select className={input} value={form.type} onChange={e => set('type', e.target.value)}>
                            {Object.entries(MAINTENANCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Field>
                    {isEdit && (
                        <Field label="Status">
                            <select className={input} value={form.status} onChange={e => set('status', e.target.value)}>
                                {Object.entries(MAINTENANCE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </Field>
                    )}
                </div>
                <Field label="Título *">
                    <input className={input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex: Revisão sistema hidráulico" />
                </Field>
                <Field label="Descrição *">
                    <textarea className={`${input} h-20 resize-none`} value={form.description} onChange={e => set('description', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Prestador de Serviço">
                        <input className={input} value={form.providerName} onChange={e => set('providerName', e.target.value)} />
                    </Field>
                    <Field label="CNPJ do Prestador">
                        <input className={input} value={form.providerCnpj} onChange={e => set('providerCnpj', e.target.value)} maxLength={18} />
                    </Field>
                    <Field label="Data Prevista *">
                        <input type="date" className={input} value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} />
                    </Field>
                    <Field label="Valor Orçado (R$)">
                        <input type="number" className={input} value={form.estimatedCost} onChange={e => set('estimatedCost', e.target.value)} />
                    </Field>
                    {isEdit && form.status === 'COMPLETED' && (
                        <>
                            <Field label="Valor Realizado (R$)">
                                <input type="number" className={input} value={form.actualCost} onChange={e => set('actualCost', e.target.value)} />
                            </Field>
                            <Field label="Data de Conclusão">
                                <input type="date" className={input} value={form.completedAt} onChange={e => set('completedAt', e.target.value)} />
                            </Field>
                        </>
                    )}
                    <Field label="Nº Ordem de Serviço">
                        <input className={input} value={form.serviceOrderNo} onChange={e => set('serviceOrderNo', e.target.value)} />
                    </Field>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="capitalizavel" checked={form.capitalizable} onChange={e => set('capitalizable', e.target.checked)} />
                    <label htmlFor="capitalizavel" className="text-sm text-gray-700 cursor-pointer">Esta manutenção é capitalizável ao ativo</label>
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <ModalFooter onClose={onClose} onSave={handleSubmit} loading={loading} label={isEdit ? 'Salvar' : 'Criar OS'} />
        </ModalWrapper>
    );
}

