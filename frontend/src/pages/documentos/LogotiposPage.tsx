// frontend/src/pages/documentos/LogotiposPage.tsx
// Templates > Logotipos - upload do logo (papel timbrado) por empresa
import React, { useState, useEffect, useRef } from 'react';
import { FiUpload, FiImage, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

interface Company {
  id: string;
  legalName: string;
  tradeName?: string;
  taxId: string;
  logoUrl?: string;
}

export const LogotiposPage: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ id: string; type: 'success' | 'error'; msg: string } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const token = localStorage.getItem('@ledgr:token');
  const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
  const headers = { Authorization: 'Bearer ' + token, 'x-company-id': company.id ?? '' };

  const loadCompanies = () => {
    setLoading(true);
    fetch(API + '/companies', { headers })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCompanies(); }, []);

  const handleUpload = async (companyId: string, file: File) => {
    setUploadingId(companyId);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API}/companies/${companyId}/logo`, {
        method: 'POST',
        headers,
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message ?? 'Falha ao enviar o logo.');
      }
      setStatus({ id: companyId, type: 'success', msg: 'Logo atualizado com sucesso.' });
      loadCompanies();
    } catch (e: any) {
      setStatus({ id: companyId, type: 'error', msg: e.message ?? 'Erro ao enviar o logo.' });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-medium text-gray-900">Logotipos</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">
          Logo usado no papel timbrado dos documentos gerados (ex: Contrato de Locação). PNG, JPEG, SVG ou WEBP, até 2MB.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Carregando...</div>
      ) : companies.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">Nenhuma empresa encontrada.</div>
      ) : (
        <div className="grid gap-3">
          {companies.map(c => (
            <div key={c.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-20 h-14 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-lg overflow-hidden">
                  {c.logoUrl ? (
                    <img src={API + c.logoUrl} alt={c.legalName} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <FiImage className="text-gray-300" size={22} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{c.tradeName || c.legalName}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{c.taxId}</p>
                  {status?.id === c.id && (
                    <p className={`text-[11px] mt-1 flex items-center gap-1 ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {status.type === 'success' ? <FiCheckCircle size={11} /> : <FiAlertCircle size={11} />}
                      {status.msg}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <input
                  type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden"
                  ref={el => { fileRefs.current[c.id] = el; }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(c.id, file);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileRefs.current[c.id]?.click()}
                  disabled={uploadingId === c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] text-white rounded-lg text-[12px] disabled:opacity-50"
                >
                  <FiUpload size={12} /> {uploadingId === c.id ? 'Enviando...' : (c.logoUrl ? 'Substituir' : 'Enviar Logo')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
