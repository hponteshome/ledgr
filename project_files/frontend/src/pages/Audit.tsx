import React from 'react';
import { FiActivity, FiClock, FiUser, FiShield } from 'react-icons/fi';

// Named export following the project pattern (e.g., export const Audit)
export const Audit: React.FC = () => {
  const logs = [
    { id: 1, action: 'Login', user: 'Ledgr Administrator', date: '02/03/2026 14:30', ip: '192.168.1.1', status: 'Success' },
    { id: 2, action: 'Company Registration', user: 'Ledgr Administrator', date: '02/03/2026 15:10', ip: '192.168.1.1', status: 'Success' },
    { id: 3, action: 'User Deletion', user: 'John Doe', date: '02/03/2026 15:45', ip: '177.42.10.5', status: 'Denied' },
  ];

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FiShield className="text-blue-600" /> System Audit
        </h1>
        <p className="text-gray-500">Activity tracking and security logs</p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Event</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">User</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Date/Time</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-700">{log.action}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 flex items-center gap-2">
                    <FiUser className="text-gray-400" /> {log.user}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <FiClock size={12} /> {log.date}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${log.status === 'Success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};