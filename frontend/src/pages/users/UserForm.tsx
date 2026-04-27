// frontend/src/pages/users/UserForm.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiUser, FiMail, FiPhone, FiCreditCard, FiAtSign,
  FiLock, FiSave, FiArrowLeft, FiShield, FiAlertCircle,
  FiCheckCircle, FiLoader, FiUserPlus
} from 'react-icons/fi';
import api from '@/services/api';

interface Profile {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  nickname: string;
  email: string;
  phone: string;
  level: string;
  document: string;
  documentType: 'CPF' | 'PASSPORT' | 'RNE';
  password: string;
  profileId: string;
  status: 'active' | 'inactive' | 'blocked';
}

export const UserForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isSaving, setIsSaving] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [showPersonOption, setShowPersonOption] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [formData, setFormData] = useState<FormData>({
    name: '', nickname: '', email: '', phone: '', level: '',
    document: '', documentType: 'CPF',
    password: '', profileId: '', status: 'active',
  });

  // ── Carrega perfis disponíveis ──────────────────────────────────────────────
  useEffect(() => {
    api.get('/profiles')
      .then(res => setProfiles(res.data))
      .catch(() => setProfiles([]));
  }, []);

  // ── Carrega dados do usuário ao editar ──────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    api.get(`/users/${id}`)
      .then(res => {
        const u = res.data;
        setFormData({
          name: u.fullName || u.full_name || u.name || '',
          nickname: u.nickname || '',
          email: u.email || '',
          phone: u.phone1 || u.phone || u.cellphone || '',
          document: u.document || '',
          documentType: 'CPF',
          level: u.level || '',
          password: '',
          profileId: u.profile?.id || '',
          status: u.status || 'active',
        });
      })
      .catch(() => setFeedback({ type: 'error', message: 'Erro ao carregar dados do usuário.' }))
      .finally(() => setIsLoading(false));
  }, [id]);

  // ── Busca por documento (apenas em modo criação) ────────────────────────────
  const handleDocumentLookup = async (document: string) => {
    const cleanDoc = document.replace(/\D/g, '');
    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      setShowPersonOption(false);
      return;
    }
    setIsSearching(true);
    setFeedback(null);
    setShowPersonOption(false);

    try {
      const userResponse = await api.get(`/users/document/${cleanDoc}`).catch(() => null);
      if (userResponse?.data) {
        const u = userResponse.data;
        setFormData(prev => ({
          ...prev,
          name: u.fullName || u.name || '',
          email: u.email || '',
          phone: u.phone || u.phone1 || u.cellphone || '',
          nickname: u.nickname || '',
          level: u.level || '',
          document: cleanDoc,
          profileId: u.profile?.id || prev.profileId,
        }));
        setFeedback({ type: 'info', message: 'Usuário já cadastrado.' });
        return;
      }

      const personResponse = await api.get(`/persons/document/${cleanDoc}`).catch(() => null);
      if (personResponse?.data) {
        const p = personResponse.data;
        setFormData(prev => ({
          ...prev,
          name: p.fullName || p.name || '',
          email: p.email || p.contactEmail || '',
          phone: p.phone1 || p.cellphone || p.phone || '',
          document: cleanDoc,
          level: p.name || '',
          nickname: p.nickname || '',
        }));
        setFeedback({ type: 'info', message: 'Pessoa encontrada no cadastro base. Dados importados.' });
      } else {
        setShowPersonOption(true);
      }
    } catch (error) {
      console.error('Erro na busca:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        fullName: formData.name,
        isActive: formData.status === 'active',
      };
      if (isEditing) await api.patch(`/users/${id}`, payload);
      else await api.post('/users', payload);
      setFeedback({ type: 'success', message: 'Usuário salvo com sucesso!' });
      setTimeout(() => navigate('/app/users'), 1500);
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Erro ao salvar.';
      setFeedback({ type: 'error', message: Array.isArray(msg) ? msg.join(', ') : msg });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDocument = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .slice(0, 14);
    }
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
      .slice(0, 18);
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4 text-gray-400">
      <FiLoader className="animate-spin" size={40} />
    </div>
  );

  const isPersonDataReadOnly = !isEditing && Boolean(formData.name && formData.email);

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/app/users')}
          className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all"
        >
          <FiArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-gray-800">
          {isEditing ? '✏️ Editar Usuário' : '👤 Novo Usuário'}
        </h1>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 py-3 rounded-xl text-sm font-bold border flex items-center gap-3 transition-all ${feedback.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
          feedback.type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' :
            'bg-red-50 text-red-700 border-red-200'
          }`}>
          {feedback.type === 'success' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
          {feedback.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Seção 1 — Documento */}
        {!isEditing && (
          <div className="px-8 py-8 border-b border-gray-100 bg-gray-50/30">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
              <FiCreditCard size={14} /> 1. Validação de Documento
            </h2>
            <div className="relative max-w-sm">
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold transition-all"
                value={formatDocument(formData.document)}
                placeholder="000.000.000-00"
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData(prev => ({ ...prev, document: val }));
                  if (val.length === 11 || val.length === 14) handleDocumentLookup(val);
                  else setShowPersonOption(false);
                }}
                required
              />
              {isSearching && (
                <div className="absolute right-4 top-3">
                  <FiLoader className="animate-spin text-blue-600" />
                </div>
              )}
            </div>

            {showPersonOption && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800 mb-3">
                  <FiAlertCircle className="inline mr-1" size={16} /> Documento não encontrado.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/app/persons/new', {
                    state: { initialCpf: formData.document, returnTo: window.location.pathname }
                  })}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
                >
                  <FiUserPlus size={16} /> Cadastrar Nova Pessoa Física
                </button>
              </div>
            )}
          </div>
        )}

        {/* Seção 2 — Dados Pessoais */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FiUser size={14} /> {isEditing ? '1.' : '2.'} Dados Pessoais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nome Completo</label>
              <input
                className={`w-full px-4 py-2.5 border rounded-xl outline-none transition-all ${isPersonDataReadOnly
                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200'
                  : 'bg-white border-gray-200 focus:ring-2 focus:ring-blue-500'
                  }`}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                readOnly={isPersonDataReadOnly}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">E-mail Corporativo</label>
              <input
                type="email"
                className={`w-full px-4 py-2.5 border rounded-xl outline-none transition-all ${isPersonDataReadOnly
                  ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200'
                  : 'bg-white border-gray-200 focus:ring-2 focus:ring-blue-500'
                  }`}
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                readOnly={isPersonDataReadOnly}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Telefone</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Seção 3 — Acesso ao Sistema */}
        <div className="px-8 py-6 bg-blue-50/10">
          <h2 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FiShield size={14} /> {isEditing ? '2.' : '3.'} Acesso ao Sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nickname (Username)</label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.nickname}
                onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Nível de Acesso (Level)</label>
              <input
                type="number"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.level}
                onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Perfil de Acesso</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.profileId}
                onChange={(e) => setFormData(prev => ({ ...prev, profileId: e.target.value }))}
                required
              >
                <option value="">— Selecionar Perfil —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">
                {isEditing ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
              </label>
              <input
                type="password"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required={!isEditing}
                placeholder={isEditing ? '••••••••' : ''}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Status</label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as FormData['status'] }))}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/users')}
            className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`flex items-center gap-2 px-8 py-2.5 text-white font-black rounded-xl transition-all ${isSaving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700 shadow-lg'
              }`}
          >
            {isSaving ? <FiLoader className="animate-spin" /> : <FiSave />}
            {isEditing ? 'SALVAR ALTERAÇÕES' : 'CRIAR USUÁRIO'}
          </button>
        </div>
      </form >
    </div >
  );
};