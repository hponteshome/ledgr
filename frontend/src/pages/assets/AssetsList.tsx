// ============================================================
// LEDGR — frontend/src/pages/assets/AssetList.tsx
// ============================================================
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Wrench, Plus, Search, Filter, AlertTriangle,
    TrendingDown, BarChart3, DollarSign, Package,
} from 'lucide-react';
import { useAssetsList } from './hooks/useAssets';
import {
    ASSET_GROUP_LABELS,
    ASSET_STATUS_LABELS,
    ASSET_STATUS_COLORS,
    AssetGroup
} from './types/asset.types';
import type { FixedAsset } from './types/asset.types';
import { AssetFormModal } from './modals/AssetFormModal';
import { formatCurrency, formatDate } from '../../utils/formatters';

const GRUPO_ICONS: Record<string, any> = {
    REAL_ESTATE: Building2,
    MACHINERY_EQUIPMENT: Package,
    VEHICLE: Package,
    FURNITURE_FIXTURE: Package,
    IT_EQUIPMENT: Package,
    INTANGIBLE: Package,
    OTHER: Package,
};

export default function AssetsList() {
    const navigate = useNavigate();
    const { data, loading, error, fetch } = useAssetsList();
    const [search, setSearch] = useState('');
    const [grupo, setGrupo] = useState<AssetGroup | ''>('');
    const [status, setStatus] = useState('');
    const [showForm, setShowForm] = useState(false);

    useEffect(() => { fetch({ search, grupo, status }); }, []);

    function handleFilter() {
        fetch({ search: search || undefined, grupo: grupo || undefined, status: status || undefined });
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleFilter();
    }

    function onCreated() {
        setShowForm(false);
        fetch({ search, grupo, status });
    }

    const pctDeprec = (a: FixedAsset) => {
        if (!a.acquisitionCost) return 0;
        return Math.round((a.accumulatedDeprec / a.acquisitionCost) * 100);
    };

    return (
        <div className="p-6 space-y-6">
            {/* ── Header ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-7 h-7 text-blue-700" />
                        Ativo Imobilizado
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Controle patrimonial completo — imóveis, máquinas, veículos e mais</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Novo Ativo
                </button>
            </div>

            {/* ── KPIs ────────────────────────────────────────────── */}
            {data?.kpis && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        icon={<Package className="w-5 h-5 text-blue-600" />}
                        label="Total de Ativos"
                        value={data.kpis.totalAssets.toString()}
                        bg="bg-blue-50"
                    />
                    <KpiCard
                        icon={<DollarSign className="w-5 h-5 text-green-600" />}
                        label="Valor Bruto Total"
                        value={formatCurrency(data.kpis.totalAcquisitionCost)}
                        bg="bg-green-50"
                    />
                    <KpiCard
                        icon={<BarChart3 className="w-5 h-5 text-indigo-600" />}
                        label="Valor Contábil"
                        value={formatCurrency(data.kpis.totalBookValue)}
                        bg="bg-indigo-50"
                    />
                    <KpiCard
                        icon={<TrendingDown className="w-5 h-5 text-orange-600" />}
                        label="Depreciação Acum."
                        value={formatCurrency(data.kpis.totalAccumDeprec)}
                        bg="bg-orange-50"
                    />
                </div>
            )}

            {/* ── Filtros ──────────────────────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Código, descrição, marca..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>
                <div className="min-w-40">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Grupo</label>
                    <select
                        className="w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={grupo}
                        onChange={e => setGrupo(e.target.value as AssetGroup)}
                    >
                        <option value="">Todos</option>
                        {Object.entries(ASSET_GROUP_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>
                <div className="min-w-36">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select
                        className="w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                    >
                        <option value="">Todos</option>
                        {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleFilter}
                    className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm"
                >
                    <Filter className="w-4 h-4" />
                    Filtrar
                </button>
            </div>

            {/* ── Tabela ──────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-[#1A3A5C] text-white">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium">Código</th>
                                <th className="text-left px-4 py-3 font-medium">Descrição</th>
                                <th className="text-left px-4 py-3 font-medium">Grupo</th>
                                <th className="text-left px-4 py-3 font-medium">Localização</th>
                                <th className="text-right px-4 py-3 font-medium">Valor Contábil</th>
                                <th className="text-center px-4 py-3 font-medium">% Deprec.</th>
                                <th className="text-center px-4 py-3 font-medium">Status</th>
                                <th className="text-center px-4 py-3 font-medium">OS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && (
                                <tr><td colSpan={8} className="py-12 text-center text-gray-400">Carregando...</td></tr>
                            )}
                            {!loading && !data?.data?.length && (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center">
                                        <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                        <p className="text-gray-400">Nenhum ativo cadastrado</p>
                                        <button onClick={() => setShowForm(true)} className="mt-2 text-blue-600 text-sm hover:underline">
                                            Cadastrar primeiro ativo
                                        </button>
                                    </td>
                                </tr>
                            )}
                            {data?.data?.map(ativo => {
                                const Icon = GRUPO_ICONS[ativo.group] ?? Package;
                                const pct = pctDeprec(ativo);
                                const osAbertas = ativo.maintenances?.filter(m => m.status !== 'COMPLETED' && m.status !== 'CANCELLED').length ?? 0;
                                return (
                                    <tr
                                        key={ativo.id}
                                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                                        onClick={() => navigate(`/app/assets/${ativo.id}`)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Icon className="w-4 h-4 text-blue-500 shrink-0" />
                                                <span className="font-mono font-medium text-gray-800">{ativo.internalCode}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900">{ativo.description}</div>
                                            {ativo.brand && <div className="text-xs text-gray-400">{ativo.brand}{ativo.model ? ` · ${ativo.model}` : ''}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{ASSET_GROUP_LABELS[ativo.group]}</td>
                                        <td className="px-4 py-3 text-gray-600">{ativo.location ?? '—'}</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                                            {formatCurrency(ativo.bookValue)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-xs font-medium text-gray-700">{pct}%</span>
                                                <div className="w-16 h-1.5 bg-gray-200 rounded-full">
                                                    <div
                                                        className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-red-500' : pct >= 50 ? 'bg-orange-400' : 'bg-green-500'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ASSET_STATUS_COLORS[ativo.status]}`}>
                                                {ASSET_STATUS_LABELS[ativo.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {osAbertas > 0 ? (
                                                <span className="flex items-center justify-center gap-1 text-orange-600 text-xs font-medium">
                                                    <Wrench className="w-3 h-3" /> {osAbertas}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Paginação */}
                {data?.meta && data.meta.totalPages > 1 && (
                    <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between text-sm text-gray-500">
                        <span>{data.meta.total} ativos encontrados</span>
                        <div className="flex gap-1">
                            {Array.from({ length: data.meta.totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => fetch({ search, grupo, status, page: p })}
                                    className={`px-3 py-1 rounded ${p === data.meta.page ? 'bg-blue-700 text-white' : 'hover:bg-gray-100'}`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {showForm && (
                <AssetFormModal onClose={() => setShowForm(false)} onSuccess={onCreated} />
            )}
        </div>
    );
}

// ── Componente auxiliar ────────────────────────────────────────
function KpiCard({ icon, label, value, bg }: { icon: any; label: string; value: string; bg: string }) {
    return (
        <div className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
            <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
            <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
            </div>
        </div>
    );
}