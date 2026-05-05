// ============================================================
// LEDGR — frontend/src/pages/assets/modals/AssetFormModal.tsx
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { Loader } from 'lucide-react';
import { useAssetMutations } from '../hooks/useAssets';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import {
    ASSET_GROUP_LABELS,
    DEPRECIATION_METHOD_LABELS,
    AssetGroup,
    DepreciationMethod
} from '../types/asset.types';
import type { FixedAsset, CreateAssetForm } from '../types/asset.types';
import { ModalWrapper, Field } from './ModalComponents';

const API = 'http://localhost:3000';

// ── Helpers de formatação ──────────────────────────────────

function fmtNum(val: string | number | undefined): string {
    if (val === undefined || val === null || val === '') return '';
    const n = typeof val === 'string' ? parseFloat(val.replace(/\./g, '').replace(',', '.')) : Number(val);
    if (isNaN(n)) return String(val);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toNum(v: string | number | undefined): number | undefined {
    if (v === undefined || v === null || v === '') return undefined;
    const s = String(v).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
}

function NumInput({ value, onChange, placeholder, className }: {
    value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
    const [display, setDisplay] = useState(value ? fmtNum(value) : '');
    useEffect(() => { if (value === '') setDisplay(''); }, [value]);
    return (
        <input type="text" inputMode="decimal" className={className}
            placeholder={placeholder ?? '0,00'} value={display}
            onChange={e => { const raw = e.target.value.replace(/[^\d,]/g, ''); setDisplay(raw); onChange(raw); }}
            onBlur={() => {
                const n = parseFloat(display.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(n)) { const f = fmtNum(n); setDisplay(f); onChange(f); }
            }} />
    );
}

// ── Lookup de conta contábil ───────────────────────────────

interface AccountResult { id: string; code: string; name: string; }

function AccountLookup({ label, value, onChange, headers }: {
    label: string;
    value: AccountResult;
    onChange: (v: AccountResult) => void;
    headers: Record<string, string>;
}) {
    const [code, setCode] = useState(value.code);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const lookup = useCallback(async () => {
        if (!code.trim()) return;
        setLoading(true); setErr('');
        try {
            const r = await fetch(`${API}/accounting/journal/lookup-account?code=${code.trim()}`, { headers });
            if (!r.ok) throw new Error('not found');
            const acc: AccountResult = await r.json();
            onChange({ id: acc.id, code: acc.code, name: acc.name });
        } catch {
            setErr('Conta não encontrada');
            onChange({ id: '', code, name: '' });
        } finally { setLoading(false); }
    }, [code, headers, onChange]);

    const base = "border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <Field label={label}>
            <div className="flex gap-2">
                <div className="relative w-32 flex-shrink-0">
                    <input className={`${base} w-full`} value={code}
                        onChange={e => { setCode(e.target.value); onChange({ id: '', code: e.target.value, name: '' }); setErr(''); }}
                        onBlur={lookup}
                        onKeyDown={e => e.key === 'Enter' && lookup()}
                        placeholder="Código" />
                    {loading && <Loader size={11} className="animate-spin absolute right-2 top-2.5 text-blue-400" />}
                </div>
                <input readOnly value={err || value.name}
                    className={`flex-1 text-sm py-2 px-3 rounded-lg border ${
                        err ? 'border-red-200 bg-red-50 text-red-600' :
                        value.id ? 'border-green-200 bg-green-50 text-green-800' :
                        'border-gray-100 bg-gray-50 text-gray-400'
                    }`}
                    placeholder="Nome da conta" />
            </div>
        </Field>
    );
}

// ── Constantes ─────────────────────────────────────────────

const SUGGESTED_USEFUL_LIFE: Partial<Record<AssetGroup, number>> = {
    REAL_ESTATE: 480,
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
    const { token } = useAuth();
    const { activeCompany } = useCompany();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token ?? ''}`,
        'x-company-id': activeCompany?.id ?? '',
    };

    const isEdit = !!asset;
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);

    const [acctAsset,  setAcctAsset]  = useState<AccountResult>({ id: asset?.assetAccountId  ?? '', code: '', name: '' });
    const [acctDeprec, setAcctDeprec] = useState<AccountResult>({ id: asset?.depreciationAccId ?? '', code: '', name: '' });
    const [acctAccum,  setAcctAccum]  = useState<AccountResult>({ id: asset?.accumDeprecAccId  ?? '', code: '', name: '' });

    const [form, setForm] = useState<any>({
        internalCode:      asset?.internalCode ?? '',
        description:       asset?.description ?? '',
        group:             asset?.group ?? 'REAL_ESTATE',
        subgroup:          asset?.subgroup ?? '',
        brand:             asset?.brand ?? '',
        model:             asset?.model ?? '',
        serialNumber:      asset?.serialNumber ?? '',
        location:          asset?.location ?? '',
        notes:             asset?.notes ?? '',
        acquisitionCost:   asset?.acquisitionCost ? fmtNum(asset.acquisitionCost) : '',
        acquisitionDate:   asset?.acquisitionDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        residualValue:     asset?.residualValue ? fmtNum(asset.residualValue) : '0,00',
        depreciationMethod: asset?.depreciationMethod ?? 'STRAIGHT_LINE',
        usefulLifeMonths:  asset?.usefulLifeMonths ?? '',
        annualRatePercent: asset?.annualRatePercent ?? '',
        depreciationStart: asset?.depreciationStart?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        nonDepreciable:    asset?.nonDepreciable ?? false,
        iptuRegistration:  asset?.iptuRegistration ?? '',
        registryNumber:    asset?.registryNumber ?? '',
        registryOffice:    '',
        totalArea:         asset?.totalArea  ? fmtNum(asset.totalArea)  : '',
        builtArea:         asset?.builtArea  ? fmtNum(asset.builtArea)  : '',
        assessedValueItbi: asset?.assessedValue ? fmtNum(asset.assessedValue) : '',
        landValuePercent:  asset?.landValuePercent ? fmtNum(asset.landValuePercent) : '',
        landFraction:      '',
        street:            asset?.street  ?? '',
        zipCode:           asset?.zipCode ?? '',
        state:             asset?.state   ?? '',
        city:              asset?.city    ?? '',
        realEstateNotes:   '',
    });

    useEffect(() => {
        if (!isEdit && form.group) {
            const vu = SUGGESTED_USEFUL_LIFE[form.group as AssetGroup];
            if (vu) setForm((f: any) => ({ ...f, usefulLifeMonths: vu }));
        }
    }, [form.group, isEdit]);

    useEffect(() => {
        const meses = Number(form.usefulLifeMonths);
        if (meses > 0) {
            const taxa = ((1 / (meses / 12)) * 100).toFixed(2);
            setForm((f: any) => ({ ...f, annualRatePercent: taxa }));
        }
    }, [form.usefulLifeMonths]);

    useEffect(() => {
        const frac = parseFloat(String(form.landFraction).replace(',', '.'));
        if (!isNaN(frac) && frac > 0) {
            setForm((f: any) => ({ ...f, landValuePercent: fmtNum(frac * 100) }));
        }
    }, [form.landFraction]);

    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

    async function handleSubmit() {
        setError('');
        if (!form.internalCode || !form.description || !form.acquisitionCost || !form.usefulLifeMonths) {
            setError('Preencha os campos obrigatórios: Código, Descrição, Valor de Aquisição e Vida Útil.');
            return;
        }
        try {
            const payload = {
                ...form,
                acquisitionCost:   toNum(form.acquisitionCost)!,
                usefulLifeMonths:  Number(form.usefulLifeMonths),
                residualValue:     toNum(form.residualValue) ?? 0,
                landValuePercent:  toNum(form.landValuePercent),
                totalArea:         toNum(form.totalArea),
                builtArea:         toNum(form.builtArea),
                assessedValue:     toNum(form.assessedValueItbi),
                notes:             [form.notes, form.realEstateNotes].filter(Boolean).join(' | ') || undefined,
                assetAccountId:    acctAsset.id  || undefined,
                depreciationAccId: acctDeprec.id || undefined,
                accumDeprecAccId:  acctAccum.id  || undefined,
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
        <ModalWrapper title={isEdit ? 'Editar Ativo' : 'Novo Ativo Imobilizado'} onClose={onClose}>
            {/* Nav Steps */}
            <div className="px-6 pt-4 flex gap-2">
                {[{ n: 1, l: 'Identificação' }, { n: 2, l: 'Financeiro' }, { n: 3, l: isRealEstate ? 'Imóvel' : 'Específico' }].map(s => (
                    <button key={s.n} type="button" onClick={() => setStep(s.n)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${step === s.n ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${step === s.n ? 'bg-blue-500' : 'bg-gray-300'}`}>{s.n}</span>
                        {s.l}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-[400px]">

                {/* ── Step 1: Identificação ─────────────────────── */}
                {step === 1 && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Código Interno *">
                                <input className={input} value={form.internalCode}
                                    onChange={e => set('internalCode', e.target.value)}
                                    placeholder="Ex: IMV-001" />
                            </Field>
                            <Field label="Grupo *">
                                <select className={input} value={form.group}
                                    onChange={e => set('group', e.target.value as AssetGroup)}>
                                    {Object.entries(ASSET_GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </Field>
                        </div>
                        <Field label="Descrição *">
                            <input className={input} value={form.description}
                                onChange={e => set('description', e.target.value)} />
                        </Field>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Subgrupo">
                                <input className={input} value={form.subgroup}
                                    onChange={e => set('subgroup', e.target.value)} />
                            </Field>
                            <Field label="Localização">
                                <input className={input} value={form.location}
                                    onChange={e => set('location', e.target.value)} />
                            </Field>
                        </div>
                    </>
                )}

                {/* ── Step 2: Financeiro ────────────────────────── */}
                {step === 2 && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Valor de Aquisição *">
                                <NumInput className={input} value={String(form.acquisitionCost)}
                                    onChange={v => set('acquisitionCost', v)} />
                            </Field>
                            <Field label="Data de Aquisição *">
                                <input type="date" className={input} value={form.acquisitionDate}
                                    onChange={e => set('acquisitionDate', e.target.value)} />
                            </Field>
                        </div>

                        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <input type="checkbox" id="naoDeprec" checked={form.nonDepreciable}
                                onChange={e => set('nonDepreciable', e.target.checked)} />
                            <label htmlFor="naoDeprec" className="text-sm text-yellow-800 font-medium">Ativo não depreciável</label>
                        </div>

                        {!form.nonDepreciable && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Método">
                                        <select className={input} value={form.depreciationMethod}
                                            onChange={e => set('depreciationMethod', e.target.value as DepreciationMethod)}>
                                            {Object.entries(DEPRECIATION_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Vida Útil (meses) *">
                                        <input type="number" className={input} value={form.usefulLifeMonths}
                                            onChange={e => set('usefulLifeMonths', e.target.value)} />
                                    </Field>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Valor Residual">
                                        <NumInput className={input} value={String(form.residualValue)}
                                            onChange={v => set('residualValue', v)} />
                                    </Field>
                                    <Field label="Taxa Anual (%)">
                                        <input className={`${input} bg-gray-50 text-gray-400`} readOnly
                                            value={form.annualRatePercent ? `${form.annualRatePercent}%` : ''} />
                                    </Field>
                                </div>
                            </>
                        )}

                        {/* Contas Contábeis */}
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contas Contábeis</p>
                            <p className="text-xs text-gray-400">Digite o código e pressione Tab ou Enter para buscar</p>
                            <AccountLookup
                                label="Ativo Imobilizado (débito na aquisição)"
                                value={acctAsset} onChange={setAcctAsset} headers={headers} />
                            <AccountLookup
                                label="Despesa de Depreciação (débito mensal)"
                                value={acctDeprec} onChange={setAcctDeprec} headers={headers} />
                            <AccountLookup
                                label="Depreciação Acumulada (crédito mensal)"
                                value={acctAccum} onChange={setAcctAccum} headers={headers} />
                        </div>
                    </>
                )}

                {/* ── Step 3: Imóvel ────────────────────────────── */}
                {step === 3 && isRealEstate && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Matrícula">
                                <input className={input} value={form.registryNumber}
                                    onChange={e => set('registryNumber', e.target.value)}
                                    placeholder="Nº da matrícula" />
                            </Field>
                            <Field label="Cartório de Registro">
                                <input className={input} value={form.registryOffice ?? ''}
                                    onChange={e => set('registryOffice', e.target.value)}
                                    placeholder="Ex: 1º Ofício de Imóveis" />
                            </Field>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <Field label="Município">
                                <input className={input} value={form.city}
                                    onChange={e => set('city', e.target.value)} />
                            </Field>
                            <Field label="UF">
                                <input className={input} value={form.state}
                                    onChange={e => set('state', e.target.value)}
                                    maxLength={2} placeholder="SP" />
                            </Field>
                            <Field label="CEP">
                                <input className={input} value={form.zipCode}
                                    onChange={e => set('zipCode', e.target.value)}
                                    placeholder="00000-000" />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Área Construída (m²)">
                                <NumInput className={input} value={String(form.builtArea)}
                                    onChange={v => set('builtArea', v)} />
                            </Field>
                            <Field label="Área Total (m²)">
                                <NumInput className={input} value={String(form.totalArea)}
                                    onChange={v => set('totalArea', v)} />
                            </Field>
                        </div>

                        {/* Apuração do Terreno */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Apuração do Terreno (não depreciável)</p>
                            <div className="grid grid-cols-3 gap-4">
                                <Field label="Valor Venal ITBI">
                                    <NumInput className={input} value={String(form.assessedValueItbi)}
                                        onChange={v => set('assessedValueItbi', v)} />
                                </Field>
                                <Field label="Fração Ideal">
                                    <input className={input} value={form.landFraction ?? ''}
                                        onChange={e => set('landFraction', e.target.value)}
                                        placeholder="Ex: 0,0294117" />
                                </Field>
                                <Field label="% do Terreno *">
                                    <NumInput className={input} value={String(form.landValuePercent)}
                                        onChange={v => set('landValuePercent', v)} />
                                </Field>
                            </div>
                            {(() => {
                                const frac = parseFloat(String(form.landFraction).replace(',', '.'));
                                const itbi = toNum(form.assessedValueItbi) ?? 0;
                                const terreno = frac * itbi;
                                return (!isNaN(terreno) && terreno > 0) ? (
                                    <div className="text-xs text-blue-600 bg-white rounded px-3 py-2 border border-blue-100">
                                        Valor do terreno estimado: <strong>{fmtNum(terreno)}</strong>
                                        {' '}— fração ideal × valor venal ITBI (PN CST 14/1975)
                                    </div>
                                ) : null;
                            })()}
                        </div>

                        <Field label="Inscrição IPTU">
                            <input className={input} value={form.iptuRegistration}
                                onChange={e => set('iptuRegistration', e.target.value)}
                                placeholder="Nº de inscrição municipal" />
                        </Field>

                        <Field label="Observações">
                            <textarea className={`${input} resize-none`} rows={3}
                                value={form.realEstateNotes ?? ''}
                                onChange={e => set('realEstateNotes', e.target.value)}
                                placeholder="Descrição do imóvel, confrontações, observações relevantes..." />
                        </Field>
                    </div>
                )}

                {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between bg-gray-50/50">
                <button type="button"
                    onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                    {step === 1 ? 'Cancelar' : 'Anterior'}
                </button>
                {step < 3 ? (
                    <button type="button" onClick={() => setStep(s => s + 1)}
                        className="px-6 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800">
                        Próximo
                    </button>
                ) : (
                    <button type="button" onClick={handleSubmit} disabled={loading}
                        className="px-6 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50">
                        {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Ativo'}
                    </button>
                )}
            </div>
        </ModalWrapper>
    );
}
