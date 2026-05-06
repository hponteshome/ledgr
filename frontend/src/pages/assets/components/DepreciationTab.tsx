// ============================================================
// frontend/src/pages/assets/components/DepreciationTab.tsx
// ============================================================
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useAssetMutations } from '../hooks/useAssets';
import type { FixedAsset } from '../types/asset.types';
import { formatCurrency } from '../../../utils/formatters';

export function DepreciationTab({ asset }: { asset: FixedAsset }) {
    const { getDepreciationProjection } = useAssetMutations();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        getDepreciationProjection(asset.id).then(setData);
    }, [asset.id]);

    if (asset.nonDepreciable) return (
        <div className="py-10 text-center text-gray-400 text-sm">Este ativo não é depreciável</div>
    );

    const history = asset.depreciationLogs ?? [];
    const projection = data?.projection ?? [];

    console.log('PERIOD SAMPLE', history[0]?.period, typeof history[0]?.period);
    const chartData = [
        ...history.map(d => ({
                month: (() => { const d = new Date(d.period); return d.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('. ', '/'); })(),
            bookValue: Number(d.bookValueAfter),
            accumDeprec: Number(d.accumDeprecAfter),
            type: 'real',
        })),
        ...projection.map((d: any) => ({
                month: (() => { const raw = d.period ?? d.month; const dt = new Date(raw); return dt.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('. ', '/'); })(),
            bookValueProjected: d.bookValue ?? d.balance,
            accumDeprecProjected: d.accumDeprec ?? d.accumulatedDepreciation,
            type: 'projection',
        })),
    ];

    // Cálculo da quota mensal para exibição
    const monthlyCharge = asset.acquisitionCost && asset.usefulLifeMonths
        ? (Number(asset.acquisitionCost) - Number(asset.landValueAmount ?? 0) - Number(asset.residualValue)) / asset.usefulLifeMonths
        : 0;

    return (
        <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-400">Quota Mensal (Linear)</p>
                    <p className="text-lg font-bold">{formatCurrency(monthlyCharge)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-400">Depreciação Acumulada</p>
                    <p className="text-lg font-bold">{formatCurrency(asset.accumulatedDeprec)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-400">Meses Restantes</p>
                    <p className="text-lg font-bold">{asset.remainingLifeMonths}</p>
                </div>
            </div>

            {/* Gráfico */}
            {chartData.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Curva de Depreciação</h3>
                    <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(v: any) => formatCurrency(v)} />
                            <Legend />
                            <ReferenceLine y={Number(asset.residualValue)} stroke="#999" strokeDasharray="4 4" label={{ value: 'Residual', fontSize: 10 }} />
                            <Line type="monotone" dataKey="bookValue" stroke="#1d4ed8" strokeWidth={2} dot={false} name="Valor Contábil (real)" />
                            <Line type="monotone" dataKey="bookValueProjected" stroke="#1d4ed8" strokeWidth={2} dot={false} strokeDasharray="5 5" name="Valor Contábil (projeção)" />
                            <Line type="monotone" dataKey="accumDeprec" stroke="#f97316" strokeWidth={2} dot={false} name="Deprec. Acum. (real)" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Tabela histórico */}
            {history.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Competência</th>
                                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Quota Mensal</th>
                                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Deprec. Acum.</th>
                                    <th className="text-right px-4 py-2 text-xs font-medium text-gray-500">Valor Contábil</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.slice(0, 24).map(d => (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 font-mono text-xs">{new Date(d.period).toLocaleString('pt-BR', { month: 'short', year: 'numeric' }).replace('. ', '/')}</td>
                                        <td className="px-4 py-2 text-right text-red-600 text-xs">{formatCurrency(d.monthlyCharge)}</td>
                                        <td className="px-4 py-2 text-right text-xs">{formatCurrency(d.accumDeprecAfter)}</td>
                                        <td className="px-4 py-2 text-right font-medium text-xs">{formatCurrency(d.bookValueAfter)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
