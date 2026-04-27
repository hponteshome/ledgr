// src/pages/companies/corporate/contratos/ContratoList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiPlus, FiEye, FiEdit2, FiFileText, FiClock,
  FiCheckCircle, FiAlertCircle, FiRefreshCw,
} from 'react-icons/fi';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';

// ── Tipos ─────────────────────────────────────────────────────
interface ContratoDoc {
  id: string;
  type: 'CONTRATO_SOCIAL' | 'ADITIVO_CONTRATUAL';
  title: string;
  date: string | null;
  status: string;
  bookNumber: number | null;
  description: string | null; // styleId
  createdAt: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  RASCUNHO: { label: 'Rascunho', color: 'text-gray-500  bg-gray-50   border-gray-200', icon: <FiEdit2 size={11} /> },
  EM_REVISAO: { label: 'Em Revisão', color: 'text-amber-600 bg-amber-50  border-amber-200', icon: <FiClock size={11} /> },
  AGUARDANDO_ASSINATURA: { label: 'Ag. Assinatura', color: 'text-blue-600  bg-blue-50   border-blue-200', icon: <FiAlertCircle size={11} /> },
  ASSINADO: { label: 'Assinado', color: 'text-green-600 bg-green-50  border-green-200', icon: <FiCheckCircle size={11} /> },
  REGISTRADO: { label: 'Registrado', color: 'text-purple-600 bg-purple-50 border-purple-200', icon: <FiCheckCircle size={11} /> },
  ARQUIVADO: { label: 'Arquivado', color: 'text-gray-400  bg-gray-50   border-gray-200', icon: <FiRefreshCw size={11} /> },
};

const TYPE_LABEL: Record<string, string> = {
  CONTRATO_SOCIAL: 'Contrato Social',
  ADITIVO_CONTRATUAL: 'Alteração / Aditivo',
};

// ── Componente ─────────────────────────────────────────────────
export const ContratoList: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id ?? '';

  const [docs, setDocs] = useState<ContratoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    api.get('/contratos', {
      params: { companyId },
    })
      .then(r => setDocs(r.data?.data ?? r.data ?? []))
      .catch(() => setError('Erro ao carregar documentos.'))
      .finally(() => setLoading(false));
  }, [companyId]);

  const contratoPrincipal = docs.find(d => d.type === 'CONTRATO_SOCIAL');
  const alteracoes = docs.filter(d => d.type === 'ADITIVO_CONTRATUAL');

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  const statusBadge = (status: string) => {
    const s = STATUS_LABEL[status] ?? { label: status, color: 'text-gray-500 bg-gray-50 border-gray-200', icon: null };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.color}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  if (!companyId) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Selecione uma empresa para visualizar os documentos societários.
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contrato Social e Alterações</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCompany?.legalName} — documentos constitutivos
          </p>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-gray-400">Carregando documentos…</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Contrato Social Principal */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiFileText size={16} className="text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Contrato Social
                </h2>
              </div>
              {!contratoPrincipal && (
                <button
                  onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}/new?type=CONTRATO_SOCIAL`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiPlus size={13} /> Criar Contrato Social
                </button>
              )}
            </div>

            {contratoPrincipal ? (
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{contratoPrincipal.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>Data: {fmtDate(contratoPrincipal.date)}</span>
                    {contratoPrincipal.bookNumber && <span>Livro nº {contratoPrincipal.bookNumber}</span>}
                    <span>Atualizado: {fmtDate(contratoPrincipal.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(contratoPrincipal.status)}
                  <button
                    onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}/view/${contratoPrincipal.id}`)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Visualizar"
                  >
                    <FiEye size={16} />
                  </button>
                  <button
                    onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}/edit/${contratoPrincipal.id}`)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <FiEdit2 size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                Nenhum Contrato Social cadastrado.
              </div>
            )}
          </div>

          {/* Alterações */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiRefreshCw size={15} className="text-purple-600" />
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Alterações Contratuais
                </h2>
                <span className="ml-1 text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-semibold">
                  {alteracoes.length}
                </span>
              </div>
              <button
                onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}/new?type=ADITIVO_CONTRATUAL`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FiPlus size={13} /> Nova Alteração
              </button>
            </div>

            {alteracoes.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                Nenhuma alteração registrada.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3 text-left font-semibold">Nº</th>
                    <th className="px-4 py-3 text-left font-semibold">Título</th>
                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {alteracoes.map((doc, idx) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 text-gray-400 font-mono text-xs">{idx + 1}ª</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{doc.title}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(doc.date)}</td>
                      <td className="px-4 py-3">{statusBadge(doc.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}/view/${doc.id}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Visualizar"
                          >
                            <FiEye size={14} />
                          </button>
                          <button
                            onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}/edit/${doc.id}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <FiEdit2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
};