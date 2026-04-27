// src/pages/companies/corporate/contratos/ContratoView.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiFileText, FiPrinter } from 'react-icons/fi';
import { useCompany } from '@/contexts/CompanyContext';
import { DOC_STYLES, RenderDocument } from '@/components/DocumentStylePicker';
import api from '@/services/api';

interface Doc {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string;
  date: string | null;
  description: string | null; // styleId
  bookNumber: number | null;
}

export const ContratoView: React.FC = () => {
  const { companyId, docId } = useParams<{ companyId: string; docId: string }>();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);

  const companyName = activeCompany?.legalName ?? activeCompany?.tradeName ?? '';
  const cnpj = activeCompany?.taxId ?? '';
  const _ac = activeCompany as any;
  const registerInfo = _ac?.registerOrg
    ? (_ac.registerOrg.toLowerCase().includes('jucesp')
      ? `NIRE: ${_ac.registerNumber ?? ''}`
      : `${_ac.registerOrg}${_ac.registerNumber ? ` nº ${_ac.registerNumber}` : ''}`)
    : (_ac?.nire ? `NIRE: ${_ac.nire}` : undefined);

  useEffect(() => {
    if (!docId) return;
    api.get(`/contratos/${docId}`)
      .then(r => setDoc(r.data))
      .catch(() => alert('Erro ao carregar documento.'))
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) return <div className="text-center py-16 text-gray-400">Carregando…</div>;
  if (!doc) return <div className="text-center py-16 text-red-400">Documento não encontrado.</div>;

  const activeStyle = DOC_STYLES.find(s => s.id === (doc.description ?? 'minimalista')) ?? DOC_STYLES[0];

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}`)}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{doc.title}</h1>
            <p className="text-xs text-gray-400">
              {doc.type === 'CONTRATO_SOCIAL' ? 'Contrato Social' : 'Alteração Contratual'}
              {doc.date && ` — ${new Date(doc.date).toLocaleDateString('pt-BR')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
          >
            <FiPrinter size={13} /> Imprimir
          </button>
          <button
            onClick={() => navigate(`/app/companies/corporate/contratos/${companyId}/edit/${docId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiEdit2 size={13} /> Editar
          </button>
        </div>
      </div>

      {/* Documento */}
      <div className="p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
            <FiFileText size={14} className="text-gray-400" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              Texto da {doc.type === 'CONTRATO_SOCIAL' ? 'Contrato Social' : 'Alteração Contratual'}
            </span>
          </div>
          <RenderDocument
            style={activeStyle}
            content={doc.content ?? ''}
            companyName={companyName}
            docTitle={doc.title}
            cnpj={cnpj}
            registerInfo={registerInfo}
          />
        </div>
      </div>
    </div>
  );
};