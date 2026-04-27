// frontend/src/pages/documents/signatures/SignatureValidateModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import { FiUpload, FiCheckCircle, FiXCircle, FiShield, FiX } from 'react-icons/fi';

interface Props {
  documentId?: string;
  onClose: () => void;
}

export const SignatureValidateModal: React.FC<Props> = ({ documentId, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const didValidate = useRef(false);

  const token = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const headers = { 'Authorization': `Bearer ${token}`, 'x-company-id': company.id ?? '' };

  // Se documentId fornecido, validar automaticamente baixando o PDF
  useEffect(() => {
    if (!documentId) return;
    const autoValidate = async () => {
      setLoading(true);
      try {
        // Buscar metadados do documento para verificar se tem fileUrl
        const metaRes = await fetch(`http://localhost:3000/documents/${documentId}`, { headers });
        const meta = await metaRes.json();
        const pdfUrl = meta.fileUrl
          ? `http://localhost:3000${meta.fileUrl}`
          : `http://localhost:3000/documents/${documentId}/pdf`;

        // Baixar PDF
        const pdfRes = await fetch(pdfUrl, { headers });
        if (!pdfRes.ok) throw new Error('Erro ao baixar PDF do documento');
        const blob = await pdfRes.blob();

        // Enviar para validação
        const fd = new FormData();
        fd.append('pdf', blob, 'documento.pdf');
        fd.append('documentId', documentId);
        const res = await fetch('http://localhost:3000/signatures/validate', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': company.id ?? '' },
          body: fd
        });
        const data = await res.json();
        setResult(data);
      } catch (e: any) {
        setResult({ valid: false, errors: [e.message], signatures: [] });
      }
      setLoading(false);
    };
    if (!didValidate.current) { didValidate.current = true; autoValidate(); }
  }, [documentId]);

  const handleValidate = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      if (documentId) fd.append('documentId', documentId);
      const res = await fetch('http://localhost:3000/signatures/validate', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'x-company-id': company.id ?? '' }, body: fd });
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ valid: false, errors: [e.message], signatures: [] });
    }
    setLoading(false);
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const certLabel = (t: string) => t === 'ICP_BRASIL' ? 'ICP-Brasil' : t === 'GOVBR' ? 'Gov.br' : 'Outro';
  const certColor = (t: string) => t === 'ICP_BRASIL' ? 'text-purple-700 bg-purple-50' : t === 'GOVBR' ? 'text-blue-700 bg-blue-50' : 'text-gray-700 bg-gray-100';

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-[14px] border border-gray-200 p-6 w-[560px] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-[16px] font-medium text-gray-900">Validar Assinatura Digital</h3>
            <p className="text-[13px] text-gray-500 mt-0.5">
              {documentId ? 'Validando assinatura do documento...' : 'Verificar autenticidade de PDF assinado com certificado ICP-Brasil ou gov.br'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><FiX size={18} /></button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-4" />
            <p className="text-[14px] text-gray-500">Validando assinatura digital...</p>
          </div>
        ) : !result ? (
          <div className="space-y-4">
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-[10px] p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
              <FiUpload size={28} className="mx-auto mb-3 text-gray-400" />
              {file ? (
                <div>
                  <p className="text-[15px] font-medium text-gray-800">{file.name}</p>
                  <p className="text-[12px] text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-[15px] text-gray-600">Clique para selecionar o PDF assinado</p>
                  <p className="text-[12px] text-gray-400 mt-1">Suporta PDF com assinatura digital ICP-Brasil (A1, A3, token) e gov.br</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-[14px] border border-gray-200 rounded-lg">Cancelar</button>
              <button onClick={handleValidate} disabled={!file}
                className="px-5 py-2 text-[14px] bg-[#111] text-white rounded-lg disabled:opacity-50">
                Validar Assinatura
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-[10px] ${result.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {result.valid ? <FiCheckCircle size={24} className="text-green-600 shrink-0" /> : <FiXCircle size={24} className="text-red-600 shrink-0" />}
              <div>
                <p className={`text-[15px] font-medium ${result.valid ? 'text-green-800' : 'text-red-800'}`}>
                  {result.valid ? 'Assinatura válida' : 'Assinatura inválida ou não encontrada'}
                </p>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Validado em {fmtDate(result.validatedAt)} · Hash: <span className="font-mono">{result.documentHash?.slice(0,16)}...</span>
                </p>
              </div>
            </div>

            {result.signatures?.length > 0 && (
              <div className="border border-gray-200 rounded-[10px] overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-[12px] font-medium text-gray-600 uppercase tracking-wide">Signatários encontrados</span>
                </div>
                {result.signatures.map((sig: any, i: number) => (
                  <div key={i} className="p-4 border-b border-gray-100 last:border-0">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-[15px] font-medium text-gray-900">{sig.signerName}</p>
                        {sig.signerCpf && <p className="text-[13px] text-gray-500 font-mono">{sig.signerCpf}</p>}
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${certColor(sig.certificateType)}`}>{certLabel(sig.certificateType)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sig.trustLevel === 'VALID' ? 'bg-green-100 text-green-700' : sig.trustLevel === 'EXPIRED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {sig.trustLevel === 'VALID' ? '✓ Válido' : sig.trustLevel === 'EXPIRED' ? '✗ Expirado' : '⚠ Não confiável'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[12px] text-gray-500">
                      <div><span className="text-gray-400">Emissor:</span> {sig.issuer}</div>
                      <div><span className="text-gray-400">Série:</span> <span className="font-mono">{sig.serialNumber?.slice(0,16)}</span></div>
                      <div><span className="text-gray-400">Válido de:</span> {fmtDate(sig.validFrom)}</div>
                      <div><span className="text-gray-400">Válido até:</span> {fmtDate(sig.validTo)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.errors?.length > 0 && (
              <div className="p-3 bg-red-50 rounded-lg">
                {result.errors.map((e: string, i: number) => (
                  <p key={i} className="text-[13px] text-red-700">⚠ {e}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setResult(null)} className="px-4 py-2 text-[14px] border border-gray-200 rounded-lg">Validar outro</button>
              <button onClick={onClose} className="px-4 py-2 text-[14px] bg-[#111] text-white rounded-lg">Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
