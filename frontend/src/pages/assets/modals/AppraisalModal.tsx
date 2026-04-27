// ============================================================
// LEDGR — frontend/src/pages/assets/modals/AppraisalModal.tsx
// ============================================================
import { APPRAISAL_TYPE_LABELS } from '../types/asset.types';
import { formatCurrency } from '../../../utils/formatters';
import { ModalWrapper, ModalFooter, Field } from './ModalComponents';


export function AppraisalModal({ assetId, bookValue, onClose, onSuccess }: {
    assetId: string; bookValue: number; onClose: () => void; onSuccess: () => void;
}) {
    const { createAppraisal, loading } = useAssetMutations();
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        assetId,
        type: 'ASSET_VALUATION',
        appraisalDate: new Date().toISOString().slice(0, 10),
        appraisalFirm: '',
        responsibleName: '',
        creaRegistration: '',
        appraisedValue: '',
        methodology: '',
        conclusions: '',
        estimatedRemainingMonths: ''
    });
    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    async function handleSubmit() {
        if (!form.appraisalFirm || !form.responsibleName || !form.appraisedValue) {
            setError('Preencha empresa avaliadora, responsável e valor apurado.');
            return;
        }
        try { await createAppraisal(form); onSuccess(); } catch (e: any) { setError(e.message); }
    }

    const input = "w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <ModalWrapper title="Registrar Laudo de Avaliação" onClose={onClose}>
            <div className="space-y-4 p-6">
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                    Valor contábil atual: <strong>{formatCurrency(bookValue)}</strong>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label="Tipo de Laudo">
                        <select className={input} value={form.type} onChange={e => set('type', e.target.value)}>
                            {Object.entries(APPRAISAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </Field>
                    <Field label="Data do Laudo">
                        <input type="date" className={input} value={form.appraisalDate} onChange={e => set('appraisalDate', e.target.value)} />
                    </Field>
                    <Field label="Empresa Avaliadora *">
                        <input className={input} value={form.appraisalFirm} onChange={e => set('appraisalFirm', e.target.value)} />
                    </Field>
                    <Field label="Responsável Técnico *">
                        <input className={input} value={form.responsibleName} onChange={e => set('responsibleName', e.target.value)} />
                    </Field>
                    <Field label="Registro CREA/CAU">
                        <input className={input} value={form.creaRegistration} onChange={e => set('creaRegistration', e.target.value)} />
                    </Field>
                    <Field label="Valor Apurado (R$) *">
                        <input type="number" className={input} value={form.appraisedValue} onChange={e => set('appraisedValue', e.target.value)} />
                    </Field>
                    <Field label="Vida Útil Restante Estimada (meses)">
                        <input type="number" className={input} value={form.estimatedRemainingMonths} onChange={e => set('estimatedRemainingMonths', e.target.value)} />
                    </Field>
                </div>
                <Field label="Metodologia">
                    <textarea className={`${input} h-20 resize-none`} value={form.methodology} onChange={e => set('methodology', e.target.value)} placeholder="Método comparativo de dados de mercado, custo de reposição..." />
                </Field>
                {error && <p className="text-red-600 text-sm">{error}</p>}
            </div>
            <ModalFooter onClose={onClose} onSave={handleSubmit} loading={loading} label="Registrar Laudo" />
        </ModalWrapper>
    );
}