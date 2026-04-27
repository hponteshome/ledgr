// src/pages/documents/signatures/SignatureRequest.tsx
import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiPlus, FiTrash2, FiShield } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

const AUTH_METHODS = [
  { value: 'email', label: 'E-mail (link de assinatura)' },
  { value: 'sms', label: 'SMS (código no celular)' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'pix', label: 'Pix (validação CPF)' },
  { value: 'icp', label: 'Certificado ICP-Brasil (A1/A3)' },
];

export const SignatureRequest: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [signers, setSigners] = useState([
    { name: '', cpf: '', email: '', phone: '', role: '', order: 1, auth: 'email' }
  ]);
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const company = JSON.parse(localStorage.getItem('@ledgr:activeCompany') ?? '{}');
        const res = await api.get('/documents?companyId=' + (company.id ?? ''));
        setDocuments(res.data ?? []);
      } catch { setDocuments([]); }
      setLoading(false);
    };
    load();
  }, []);

  const addSigner = () => {
    setSigners(p => [...p, { name: '', cpf: '', email: '', phone: '', role: '', order: p.length + 1, auth: 'email' }]);
  };

  const removeSigner = (i: number) => {
    setSigners(p => p.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })));
  };

  const updateSigner = (i: number, field: string, value: string) => {
    setSigners(p => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const handleSubmit = async () => {
    if (!selectedDocId) { alert('Selecione um documento'); return; }
    if (signers.some(s => !s.name || !s.email)) { alert('Nome e e-mail são obrigatórios para todos os signatários'); return; }
    setSubmitting(true);
    try {
      // 1. Adicionar signatários ao documento
      const signersRes = await api.post(`/signatures/documents/${selectedDocId}/signers`, { signers });
      const createdSigners = signersRes.data;

      // 2. Criar solicitação no ClickSign
      const signersWithIds = signers.map((s, i) => ({
        ...s,
        id: Array.isArray(createdSigners) ? createdSigners[i]?.id : createdSigners[i]?.id,
      }));

      await api.post(`/signatures/documents/${selectedDocId}/clicksign/request`, {
        signers: signersWithIds,
        deadline: deadline || undefined,
      });

      navigate('/app/documents/signatures');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro ao criar solicitação');
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/app/documents/signatures')}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
          <FiArrowLeft size={18} />
        </button>
        <h1 className="text-[20px] font-medium text-gray-900">Nova Solicitação de Assinatura</h1>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-orange-50 border border-orange-200 rounded-full">
          <FiShield size={12} className="text-orange-600" />
          <span className="text-[12px] text-orange-700 font-medium">Powered by ClickSign</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Documento */}
        <div className="border border-gray-200 rounded-[10px] p-5">
          <h2 className="text-[15px] font-medium text-gray-800 mb-3">Documento</h2>
          {loading ? (
            <p className="text-[14px] text-gray-400">Carregando...</p>
          ) : (
            <select value={selectedDocId} onChange={e => setSelectedDocId(e.target.value)}
              className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2">
              <option value="">Selecionar documento...</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>{d.title} — {d.type}</option>
              ))}
            </select>
          )}
          <div className="mt-3">
            <label className="block text-[12px] text-gray-500 mb-1">Prazo para assinatura</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="text-[14px] border border-gray-200 rounded-lg px-3 py-2" />
          </div>
        </div>

        {/* Signatários */}
        <div className="border border-gray-200 rounded-[10px] p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[15px] font-medium text-gray-800">Signatários</h2>
            <button onClick={addSigner}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] border border-gray-200 rounded-lg hover:bg-gray-50">
              <FiPlus size={13} /> Adicionar
            </button>
          </div>
          <div className="space-y-4">
            {signers.map((s, i) => (
              <div key={i} className="p-4 border border-gray-100 rounded-lg bg-gray-50">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[13px] font-medium text-gray-600">Signatário #{s.order}</span>
                  {signers.length > 1 && (
                    <button onClick={() => removeSigner(i)} className="text-red-400 hover:text-red-600">
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-gray-500 mb-1">Nome *</label>
                    <input value={s.name} onChange={e => updateSigner(i, 'name', e.target.value)}
                      className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">E-mail *</label>
                    <input value={s.email} onChange={e => updateSigner(i, 'email', e.target.value)}
                      className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">CPF</label>
                    <input value={s.cpf} onChange={e => updateSigner(i, 'cpf', e.target.value)}
                      className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Celular</label>
                    <input value={s.phone} onChange={e => updateSigner(i, 'phone', e.target.value)}
                      className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="+55 11 99999-9999" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-1">Cargo / Qualificação</label>
                    <input value={s.role} onChange={e => updateSigner(i, 'role', e.target.value)}
                      className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2" placeholder="Ex: Diretor, Sócio" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-gray-500 mb-1">Método de autenticação</label>
                    <select value={s.auth} onChange={e => updateSigner(i, 'auth', e.target.value)}
                      className="w-full text-[14px] border border-gray-200 rounded-lg px-3 py-2">
                      {AUTH_METHODS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-gray-400 mt-3">
            Os signatários receberão um e-mail do ClickSign com o link para assinar na ordem definida.
          </p>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-3">
          <button onClick={() => navigate('/app/documents/signatures')}
            className="px-4 py-2 text-[14px] border border-gray-200 rounded-lg text-gray-600">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={submitting || !selectedDocId}
            className="px-5 py-2 text-[14px] bg-[#111] text-white rounded-lg disabled:opacity-50">
            {submitting ? 'Enviando para ClickSign...' : 'Criar Solicitação'}
          </button>
        </div>
      </div>
    </div>
  );
};
