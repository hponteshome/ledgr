// ============================================================
// LEDGR — frontend/src/pages/assets/modals/RetrofitModal.tsx
// ============================================================
import { useState } from 'react';
import { useAssetMutations } from '../hooks/useAssets';
import { ModalWrapper, ModalFooter, Field } from './ModalComponents';



export function RetrofitModal({ assetId, onClose, onSuccess }: {
    assetId: string; onClose: () => void; onSuccess: () => void;
}) {
    const { createRetrofit, loading } = useAssetMutations();
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        assetId,
        name: '',
        objective: '',
        responsible: '',
        startDate: new Date().toISOString().slice(0, 10),
        plannedEndDate: '',
        totalBudget: '',
        usefulLifeImpact: 0
    });
    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    async function handleSubmit() {
        if (!form.name || !form.objective || !form.totalBudget) { setError('Preencha nome, objetivo e orçamento.'); return; }
        try { await createRetrofit(form); onSuccess(); } catch (e: any) { setError(e.message); }
    }

    const input = "w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <ModalWrapper title="Novo Projeto de Retrofit" onClose={onClose}>
            <div className="space-y-4 p-6">
                <Field label="Nome do Projeto *">
                    <input className={input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Modernização sistema HVAC" />
                </Field>
                <Field label="Objetivo *">
                    <textarea className={`${input} h-20 resize-none`} value={form.objective} onChange={e => set('objective', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Responsável">
                        <input className={input} value={form.responsible} onChange={e => set('responsible', e.target.value)} />
                    </Field>
                    <Field label="Orçamento Total (R$) *">
                        <input type="number" className={input} value={form.totalBudget} onChange={e => set('totalBudget', e.target.value)} />
                    </Field>
                    <Field label="Data de Início">
                        <input type="date" className={input} value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                    </Field>
                    <Field label="Data Fim Prevista">
                        <input type="date" className={input} value={form.plannedEndDate} onChange={e => set('plannedEndDate', e.target.value)} />
                    </Field>
                    <Field label="Impacto na Vida Útil (meses)">
                        <input type="number" className={input} value={form.usefulLifeImpact} onChange={e => set('usefulLifeImpact', e.target.value)} />
                    </Field>
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <ModalFooter onClose={onClose} onSave={handleSubmit} loading={loading} label="Criar Projeto" />
        </ModalWrapper>
    );
}