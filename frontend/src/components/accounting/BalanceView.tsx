// frontend/src/pages/accounting/BalanceView.tsx
import React, { useState, useEffect } from 'react';
import { FiCalendar, FiFilter, FiDownload } from 'react-icons/fi';
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

export const BalanceView: React.FC = () => {
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBalances = async () => {
    setLoading(true);
    try {
      const response = await api.get('/accounting/balances', {
        params: { startDate, endDate }
      });
      setBalances(response.data);
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Balancete</h1>

        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border rounded-lg px-3 py-2"
            />
            <span>até</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border rounded-lg px-3 py-2"
            />
          </div>

          <button
            onClick={loadBalances}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FiFilter className="inline mr-2" />
            Filtrar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Conta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Nome
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Débito
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Crédito
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {balances.map((balance) => (
                <tr key={balance.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(balance.referenceDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-blue-600">
                    {balance.account.code}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-800">
                    {balance.account.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-green-600">
                    {balance.balance > 0 ? balance.balance.toFixed(2) : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-red-600">
                    {balance.balance < 0 ? Math.abs(balance.balance).toFixed(2) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};