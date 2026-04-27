// ============================================================
// LEDGR — frontend/src/pages/assets/AssetView.tsx
// ============================================================
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Building2, Wrench, Layers, RefreshCw, FileText,
    History, TrendingDown, Edit, CheckCircle, XCircle, AlertTriangle,
    MapPin, Hash, Calendar, DollarSign,
} from 'lucide-react';
import { useAssetDetail } from './hooks/useAssets';
import {
    ASSET_GROUP_LABELS,
    ASSET_STATUS_LABELS,
    ASSET_STATUS_COLORS,
    DEPRECIATION_METHOD_LABELS,
} from './types/asset.types';
import type { FixedAsset } from './types/asset.types';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { MaintenanceTab } from './components/MaintenanceTab';
import { ImprovementTab } from './components/ImprovementTab';
import { RetrofitTab } from './components/RetrofitTab';
import { AppraisalTab } from './components/AppraisalTab';
import { DepreciationTab } from './components/DepreciationTab';
import { HistoryTab } from './components/HistoryTab';
import { AssetFormModal } from './modals/AssetFormModal';
import { WriteOffModal } from './modals/WriteOffModal';

type Tab = 'resumo' | 'depreciacao' | 'manutencao' | 'benfeitoria' | 'retrofit' | 'laudos' | 'historico';

const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'resumo', label: 'Resumo', icon: Building2 },
    { key: 'depreciacao', label: 'Depreciação', icon: TrendingDown },
    { key: 'manutencao', label: 'Manutenção', icon: Wrench },
    { key: 'benfeitoria', label: 'Benfeitorias', icon: Layers },
    { key: 'retrofit', label: 'Retrofit', icon: RefreshCw },
    { key: 'laudos', label: 'Laudos', icon: FileText },
    { key: 'historico', label: 'Histórico', icon: History },
];

