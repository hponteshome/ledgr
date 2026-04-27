import React, { useEffect, useState } from 'react';

export const AuditLogs = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Aqui você chamará a rota HTTP que criamos no Gateway
    fetch('http://localhost:3000/auditoria/logs')
      .then(res => res.json())
      .then(data => setLogs(data));
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Trilha de Auditoria - Ledgr</h1>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-100 text-gray-600 uppercase text-sm">
              <th className="px-5 py-3 border-b">Data</th>
              <th className="px-5 py-3 border-b">Ação</th>
              <th className="px-5 py-3 border-b">Usuário</th>
              <th className="px-5 py-3 border-b">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 border-b text-sm">
                  {new Date(log.criadoEm).toLocaleString()}
                </td>
                <td className="px-5 py-4 border-b text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                    {log.acao}
                  </span>
                </td>
                <td className="px-5 py-4 border-b text-sm">{log.usuario}</td>
                <td className="px-5 py-4 border-b text-sm">
                  <button className="text-indigo-600 hover:text-indigo-900 font-medium">
                    Ver JSON
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
