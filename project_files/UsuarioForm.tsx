import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiUser, FiMail, FiPhone, FiCreditCard, FiAtSign,
  FiLock, FiSave, FiArrowLeft, FiShield, FiAlertCircle,
  FiCheckCircle, FiLoader
} from 'react-icons/fi';
import api from '../../services/api';

interface Perfil {
  id: string;
  nome: string;
}

interface FormData {
  nome: string;
  nick: string;
  email: string;
  telefone: string;
  documento: string;
  tipoDocumento: string;
  senha: string;
  perfilId: string;
  status: string;
}

type FeedbackState = { tipo: 'sucesso' | 'erro'; mensagem: string } | null;

export const UsuarioForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdicao = Boolean(id);

  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(isEdicao);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [perfis, setPerfis] = useState<Perfil[]>([]);

  const [formData, setFormData] = useState<FormData>({
    nome: '',
    nick: '',
    email: '',
    telefone: '',
    documento: '',
    tipoDocumento: 'CPF',
    senha: '',
    perfilId: '',
    status: 'ativo',
  });

  // Carrega perfis disponíveis
  useEffect(() => {
    api.get('/perfis').then(res => setPerfis(res.data)).catch(() => {});
  }, []);

  // Carrega dados do usuário na edição
  useEffect(() => {
    if (!id) return;
    setCarregando(true);
    api.get(`/usuarios/${id}`)
      .then(res => {
        const u = res.data;
        setFormData({
          nome: u.nome || '',
          nick: u.nick || '',
          email: u.email || '',
          telefone: u.telefone || '',
          documento: u.documento || '',
          tipoDocumento: u.tipoDocumento || 'CPF',
          senha: '',
          perfilId: u.perfil?.id || '',
          status: u.status || 'ativo',
        });
      })
      .catch(() => setFeedback({ tipo: 'erro', mensagem: 'Erro ao carregar dados do usuário.' }))
      .finally(() => setCarregando(false));
  }, [id]);

  const set = (campo: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setFormData(prev => ({ ...prev, [campo]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setFeedback(null);

    try {
      if (isEdicao) {
        // Monta payload sem senha vazia e mapeia perfilId → perfil
        const { senha, perfilId, ...resto } = formData;
        const payload: any = { ...resto };
        if (perfilId) payload.perfilId = perfilId;
        if (senha.trim()) payload.senha = senha;

        await api.patch(`/usuarios/${id}`, payload);
        setFeedback({ tipo: 'sucesso', mensagem: 'Usuário atualizado com sucesso!' });
        setTimeout(() => navigate('/app/usuarios'), 1500);
      } else {
        await api.post('/auth/registro', formData);
        setFeedback({ tipo: 'sucesso', mensagem: 'Usuário criado com sucesso!' });
        setTimeout(() => navigate('/app/usuarios'), 1500);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Erro ao salvar. Tente novamente.';
      setFeedback({ tipo: 'erro', mensagem: Array.isArray(msg) ? msg.join(', ') : msg });
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <span className="text-sm font-medium">Carregando dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/app/usuarios')}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
        >
          <FiArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-800">
            {isEdicao ? `✏️ Editar Usuário` : '👤 Novo Usuário'}
          </h1>
          {isEdicao && formData.nome && (
            <p className="text-sm text-gray-500 font-medium">{formData.nome}</p>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold border ${
          feedback.tipo === 'sucesso'
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.tipo === 'sucesso'
            ? <FiCheckCircle size={18} />
            : <FiAlertCircle size={18} />}
          {feedback.mensagem}
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Seção: Identificação */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FiUser size={14} /> Identificação
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div className="md:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Nome Completo *
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.nome}
                onChange={set('nome')}
                placeholder="Nome completo do usuário"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiAtSign size={12} className="inline mr-1" />Nick (Username)
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.nick}
                onChange={set('nick')}
                placeholder="usuario123"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiPhone size={12} className="inline mr-1" />Telefone
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.telefone}
                onChange={set('telefone')}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </div>

        {/* Seção: Acesso */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FiMail size={14} /> Acesso ao Sistema
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div className="md:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                E-mail Corporativo *
              </label>
              <input
                type="email"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.email}
                onChange={set('email')}
                placeholder="usuario@empresa.com.br"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiLock size={12} className="inline mr-1" />
                {isEdicao ? 'Nova Senha (opcional)' : 'Senha de Acesso *'}
              </label>
              <input
                type="password"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.senha}
                onChange={set('senha')}
                placeholder={isEdicao ? 'Deixe em branco para não alterar' : 'Mínimo 8 caracteres'}
                required={!isEdicao}
              />
              {isEdicao && (
                <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase italic">
                  Preencha apenas para redefinir a senha
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiShield size={12} className="inline mr-1" />Status
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all bg-white"
                value={formData.status}
                onChange={set('status')}
              >
                <option value="ativo">✅ Ativo</option>
                <option value="inativo">🔴 Inativo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seção: Documento + Perfil */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FiCreditCard size={14} /> Documento & Perfil de Acesso
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Tipo de Documento
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all bg-white"
                value={formData.tipoDocumento}
                onChange={set('tipoDocumento')}
              >
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Número do Documento *
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.documento}
                onChange={set('documento')}
                placeholder={formData.tipoDocumento === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiShield size={12} className="inline mr-1" />Perfil de Acesso
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all bg-white"
                value={formData.perfilId}
                onChange={set('perfilId')}
              >
                <option value="">— Sem perfil vinculado —</option>
                {perfis.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-8 py-5 bg-gray-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/usuarios')}
            className="px-6 py-2.5 text-gray-500 font-bold hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-white font-black shadow-lg transition-all ${
              salvando
                ? 'bg-gray-400 cursor-not-allowed shadow-none'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100 hover:shadow-blue-200'
            }`}
          >
            {salvando ? (
              <>
                <FiLoader size={16} className="animate-spin" />
                PROCESSANDO...
              </>
            ) : (
              <>
                <FiSave size={16} />
                {isEdicao ? 'SALVAR ALTERAÇÕES' : 'CRIAR USUÁRIO'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
