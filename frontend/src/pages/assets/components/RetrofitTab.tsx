// ============================================================
// frontend/src/pages/assets/components/RetrofitTab.tsx
// ============================================================
import { useState } from 'react';
import { Plus, CheckCircle as CheckCircle2 } from 'lucide-react';
import { RetrofitModal } from '../modals/RetrofitModal';
import type { FixedAsset, AssetRetrofitProject } from '../types/asset.types';
import { formatCurrency, formatDate } from '../../../utils/formatters';

export function RetrofitTab({ asset, onRefresh }: { asset: FixedAsset; onRefresh: () => void }) {
    const [showModal, setShowModal] = useState(false);
    const retrofits = asset.retrofitProjects ?? [];

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-800">
                    <Plus className="w-4 h-4" /> Novo Projeto
                </button>
            </div>
            {retrofits.length === 0 && (
                <div className="py-10 text-center text-gray-400 text-sm">Nenhum projeto de retrofit</div>
            )}
            {retrofits.map(r => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <h3 className="font-semibold text-gray-900">{r.name}</h3>
                            <p className="text-xs text-gray-500 mt-0.5">{r.objective}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : r.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {r.status}
                        </span>
                    </div>
                    {/* Barra de progresso */}
                    <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Progresso físico</span>
                            <span className="font-bold text-gray-700">{Number(r.physicalProgress).toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full">
                            <div className="h-2 bg-blue-500 rounded-full" style={{ width: `${r.physicalProgress}%` }} />
                        </div>
                    </div>
                    {/* Financeiro */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                        <div><p className="text-gray-400">Orçado</p><p className="font-medium">{formatCurrency(r.totalBudget)}</p></div>
                        <div><p className="text-gray-400">Executado</p><p className="font-medium">{formatCurrency(r.executedAmount)}</p></div>
                        <div><p className="text-gray-400">Desvio</p>
                            <p className={`font-medium ${Number(r.executedAmount) > Number(r.totalBudget) ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(Number(r.totalBudget) - Number(r.executedAmount))}
                            </p>
                        </div>
                    </div>
                    {/* Fases */}
                    {r.phases?.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase">Fases</p>
                            {r.phases.map(f => (
                                <div key={f.id} className="flex items-center gap-3 text-xs">
                                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${f.completed ? 'text-green-500' : 'text-gray-300'}`} />
                                    <span className={`flex-1 ${f.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{f.sequence}. {f.name}</span>
                                    <span className="text-gray-400">{formatDate(f.plannedDate)}</span>
                                    <span className="font-medium">{formatCurrency(f.phaseBudget)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {showModal && (
                <RetrofitModal assetId={asset.id} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); onRefresh(); }} />
            )}
        </div>
    );
}