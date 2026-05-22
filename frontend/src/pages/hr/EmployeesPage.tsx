// frontend/src/pages/hr/EmployeesPage.tsx
import React, { useState, useEffect } from 'react';
import { FiPlus, FiUser, FiUpload } from 'react-icons/fi';
import api from '@/services/api';
import { EmployeeImportModal } from './EmployeeImportModal';

function fmtCpf(v: string) { return v?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') ?? v; }
function fmtDate(s: string | null) { if (!s) return '—'; try { return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR'); } catch { return s; } }
function fmtSalary(v: any) { return v ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'; }

export const EmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/hr/employees');
      setEmployees(data);
    } catch { }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Funcionários</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Cadastro de funcionários — base eSocial · {employees.length} {employees.length === 1 ? 'funcionário' : 'funcionários'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
            <FiUpload size={15} /> Importar PDF
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FiUser size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Nenhum funcionário cadastrado.</p>
            <button onClick={() => setShowImport(true)} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              Importar ficha cadastral PDF
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Nome', 'CPF', 'Função', 'Admissão', 'Salário', 'Situação'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-600">
                          {e.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">{e.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{fmtCpf(e.taxId)}</td>
                  <td className="px-4 py-3 text-gray-600">{e.role}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(e.hireDate)}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtSalary(e.salary)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {e.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showImport && (
        <EmployeeImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); load(); }}
        />
      )}
    </div>
  );
};