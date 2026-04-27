// src/pages/documents/CertificatesPage.tsx
// Rota: /app/documents/signatures/certificates
//
// Lista os certificados digitais da empresa ativa.
// Permite importar novo, desativar e ver detalhes.

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiShield, FiPlus, FiAlertTriangle, FiCheckCircle,
  FiXCircle, FiClock, FiTrash2, FiRefreshCw, FiInfo,
} from 'react-icons/fi';
import api from '@/services/api';
import { useCompany } from '@/contexts/CompanyContext';
import { CertificateImportModal } from './CertificateImportModal';

// ── Tipos ────────────────────────────────────────────────────────
interface Certificate {
  id: string;
  alias: string;
  type: string;
  usage: string[];
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  fingerprint: string;
  isActive: boolean;
  createdAt: string;
  daysUntilExpiry: number;
  expiryStatus: 'valid' | 'warning' | 'danger' | 'expired';
}

// ── Helpers visuais ──────────────────────────────────────────────
const EXPIRY_CONFIG = {
  valid: { label: 'Válido', bg: 'bg-green-100', text: 'text-green-700', Icon: FiCheckCircle },
  warning: { label: 'Atenção', bg: 'bg-yellow-100', text: 'text-yellow-700', Icon: FiClock },
  danger: { label: 'Vencendo!', bg: 'bg-orange-100', text: 'text-orange-700', Icon: FiAlertTriangle },
  expired: { label: 'Expirado', bg: 'bg-red-100', text: 'text-red-700', Icon: FiXCircle },
};

const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR');

const UsageBadge = ({ usage }: { usage: string[] }) => (
  <div className="flex flex-wrap gap-1">
    {usage.map(u => (
      <span key={u}
        className={`text-[9px] font-black px-2 py-0.5 rounded uppercase
          ${u === 'SIGNING' ? 'bg-blue-100 text-blue-700' : ''}
          ${u === 'TRANSMISSION' ? 'bg-purple-100 text-purple-700' : ''}`}>
        {u === 'SIGNING' ? 'Assinatura' : 'Transmissão'}
      </span>
    ))}
  </div>
);

