import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FiUser, FiMail, FiPhone, FiCreditCard, FiAtSign,
  FiLock, FiSave, FiArrowLeft, FiShield, FiAlertCircle,
  FiCheckCircle, FiLoader
} from 'react-icons/fi';
import api from '../../services/api';

interface Role {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  nickname: string;
  email: string;
  phone: string;
  document: string;
  document_type: string;
  password: string;
  roleId: string;
  status: string;
}

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

export const UserForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [roles, setRoles] = useState<Role[]>([]);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    nickname: '',
    email: '',
    phone: '',
    document: '',
    document_type: 'CPF',
    password: '',
    roleId: '',
    status: 'active',
  });

  // Load available roles
  useEffect(() => {
    api.get('/roles').then(res => setRoles(res.data)).catch(() => { });
  }, []);

  // Load user data when editing
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    api.get(`/users/${id}`)
      .then(res => {
        const u = res.data;
        setFormData({
          name: u.name || '',
          nickname: u.nickname || '',
          email: u.email || '',
          phone: u.phone || '',
          document: u.document || '',
          document_type: u.document_type || 'CPF',
          password: '',
          roleId: u.role?.id || '',
          status: u.status || 'active',
        });
      })
      .catch(() => setFeedback({ type: 'error', message: 'Error loading user data.' }))
      .finally(() => setIsLoading(false));
  }, [id]);

  const setField = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setFormData(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      if (isEditing) {
        // Build payload without empty password and map roleId
        const { password, roleId, ...rest } = formData;
        const payload: any = { ...rest };
        if (roleId) payload.role_id = roleId;
        if (password.trim()) payload.password = password;

        await api.patch(`/users/${id}`, payload);
        setFeedback({ type: 'success', message: 'User updated successfully!' });
        setTimeout(() => navigate('/app/users'), 1500);
      } else {
        await api.post('/auth/register', formData);
        setFeedback({ type: 'success', message: 'User created successfully!' });
        setTimeout(() => navigate('/app/users'), 1500);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error saving. Please try again.';
      setFeedback({ type: 'error', message: Array.isArray(msg) ? msg.join(', ') : msg });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <span className="text-sm font-medium">Loading data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/app/users')}
          className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
        >
          <FiArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-800">
            {isEditing ? `✏️ Edit User` : '👤 New User'}
          </h1>
          {isEditing && formData.name && (
            <p className="text-sm text-gray-500 font-medium">{formData.name}</p>
          )}
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold border ${feedback.type === 'success'
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50 text-red-700 border-red-200'
          }`}>
          {feedback.type === 'success'
            ? <FiCheckCircle size={18} />
            : <FiAlertCircle size={18} />}
          {feedback.message}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Section: Identification */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FiUser size={14} /> Identification
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div className="md:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Full Name *
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.name}
                onChange={setField('name')}
                placeholder="Full user name"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiAtSign size={12} className="inline mr-1" />Nickname (Username)
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.nickname}
                onChange={setField('nickname')}
                placeholder="user123"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiPhone size={12} className="inline mr-1" />Phone
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.phone}
                onChange={setField('phone')}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
        </div>

        {/* Section: Access */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FiMail size={14} /> System Access
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div className="md:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Corporate Email *
              </label>
              <input
                type="email"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.email}
                onChange={setField('email')}
                placeholder="user@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiLock size={12} className="inline mr-1" />
                {isEditing ? 'New Password (optional)' : 'Access Password *'}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.password}
                onChange={setField('password')}
                placeholder={isEditing ? 'Leave blank to keep current' : 'Minimum 8 characters'}
                required={!isEditing}
              />
              {isEditing && (
                <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase italic">
                  Fill only to reset password
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
                onChange={setField('status')}
              >
                <option value="active">✅ Active</option>
                <option value="inactive">🔴 Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section: Document + Role */}
        <div className="px-8 py-6 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 flex items-center gap-2">
            <FiCreditCard size={14} /> Document & Access Role
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Document Type
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all bg-white"
                value={formData.document_type}
                onChange={setField('document_type')}
              >
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                Document Number *
              </label>
              <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all"
                value={formData.document}
                onChange={setField('document')}
                placeholder={formData.document_type === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">
                <FiShield size={12} className="inline mr-1" />Access Role
              </label>
              <select
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-800 font-medium transition-all bg-white"
                value={formData.roleId}
                onChange={setField('roleId')}
              >
                <option value="">— No role linked —</option>
                {roles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-gray-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/users')}
            className="px-6 py-2.5 text-gray-500 font-bold hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-white font-black shadow-lg transition-all ${isSaving
              ? 'bg-gray-400 cursor-not-allowed shadow-none'
              : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100 hover:shadow-blue-200'
              }`}
          >
            {isSaving ? (
              <>
                <FiLoader size={16} className="animate-spin" />
                PROCESSING...
              </>
            ) : (
              <>
                <FiSave size={16} />
                {isEditing ? 'SAVE CHANGES' : 'CREATE USER'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};