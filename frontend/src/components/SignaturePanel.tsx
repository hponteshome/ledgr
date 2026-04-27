// src/components/SignaturePanel.tsx
//
// Painel de assinatura inline — aparece no rodapé dos DocumentView,
// ContratoView e AgeView.
//
// Props:
//   documentId  — ID do documento a assinar
//   companyId   — empresa ativa
//   onSigned    — callback após assinatura concluída (recarrega o documento)

import React, { useEffect, useState, useCallback } from 'react';
import { FiShield, FiCheckCircle, FiClock, FiAlertTriangle, FiXCircle, FiUser } from 'react-icons/fi';
import api from '../services/api';
import { useCompany } from '../contexts/CompanyContext';

// ── Tipos ────────────────────────────────────────────────────────
interface Signer {
  id:     string;
  name:   string;
  email:  string | null;
  role:   string | null;
  status: 'PENDENTE' | 'ASSINADO' | 'RECUSADO' | 'EXPIRADO';
  signedAt?: string;
}

interface Certificate {
  id:    string;
  alias: string;
  type:  string;
  expiryStatus: string;
  daysUntilExpiry: number;
}

interface Props {
  documentId: string;
  onSigned?:  () => void;
}

const STATUS_CONFIG = {
  PENDENTE: { Icon: FiClock,        color: 'text-yellow-500', label: 'Pendente'  },
  ASSINADO: { Icon: FiCheckCircle,  color: 'text-green-600',  label: 'Assinado'  },
  RECUSADO: { Icon: FiXCircle,      color: 'text-red-600',    label: 'Recusado'  },
  EXPIRADO: { Icon: FiAlertTriangle,color: 'text-gray-400',   label: 'Expirado'  },
};

const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

// ── Componente ───────────────────────────────────────────────────
export const SignaturePanel: React.FC<Props> = ({ documentId, onSigned }) => {
  const { empresa }   = useCompany();
  const [signers, setSigners]   = useState<Signer[]>([]);
  const [certs, setCerts]       = useState<Certificate[]>([]);
  const [selCert, setSelCert]   = useState('');
  const [signing, setSigning]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(true);

  const loadSigners = useCallback(async () => {
    try {
      const { data } = await api.get(`/documents/${documentId}`);
      setSigners(data.signers ?? []);
    } catch { /* silencioso */ }
  }, [documentId]);

  const loadCerts = useCallback(async () => {
    if (!empresa?.id) return;
    try {
      const { data } = await api.get('/certificates', {
        params: { companyId: empresa.id, onlyActive: 'true' },
      });
      const valid = (data as Certificate[]).filter(c =>
        c.expiryStatus !== 'expired' && c.type !== 'GOVBR',
      );
      setCerts(valid);
      if (valid.length === 1) setSelCert(valid[0].id);
    } catch { /* silencioso */ }
  }, [empresa?.id]);

  useEffect(() => {
    Promise.all([loadSigners(), loadCerts()])
      .finally(() => setLoading(false));
  }, [loadSigners, loadCerts]);

  // ── Assinar ──────────────────────────────────────────────────
  const handleSign = async () => {
    if (!selCert) { setError('Selecione um certificado.'); return; }
    setError('');
    setSigning(true);
    try {
      await api.post(`/documents/${documentId}/sign`, {
        certId:         selCert,
        method:         'CERT_A1',
        // O backend (DocumentsService.sign) receberá o certId e
        // delegará ao SigningService para gerar signatureHash + pdfUrl
      });
      await loadSigners();
      onSigned?.();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erro ao assinar. Tente novamente.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) return null;

  const allSigned = signers.length > 0 && signers.every(s => s.status === 'ASSINADO');
  const mySigned  = signers.some(s => s.status === 'ASSINADO'); // simplificado

  return (
    <div className="mt-8 border-t-2 border-gray-100 pt-6 space-y-5">
      <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
        <FiShield size={13} className="text-blue-600" /> Assinaturas Digitais
      </h3>

      {/* Lista de signatários */}
      {signers.length > 0 && (
        <div className="space-y-2">
          {signers.map(s => {
            const cfg = STATUS_CONFIG[s.status];
            return (
              <div key={s.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-7 h-7 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiUser size={12} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-700 truncate">{s.name}</p>
                  {s.role && <p className="text-[10px] text-gray-400">{s.role}</p>}
                </div>
                <div className={`flex items-center gap-1 text-[10px] font-black ${cfg.color}`}>
                  <cfg.Icon size={11} />
                  <span className="uppercase">{cfg.label}</span>
                  {s.signedAt && (
                    <span className="ml-1 text-gray-400 font-medium">· {fmt(s.signedAt)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Painel de assinar */}
      {!allSigned && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          {certs.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-orange-700 font-bold">
              <FiAlertTriangle size={13} />
              <span>
                Nenhum certificado digital ativo.{' '}
                <a href="/app/documents/signatures/certificates"
                  className="underline hover:text-orange-800">
                  Importar certificado →
                </a>
              </span>
            </div>
          ) : (
            <>
              <p className="text-xs font-black text-blue-700 uppercase">Assinar com certificado ICP-Brasil</p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-gray-500 block mb-1">Certificado</label>
                  <select value={selCert} onChange={e => setSelCert(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white outline-none focus:border-blue-400">
                    <option value="">Selecione…</option>
                    {certs.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.alias} ({c.type}) — {c.daysUntilExpiry}d restantes
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={handleSign} disabled={signing || !selCert}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold
                             hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                  {signing ? 'Assinando…' : 'Assinar'}
                </button>
              </div>
              {error && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                  <FiAlertTriangle size={11} /> {error}
                </p>
              )}
              <p className="text-[10px] text-blue-400 italic">
                A assinatura é registrada com hash SHA-256 do conteúdo, vinculada ao seu certificado ICP-Brasil.
              </p>
            </>
          )}
        </div>
      )}

      {/* Todos assinados */}
      {allSigned && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs font-bold text-green-700">
          <FiCheckCircle size={14} /> Documento assinado por todos os signatários.
        </div>
      )}
    </div>
  );
};
