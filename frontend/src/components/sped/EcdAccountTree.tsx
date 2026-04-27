// apps/frontend/src/components/sped/EcdAccountTree.tsx
import React, { useState, useMemo } from 'react';

interface Account {
  code: string;
  name: string;
  level: number;
  type: string;
  isAnalytic: boolean;
  balance: number;
}

export const EcdAccountTree: React.FC<{ accounts: Account[] }> = ({ accounts }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtra as contas por código ou nome sem perder a referência de nível
  const filteredAccounts = useMemo(() => {
    if (!searchTerm) return accounts;
    const term = searchTerm.toLowerCase();
    return accounts.filter(
      (acc) =>
        acc.code.toLowerCase().includes(term) ||
        acc.name.toLowerCase().includes(term)
    );
  }, [accounts, searchTerm]);

  return (
    <div className="flex flex-col gap-4">
      {/* Input de Busca */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Filtrar por código ou nome da conta..."
          className="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Código</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Descrição</th>
              <th className="px-4 py-2 text-right font-semibold text-gray-700">Saldo Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map((acc) => (
                <tr
                  key={acc.code}
                  className={`${acc.isAnalytic ? "hover:bg-blue-50/50" : "bg-gray-50/80 font-semibold text-gray-900"}`}
                >
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-600">
                    {acc.code}
                  </td>
                  <td className="px-4 py-2" style={{ paddingLeft: `${acc.level * 12}px` }}>
                    {acc.name}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2 text-right font-mono ${acc.balance < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      signDisplay: 'always'
                    }).format(acc.balance)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500 italic">
                  Nenhuma conta encontrada para o termo "{searchTerm}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};