// src/pages/documents/DocumentUpload.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiSave, FiArrowLeft, FiUpload, FiFile,
    FiX, FiCheckCircle, FiAlertCircle
} from 'react-icons/fi';
import api from '../../services/api';
import { useCompany } from '../../contexts/CompanyContext';

export const DocumentUpload: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { companies } = useCompany();
    const isEditing = !!id;

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [formData, setFormData] = useState({
        companyId: '',
        type: 'OUTRO',
        description: '',
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        bookNumber: '',
        registrationNumber: '',
        notes: '',
    });

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);

    useEffect(() => {
        if (isEditing) {
            loadDocument();
        }
    }, [id]);

    const loadDocument = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/documents/${id}`);
            const doc = response.data;

            setFormData({
                companyId: doc.companyId || '',
                type: doc.type || 'OUTRO',
                description: doc.description || '',
                date: doc.date ? doc.date.split('T')[0] : '',
                status: doc.status || 'draft',
                bookNumber: doc.bookNumber?.toString() || '',
                registrationNumber: doc.registrationNumber || '',
                notes: doc.notes || '',
            });

            if (doc.fileUrl) {
                setFilePreview(doc.fileUrl);
            }
        } catch (error) {
            console.error('Erro ao carregar documento:', error);
            setFeedback({ type: 'error', message: 'Erro ao carregar documento' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);

            // Criar preview se for imagem ou PDF
            if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFilePreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        if (!isEditing) {
            setFilePreview(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFeedback(null);

        try {
            const formDataToSend = new FormData();

            // Adicionar campos do formulário
            Object.entries(formData).forEach(([key, value]) => {
                if (value) formDataToSend.append(key, value.toString());
            });

            // Adicionar arquivo se selecionado
            if (selectedFile) {
                formDataToSend.append('file', selectedFile);
            }

            if (isEditing) {
                await api.patch(`/documents/${id}`, formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setFeedback({ type: 'success', message: 'Documento atualizado com sucesso!' });
            } else {
                await api.post('/documents', formDataToSend, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setFeedback({ type: 'success', message: 'Documento criado com sucesso!' });
            }

            setTimeout(() => {
                navigate('/app/documents');
            }, 1500);

        } catch (error: any) {
            console.error('Erro ao salvar documento:', error);
            setFeedback({
                type: 'error',
                message: error.response?.data?.message || 'Erro ao salvar documento'
            });
        } finally {
            setSaving(false);
        }
    };

    const getTypeLabel = (type: string) => {
        const typeMap: Record<string, string> = {
            ATA: 'Ata',
            CONTRATO: 'Contrato',
            ALTERACAO: 'Alteração',
            ASSEMBLEIA: 'Assembleia',
            OUTRO: 'Outro',
            FISCAL: 'Fiscal',
            TRABALHISTA: 'Trabalhista',
            CONTABIL: 'Contábil'
        };
        return typeMap[type] || type;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/app/documents')}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <FiArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isEditing ? 'Editar Documento' : 'Novo Documento'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {isEditing ? 'Altere as informações do documento' : 'Preencha os dados para criar um novo documento'}
                    </p>
                </div>
            </div>

            {/* Feedback */}
            {feedback && (
                <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${feedback.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {feedback.type === 'success'
                        ? <FiCheckCircle size={20} />
                        : <FiAlertCircle size={20} />
                    }
                    {feedback.message}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 space-y-6">
                    {/* Seção: Identificação */}
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Identificação</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
                                <select
                                    name="companyId"
                                    value={formData.companyId}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Selecione uma empresa</option>
                                    {companies.map(company => (
                                        <option key={company.id} value={company.id}>
                                            {company.legalName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="ATA">Ata</option>
                                    <option value="CONTRATO">Contrato</option>
                                    <option value="ALTERACAO">Alteração</option>
                                    <option value="ASSEMBLEIA">Assembleia</option>
                                    <option value="FISCAL">Fiscal</option>
                                    <option value="TRABALHISTA">Trabalhista</option>
                                    <option value="CONTABIL">Contábil</option>
                                    <option value="OUTRO">Outro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data do Documento *</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    required
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Descreva o conteúdo do documento..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Seção: Livro Societário (opcional) */}
                    {['ATA', 'CONTRATO', 'ALTERACAO', 'ASSEMBLEIA'].includes(formData.type) && (
                        <div className="border-t pt-4">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Livro Societário</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Número do Livro</label>
                                    <input
                                        type="text"
                                        name="bookNumber"
                                        value={formData.bookNumber}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ex: 001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Número de Registro</label>
                                    <input
                                        type="text"
                                        name="registrationNumber"
                                        value={formData.registrationNumber}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ex: 12345"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Seção: Arquivo */}
                    <div className="border-t pt-4">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Arquivo</h2>

                        {filePreview ? (
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FiFile size={24} className="text-blue-600" />
                                        <div>
                                            <p className="font-medium text-gray-800">
                                                {selectedFile ? selectedFile.name : 'Arquivo atual'}
                                            </p>
                                            {selectedFile && (
                                                <p className="text-xs text-gray-500">
                                                    {(selectedFile.size / 1024).toFixed(2)} KB
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={clearFile}
                                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <FiX size={18} />
                                    </button>
                                </div>
                                {filePreview && filePreview.startsWith('data:image/') && (
                                    <img src={filePreview} alt="Preview" className="mt-3 max-h-32 rounded-lg" />
                                )}
                            </div>
                        ) : (
                            <div className="mb-4">
                                <label className="block cursor-pointer">
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                                        <FiUpload className="mx-auto text-gray-400 mb-2" size={32} />
                                        <p className="text-sm text-gray-600">
                                            Clique para selecionar um arquivo
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            PDF, DOC, XLS, JPG, PNG (max. 10MB)
                                        </p>
                                    </div>
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                    />
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Seção: Status e Observações */}
                    <div className="border-t pt-4">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">Status e Observações</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="draft">Rascunho</option>
                                    <option value="signed">Assinado</option>
                                    <option value="registered">Registrado</option>
                                    <option value="archived">Arquivado</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    placeholder="Informações adicionais..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/app/documents')}
                        className="px-4 py-2 text-gray-600 font-medium hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                    >
                        <FiSave size={16} />
                        {saving ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Salvar')}
                    </button>
                </div>
            </form>
        </div>
    );
};