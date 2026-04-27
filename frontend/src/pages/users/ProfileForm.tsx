import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiShield, FiSave, FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import api from '../../services/api';

interface Profile {
  id: string;
  name: string;
  permissions: Record<string, any>;
}

export const ProfileForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [permsRaw, setPermsRaw] = useState('{}');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [jsonError, setJsonError] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      const loadProfile = async () => {
        try {
          setIsLoading(true);
          const { data } = await api.get(`/profiles/${id}`);
          setName(data.name);
          setPermsRaw(JSON.stringify(data.permissions, null, 2));
        } catch (err) {
          console.error('Erro ao carregar perfil:', err);
          navigate('/app/profiles');
        } finally {
          setIsLoading(false);
        }
      };
      loadProfile();
    }
  }, [id, navigate]);

  const handlePermChange = (value: string) => {
    setPermsRaw(value);
    try {
      if (value.trim()) JSON.parse(value);
      setJsonError(false);
    } catch {
      setJsonError(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jsonError) return;

    setIsSaving(true);
    try {
      const payload = {
        name,
        permissions: JSON.parse(permsRaw || '{}'),
      };

      // MUDANÇA CRUCIAL: Trocado de api.put para api.patch
      if (id && id !== 'new') {
        console.log(`[DEBUG] Enviando PATCH para /profiles/${id}`);
        await api.patch(`/profiles/${id}`, payload);
      } else {
        await api.post('/profiles', payload);
      }

      navigate('/app/profiles', { state: { refresh: true } });
    } catch (err: any) {
      console.error('Erro detalhado:', err.response?.data || err.message);
      alert(`Erro: ${err.response?.data?.message || 'Não foi possível salvar.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <button onClick={() => navigate('/app/profiles')} className="flex items-center gap-2 text-gray-500 mb-6 font-bold text-sm">
        <FiArrowLeft /> VOLTAR
      </button>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b bg-gray-50 flex items-center gap-4">
          <FiShield className="text-blue-600" size={24} />
          <h2 className="text-xl font-black text-gray-800">
            {id === 'new' ? 'Novo Perfil' : 'Editar Perfil'}
          </h2>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase mb-2">Nome do Perfil</label>
            <input
              required
              className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase mb-2 flex justify-between">
              Permissões (JSON)
              {jsonError && <span className="text-red-500 text-[10px] tracking-tighter italic">Formato JSON inválido</span>}
            </label>
            <textarea
              className={`w-full h-80 p-4 font-mono text-xs rounded-xl outline-none border-2 ${jsonError ? 'border-red-200 bg-red-50' : 'bg-gray-900 text-green-400'
                }`}
              value={permsRaw}
              onChange={(e) => handlePermChange(e.target.value)}
              spellCheck={false}
            />
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/app/profiles')} className="px-6 py-2 text-gray-500 font-bold">Cancelar</button>
          <button
            type="submit"
            disabled={isSaving || jsonError || !name}
            className="px-10 py-2 bg-blue-600 text-white rounded-xl font-black disabled:bg-gray-300 shadow-lg shadow-blue-100"
          >
            {isSaving ? 'SALVANDO...' : 'SALVAR'}
          </button>
        </div>
      </form>
    </div>
  );
};