// ── Componente principal ─────────────────────────────────────────
export const CertificatesPage: React.FC = () => {
  const { empresa } = useCompany();
  const navigate = useNavigate();
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [detail, setDetail] = useState<Certificate | null>(null);

  const load = useCallback(async () => {
    if (!empresa?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get('/certificates', {
        params: { companyId: empresa.id },
      });
      setCerts(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [empresa?.id]);

  useEffect(() => { load(); }, [load]);

  const handleDeactivate = async (id: string, alias: string) => {
    if (!confirm(`Desativar o certificado "${alias}"?\n\nEle não poderá mais ser usado para assinaturas ou transmissões.`)) return;
    await api.delete(`/certificates/${id}`, { params: { companyId: empresa?.id } });
    load();
  };

  // Separar ativos / inativos
  const ativos = certs.filter(c => c.isActive);
  const inativos = certs.filter(c => !c.isActive);

  // ── Alertas no topo ──────────────────────────────────────────
  const alertas = ativos.filter(c => c.expiryStatus !== 'valid');

  return (
    <div className="p-6 bg-[#F8F9FC] min-h-screen font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow">
              <FiShield className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-800 uppercase">Certificados Digitais</h1>
              <p className="text-xs text-gray-400 font-medium">ICP-Brasil A1 / A3 · Gestão por empresa</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load}
              className="flex items-center gap-2 px-3 py-2 text-gray-500 border border-gray-200
                         bg-white rounded-xl hover:bg-gray-50 text-xs font-bold transition">
              <FiRefreshCw size={13} /> Atualizar
            </button>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                         rounded-xl hover:bg-blue-700 text-xs font-bold transition shadow">
              <FiPlus size={14} /> Importar Certificado
            </button>
          </div>
        </div>

        {/* Alertas de expiração */}
        {alertas.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-black text-orange-700 uppercase flex items-center gap-2">
              <FiAlertTriangle /> {alertas.length} certificado(s) requer(em) atenção
            </p>
            {alertas.map(c => {
              const cfg = EXPIRY_CONFIG[c.expiryStatus];
              return (
                <div key={c.id} className="flex items-center gap-2 text-xs text-orange-600 font-medium">
                  <cfg.Icon size={12} />
                  <span><strong>{c.alias}</strong> — {c.daysUntilExpiry < 0 ? 'EXPIRADO' : `vence em ${c.daysUntilExpiry} dia(s)`} ({fmt(c.validTo)})</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-gray-400 font-black uppercase animate-pulse text-sm">
            Carregando certificados…
          </div>
        )}

        {/* Lista Ativos */}
        {!loading && ativos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center space-y-3">
            <FiShield size={40} className="mx-auto text-gray-300" />
            <p className="font-black text-gray-400 uppercase text-sm">Nenhum certificado cadastrado</p>
            <p className="text-xs text-gray-400">Importe um arquivo .p12 ou .pfx para começar a assinar documentos e transmitir ao fisco.</p>
            <button onClick={() => setShowImport(true)}
              className="mt-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition">
              Importar Certificado
            </button>
          </div>
        )}

        {!loading && ativos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest border-l-4 border-blue-600 pl-3">
                Certificados Ativos ({ativos.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-50">
              {ativos.map(cert => {
                const cfg = EXPIRY_CONFIG[cert.expiryStatus];
                return (
                  <div key={cert.id}
                    className="px-6 py-4 hover:bg-gray-50 transition flex items-start gap-4">

                    {/* Ícone tipo */}
                    <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                      ${cert.type === 'A3' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                      <FiShield size={16} className={cert.type === 'A3' ? 'text-purple-600' : 'text-blue-600'} />
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-black text-sm text-gray-800">{cert.alias}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase
                          ${cert.type === 'A3' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {cert.type}
                        </span>
                        <UsageBadge usage={cert.usage} />
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
                          <cfg.Icon size={10} /> {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-medium truncate">{cert.subject}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        AC: {cert.issuer.split(',')[0]?.replace('CN=', '')} ·
                        Válido: {fmt(cert.validFrom)} – {fmt(cert.validTo)} ·
                        {cert.daysUntilExpiry >= 0
                          ? ` ${cert.daysUntilExpiry} dias restantes`
                          : ' EXPIRADO'}
                      </p>
                    </div>

                    {/* Ações */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button onClick={() => setDetail(cert)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Ver detalhes">
                        <FiInfo size={15} />
                      </button>
                      <button onClick={() => handleDeactivate(cert.id, cert.alias)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Desativar certificado">
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inativos (colapsado) */}
        {inativos.length > 0 && (
          <details className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <summary className="px-6 py-4 cursor-pointer text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-gray-50 flex items-center gap-2">
              <FiXCircle size={13} className="text-gray-300" />
              Certificados Inativos ({inativos.length})
            </summary>
            <div className="divide-y divide-gray-50">
              {inativos.map(cert => (
                <div key={cert.id} className="px-6 py-3 flex items-center gap-4 opacity-50">
                  <FiShield size={14} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-gray-500">{cert.alias}</span>
                    <span className="ml-2 text-[10px] text-gray-400 line-through">{cert.subject}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">Desativado</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* Modal de importação */}
      {showImport && (
        <CertificateImportModal
          companyId={empresa!.id}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); load(); }}
        />
      )}

      {/* Modal de detalhes */}
      {detail && (
        <CertificateDetailModal cert={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
};

// ── Modal de detalhes ────────────────────────────────────────────
const CertificateDetailModal: React.FC<{ cert: Certificate; onClose: () => void }> = ({ cert, onClose }) => {
  const cfg = EXPIRY_CONFIG[cert.expiryStatus];
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex gap-2 py-2 border-b border-gray-50 last:border-0">
      <span className="text-[10px] font-black text-gray-400 uppercase w-28 flex-shrink-0 mt-0.5">{label}</span>
      <span className="text-xs font-medium text-gray-700 break-all">{value}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-black text-gray-800 text-sm uppercase">{cert.alias}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none">✕</button>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${cfg.bg} ${cfg.text}`}>
          <cfg.Icon size={13} />
          {cert.expiryStatus === 'expired'
            ? 'Certificado expirado'
            : `Válido — ${cert.daysUntilExpiry} dias restantes`}
        </div>
        <div>
          <Row label="Titular" value={cert.subject} />
          <Row label="AC Emissora" value={cert.issuer} />
          <Row label="Tipo" value={cert.type} />
          <Row label="Número de Série" value={cert.serialNumber} />
          <Row label="Válido de" value={fmt(cert.validFrom)} />
          <Row label="Válido até" value={fmt(cert.validTo)} />
          <Row label="Fingerprint" value={cert.fingerprint} />
          <Row label="Uso" value={cert.usage.join(', ')} />
          <Row label="Importado em" value={fmt(cert.createdAt)} />
        </div>
      </div>
    </div>
  );
};
