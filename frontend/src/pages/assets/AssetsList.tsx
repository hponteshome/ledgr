// ============================================================
// LEDGR — frontend/src/pages/assets/AssetsList.tsx
// ============================================================
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Wrench, Plus, Search, Filter, AlertTriangle, Upload,
    TrendingDown, BarChart3, DollarSign, Package, ChevronUp, ChevronDown, ChevronsUpDown,
    CheckSquare, Square, Zap, Power, PowerOff, Trash2, RefreshCw, X,
} from 'lucide-react';
import { useAssetsList, useAssetMutations } from './hooks/useAssets';
import {
    ASSET_GROUP_LABELS,
    ASSET_STATUS_LABELS,
    ASSET_STATUS_COLORS,
    AssetGroup
} from './types/asset.types';
import type { FixedAsset } from './types/asset.types';
import { AssetFormModal } from './modals/AssetFormModal';
import { AssetImportModal } from './modals/AssetImportModal';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

const API = 'http://localhost:3000';

const GRUPO_ICONS: Record<string, any> = {
    REAL_ESTATE: Building2, MACHINERY_EQUIPMENT: Package, VEHICLE: Package,
    FURNITURE_FIXTURE: Package, IT_EQUIPMENT: Package, INTANGIBLE: Package, OTHER: Package,
};

type SortKey = 'internalCode' | 'description' | 'assetAccount' | 'city' | 'bookValue' | 'accumDeprec' | 'status';
type SortDir = 'asc' | 'desc';

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
    if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-40 inline ml-1" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
}

