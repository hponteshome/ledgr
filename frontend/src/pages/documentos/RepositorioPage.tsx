// frontend/src/pages/documentos/RepositorioPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { FiFileText, FiCheckCircle, FiClock, FiArchive, FiDownload, FiEye, FiShield, FiFilter, FiUpload } from 'react-icons/fi';
import { SignatureValidateModal } from '../documents/signatures/SignatureValidateModal';
import { DocumentViewModal } from './DocumentViewModal';
import { ImportarDocumentoModal } from './ImportarDocumentoModal';
import api from '../../services/api';

const SHELF_CONFIG: Record<string, { label: string; types: string[] }> = {
  'societario/contratos': { label: 'Contratos Sociais / Estatutos', types: ['CONTRATO_SOCIAL','ESTATUTO_SOCIAL','ADITIVO_CONTRATUAL'] },
  'societario/atas':      { label: 'Atas Assinadas', types: ['ATA_AGO','ATA_AGE','ATA_DIRETORIA'] },
  'societario/procuracoes': { label: 'Procurações', types: ['PROCURACAO'] },
  'societario/acordos':   { label: 'Acordos de Acionistas', types: ['ACORDO_ACIONISTAS'] },
  'societario/livros':    { label: 'Livros Encerrados', types: ['LIVRO_REGISTRO_ACOES','LIVRO_TRANSFERENCIA_ACOES','LIVRO_ATAS_AGO','LIVRO_ATAS_AGE'] },
  'societario':           { label: 'Arquivo Societário', types: ['CONTRATO_SOCIAL','ESTATUTO_SOCIAL','ATA_AGO','ATA_AGE','ATA_DIRETORIA','PROCURACAO','ACORDO_ACIONISTAS','ADITIVO_CONTRATUAL','LIVRO_REGISTRO_ACOES','LIVRO_TRANSFERENCIA_ACOES','LIVRO_ATAS_AGO','LIVRO_ATAS_AGE'] },
  'contabil/balancetes':  { label: 'Balancetes Aprovados', types: ['CONTABIL'] },
  'contabil/ecd':         { label: 'ECDs Assinados', types: ['CONTABIL'] },
  'contabil/demonstracoes': { label: 'Demonstrações Financeiras', types: ['CONTABIL'] },
  'contabil':             { label: 'Arquivo Contábil', types: ['CONTABIL'] },
  'fiscal/ecf':           { label: 'ECFs Assinados', types: ['FISCAL'] },
  'fiscal/obrigacoes':    { label: 'Obrigações Acessórias', types: ['FISCAL'] },
  'fiscal':               { label: 'Arquivo Fiscal', types: ['FISCAL'] },
  'rh/contratos':         { label: 'Contratos de Trabalho', types: ['TRABALHISTA'] },
  'rh/procuracoes':       { label: 'Procurações Trabalhistas', types: ['PROCURACAO'] },
  'rh/acordos':           { label: 'Acordos Coletivos', types: ['TRABALHISTA'] },
  'rh':                   { label: 'Arquivo RH / Trabalhista', types: ['TRABALHISTA'] },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  RASCUNHO:              { label: 'Rascunho',       color: 'bg-gray-100 text-gray-600',    icon: <FiFileText size={11} /> },
  EM_REVISAO:            { label: 'Em Revisão',     color: 'bg-yellow-50 text-yellow-700', icon: <FiClock size={11} /> },
  AGUARDANDO_ASSINATURA: { label: 'Ag. Assinatura', color: 'bg-orange-50 text-orange-700', icon: <FiClock size={11} /> },
  ASSINADO:              { label: 'Assinado',       color: 'bg-green-50 text-green-700',   icon: <FiCheckCircle size={11} /> },
  REGISTRADO:            { label: 'Registrado',     color: 'bg-blue-50 text-blue-700',     icon: <FiCheckCircle size={11} /> },
  ARQUIVADO:             { label: 'Arquivado',      color: 'bg-gray-200 text-gray-500',    icon: <FiArchive size={11} /> },
  CANCELADO:             { label: 'Cancelado',      color: 'bg-red-50 text-red-700',       icon: <FiFileText size={11} /> },
};

export const RepositorioPage: React.FC = () => {
  const location = useLocation();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [validateDocId, setValidateDocId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [viewDoc, setViewDoc] = useState<{id:string;title:string} | null>(null);

  const shelf = location.pathname.replace('/app/arquivo/', '');
  const config = SHELF_CONFIG[shelf] ?? { label: 'Arquivo', types: [] };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
        const params = new URLSearchParams({ companyId: company.id ?? '' });
        if (filterStatus) params.append('status', filterStatus);
        const res = await api.get(`/documents?${params}`);
        const all = res.data ?? [];
        const filtered = config.types.length > 0
          ? all.filter((d: any) => config.types.includes(d.type))
          : all;
        setDocs(filtered);
      } catch { setDocs([]); }
      setLoading(false);
    };
    load();
  }, [location.pathname, filterStatus]);

  const fmtDate = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR');
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[22px] font-medium text-gray-900">{config.label}</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{docs.length} documento{docs.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#111] text-white rounded-lg text-[13px] mr-2"><FiUpload size={13} /> Importar Documento</button>
          <FiFilter size={14} className="text-gray-400" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-[13px] border border-gray-200 rounded-lg px-3 py-1.5">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-gray-200 rounded-[10px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">Documento</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">Tipo</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">Data</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">Status</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-[14px]">Carregando...</td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center">
                <FiArchive size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-[14px] text-gray-400">Nenhum documento nesta prateleira</p>
                <p className="text-[12px] text-gray-300 mt-1">Os documentos aparecem aqui automaticamente quando finalizados</p>
              </td></tr>
            ) : docs.map(doc => {
              const st = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG['RASCUNHO'];
              return (
                <tr key={doc.id} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-[14px] font-medium text-gray-900">{doc.title}</p>
                    {doc.description && <p className="text-[12px] text-gray-400 mt-0.5">{doc.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] text-gray-500">{doc.type?.replace(/_/g,' ')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[13px] text-gray-600">{fmtDate(doc.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${st.color}`}>
                      {st.icon} {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button title="Visualizar" onClick={() => setViewDoc({id: doc.id, title: doc.title})} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded">
                        <FiEye size={14} />
                      </button>
                      <button title="Baixar PDF" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded">
                        <FiDownload size={14} />
                      </button>
                      <button title="Validar Assinatura"
                        onClick={() => setValidateDocId(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-purple-700 hover:bg-purple-50 rounded">
                        <FiShield size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showImport && <ImportarDocumentoModal onClose={() => setShowImport(false)} onSuccess={() => window.location.reload()} />}
      {viewDoc !== null && (
        <DocumentViewModal
          documentId={viewDoc.id}
          documentTitle={viewDoc.title}
          onClose={() => setViewDoc(null)}
          onValidate={(id) => { setValidateDocId(id); setViewDoc(null); }}
        />
      )}
      {validateDocId !== null && (
        <SignatureValidateModal documentId={validateDocId} onClose={() => setValidateDocId(null)} />
      )}
    </div>
  );
};
