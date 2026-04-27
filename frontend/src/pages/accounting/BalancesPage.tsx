// frontend/src/pages/accounting/BalancesPage.tsx
import React, { useState, useEffect } from 'react';
import { FiCalendar, FiFilter, FiSearch, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import api from '../../services/api';

interface Balance {
    id: string;
    balance: number;
    referenceDate: string;
    account: {
        code: string;
        name: string;
        type: string;
        nature: string;
    };
}

const BalancesPage: React.FC = () => {
    const [startDate, setStartDate] = useState(
        new Date(new Date().getFullYear() - 1, 0, 1).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [balances, setBalances] = useState<Balance[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadBalances = async () => {
        setLoading(true);
        try {
            const response = await api.get('/accounting/balances', {
                params: { startDate, endDate }
            });
            setBalances(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Erro ao carregar saldos:', error);
            setBalances([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBalances();
    }, []);

    const filtered = balances.filter(b =>
        b.account.code.includes(search) ||
        b.account.name.toLowerCase().includes(search.toLowerCase())
    );

    const totalDebito = filtered.filter(b => b.balance > 0).reduce((s, b) => s + b.balance, 0);
    const totalCredito = filtered.filter(b => b.balance < 0).reduce((s, b) => s + Math.abs(b.balance), 0);

    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Saldos por Período</h1>
                    <p className="text-sm text-gray-500 mt-1">Consulta de saldos contábeis por intervalo de datas</p>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end shadow-sm">
                <div className="flex items-center gap-2">
                    <FiCalendar className="text-gray-400" size={16} />
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Data inicial</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-gray-500 block mb-1">Data final</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={loadBalances}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                >
                    <FiFilter size={14} />
                    {loading ? 'Carregando...' : 'Filtrar'}
                </button>
                <div className="flex-1 min-w-48">
                    <label className="text-xs text-gray-500 block mb-1">Buscar conta</label>
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                            type="text"
                            placeholder="Código ou nome..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Totalizadores */}
            {!loading && filtered.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <p className="text-xs text-gray-500 mb-1">Total de registros</p>
                        <p className="text-2xl font-bold text-gray-800">{filtered.length}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl border border-green-100 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <FiTrendingUp className="text-green-600" size={14} />
                            <p className="text-xs text-green-600">Total Débito</p>
                        </div>
                        <p className="text-xl font-bold text-green-700">R$ {fmt(totalDebito)}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl border border-red-100 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                            <FiTrendingDown className="text-red-500" size={14} />
                            <p className="text-xs text-red-500">Total Crédito</p>
                        </div>
                        <p className="text-xl font-bold text-red-600">R$ {fmt(totalCredito)}</p>
                    </div>
                </div>
            )}

            {/* Tabela */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="text-center py-16 text-gray-400">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
                        Carregando saldos...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <FiCalendar size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhum saldo encontrado</p>
                        <p className="text-sm mt-1">Ajuste o período ou importe saldos pelo menu Accounting</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conta</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Débito</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Crédito</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map((balance) => (
                                <tr key={balance.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-3 text-sm text-gray-500">
                                        {new Date(balance.referenceDate).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-3 text-sm font-mono text-blue-600 font-medium">
                                        {balance.account.code}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-gray-800">
                                        {balance.account.name}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${balance.account.nature === 'DEVEDORA'
                                                ? 'bg-green-50 text-green-700'
                                                : 'bg-red-50 text-red-700'
                                            }`}>
                                            {balance.account.nature}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-sm text-right font-mono text-green-700 font-medium">
                                        {balance.balance > 0 ? `R$ ${fmt(balance.balance)}` : '-'}
                                    </td>
                                    <td className="px-6 py-3 text-sm text-right font-mono text-red-600 font-medium">
                                        {balance.balance < 0 ? `R$ ${fmt(Math.abs(balance.balance))}` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default BalancesPage;