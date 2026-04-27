// src/pages/documents/CertificateImportModal.tsx
//
// Modal de importação de certificado .p12 / .pfx
// Fluxo: upload → preview (parse sem salvar) → confirmar → salvar

import React, { useState, useRef } from 'react';
import { FiUploadCloud, FiShield, FiAlertTriangle, FiCheckCircle, FiX, FiEye, FiEyeOff } from 'react-icons/fi';
import api from '@/services/api';

interface Props {
  companyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Preview {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  fingerprint: string;
  daysRemaining: number;
  expired: boolean;
}

const USAGE_OPTIONS = [
  { value: 'SIGNING', label: 'Assinatura de Documentos', desc: 'Contratos, atas, procurações' },
  { value: 'TRANSMISSION', label: 'Transmissão ao Fisco', desc: 'SPED, NF-e, eSocial' },
];

const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export const CertificateImportModal: React.FC<Props> = ({ companyId, onClose, onSuccess }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [alias, setAlias] = useState('');
  const [type, setType] = useState<'A1' | 'A3'>('A1');
  const [usage, setUsage] = useState<string[]>(['SIGNING']);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleUsage = (v: string) =>
    setUsage(prev => prev.includes(v) ? prev.filter(u => u !== v) : [...prev, v]);

  // ── Step 1: Preview (parse sem salvar) ──────────────────────
  const handlePreview = async () => {
    if (!file || !password) { setError('Selecione o arquivo e informe a senha.'); return; }
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('password', password);
      const { data } = await api.post('/certificates/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
      if (!alias) {
        // Auto-preenche alias com CN do titular
        const cn = data.subject.match(/CN=([^,]+)/)?.[1] ?? '';
        setAlias(cn ? `${cn} - ${type}` : '');
      }
      setStep('preview');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao ler o certificado. Verifique a senha.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Confirmar e salvar ───────────────────────────────
  const handleImport = async () => {
    if (!alias || usage.length === 0) { setError('Preencha o nome e selecione ao menos um uso.'); return; }
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file!);
      fd.append('companyId', companyId);
      fd.append('alias', alias);
      fd.append('type', type);
      fd.append('password', password);
      usage.forEach(u => fd.append('usage[]', u));

      await api.post('/certificates/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao importar certificado.');
    } finally {
      setLoading(false);
    }
  };

  const daysColor = preview
    ? preview.expired ? 'text-red-600 bg-red-50'
      : preview.daysRemaining < 30 ? 'text-orange-600 bg-orange-50'
        : preview.daysRemaining < 60 ? 'text-yellow-600 bg-yellow-50'
          : 'text-green-600 bg-green-50'
    : '';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <FiShield size={15} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-gray-800 text-sm uppercase">Importar Certificado</h2>
              <p className="text-[10px] text-gray-400">
                {step === 'upload' ? 'Selecione o arquivo .p12 ou .pfx'
                  : step === 'preview' ? 'Verifique os dados antes de salvar'
                    : 'Confirme a importação'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-bold leading-none">
            <FiX />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* ── STEP UPLOAD ── */}
          {step === 'upload' && (
            <>
              {/* Drag/drop area */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
                  ${file ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'}`}>
                <FiUploadCloud size={32} className={`mx-auto mb-2 ${file ? 'text-blue-500' : 'text-gray-300'}`} />
                {file ? (
                  <p className="text-sm font-bold text-blue-600">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-gray-500">Clique para selecionar</p>
                    <p className="text-xs text-gray-400 mt-1">Aceita .p12 e .pfx · Máx. 2 MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".p12,.pfx" className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)} />

              {/* Senha */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">Senha do certificado</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePreview()}
                    placeholder="Senha do arquivo .p12"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm pr-10 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Tipo de certificado</label>
                <div className="flex gap-3">
                  {(['A1', 'A3'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setType(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border transition
                        ${type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                      {t === 'A1' ? 'A1 — Arquivo' : 'A3 — Token/Cartão'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── STEP PREVIEW ── */}
          {step === 'preview' && preview && (
            <>
              {/* Status de validade */}
              <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold ${daysColor}`}>
                {preview.expired
                  ? <><FiAlertTriangle /> Certificado EXPIRADO — não poderá ser usado</>
                  : <><FiCheckCircle /> Válido por mais {preview.daysRemaining} dias (até {fmt(preview.validTo)})</>}
              </div>

              {/* Dados do certificado */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-xs">
                {[
                  ['Titular', preview.subject],
                  ['AC Emissora', preview.issuer],
                  ['Série', preview.serialNumber],
                  ['Válido de', fmt(preview.validFrom)],
                  ['Válido até', fmt(preview.validTo)],
                  ['Fingerprint', preview.fingerprint],
                ].map(([l, v]) => (
                  <div key={l} className="flex gap-2">
                    <span className="w-24 text-gray-400 font-bold flex-shrink-0">{l}</span>
                    <span className="text-gray-700 font-medium break-all">{v}</span>
                  </div>
                ))}
              </div>

              {/* Alias */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-1">
                  Nome descritivo <span className="text-red-500">*</span>
                </label>
                <input value={alias} onChange={e => setAlias(e.target.value)}
                  placeholder="Ex: e-CNPJ A1 - Receita Federal"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>

              {/* Uso */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">
                  Finalidade <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {USAGE_OPTIONS.map(opt => (
                    <label key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition
                        ${usage.includes(opt.value) ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-200'}`}>
                      <input type="checkbox" checked={usage.includes(opt.value)}
                        onChange={() => toggleUsage(opt.value)}
                        className="mt-0.5 accent-blue-600" />
                      <div>
                        <p className="text-xs font-bold text-gray-700">{opt.label}</p>
                        <p className="text-[10px] text-gray-400">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-bold">
              <FiAlertTriangle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between gap-3">
          {step === 'preview' ? (
            <>
              <button onClick={() => setStep('upload')}
                className="px-5 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition">
                ← Voltar
              </button>
              <button onClick={handleImport} disabled={loading || preview?.expired || !alias || usage.length === 0}
                className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? 'Importando…' : 'Confirmar e Importar'}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose}
                className="px-5 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-xs font-bold hover:bg-gray-50 transition">
                Cancelar
              </button>
              <button onClick={handlePreview} disabled={loading || !file || !password}
                className="flex-1 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? 'Lendo certificado…' : 'Verificar Certificado →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};