export default function AssetsList() {
    const navigate = useNavigate();
    const { data, loading, error, fetch } = useAssetsList();
    const { activate, deactivate, reactivate, removeAsset, backfillAsset } = useAssetMutations();
    const { token } = useAuth();
    const { activeCompany } = useCompany();

    const [search, setSearch] = useState('');
    const [grupo, setGrupo] = useState<AssetGroup | ''>('');
    const [status, setStatus] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>('internalCode');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Seleção em lote
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkResult, setBulkResult] = useState('');
    const [showBackfillModal, setShowBackfillModal] = useState(false);
    const [backfillFrom, setBackfillFrom] = useState('');
    const [backfillTo, setBackfillTo] = useState(new Date().toISOString().slice(0, 7));

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token ?? ''}`,
        'x-company-id': activeCompany?.id ?? '',
    };

    useEffect(() => { fetch({ search, grupo, status, limit: 1000 }); }, []);

    function handleFilter() {
        fetch({ search: search || undefined, grupo: grupo || undefined, status: status || undefined, limit: 1000 });
        setSelected(new Set());
    }

    function handleKeyDown(e: React.KeyboardEvent) { if (e.key === 'Enter') handleFilter(); }

    function onCreated() { setShowForm(false); fetch({ search, grupo, status, limit: 1000 }); }

    function handleSort(key: SortKey) {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
    }

    const sorted = useMemo(() => {
        const rows = [...(data?.data ?? [])];
        rows.sort((a, b) => {
            let va: any, vb: any;
            switch (sortKey) {
                case 'internalCode': va = a.internalCode; vb = b.internalCode; break;
                case 'description': va = a.description; vb = b.description; break;
                case 'assetAccount': va = (a as any).assetAccount?.code ?? ''; vb = (b as any).assetAccount?.code ?? ''; break;
                case 'city': va = a.city ?? a.location ?? ''; vb = b.city ?? b.location ?? ''; break;
                case 'bookValue': va = Number(a.bookValue); vb = Number(b.bookValue); break;
                case 'accumDeprec': va = Number(a.accumulatedDeprec ?? 0); vb = Number(b.accumulatedDeprec ?? 0); break;
                case 'status': va = a.status; vb = b.status; break;
                default: va = ''; vb = '';
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return rows;
    }, [data?.data, sortKey, sortDir]);

    // Checkbox helpers
    const allSelected = sorted.length > 0 && selected.size === sorted.length;
    const someSelected = selected.size > 0;

    function toggleAll() {
        if (allSelected) setSelected(new Set());
        else setSelected(new Set(sorted.map(a => a.id)));
    }

    function toggleOne(id: string) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    // Ações em lote
    async function bulkAction(action: 'activate' | 'deactivate' | 'reactivate' | 'delete' | 'backfill') {
        if (!someSelected) return;
        setBulkLoading(true); setBulkResult('');
        const ids = Array.from(selected);
        let ok = 0, fail = 0;
        try {
            if (action === 'backfill') {
                // Chamar backfill para cada ativo selecionado
                for (const id of ids) {
                    try {
                        await backfillAsset(id, backfillFrom ? backfillFrom + '-01' : undefined, backfillTo ? backfillTo + '-01' : undefined);
                        ok++;
                    } catch { fail++; }
                }
            } else {
                for (const id of ids) {
                    try {
                        if (action === 'activate') await activate(id);
                        if (action === 'deactivate') await deactivate(id);
                        if (action === 'reactivate') await reactivate(id);
                        if (action === 'delete') await removeAsset(id);
                        ok++;
                    } catch { fail++; }
                }
            }
            setBulkResult(`✓ ${ok} processados${fail > 0 ? ` · ${fail} erros` : ''}`);
            setSelected(new Set());
            fetch({ search: search || undefined, grupo: grupo || undefined, status: status || undefined, limit: 1000 });
        } finally { setBulkLoading(false); }
    }

    const thCls = "px-3 py-3 font-medium cursor-pointer select-none hover:bg-[#16325a] whitespace-nowrap";
    const colWidths = ['48px', '130px', '160px', '', '120px', '140px', '140px', '140px', '48px'];

    function Colgroup() {
        return (
            <colgroup>
                {colWidths.map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}
            </colgroup>
        );
    }

    return (
        <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-7 h-7 text-blue-700" /> Ativo Imobilizado
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Controle patrimonial completo — imóveis, máquinas, veículos e mais</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 border border-orange-300 text-orange-600 px-4 py-2 rounded-lg hover:bg-orange-50 text-sm font-medium">
                        <Upload className="w-4 h-4" /> Importar
                    </button>
                    <button onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 text-sm font-medium">
                        <Plus className="w-4 h-4" /> Novo Ativo
                    </button>
                </div>
            </div>

            {/* KPIs */}
            {data?.kpis && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon={<Package className="w-5 h-5 text-blue-600" />} label="Total de Ativos" value={data.kpis.totalAssets.toString()} bg="bg-blue-50" />
                    <KpiCard icon={<DollarSign className="w-5 h-5 text-green-600" />} label="Valor Bruto Total" value={formatCurrency(data.kpis.totalAcquisitionCost)} bg="bg-green-50" />
                    <KpiCard icon={<BarChart3 className="w-5 h-5 text-indigo-600" />} label="Valor Contábil" value={formatCurrency(data.kpis.totalBookValue)} bg="bg-indigo-50" />
                    <KpiCard icon={<TrendingDown className="w-5 h-5 text-orange-600" />} label="Depreciação Acum." value={formatCurrency(data.kpis.totalAccumDeprec)} bg="bg-orange-50" />
                </div>
            )}

            {/* Filtros */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Código, descrição, marca..."
                            value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleKeyDown} />
                    </div>
                </div>
                <div className="min-w-40">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Grupo</label>
                    <select className="w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={grupo} onChange={e => setGrupo(e.target.value as AssetGroup)}>
                        <option value="">Todos</option>
                        {Object.entries(ASSET_GROUP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div className="min-w-36">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select className="w-full border border-gray-300 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={status} onChange={e => setStatus(e.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <button onClick={handleFilter}
                    className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm">
                    <Filter className="w-4 h-4" /> Filtrar
                </button>
            </div>

            {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </div>
            )}

            {/* Barra de ações em lote */}
            {someSelected && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-medium text-blue-700">
                        {selected.size} selecionado{selected.size > 1 ? 's' : ''}
                    </span>
                    <div className="h-4 w-px bg-blue-200" />
                    <button onClick={() => bulkAction('activate')} disabled={bulkLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                        <Power className="w-3 h-3" /> Ativar
                    </button>
                    <button onClick={() => bulkAction('deactivate')} disabled={bulkLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 disabled:opacity-50">
                        <PowerOff className="w-3 h-3" /> Desativar
                    </button>
                    <button onClick={() => bulkAction('reactivate')} disabled={bulkLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                        <RefreshCw className="w-3 h-3" /> Reativar
                    </button>
                    <button onClick={() => setShowBackfillModal(true)} disabled={bulkLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                        <Zap className="w-3 h-3" /> Depreciar Retroativo
                    </button>
                    <button onClick={() => bulkAction('delete')} disabled={bulkLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
                        <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                    {bulkLoading && <span className="text-xs text-red-800 animate-pulse bg-black-600">Processando...</span>}
                    {bulkResult && <span className="text-xs text-green-700 font-medium">{bulkResult}</span>}
                    <button onClick={() => setSelected(new Set())} className="ml-auto text-blue-400 hover:text-blue-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Tabela com scroll */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col"
                style={{ maxHeight: 'calc(100vh - 340px)' }}>

                {/* Header fixo */}
                <table className="w-full text-sm table-fixed flex-shrink-0">
                    <Colgroup />
                    <thead className="bg-[#1A3A5C] text-white">
                        <tr>
                            <th className="px-3 py-3 text-center w-12" onClick={toggleAll}>
                                <button className="text-white/70 hover:text-white">
                                    {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                </button>
                            </th>
                            <th className={`${thCls} text-left`} onClick={() => handleSort('internalCode')}>
                                Código <SortIcon col="internalCode" sortKey={sortKey} sortDir={sortDir} />
                            </th>
                            <th className={`${thCls} text-left`} onClick={() => handleSort('assetAccount')}>
                                Conta <SortIcon col="assetAccount" sortKey={sortKey} sortDir={sortDir} />
                            </th>
                            <th className={`${thCls} text-left`} onClick={() => handleSort('description')}>
                                Descrição <SortIcon col="description" sortKey={sortKey} sortDir={sortDir} />
                            </th>
                            <th className={`${thCls} text-left`} onClick={() => handleSort('city')}>
                                Localização <SortIcon col="city" sortKey={sortKey} sortDir={sortDir} />
                            </th>
                            <th className={`${thCls} text-right`} onClick={() => handleSort('bookValue')}>
                                Valor Contábil <SortIcon col="bookValue" sortKey={sortKey} sortDir={sortDir} />
                            </th>
                            <th className={`${thCls} text-right`} onClick={() => handleSort('accumDeprec')}>
                                Deprec. Acum. <SortIcon col="accumDeprec" sortKey={sortKey} sortDir={sortDir} />
                            </th>
                            <th className={`${thCls} text-center`} onClick={() => handleSort('status')}>
                                Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                            </th>
                            <th className="px-3 py-3 text-center font-medium">OS</th>
                        </tr>
                    </thead>
                </table>

                {/* Corpo scrollável */}
                <div className="overflow-auto flex-1">
                    <table className="w-full text-sm table-fixed">
                        <Colgroup />
                        <tbody className="divide-y divide-gray-100">
                            {loading && (
                                <tr><td colSpan={9} className="py-12 text-center text-gray-400">Carregando...</td></tr>
                            )}
                            {!loading && !sorted.length && (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center">
                                        <Building2 className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                                        <p className="text-gray-400">Nenhum ativo cadastrado</p>
                                        <button onClick={() => setShowForm(true)} className="mt-2 text-blue-600 text-sm hover:underline">
                                            Cadastrar primeiro ativo
                                        </button>
                                    </td>
                                </tr>
                            )}
                            {sorted.map(ativo => {
                                const Icon = GRUPO_ICONS[ativo.group] ?? Package;
                                const deprec = Number(ativo.accumulatedDeprec ?? 0);
                                const osAbertas = ativo.maintenances?.filter((m: any) => m.status !== 'COMPLETED' && m.status !== 'CANCELLED').length ?? 0;
                                const isSelected = selected.has(ativo.id);
                                return (
                                    <tr key={ativo.id}
                                        className={`cursor-pointer transition-colors border-b border-gray-50 ${isSelected ? 'bg-blue-50' : 'hover:bg-blue-50/50'}`}>
                                        <td className="px-3 py-2.5 text-center" onClick={e => { e.stopPropagation(); toggleOne(ativo.id); }}>
                                            <button className={isSelected ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}>
                                                {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                            </button>
                                        </td>
                                        <td className="px-3 py-2.5" onClick={() => navigate(`/app/assets/${ativo.id}`)}>
                                            <div className="flex items-center gap-1.5">
                                                <Icon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                                <span className="font-mono font-medium text-gray-800 text-xs truncate">{ativo.internalCode}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5" onClick={() => navigate(`/app/assets/${ativo.id}`)}>
                                            {(ativo as any).assetAccount ? (
                                                <div>
                                                    <span className="font-mono text-xs text-blue-700">{(ativo as any).assetAccount.code}</span>
                                                    <div className="text-[10px] text-gray-400 truncate">{(ativo as any).assetAccount.name}</div>
                                                </div>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5" onClick={() => navigate(`/app/assets/${ativo.id}`)}>
                                            <div className="font-medium text-gray-900 text-xs truncate">{ativo.description}</div>
                                            {ativo.brand && <div className="text-[10px] text-gray-400">{ativo.brand}{ativo.model ? ` · ${ativo.model}` : ''}</div>}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-gray-600 truncate" onClick={() => navigate(`/app/assets/${ativo.id}`)}>{ativo.city ?? ativo.location ?? '—'}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs font-medium text-gray-900" onClick={() => navigate(`/app/assets/${ativo.id}`)}>
                                            {formatCurrency(ativo.bookValue)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs text-orange-600" onClick={() => navigate(`/app/assets/${ativo.id}`)}>
                                            {deprec > 0 ? formatCurrency(deprec) : <span className="text-gray-300">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center" onClick={() => navigate(`/app/assets/${ativo.id}`)}>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ASSET_STATUS_COLORS[ativo.status]}`}>
                                                {ASSET_STATUS_LABELS[ativo.status]}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center" onClick={() => navigate(`/app/assets/${ativo.id}`)}>
                                            {osAbertas > 0 ? (
                                                <span className="flex items-center justify-center gap-1 text-orange-600 text-xs font-medium">
                                                    <Wrench className="w-3 h-3" /> {osAbertas}
                                                </span>
                                            ) : <span className="text-gray-300 text-xs">—</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Rodapé */}
                {sorted.length > 0 && (
                    <div className="border-t border-gray-200 px-4 py-2 bg-gray-50 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
                        <span>
                            <strong className="text-gray-700">{sorted.length}</strong> ativos
                            {someSelected && <span className="text-blue-600 ml-2">· {selected.size} selecionado{selected.size > 1 ? 's' : ''}</span>}
                        </span>
                        <div className="flex gap-6">
                            <span>Deprec. acum.: <strong className="text-orange-600 font-mono">
                                {formatCurrency(sorted.reduce((s, a) => s + Number(a.accumulatedDeprec ?? 0), 0))}
                            </strong></span>
                            <span>Valor contábil: <strong className="text-gray-700 font-mono">
                                {formatCurrency(sorted.reduce((s, a) => s + Number(a.bookValue), 0))}
                            </strong></span>
                        </div>
                    </div>
                )}
            </div>

            {showForm && <AssetFormModal onClose={() => setShowForm(false)} onSuccess={onCreated} />}
            {showBackfillModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
                        <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-orange-500" /> Depreciar Retroativo
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">{selected.size} ativo{selected.size > 1 ? "s" : ""} selecionado{selected.size > 1 ? "s" : ""}. Deixe "De" em branco para usar a data de início de cada ativo.</p>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">De (mm/aaaa)</label>
                                <input type="month" className="w-full border border-gray-300 rounded-lg text-sm py-2 px-3" value={backfillFrom} onChange={e => setBackfillFrom(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Até (mm/aaaa)</label>
                                <input type="month" className="w-full border border-gray-300 rounded-lg text-sm py-2 px-3" value={backfillTo} onChange={e => setBackfillTo(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowBackfillModal(false)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-200">Cancelar</button>
                            <button onClick={() => { setShowBackfillModal(false); bulkAction("backfill"); }} className="px-4 py-1.5 text-sm text-white bg-orange-600 rounded-lg hover:bg-orange-700">Calcular</button>
                        </div>
                    </div>
                </div>
            )}
            {showImport && (
                <AssetImportModal
                    onClose={() => setShowImport(false)}
                    onSuccess={() => { setShowImport(false); fetch({ limit: 1000 }); }}
                />
            )}
        </div>
    );
}

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
