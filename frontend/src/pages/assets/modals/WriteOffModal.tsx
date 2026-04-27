// ============================================================
// LEDGR — frontend/src/pages/assets/modals/WriteOffModal.tsx
// ============================================================
import { useState } from 'react';
import { X } from 'lucide-react';
import { useAssetMutations } from '../hooks/useAssets';
import { WRITE_OFF_REASON_LABELS } from '../types/asset.types';
import type { FixedAsset } from '../types/asset.types';
import { formatCurrency } from '../../../utils/formatters';

// Componentes auxiliares
function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="font-bold text-gray-900">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

function ModalFooter({ onClose, onSave, loading, label, danger }: any) {
    return (
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Cancelar
            </button>
            <button
                onClick={onSave}
                disabled={loading}
                className={`px-5 py-2 rounded-lg text-sm text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'}`}
            >
                {loading ? 'Salvando...' : label}
            </button>
        </div>
    );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
    return (
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

export function WriteOffModal({ asset, onClose, onSuccess }: {
    asset: FixedAsset;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const { writeOff, loading } = useAssetMutations();
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        writeOffDate: new Date().toISOString().slice(0, 10),
        reason: 'SCRAPPING',
        disposalValue: '',
        notes: ''
    });

    const set = (key: string, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    async function handleSubmit() {
        if (!form.writeOffDate || !form.reason) {
            setError('Informe a data e o motivo da baixa.');
            return;
        }
        try {
            await writeOff(asset.id, form);
            onSuccess();
        } catch (e: any) {
            setError(e.message);
        }
    }

    const input = "w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <ModalWrapper title={`Baixa do Ativo — ${asset.internalCode}`} onClose={onClose}>
            <div className="space-y-4 p-6">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <strong>Atenção:</strong> Esta ação não pode ser desfeita. Valor contábil na baixa: <strong>{formatCurrency(asset.bookValue)}</strong>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Data da Baixa *">
                        <input
                            type="date"
                            className={input}
                            value={form.writeOffDate}
                            onChange={e => set('writeOffDate', e.target.value)}
                        />
                    </Field>
                    <Field label="Motivo da Baixa *">
                        <select
                            className={input}
                            value={form.reason}
                            onChange={e => set('reason', e.target.value)}
                        >
                            {Object.entries(WRITE_OFF_REASON_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </Field>
                    {form.reason === 'DISPOSAL' && (
                        <Field label="Valor de Alienação (R$)">
                            <input
                                type="number"
                                className={input}
                                value={form.disposalValue}
                                onChange={e => set('disposalValue', e.target.value)}
                            />
                        </Field>
                    )}
                </div>
                <Field label="Observações">
                    <textarea
                        className={`${input} h-20 resize-none`}
                        value={form.notes}
                        onChange={e => set('notes', e.target.value)}
                    />
                </Field>
                {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <ModalFooter
                onClose={onClose}
                onSave={handleSubmit}
                loading={loading}
                label="Confirmar Baixa"
                danger
            />
        </ModalWrapper>
    );
}