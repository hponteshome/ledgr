// src/pages/documents/signatures/SignatureList.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiFileText, FiClock, FiCheckCircle, FiDownload, FiUpload, FiShield, FiAward, FiPlus, FiKey } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { SignatureValidateModal } from './SignatureValidateModal';

const DS = {
  th: 'px-3.5 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500 bg-gray-50 border-b border-gray-200',
  td: 'px-3.5 py-2.5 text-[14px] text-gray-700 border-b border-gray-100',
};

export const SignatureList: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'documents' | 'certificates'>('documents');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [uploadModal, setUploadModal] = useState<{ docId: string; signerId: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validateModal, setValidateModal] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    try {
      const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
      const res = await api.get('/documents?companyId=' + (company.id ?? ''));
      const docs = res.data ?? [];
      // Buscar signatários para cada documento
      const docsWithSigners = await Promise.all(docs.map(async (d: any) => {
        try {
          const s = await api.get(`/signatures/documents/${d.id}/signers`);
          return { ...d, signers: s.data ?? [] };
        } catch { return { ...d, signers: [] }; }
      }));
      setDocuments(docsWithSigners);
    } catch { setDocuments([]); }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadDocuments().finally(() => setLoading(false));
  }, [loadDocuments]);

  const handleDownloadPdf = async (docId: string, title: string) => {
    try {
      const res = await api.get(`/documents/${docId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `${title}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Erro ao baixar PDF'); }
  };

  const handleUploadSigned = async (file: File) => {
    if (!uploadModal) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('signerId', uploadModal.signerId);
      await fetch(`/api/signatures/documents/${uploadModal.docId}/upload-signed`, {
        method: 'POST',
        headers: {
          'x-company-id': JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}').id ?? '',
          'Authorization': 'Bearer ' + localStorage.getItem('@ledgr:token'),
        },
        body: fd,
      });
      setUploadModal(null);
      await loadDocuments();
    } catch { alert('Erro ao enviar PDF assinado'); }
    setUploading(false);
  };

  const handleGovBr = async (docId: string, signerId: string) => {
    try {
      const res = await api.post(`/signatures/documents/${docId}/sign/govbr/init`, {
        signerId,
        redirectUrl: window.location.origin + '/app/documents/signatures',
      });
      if (res.data?.authUrl) window.location.href = res.data.authUrl;
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro ao iniciar gov.br'); }
  };

  const filteredDocs = documents.filter(d => {
    if (filter === 'pending') return d.status === 'AGUARDANDO_ASSINATURA' || d.status === 'EM_REVISAO';
    if (filter === 'signed') return d.status === 'ASSINADO';
    return true;
  });

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-[22px] font-medium text-gray-900">Assinaturas Digitais</h1>
        <div className="flex gap-3">
          <button onClick={() => setValidateModal('')}
            className="flex items-center gap-2 px-6 py-3 border border-gray-200 rounded-lg text-[16px] text-gray-600 hover:bg-gray-50">
            <FiShield size={18} /> Validar Assinatura
          </button>
          <button onClick={() => navigate('/app/documents/signatures/request')}
            className="flex items-center gap-2 px-6 py-3 bg-[#111] text-white rounded-lg text-[16px]">
            <FiPlus size={18} /> Nova Solicitação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[['all','Todos'],['pending','Pendentes'],['signed','Assinados']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1 rounded-full text-[13px] font-medium ${filter === v ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Lista de documentos */}
      <div className="border border-gray-200 rounded-[10px] overflow-hidden">
        <div className="divide-y divide-gray-100">
          {filteredDocs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <FiFileText size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-[15px]">Nenhum documento encontrado</p>
              <button onClick={() => navigate('/app/documents/signatures/request')}
                className="mt-4 px-4 py-2 bg-[#111] text-white rounded-lg text-[14px]">
                Criar primeira solicitação
              </button>
            </div>
          ) : filteredDocs.map(doc => (
            <div key={doc.id} className="p-5 hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FiFileText size={15} className="text-gray-400" />
                    <span className="font-medium text-[15px] text-gray-900">{doc.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      doc.status === 'ASSINADO' ? 'bg-green-100 text-green-700' :
                      doc.status === 'AGUARDANDO_ASSINATURA' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'}`}>
                      {doc.status === 'ASSINADO' ? '✓ Assinado' :
                       doc.status === 'AGUARDANDO_ASSINATURA' ? '⏳ Aguardando Assinatura' :
                       doc.status ?? 'Rascunho'}
                    </span>
                  </div>
                  {doc.description && <p className="text-[13px] text-gray-500 mb-2">{doc.description}</p>}

                  {/* Fila de signatários */}
                  {doc.signers?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {doc.signers.map((s: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-400 w-4">#{s.order}</span>
                          {s.status === 'ASSINADO'
                            ? <FiCheckCircle size={13} className="text-green-600" />
                            : <FiClock size={13} className="text-yellow-500" />}
                          <span className="text-[13px] text-gray-700">{s.name}</span>
                          {s.role && <span className="text-[11px] text-gray-400">({s.role})</span>}
                          {s.status !== 'ASSINADO' && (
                            <div className="flex gap-1 ml-2">
                              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded font-medium">
                                ⏳ Aguardando via ClickSign
                              </span>
                            </div>
                          )}
                          {s.status === 'ASSINADO' && (
                            <span className="text-[11px] text-green-600 ml-1">✓ Assinado</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-2">Criado em: {fmtDate(doc.createdAt)}</p>
                </div>
                <button onClick={() => handleDownloadPdf(doc.id, doc.title)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg ml-4" title="Baixar PDF">
                  <FiDownload size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input file oculto para upload */}
      <input ref={fileRef} type="file" accept=".pdf" className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleUploadSigned(e.target.files[0]); }} />

      {/* Modal upload em progresso */}
      {uploading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-[14px] p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-4" />
            <p className="text-[15px] font-medium">Enviando PDF assinado...</p>
            <p className="text-[13px] text-gray-500 mt-1">Validando assinatura digital</p>
          </div>
        </div>
      )}
      {validateModal !== null && <SignatureValidateModal documentId={validateModal || undefined} onClose={() => setValidateModal(null)} />}
    </div>
  );
};
