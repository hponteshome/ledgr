// src/pages/companies/corporate/statute/StatuteEdit.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiUpload } from 'react-icons/fi';
import api from '../../../../services/api';
import { useCompany } from '../../../../contexts/CompanyContext';

const STATUS_TO_BACKEND: Record<string, string> = {
    draft: 'RASCUNHO',
    approved: 'APROVADO',
    registered: 'ASSINADO',
    archived: 'ARQUIVADO',
};

const STATUS_FROM_BACKEND: Record<string, string> = {
    RASCUNHO: 'draft',
    APROVADO: 'approved',
    ASSINADO: 'registered',
    ARQUIVADO: 'archived',
};

export const StatuteEdit: React.FC = () => {
    const { id, docId } = useParams<{ id: string; docId?: string }>();
    const navigate = useNavigate();
    const { activeCompany } = useCompany();

    const companyId = activeCompany?.id ?? id ?? '';
    const isEditing = !!docId;

    const [loading, setLoading] = useState(false);
    const [loadingDoc, setLoadingDoc] = useState(isEditing);
    const [changeNote, setChangeNote] = useState('');

    const [formData, setFormData] = useState({
        version: 1,
        approvalDate: new Date().toISOString().split('T')[0],
        registrationDate: '',
        registrationNumber: '',
        notaryOffice: 'JUCESP',
        status: 'draft',
        content: '',
        file: null as File | null,
    });

    // ── Carrega o documento existente quando editando ─────────
    useEffect(() => {
        if (!isEditing || !docId) return;

        const loadDoc = async () => {
            setLoadingDoc(true);
            try {
                const { data } = await api.get(`/documents/${docId}`);
                setFormData({
                    version: data.currentVersion ?? data.current_version ?? 1,
                    approvalDate: data.date
                        ? new Date(data.date).toISOString().split('T')[0]
                        : new Date().toISOString().split('T')[0],
                    registrationDate: data.registrationDate
                        ? new Date(data.registrationDate).toISOString().split('T')[0]
                        : '',
                    registrationNumber: data.registrationNumber ?? '',
                    notaryOffice: data.notes ?? 'JUCESP',
                    status: STATUS_FROM_BACKEND[data.status] ?? 'draft',
                    content: data.content ?? '',
                    file: null,
                });
            } catch (err) {
                console.error('Erro ao carregar documento:', err);
                alert('Não foi possível carregar o estatuto para edição.');
                navigate(`/app/companies/corporate/statute/${companyId}`);
            } finally {
                setLoadingDoc(false);
            }
        };

        loadDoc();
    }, [docId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!companyId) {
            alert('Nenhuma empresa selecionada.');
            return;
        }

        setLoading(true);
        try {
            if (isEditing && docId) {
                // ── PATCH — edita documento existente ────────
                const payload: Record<string, any> = {
                    title: `Estatuto Social v${formData.version}`,
                    description: `Estatuto Social versão ${formData.version} — ${activeCompany?.legalName ?? activeCompany?.tradeName ?? ''}`,
                    status: STATUS_TO_BACKEND[formData.status] ?? 'RASCUNHO',
                    notes: formData.notaryOffice || undefined,
                    bookNumber: formData.registrationNumber ? Number(formData.registrationNumber) : undefined,
                    date: formData.approvalDate ? new Date(formData.approvalDate).toISOString() : undefined,
                    changeNote: changeNote || `Edição manual — v${formData.version}`,
                };

                // Só envia content se foi preenchido (evita sobrescrever com vazio)
                if (formData.content.trim()) {
                    payload.content = formData.content;
                }

                const response = await api.patch(`/documents/${docId}`, payload);
                console.log('✅ Estatuto atualizado:', response.data);
                alert('Estatuto atualizado com sucesso!');

            } else {
                // ── POST — cria novo documento ────────────────
                const payload = {
                    companyId: companyId,
                    type: 'ESTATUTO_SOCIAL',
                    title: `Estatuto Social v${formData.version}`,
                    description: `Estatuto Social versão ${formData.version} — ${activeCompany?.legalName ?? activeCompany?.tradeName ?? ''}`,
                    content: formData.content,
                    status: STATUS_TO_BACKEND[formData.status] ?? 'RASCUNHO',
                    requiresJucesp: true,
                    date: formData.approvalDate ? new Date(formData.approvalDate).toISOString() : undefined,
                    notes: formData.notaryOffice || undefined,
                };

                const response = await api.post('/documents', payload);
                console.log('✅ Estatuto criado:', response.data);
                alert('Estatuto salvo com sucesso!');
            }

            navigate(`/app/companies/corporate/statute/${companyId}`);

        } catch (error: any) {
            console.error('❌ Erro ao salvar:', error);
            const msg = error?.response?.data?.message || 'Erro ao salvar estatuto';
            alert(msg);
        } finally {
            setLoading(false);
        }
    };

    if (loadingDoc) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6">
            {/* Cabeçalho */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate(`/app/companies/corporate/statute/${companyId}`)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <FiArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isEditing ? 'Editar Estatuto Social' : 'Novo Estatuto Social'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {activeCompany?.legalName || activeCompany?.tradeName} •{' '}
                        Versão {formData.version} •{' '}
                        {formData.status === 'draft' ? 'Rascunho' : 'Registrado'}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 space-y-6">

                    {/* Dados do Registro */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Dados do Registro</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Versão</label>
                                <input
                                    type="number"
                                    value={formData.version}
                                    onChange={(e) => setFormData({ ...formData, version: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    min="1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Aprovação</label>
                                <input
                                    type="date"
                                    value={formData.approvalDate}
                                    onChange={(e) => setFormData({ ...formData, approvalDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Registro</label>
                                <input
                                    type="date"
                                    value={formData.registrationDate}
                                    onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Número do Registro</label>
                                <input
                                    type="text"
                                    value={formData.registrationNumber}
                                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Ex: JUCESP 2026/123456"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cartório / Órgão</label>
                                <input
                                    type="text"
                                    value={formData.notaryOffice}
                                    onChange={(e) => setFormData({ ...formData, notaryOffice: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="draft">Rascunho</option>
                            <option value="approved">Aprovado</option>
                            <option value="registered">Registrado / Assinado</option>
                            <option value="archived">Arquivado</option>
                        </select>
                    </div>

                    {/* Nota de alteração (só no modo edição) */}
                    {isEditing && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nota de alteração <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <input
                                type="text"
                                value={changeNote}
                                onChange={(e) => setChangeNote(e.target.value)}
                                placeholder="Ex: Alteração do objeto social, inclusão de sócio..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Conteúdo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Conteúdo do Estatuto
                        </label>
                        <textarea
                            rows={15}
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder="Cole aqui o texto completo do estatuto..."
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            {isEditing
                                ? 'Altere o conteúdo — uma nova versão será criada automaticamente ao salvar.'
                                : 'Cole o texto do estatuto. Futuramente será possível gerar automaticamente pelo template LEDGR.'}
                        </p>
                    </div>

                    {/* Upload de Arquivo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Arquivo Word/PDF (opcional)
                        </label>
                        <label className="block cursor-pointer">
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors">
                                <FiUpload className="mx-auto text-gray-400 mb-2" size={24} />
                                <span className="text-sm text-gray-600">
                                    {formData.file ? formData.file.name : 'Clique para enviar o arquivo Word/PDF'}
                                </span>
                            </div>
                            <input
                                type="file"
                                onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                                className="hidden"
                                accept=".doc,.docx,.pdf"
                            />
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/app/companies/corporate/statute/${companyId}`)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                    >
                        <FiSave size={16} />
                        {loading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Estatuto'}
                    </button>
                </div>
            </div>
        </div>
    );
};