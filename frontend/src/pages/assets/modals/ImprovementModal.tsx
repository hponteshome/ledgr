// ============================================================
// LEDGR — frontend/src/pages/assets/modals/ImprovementModal.tsx
// ============================================================
import { IMPROVEMENT_TYPE_LABELS } from '../types/asset.types';
import { X } from 'lucide-react'; // Caso o ModalWrapper use o ícone
import { useState } from 'react';
import { useAssetMutations } from '../hooks/useAssets';
import { ModalWrapper, ModalFooter, Field } from './ModalComponents';
import {
    ASSET_GROUP_LABELS,
    DEPRECIATION_METHOD_LABELS,
    AssetGroup,
    DepreciationMethod
} from '../types/asset.types';

export function ImprovementModal({ assetId, onClose, onSuccess }: {
    assetId: string; onClose: () => void; onSuccess: () => void;
}) {
    const { createImprovement, loading } = useAssetMutations();
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        assetId,
        type: 'CAPITALIZABLE_RENOVATION',
        description: '',
        justification: '',
        startDate: new Date().toISOString().slice(0, 10),
        completionDate: '',
        totalCost: '',
        usefulLifeExtension: 0,
        technicalReport: '',
    });

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    async function handleSubmit() {
        if (!form.description || !form.totalCost) { setError('Preencha descrição e valor.'); return; }
        try {
            await createImprovement(form);
            onSuccess();
        } catch (e: any) { setError(e.message); }
    }

    const input = "w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <ModalWrapper title="Registrar Benfeitoria" onClose={onClose}>
            <div className="space-y-4 p-6">
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Tipo *">
                        <select className={input} value={form.type} onChange={e => set('type', e.target.value)}>
                            {Object.entries(IMPROVEMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Field>
                    <Field label="Valor Total (R$) *">
                        <input type="number" className={input} value={form.totalCost} onChange={e => set('totalCost', e.target.value)} />
                    </Field>
                </div>
                <Field label="Descrição *">
                    <input className={input} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Ex: Reforma do telhado — substituição completa" />
                </Field>
                <Field label="Justificativa (critério CPC 27)">
                    <textarea className={`${input} h-20 resize-none`} value={form.justification} onChange={e => set('justification', e.target.value)} placeholder="Descreva como esta melhoria gera benefícios adicionais ao ativo..." />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Data de Início">
                        <input type="date" className={input} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                    </Field>
                    <Field label="Data de Conclusão">
                        <input type="date" className={input} value={form.completionDate} onChange={e => set('completionDate', e.target.value)} />
                    </Field>
                    <Field label="Ampliação Vida Útil (meses)">
                        <input type="number" className={input} value={form.usefulLifeExtension} onChange={e => set('usefulLifeExtension', e.target.value)} />
                    </Field>
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <ModalFooter onClose={onClose} onSave={handleSubmit} loading={loading} label="Registrar Benfeitoria" />
        </ModalWrapper>
    );
}

