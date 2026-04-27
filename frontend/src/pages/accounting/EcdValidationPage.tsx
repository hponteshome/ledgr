// apps/frontend/src/pages/accounting/EcdValidationPage.tsx

import React, { useState } from 'react';
import { FiCheckCircle, FiAlertCircle, FiLoader, FiSearch } from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';

interface Divergence {
    accountCode: string;
    accountName: string;
    ecdBalance: number;
    calcBalance: number;
    difference: number;
    reason?: string;
}

interface ValidationResult {
    summary: {
        totalAccounts: number;
        consistent: number;
        divergent: number;
        missingEntries: number;
        isFullyConsistent: boolean;
    };
    divergences: Divergence[];
}

export default function EcdValidationPage() {
    const { activeCompany } = useCompany();
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ValidationResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fmt = (v: number) => {
        const abs = Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        return v < 0 ? `(${abs})` : abs;
    };

    const handleValidate = async () => {
        if (!activeCompany || !periodStart || !periodEnd) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const { data } = await api.get('/chart-of-accounts/validate-ecd', {
                params: {
                    companyId: activeCompany.id,
                    periodStart,
                    periodEnd,
                },
            });
            setResult(data);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Erro ao validar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Validador ECD</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Compara os saldos importados do SPED (I155) com os lançamentos importados (I200/I250).
                    Divergências indicam lançamentos faltantes ou parcialmente importados.
                </p>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-wrap gap-4 items-end shadow-sm">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Período Início
                    </label>
                    <input
                        type="date"
                        value={periodStart}
                        onChange={e => setPeriodStart(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                        Período Fim
                    </label>
                    <input
                        type="date"
                        value={periodEnd}
                        onChange={e => setPeriodEnd(e.target.value)}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={handleValidate}
                    disabled={loading || !periodStart || !periodEnd || !activeCompany}
                    className={`flex items-center gap-2 px-6 py-2 text-white font-bold rounded-lg transition-all ${loading || !periodStart || !periodEnd
                            ? 'bg-slate-300 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {loading
                        ? <><FiLoader className="animate-spin" /> Validando...</>
                        : <><FiSearch size={16} /> Validar</>
                    }
                </button>
            </div>

            {/* Erro */}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <FiAlertCircle /> {error}
                </div>
            )}

            {/* Resultado */}
            {result && (
                <div className="space-y-4">

                    {/* Cards de resumo */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm">
                            <p className="text-2xl font-black text-slate-800">{result.summary.totalAccounts}</p>
                            <p className="text-xs text-slate-500 mt-1">Contas analisadas</p>
                        </div>
                        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center shadow-sm">
                            <p className="text-2xl font-black text-green-700">{result.summary.consistent}</p>
                            <p className="text-xs text-green-600 mt-1">Consistentes</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center shadow-sm">
                            <p className="text-2xl font-black text-amber-700">{result.summary.divergent}</p>
                            <p className="text-xs text-amber-600 mt-1">Com divergência</p>
                        </div>
                        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center shadow-sm">
                            <p className="text-2xl font-black text-red-700">{result.summary.missingEntries}</p>
                            <p className="text-xs text-red-600 mt-1">Sem lançamentos</p>
                        </div>
                    </div>

                    {/* Status geral */}
                    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border font-bold ${result.summary.isFullyConsistent
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                        {result.summary.isFullyConsistent
                            ? <><FiCheckCircle size={20} /> ECD totalmente consistente — saldos batem com os lançamentos importados.</>
                            : <><FiAlertCircle size={20} /> {result.summary.divergent + result.summary.missingEntries} conta(s) com divergência — lançamentos faltantes ou parciais.</>
                        }
                    </div>

                    {/* Tabela de divergências */}
                    {result.divergences.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                                <h2 className="text-sm font-bold text-slate-700">
                                    Contas com Divergência — ordenadas por maior diferença
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-400 uppercase">
                                            <th className="px-4 py-3 text-left">Conta</th>
                                            <th className="px-4 py-3 text-right">Saldo ECD (I155)</th>
                                            <th className="px-4 py-3 text-right">Recalculado (I250)</th>
                                            <th className="px-4 py-3 text-right">Diferença</th>
                                            <th className="px-4 py-3 text-left">Diagnóstico</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {result.divergences.map((d, i) => (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-xs text-blue-600 mr-2">{d.accountCode}</span>
                                                    <span className="text-slate-700">{d.accountName}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                    {fmt(d.ecdBalance)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                    {fmt(d.calcBalance)}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-mono font-bold ${Math.abs(d.difference) > 0 ? 'text-amber-600' : 'text-green-500'
                                                    }`}>
                                                    {d.difference > 0 ? '+' : ''}{fmt(d.difference)}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-slate-400 italic">
                                                    {d.reason || (
                                                        d.calcBalance === 0
                                                            ? 'Sem lançamentos importados'
                                                            : 'Lançamentos parcialmente importados'
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}