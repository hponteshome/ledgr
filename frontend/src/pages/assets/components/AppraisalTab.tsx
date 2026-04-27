// ============================================================
// frontend/src/pages/assets/components/AppraisalTab.tsx
// ============================================================
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AppraisalModal } from '../modals/AppraisalModal';
import type { FixedAsset, AssetAppraisal } from '../types/asset.types';
import { APPRAISAL_TYPE_LABELS } from '../types/asset.types';
import { formatCurrency, formatDate } from '../../../utils/formatters';

export function AppraisalTab({ asset, onRefresh }: { asset: FixedAsset; onRefresh: () => void }) {
    const [showModal, setShowModal] = useState(false);
    const appraisals = asset.appraisals ?? [];
    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-800">
                    <Plus className="w-4 h-4" /> Registrar Laudo
                </button>
            </div>
            {appraisals.length === 0 && <div className="py-10 text-center text-gray-400 text-sm">Nenhum laudo registrado</div>}
            <div className="space-y-3">
                {appraisals.map(l => {
                    const difference = Number(l.appraisedValue) - Number(l.previousValue);
                    return (
                        <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <span className="font-medium text-gray-900 text-sm">{APPRAISAL_TYPE_LABELS[l.type]}</span>
                                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                                        <span>{formatDate(l.appraisalDate)}</span>
                                        <span>{l.appraisalFirm}</span>
                                        <span>{l.responsibleName}</span>
                                        {l.creaRegistration && <span>CREA: {l.creaRegistration}</span>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900 text-sm">{formatCurrency(l.appraisedValue)}</p>
                                    <p className={`text-xs font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {difference >= 0 ? '+' : ''}{formatCurrency(difference)} vs contábil
                                    </p>
                                </div>
                            </div>
                            {l.conclusions && <p className="text-xs text-gray-500 mt-2 italic border-t border-gray-100 pt-2">{l.conclusions}</p>}
                        </div>
                    );
                })}
            </div>
            {showModal && (
                <AppraisalModal
                    assetId={asset.id}
                    bookValue={asset.bookValue}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); onRefresh(); }}
                />
            )}
        </div>
    );
}
