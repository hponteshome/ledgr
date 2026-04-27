import React, { useState } from 'react';
import {
    FiDollarSign,
    FiTrendingUp,
    FiTrendingDown,
    FiPieChart,
    FiCalendar,
    FiDownload,
    FiFilter,
    FiEye,
    FiCreditCard,
    FiBarChart2,
    FiArrowUpRight,
    FiArrowDownRight
} from 'react-icons/fi';

interface Transaction {
    id: string;
    date: string;
    description: string;
    category: string;
    value: number;
    type: 'income' | 'expense';
    status: 'paid' | 'pending' | 'overdue';
}

export const Financial: React.FC = () => {
    const [period, setPeriod] = useState('month');
    const [selectedMonth, setSelectedMonth] = useState('2026-03');

    // Dados mockados
    const summary = {
        revenue: 1258900.00,
        expenses: 892300.00,
        profit: 366600.00,
        profitMargin: 29.1,
        pendingInvoices: 234500.00,
        overdueInvoices: 45600.00,
        cashFlow: 458900.00
    };

    const recentTransactions: Transaction[] = [
        {
            id: '1',
            date: '2026-03-08',
            description: 'Recebimento Cliente - Empresa XYZ',
            category: 'Receita',
            value: 45000.00,
            type: 'income',
            status: 'paid'
        },
        {
            id: '2',
            date: '2026-03-07',
            description: 'Pagamento Fornecedor - Tech Solutions',
            category: 'Despesa Operacional',
            value: 12300.00,
            type: 'expense',
            status: 'paid'
        },
        {
            id: '3',
            date: '2026-03-06',
            description: 'Nota Fiscal #1234 - Serviços Prestados',
            category: 'Receita',
            value: 8900.00,
            type: 'income',
            status: 'pending'
        },
        {
            id: '4',
            date: '2026-03-05',
            description: 'Aluguel - Matriz',
            category: 'Despesa Fixa',
            value: 15000.00,
            type: 'expense',
            status: 'paid'
        },
        {
            id: '5',
            date: '2026-03-04',
            description: 'Honorários Contábeis',
            category: 'Serviços',
            value: 8500.00,
            type: 'expense',
            status: 'overdue'
        }
    ];

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status: string) => {
        const statusMap = {
            paid: { bg: 'bg-green-100', text: 'text-green-700', label: 'Pago' },
            pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendente' },
            overdue: { bg: 'bg-red-100', text: 'text-red-700', label: 'Vencido' }
        };
        return statusMap[status as keyof typeof statusMap] || statusMap.pending;
    };

    return (
        <div className="space-y-6">
            {/* Header da página */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Financial Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Acompanhe a saúde financeira da sua empresa
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                        <option value="month">Este Mês</option>
                        <option value="quarter">Este Trimestre</option>
                        <option value="year">Este Ano</option>
                    </select>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                        <FiDownload size={16} />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Receita Total */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Receita Total</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">
                                {formatCurrency(summary.revenue)}
                            </p>
                            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                                <FiArrowUpRight size={14} />
                                +12.5% vs mês anterior
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                            <FiTrendingUp size={24} />
                        </div>
                    </div>
                </div>

                {/* Despesas */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Despesas Totais</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">
                                {formatCurrency(summary.expenses)}
                            </p>
                            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                                <FiArrowDownRight size={14} />
                                +5.8% vs mês anterior
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                            <FiTrendingDown size={24} />
                        </div>
                    </div>
                </div>

                {/* Lucro Líquido */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Lucro Líquido</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">
                                {formatCurrency(summary.profit)}
                            </p>
                            <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                                <FiPieChart size={12} />
                                Margem: {summary.profitMargin}%
                            </p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                            <FiDollarSign size={24} />
                        </div>
                    </div>
                </div>

                {/* Fluxo de Caixa */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">Fluxo de Caixa</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">
                                {formatCurrency(summary.cashFlow)}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                    Pendente: {formatCurrency(summary.pendingInvoices)}
                                </span>
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                    Vencido: {formatCurrency(summary.overdueInvoices)}
                                </span>
                            </div>
                        </div>
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                            <FiCreditCard size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Receita vs Despesa */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">Receita vs Despesa</h2>
                        <select className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white">
                            <option>Últimos 6 meses</option>
                            <option>Últimos 12 meses</option>
                        </select>
                    </div>
                    <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                        <div className="text-center">
                            <FiBarChart2 size={48} className="mx-auto text-gray-300 mb-2" />
                            <p className="text-sm text-gray-400">Gráfico de evolução mensal</p>
                            <p className="text-xs text-gray-300">Integração com biblioteca de gráficos</p>
                        </div>
                    </div>
                </div>

                {/* Despesas por Categoria */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-gray-800">Despesas por Categoria</h2>
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                            Ver detalhes
                        </button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Despesas Operacionais</span>
                                <span className="font-medium text-gray-800">45%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Folha de Pagamento</span>
                                <span className="font-medium text-gray-800">30%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-green-600 h-2 rounded-full" style={{ width: '30%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Impostos e Taxas</span>
                                <span className="font-medium text-gray-800">15%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '15%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Serviços Terceiros</span>
                                <span className="font-medium text-gray-800">10%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '10%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transações Recentes */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">Transações Recentes</h2>
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                            <FiFilter size={16} />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                            <FiEye size={16} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Data
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Descrição
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Categoria
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Valor
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {recentTransactions.map((transaction) => {
                                const status = getStatusBadge(transaction.status);
                                return (
                                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                            {formatDate(transaction.date)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-800">
                                            {transaction.description}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {transaction.category}
                                        </td>
                                        <td className={`px-6 py-4 text-sm font-mono text-right whitespace-nowrap ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {transaction.type === 'income' ? '+' : '-'}
                                            {formatCurrency(transaction.value)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`block w-20 mx-auto px-2 py-1 text-xs font-semibold rounded-full text-center ${status.bg} ${status.text}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                        Mostrando 5 de 45 transações
                    </p>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Ver todas
                    </button>
                </div>
            </div>
        </div>
    );
};