export default function AssetShow() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { asset, loading, error, fetch } = useAssetDetail();
    const [tab, setTab] = useState<Tab>('resumo');
    const [showEdit, setShowEdit] = useState(false);
    const [showWriteOff, setShowWriteOff] = useState(false);

    useEffect(() => { if (id) fetch(id); }, [id]);

    if (loading) return <LoadingPlaceholder />;
    if (error || !asset) return <ErrorPlaceholder message={error ?? 'Ativo não encontrado'} onBack={() => navigate('/app/assets')} />;

    const pctDeprec = asset.acquisitionCost
        ? Math.round((asset.accumulatedDeprec / asset.acquisitionCost) * 100)
        : 0;
    const remainingMonths = asset.remainingLifeMonths;
    const openMaintenances = asset.maintenances?.filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS').length ?? 0;

    return (
        <div className="p-6 space-y-4">
            {/* ── Breadcrumb + Header ────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/app/assets')} className="text-gray-400 hover:text-gray-700 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400 font-mono">{asset.internalCode}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ASSET_STATUS_COLORS[asset.status]}`}>
                                {ASSET_STATUS_LABELS[asset.status]}
                            </span>
                            {openMaintenances > 0 && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                                    <Wrench className="w-3 h-3" /> {openMaintenances} OS aberta{openMaintenances > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mt-0.5">{asset.description}</h1>
                        <p className="text-sm text-gray-500">{ASSET_GROUP_LABELS[asset.group]}{asset.subgroup ? ` · ${asset.subgroup}` : ''}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowEdit(true)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-700"
                    >
                        <Edit className="w-4 h-4" /> Editar
                    </button>
                    {asset.status === 'PENDING_ACTIVATION' && (
                        <button
                            onClick={() => {/* ativar */ }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                            <CheckCircle className="w-4 h-4" /> Ativar
                        </button>
                    )}
                    {(asset.status === 'ACTIVE' || asset.status === 'INACTIVE') && (
                        <button
                            onClick={() => setShowWriteOff(true)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                        >
                            <XCircle className="w-4 h-4" /> Baixa
                        </button>
                    )}
                </div>
            </div>

            {/* ── Cards de Valores ──────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <ValueCard label="Valor de Aquisição" value={formatCurrency(asset.acquisitionCost)} />
                <ValueCard label="Valor Contábil" value={formatCurrency(asset.bookValue)} highlight />
                <ValueCard label="Depreciação Acum." value={formatCurrency(asset.accumulatedDeprec)} sub={`${pctDeprec}% do custo`} />
                <ValueCard label="Vida Útil Restante" value={`${remainingMonths} meses`} sub={`de ${asset.usefulLifeMonths} meses`} />
            </div>

            {/* ── Barra de depreciação ──────────────────────────── */}
            {!asset.nonDepreciable && (
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Início: {formatDate(asset.depreciationStart)}</span>
                        <span className="font-medium text-gray-700">{pctDeprec}% depreciado</span>
                        <span>Encerra: {(() => {
                            const d = new Date(asset.depreciationStart);
                            d.setMonth(d.getMonth() + asset.usefulLifeMonths);
                            return formatDate(d.toISOString());
                        })()}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full">
                        <div
                            className={`h-2 rounded-full transition-all ${pctDeprec >= 80 ? 'bg-red-500' : pctDeprec >= 50 ? 'bg-orange-400' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(pctDeprec, 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ── Tabs ─────────────────────────────────────────── */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-0 overflow-x-auto">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key
                                ? 'border-blue-700 text-blue-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* ── Conteúdo das tabs ─────────────────────────────── */}
            <div>
                {tab === 'resumo' && <ResumoTab asset={asset} />}
                {tab === 'depreciacao' && <DepreciationTab asset={asset} />}
                {tab === 'manutencao' && <MaintenanceTab asset={asset} onRefresh={() => fetch(id!)} />}
                {tab === 'benfeitoria' && <ImprovementTab asset={asset} onRefresh={() => fetch(id!)} />}
                {tab === 'retrofit' && <RetrofitTab asset={asset} onRefresh={() => fetch(id!)} />}
                {tab === 'laudos' && <AppraisalTab asset={asset} onRefresh={() => fetch(id!)} />}
                {tab === 'historico' && <HistoryTab asset={asset} />}
            </div>

            {/* ── Modais ───────────────────────────────────────── */}
            {showEdit && (
                <AssetFormModal
                    asset={asset}
                    onClose={() => setShowEdit(false)}
                    onSuccess={() => { setShowEdit(false); fetch(id!); }}
                />
            )}
            {showWriteOff && (
                <WriteOffModal
                    asset={asset}
                    onClose={() => setShowWriteOff(false)}
                    onSuccess={() => { setShowWriteOff(false); navigate('/app/assets'); }}
                />
            )}
        </div>
    );
}

// ── Tab: Resumo ───────────────────────────────────────────────
function ResumoTab({ asset }: { asset: FixedAsset }) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dados gerais */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Dados Gerais</h3>
                <InfoRow icon={Hash} label="Código" value={asset.internalCode} />
                <InfoRow icon={Building2} label="Grupo" value={ASSET_GROUP_LABELS[asset.group]} />
                {asset.subgroup && <InfoRow icon={Layers} label="Subgrupo" value={asset.subgroup} />}
                {asset.brand && <InfoRow label="Marca / Modelo" value={`${asset.brand}${asset.model ? ' · ' + asset.model : ''}`} />}
                {asset.serialNumber && <InfoRow label="Nº de Série" value={asset.serialNumber} />}
                {asset.location && <InfoRow icon={MapPin} label="Localização" value={asset.location} />}
                <InfoRow icon={Calendar} label="Data de Aquisição" value={formatDate(asset.acquisitionDate)} />
            </div>

            {/* Depreciação */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Depreciação</h3>
                {asset.nonDepreciable ? (
                    <p className="text-sm text-gray-500 italic">Ativo não depreciável (ex: terreno)</p>
                ) : (
                    <>
                        <InfoRow label="Método" value={DEPRECIATION_METHOD_LABELS[asset.depreciationMethod]} />
                        <InfoRow label="Taxa Anual" value={formatPercent(asset.annualRatePercent)} />
                        <InfoRow label="Vida Útil Total" value={`${asset.usefulLifeMonths} meses`} />
                        <InfoRow label="Vida Útil Restante" value={`${asset.remainingLifeMonths} meses`} />
                        <InfoRow label="Valor Residual" value={formatCurrency(asset.residualValue)} />
                        <InfoRow label="Início da Depreciação" value={formatDate(asset.depreciationStart)} />
                    </>
                )}
            </div>

            {/* Imóvel */}
            {asset.group === 'REAL_ESTATE' && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 lg:col-span-2">
                    <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Dados do Imóvel</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {asset.iptuRegistration && <InfoRow label="Inscrição IPTU" value={asset.iptuRegistration} />}
                        {asset.registryNumber && <InfoRow label="Matrícula Cartório" value={asset.registryNumber} />}
                        {asset.totalArea && <InfoRow label="Área Total" value={`${asset.totalArea} m²`} />}
                        {asset.builtArea && <InfoRow label="Área Construída" value={`${asset.builtArea} m²`} />}
                        {asset.assessedValue && <InfoRow label="Valor Venal" value={formatCurrency(asset.assessedValue)} />}
                        {asset.landValuePercent && <InfoRow label="% Terreno" value={formatPercent(asset.landValuePercent)} />}
                        {asset.landValueAmount && <InfoRow label="Valor do Terreno" value={formatCurrency(asset.landValueAmount)} />}
                        {asset.street && <InfoRow label="Endereço" value={`${asset.street}${asset.city ? ' — ' + asset.city : ''}${asset.state ? '/' + asset.state : ''}`} />}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Helpers UI ────────────────────────────────────────────────
function ValueCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
    return (
        <div className={`rounded-xl p-4 border ${highlight ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-gray-200'}`}>
            <p className={`text-xs font-medium ${highlight ? 'text-blue-200' : 'text-gray-500'}`}>{label}</p>
            <p className={`text-lg font-bold mt-0.5 ${highlight ? 'text-white' : 'text-gray-900'}`}>{value}</p>
            {sub && <p className={`text-xs mt-0.5 ${highlight ? 'text-blue-200' : 'text-gray-400'}`}>{sub}</p>}
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
    return (
        <div className="flex items-start gap-2">
            {Icon && <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />}
            <div className={Icon ? '' : 'ml-6'}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-800">{value}</p>
            </div>
        </div>
    );
}

function LoadingPlaceholder() {
    return (
        <div className="p-6 animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
            </div>
        </div>
    );
}

function ErrorPlaceholder({ message, onBack }: { message: string; onBack: () => void }) {
    return (
        <div className="p-6 flex flex-col items-center justify-center gap-4 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
            <p className="text-red-600">{message}</p>
            <button onClick={onBack} className="text-blue-600 hover:underline text-sm">Voltar</button>
        </div>
    );
}