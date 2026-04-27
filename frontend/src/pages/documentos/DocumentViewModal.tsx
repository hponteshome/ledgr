// frontend/src/pages/documentos/DocumentViewModal.tsx
import React, { useState, useEffect } from 'react';
import { FiX, FiDownload, FiShield, FiHash, FiCalendar, FiFileText, FiEdit } from 'react-icons/fi';

const API = 'http://localhost:3000';

const STATUS_PILL: Record<string, { bg: string; color: string; label: string }> = {
  RASCUNHO:              { bg: '#F9FAFB', color: '#374151', label: 'Rascunho' },
  EM_REVISAO:            { bg: '#FEFCE8', color: '#854D0E', label: 'Em Revisão' },
  AGUARDANDO_ASSINATURA: { bg: '#FFF7ED', color: '#C2410C', label: 'Ag. Assinatura' },
  ASSINADO:              { bg: '#FDF4FF', color: '#7E22CE', label: 'Assinado' },
  REGISTRADO:            { bg: '#EFF6FF', color: '#1D4ED8', label: 'Registrado' },
  ARQUIVADO:             { bg: '#F9FAFB', color: '#6B7280', label: 'Arquivado' },
  CANCELADO:             { bg: '#FEF2F2', color: '#991B1B', label: 'Cancelado' },
};

interface Props {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  onValidate?: (id: string) => void;
}

export const DocumentViewModal: React.FC<Props> = ({ documentId, documentTitle, onClose, onValidate }) => {
  const [doc, setDoc]       = useState<any>(null);
  const [html, setHtml]     = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [tab, setTab]       = useState<'documento' | 'assinaturas'>('documento');

  const token   = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const headers = { Authorization: 'Bearer ' + token, 'x-company-id': company.id ?? '' };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const docRes = await fetch(API + '/documents/' + documentId, { headers });
        const d = await docRes.json();
        setDoc(d);
        if (d.fileUrl) {
          setPdfUrl(API + d.fileUrl);
        } else {
          const res = await fetch(API + '/documents/' + documentId + '/preview', { headers });
          if (!res.ok) throw new Error('Erro ao carregar documento');
          setHtml(await res.text());
        }
      } catch (e: any) { setError(e.message); }
      setLoading(false);
    };
    load();
  }, [documentId]);

  const handleDownload = () => {
    fetch(API + '/documents/' + documentId + '/pdf', { headers })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = documentTitle + '.pdf';
        a.click();
      });
  };

  const pill = doc ? (STATUS_PILL[doc.status] ?? STATUS_PILL.RASCUNHO) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E5E7EB', background: '#ECFEFF', borderRadius: '14px 14px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#0891B2' }}>◆ Societário</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#111' }}>{documentTitle}</h2>
                {pill && <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: pill.bg, color: pill.color, fontWeight: 500 }}>{pill.label}</span>}
              </div>
              {doc && <p style={{ margin: '3px 0 0', fontSize: 11, color: '#6B7280' }}>{doc.type?.replace(/_/g, ' ')} · v{doc.currentVersion}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {onValidate && (
                <button onClick={() => onValidate(documentId)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, border: '0.5px solid #C4B5FD', color: '#7C3AED', background: '#F5F3FF', borderRadius: 8, cursor: 'pointer' }}>
                  <FiShield size={12} /> Validar
                </button>
              )}
              <button onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, border: '0.5px solid #D1D5DB', color: '#374151', background: '#fff', borderRadius: 8, cursor: 'pointer' }}>
                <FiDownload size={12} /> Baixar PDF
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}><FiX size={18} /></button>
            </div>
          </div>

          {/* Meta bar */}
          {doc && (
            <div style={{ display: 'flex', gap: 20, marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #CFFAFE', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#0E7490', display: 'flex', alignItems: 'center', gap: 4 }}>
                <FiCalendar size={11} /> {new Date(doc.date || doc.createdAt).toLocaleDateString('pt-BR')}
              </span>
              {doc.contentHash && (
                <span style={{ fontSize: 11, color: '#0E7490', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                  <FiHash size={11} /> SHA-256: {doc.contentHash.substring(0, 16)}...
                </span>
              )}
              {doc.registrationNumber && (
                <span style={{ fontSize: 11, color: '#0E7490', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FiFileText size={11} /> Reg. {doc.registrationNumber}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '0.5px solid #E5E7EB', padding: '0 20px' }}>
          {(['documento', 'assinaturas'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 16px', fontSize: 12, fontWeight: tab === t ? 500 : 400, color: tab === t ? '#0891B2' : '#6B7280', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #0891B2' : '2px solid transparent', cursor: 'pointer', textTransform: 'capitalize' }}>
              {t === 'documento' ? 'Documento' : 'Assinaturas'}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflow: 'auto', background: '#F9FAFB', padding: 16 }}>
          {tab === 'documento' && (
            loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#0891B2', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : error ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                <p style={{ color: '#EF4444' }}>{error}</p>
              </div>
            ) : pdfUrl ? (
              <iframe src={pdfUrl} style={{ width: '100%', minHeight: '75vh', border: 'none', borderRadius: 8 }} title={documentTitle} />
            ) : (
              <div style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderRadius: 8, overflow: 'hidden', maxWidth: '210mm', margin: '0 auto' }}>
                <iframe srcDoc={html} style={{ width: '100%', minHeight: '297mm', border: 'none' }} title={documentTitle} />
              </div>
            )
          )}

          {tab === 'assinaturas' && (
            <div style={{ maxWidth: 480, margin: '0 auto', paddingTop: 16 }}>
              {doc?.signers?.length > 0 ? doc.signers.map((s: any, i: number) => (
                <div key={i} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: '12px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111' }}>{s.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6B7280' }}>{s.cpf} · {s.role}</p>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: s.status === 'ASSINADO' ? '#F0FDF4' : '#FEFCE8', color: s.status === 'ASSINADO' ? '#15803D' : '#854D0E' }}>{s.status}</span>
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                  <FiEdit size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ fontSize: 13 }}>Nenhum signatário cadastrado</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer legal */}
        <div style={{ padding: '8px 20px', borderTop: '0.5px solid #E5E7EB', background: '#F9FAFB', borderRadius: '0 0 14px 14px' }}>
          <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF', textAlign: 'center' }}>
            Documento gerado pelo LEDGR · Assinatura digital conforme MP 2.200-2/2001 e Lei 14.063/2020 · Integridade verificável via SHA-256
          </p>
        </div>
      </div>
    </div>
  );
};
