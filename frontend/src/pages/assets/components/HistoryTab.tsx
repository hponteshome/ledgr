// ============================================================
// frontend/src/pages/assets/components/HistoryTab.tsx
// ============================================================
import type { FixedAsset, AssetHistory } from '../types/asset.types';
import { formatCurrency, formatDate } from '../../../utils/formatters';

export function HistoryTab({ asset }: { asset: FixedAsset }) {
    const history = asset.history ?? [];
    const EVENT_COLORS: Record<string, string> = {
        ACQUISITION: 'bg-blue-100 text-blue-700',
        ACTIVATION: 'bg-green-100 text-green-700',
        MAINTENANCE_OPENED: 'bg-orange-100 text-orange-700',
        MAINTENANCE_COMPLETED: 'bg-green-100 text-green-700',
        IMPROVEMENT_REGISTERED: 'bg-purple-100 text-purple-700',
        IMPROVEMENT_CAPITALIZED: 'bg-indigo-100 text-indigo-700',
        RETROFIT_STARTED: 'bg-cyan-100 text-cyan-700',
        RETROFIT_COMPLETED: 'bg-teal-100 text-teal-700',
        APPRAISAL_REGISTERED: 'bg-yellow-100 text-yellow-700',
        WRITE_OFF: 'bg-red-100 text-red-700',
        DISPOSAL: 'bg-red-100 text-red-700',
    };

    return (
        <div className="space-y-2">
            {history.length === 0 && <div className="py-10 text-center text-gray-400 text-sm">Nenhum evento registrado</div>}
            <div className="relative">
                {history.map((h, i) => (
                    <div key={h.id} className="flex gap-3 pb-4">
                        <div className="flex flex-col items-center">
                            <div className={`w-2 h-2 rounded-full mt-1.5 ${EVENT_COLORS[h.eventType]?.includes('blue') ? 'bg-blue-500' : EVENT_COLORS[h.eventType]?.includes('green') ? 'bg-green-500' : EVENT_COLORS[h.eventType]?.includes('red') ? 'bg-red-500' : 'bg-gray-400'}`} />
                            {i < history.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                        </div>
                        <div className="flex-1 pb-1">
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[h.eventType] ?? 'bg-gray-100 text-gray-600'}`}>{h.eventType.replace(/_/g, ' ')}</span>
                                <span className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleDateString('pt-BR')} {new Date(h.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p className="text-sm text-gray-700 mt-0.5">{h.description}</p>
                            {(h.previousValue || h.newValue) && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {h.previousValue && `De ${formatCurrency(h.previousValue)}`}
                                    {h.newValue && ` → ${formatCurrency(h.newValue)}`}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}