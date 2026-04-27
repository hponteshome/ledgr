// ============================================================
// LEDGR — frontend/src/pages/assets/components/MaintenanceTab.tsx
// ============================================================
import { useState } from 'react';
import { Plus, Wrench, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import type { FixedAsset, AssetMaintenance } from '../types/asset.types';
import { MaintenanceModal } from '../modals/MaintenanceModal';
import { formatCurrency, formatDate } from '../../../utils/formatters';

const TYPE_COLORS: Record<string, string> = {
    PREVENTIVE: 'bg-green-100 text-green-700',
    CORRECTIVE: 'bg-red-100 text-red-700',
    PREDICTIVE: 'bg-blue-100 text-blue-700',
    OVERHAUL: 'bg-purple-100 text-purple-700',
    EMERGENCY: 'bg-orange-100 text-orange-700',
};

const STATUS_ICON: Record<string, any> = {
    SCHEDULED: Clock,
    IN_PROGRESS: Wrench,
    COMPLETED: CheckCircle,
    CANCELLED: XCircle,
};

export function MaintenanceTab({ asset, onRefresh }: { asset: FixedAsset; onRefresh: () => void }) {
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState<AssetMaintenance | null>(null);

    const maintenances = asset.maintenances ?? [];
    const openOnes = maintenances.filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS');
    const history = maintenances.filter(m => m.status === 'COMPLETED' || m.status === 'CANCELLED');
    const overdue = openOnes.filter(m => new Date(m.scheduledDate) < new Date());

    return (
        <div className="space-y-4">
            {overdue.length > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {overdue.length} manutenção(ões) com data vencida sem conclusão.
                </div>
            )}

            <div className="flex justify-between items-center">
                <div className="flex gap-3 text-sm text-gray-500">
                    <span><span className="font-bold text-gray-800">{openOnes.length}</span> em aberto</span>
                    <span><span className="font-bold text-gray-800">{history.length}</span> concluídas</span>
                </div>
                <button onClick={() => { setEditTarget(null); setShowModal(true); }}
                    className="flex items-center gap-1.5 bg-blue-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-800">
                    <Plus className="w-4 h-4" /> Nova OS
                </button>
            </div>

            {/* Em aberto */}
            {openOnes.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Em Aberto</h3>
                    {openOnes.map(m => <MaintenanceCard key={m.id} maintenance={m} onEdit={() => { setEditTarget(m); setShowModal(true); }} />)}
                </div>
            )}

            {/* Histórico */}
            {history.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Histórico</h3>
                    {history.map(m => <MaintenanceCard key={m.id} maintenance={m} />)}
                </div>
            )}

            {maintenances.length === 0 && (
                <div className="py-10 text-center text-gray-400">
                    <Wrench className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">Nenhuma manutenção registrada</p>
                </div>
            )}

            {showModal && (
                <MaintenanceModal
                    assetId={asset.id}
                    maintenance={editTarget ?? undefined}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); onRefresh(); }}
                />
            )}
        </div>
    );
}

function MaintenanceCard({ maintenance, onEdit }: { maintenance: AssetMaintenance; onEdit?: () => void }) {
    const Icon = STATUS_ICON[maintenance.status] ?? Clock;
    const isOverdue = maintenance.status === 'SCHEDULED' && new Date(maintenance.scheduledDate) < new Date();
    return (
        <div className={`bg-white border rounded-xl p-4 flex items-start gap-3 ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${maintenance.status === 'COMPLETED' ? 'text-green-500' : maintenance.status === 'CANCELLED' ? 'text-gray-400' : isOverdue ? 'text-red-500' : 'text-orange-500'}`} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">{maintenance.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[maintenance.type] ?? 'bg-gray-100 text-gray-600'}`}>{maintenance.type}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{maintenance.description}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span>Previsto: {formatDate(maintenance.scheduledDate)}</span>
                    {maintenance.providerName && <span>{maintenance.providerName}</span>}
                    {maintenance.actualCost && <span>R$ {formatCurrency(maintenance.actualCost)}</span>}
                </div>
            </div>
            {onEdit && (
                <button onClick={onEdit} className="text-blue-600 text-xs hover:underline shrink-0">Editar</button>
            )}
        </div>
    );
}