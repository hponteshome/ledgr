// ============================================================
// LEDGR — frontend/src/pages/assets/modals/AssetFormModal.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { Building2, Info } from 'lucide-react';
import { useAssetMutations } from '../hooks/useAssets';
import {
    ASSET_GROUP_LABELS,
    DEPRECIATION_METHOD_LABELS,
    AssetGroup,
    DepreciationMethod
} from '../types/asset.types';
import type { FixedAsset, CreateAssetForm } from '../types/asset.types';
import { ModalWrapper, ModalFooter, Field } from './ModalComponents';

const SUGGESTED_USEFUL_LIFE: Partial<Record<AssetGroup, number>> = {
    REAL_ESTATE: 300,
    MACHINERY_EQUIPMENT: 120,
    VEHICLE: 60,
    FURNITURE_FIXTURE: 120,
    IT_EQUIPMENT: 60,
    INTANGIBLE: 60,
};

interface Props {
    asset?: FixedAsset;
    onClose: () => void;
    onSuccess: (a: FixedAsset) => void;
}

export function AssetFormModal({ asset, onClose, onSuccess }: Props) {
    const { create, update, loading } = useAssetMutations();
    const isEdit = !!asset;
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);

    const [form, setForm] = useState<CreateAssetForm>({
        internalCode: asset?.internalCode ?? '',
        description: asset?.description ?? '',
        group: asset?.group ?? 'REAL_ESTATE',
        subgroup: asset?.subgroup ?? '',
        brand: asset?.brand ?? '',
        model: asset?.model ?? '',
        serialNumber: asset?.serialNumber ?? '',
        location: asset?.location ?? '',
        notes: asset?.notes ?? '',
        acquisitionCost: asset?.acquisitionCost ?? '',
        acquisitionDate: asset?.acquisitionDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        residualValue: asset?.residualValue ?? 0,
        depreciationMethod: asset?.depreciationMethod ?? 'STRAIGHT_LINE',
        usefulLifeMonths: asset?.usefulLifeMonths ?? '',
        annualRatePercent: asset?.annualRatePercent ?? '',
        depreciationStart: asset?.depreciationStart?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        nonDepreciable: asset?.nonDepreciable ?? false,
        iptuRegistration: asset?.iptuRegistration ?? '',
        registryNumber: asset?.registryNumber ?? '',
        totalArea: asset?.totalArea ?? '',
        builtArea: asset?.builtArea ?? '',
        assessedValue: asset?.assessedValue ?? '',
        landValuePercent: asset?.landValuePercent ?? '',
        street: asset?.street ?? '',
        zipCode: asset?.zipCode ?? '',
        state: asset?.state ?? '',
        city: asset?.city ?? '',
    });

    useEffect(() => {
        if (!isEdit && form.group) {
            const vu = SUGGESTED_USEFUL_LIFE[form.group as AssetGroup];
            if (vu) setForm(f => ({ ...f, usefulLifeMonths: vu }));
        }
    }, [form.group, isEdit]);

    useEffect(() => {
        const meses = Number(form.usefulLifeMonths);
        if (meses > 0) {
            const taxa = ((1 / (meses / 12)) * 100).toFixed(2);
            setForm(f => ({ ...f, annualRatePercent: taxa }));
        }
    }, [form.usefulLifeMonths]);

    const set = (k: keyof CreateAssetForm, v: any) => setForm(f => ({ ...f, [k]: v }));

    async function handleSubmit() {
        setError('');
        if (!form.internalCode || !form.description || !form.acquisitionCost || !form.usefulLifeMonths) {
            setError('Preencha os campos obrigatórios.');
            return;
        }

        try {
            // Sanitização e conversão numérica antes do envio
            const payload = {
                ...form,
                acquisitionCost: Number(form.acquisitionCost),
                usefulLifeMonths: Number(form.usefulLifeMonths),
                residualValue: Number(form.residualValue || 0),
                landValuePercent: form.landValuePercent ? Number(form.landValuePercent) : undefined,
                totalArea: form.totalArea ? Number(form.totalArea) : undefined,
                builtArea: form.builtArea ? Number(form.builtArea) : undefined,
            };

            const result = isEdit
                ? await update(asset!.id, payload)
                : await create(payload);

            onSuccess(result);
        } catch (e: any) {
            setError(e.message);
        }
    }

    const isRealEstate = form.group === 'REAL_ESTATE';
    const input = "w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <ModalWrapper
            title={isEdit ? 'Editar Ativo' : 'Novo Ativo Imobilizado'}
            onClose={onClose}
        >
            {/* Nav Steps */}
            <div className="px-6 pt-4 flex gap-2">
                {[{ n: 1, l: 'Identificação' }, { n: 2, l: 'Financeiro' }, { n: 3, l: isRealEstate ? 'Imóvel' : 'Específico' }].map(s => (
                    <button
                        key={s.n}
                        type="button"
                        onClick={() => setStep(s.n)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${step === s.n ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${step === s.n ? 'bg-blue-500' : 'bg-gray-300'}`}>{s.n}</span>
                        {s.l}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[400px]">
                {step === 1 && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Código Interno *">
                                <input className={input} value={form.internalCode} onChange={e => set('internalCode', e.target.value)} />
                            </Field>
                            <Field label="Grupo *">
                                <select className={input} value={form.group} onChange={e => set('group', e.target.value as AssetGroup)}>
                                    {Object.entries(ASSET_GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </Field>
                        </div>
                        <Field label="Descrição *">
                            <input className={input} value={form.description} onChange={e => set('description', e.target.value)} />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Subgrupo"><input className={input} value={form.subgroup} onChange={e => set('subgroup', e.target.value)} /></Field>
                            <Field label="Localização"><input className={input} value={form.location} onChange={e => set('location', e.target.value)} /></Field>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Valor de Aquisição (R$) *">
                                <input type="number" className={input} value={form.acquisitionCost} onChange={e => set('acquisitionCost', e.target.value)} />
                            </Field>
                            <Field label="Data de Aquisição *">
                                <input type="date" className={input} value={form.acquisitionDate} onChange={e => set('acquisitionDate', e.target.value)} />
                            </Field>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <input type="checkbox" id="naoDeprec" checked={form.nonDepreciable} onChange={e => set('nonDepreciable', e.target.checked)} />
                            <label htmlFor="naoDeprec" className="text-sm text-yellow-800 font-medium">Ativo não depreciável</label>
                        </div>
                        {!form.nonDepreciable && (
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Método"><select className={input} value={form.depreciationMethod} onChange={e => set('depreciationMethod', e.target.value as DepreciationMethod)}>
                                    {Object.entries(DEPRECIATION_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select></Field>
                                <Field label="Vida Útil (meses) *">
                                    <input type="number" className={input} value={form.usefulLifeMonths} onChange={e => set('usefulLifeMonths', e.target.value)} />
                                </Field>
                            </div>
                        )}
                    </>
                )}

                {step === 3 && isRealEstate && (
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="% do Terreno *">
                            <input type="number" className={input} value={form.landValuePercent} onChange={e => set('landValuePercent', e.target.value)} />
                        </Field>
                        <Field label="Matrícula">
                            <input className={input} value={form.registryNumber} onChange={e => set('registryNumber', e.target.value)} />
                        </Field>
                        <Field label="Área Construída">
                            <input type="number" className={input} value={form.builtArea} onChange={e => set('builtArea', e.target.value)} />
                        </Field>
                        <Field label="Município">
                            <input className={input} value={form.city} onChange={e => set('city', e.target.value)} />
                        </Field>
                    </div>
                )}

                {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between bg-gray-50/50">
                <button
                    type="button"
                    onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                    {step === 1 ? 'Cancelar' : 'Anterior'}
                </button>

                {step < 3 ? (
                    <button
                        type="button"
                        onClick={() => setStep(s => s + 1)}
                        className="px-6 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
                    >
                        Próximo
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Ativo'}
                    </button>
                )}
            </div>
        </ModalWrapper>
    );
}