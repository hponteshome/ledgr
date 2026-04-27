// ============================================================
// frontend/src/pages/assets/components/ImprovementTab.tsx
// ============================================================
import { useState } from 'react';
import { Plus, CheckCircle as CheckCircle2 } from 'lucide-react';
import { ImprovementModal } from '../modals/ImprovementModal';
import { useAssetMutations } from '../hooks/useAssets';
import type { FixedAsset, AssetImprovement } from '../types/asset.types';
import { formatCurrency, formatDate } from '../../../utils/formatters';

export function ImprovementTab({ asset, onRefresh }: { asset: FixedAsset; onRefresh: () => void }) {
    const [showModal, setShowModal] = useState(false);
    const { capitalizeImprovement } = useAssetMutations();
    const improvements = asset.improvements ?? [];

    async function handleCapitalize(id: string) {
        if (!confirm('Confirma a capitalização desta benfeitoria ao valor do ativo?')) return;
        try { await capitalizeImprovement(id); onRefresh(); } catch (e: any) { alert(e.message); }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-800">
                    <Plus className="w-4 h-4" /> Registrar Benfeitoria
                </button>
            </div>
            {improvements.length === 0 && (
                <div className="py-10 text-center text-gray-400 text-sm">Nenhuma benfeitoria registrada</div>
            )}
            <div className="space-y-3">
                {improvements.map(b => (
                    <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 text-sm">{b.description}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.capitalized ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {b.capitalized ? 'Capitalizada' : 'Pendente'}
                                    </span>
                                </div>
                                <div className="flex gap-4 mt-1 text-xs text-gray-400">
                                    <span>{b.type.replace(/_/g, ' ')}</span>
                                    <span>{formatCurrency(b.totalCost)}</span>
                                    <span>{formatDate(b.startDate)}</span>
                                    {b.usefulLifeExtension > 0 && <span>+{b.usefulLifeExtension} meses vida útil</span>}
                                </div>
                                {b.justification && <p className="text-xs text-gray-500 mt-1 italic">{b.justification}</p>}
                            </div>
                            {!b.capitalized && (
                                <button onClick={() => handleCapitalize(b.id)}
                                    className="flex items-center gap-1 text-green-700 border border-green-300 bg-green-50 px-3 py-1.5 rounded-lg text-xs hover:bg-green-100 shrink-0 ml-3">
                                    <CheckCircle2 className="w-3 h-3" /> Capitalizar
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {showModal && (
                <ImprovementModal assetId={asset.id} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); onRefresh(); }} />
            )}
        </div>
    );
}
