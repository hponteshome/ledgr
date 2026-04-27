// src/pages/companies/corporate/atas/age/AgeList.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FiFileText, FiPlus, FiEdit2, FiEye, FiTrash2,
    FiClock, FiCheckCircle, FiArchive, FiAlertCircle,
} from 'react-icons/fi';
import api from '../../../../../services/api';
import { useCompany } from '../../../../../contexts/CompanyContext';

interface AgeRecord {
    id: string;
    title: string;
    status: string;
    currentVersion?: number;
    current_version?: number;
    date?: string;
    updatedAt: string;
    versions?: { version: number; changeNote?: string; createdAt: string }[];
}

const STATUS_MAP: Record<string, { icon: React.ReactNode; title: string; text: string }> = {
    RASCUNHO: { icon: <FiClock size={14} />, title: 'Rascunho', text: 'text-gray-400' },
    EM_REVISAO: { icon: <FiAlertCircle size={14} />, title: 'Em Revisão', text: 'text-yellow-500' },
    AGUARDANDO_ASSINATURA: { icon: <FiAlertCircle size={14} />, title: 'Ag. Assinatura', text: 'text-yellow-500' },
    ASSINADO: { icon: <FiCheckCircle size={14} />, title: 'Assinado', text: 'text-blue-500' },
    REGISTRADO: { icon: <FiCheckCircle size={14} />, title: 'Registrado', text: 'text-green-500' },
    ARQUIVADO: { icon: <FiArchive size={14} />, title: 'Arquivado', text: 'text-red-400' },
};

function StatusIcon({ status }: { status: string }) {
    const s = STATUS_MAP[status] ?? STATUS_MAP['RASCUNHO'];
    return <span className={s.text} title={s.title}>{s.icon}</span>;
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
}

function DeleteModal({ title, onConfirm, onCancel }: {
    title: string; onConfirm: () => void; onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <FiTrash2 size={18} className="text-red-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">Excluir documento</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Esta ação não pode ser desfeita.</p>
                    </div>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                    Tem certeza que deseja excluir <span className="font-medium">"{title}"</span>?
                </p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm">Cancelar</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">Excluir</button>
                </div>
            </div>
        </div>
    );
}

export const AgeList: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { activeCompany } = useCompany();
    const companyId = activeCompany?.id ?? id ?? '';

    const [ages, setAges] = useState<AgeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AgeRecord | null>(null);

    const load = async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/documents', {
                params: { companyId, type: 'ATA_AGE' },
            });
            setAges(data);
        } catch (err) {
            console.error('Erro ao carregar AGEs:', err);
            setError('Não foi possível carregar as assembleias.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [companyId]);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await api.delete(`/documents/${deleteTarget.id}`);
            setAges(prev => prev.filter(a => a.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch {
            alert('Não foi possível excluir o documento.');
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto p-6">
            {deleteTarget && (
                <DeleteModal
                    title={deleteTarget.title}
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Assembleia Geral Extraordinária</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {activeCompany?.legalName || activeCompany?.tradeName || 'Empresa'}
                    </p>
                </div>
                <button
                    onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}/nova`)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <FiPlus size={18} />
                    Nova AGE
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}

            {!error && ages.length === 0 && (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
                    <FiFileText size={48} className="mx-auto text-gray-300 mb-3" />
                    <h2 className="text-lg font-semibold text-gray-700 mb-2">Nenhuma AGE registrada</h2>
                    <p className="text-gray-400 mb-6 text-sm">Registre a primeira Assembleia Geral Extraordinária desta empresa.</p>
                    <button
                        onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}/nova`)}
                        className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <FiPlus size={16} />
                        Nova AGE
                    </button>
                </div>
            )}

            {ages.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-3 py-3 w-8" />
                                <th className="text-left px-2 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide w-16">vsys</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Título</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide">Nota de alteração</th>
                                <th className="text-left px-3 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide w-20">Data</th>
                                <th className="text-left px-3 py-3 font-medium text-gray-500 uppercase text-xs tracking-wide w-20">Alterado</th>
                                <th className="px-3 py-3 w-24" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {ages.map((age) => {
                                const version = age.currentVersion ?? age.current_version ?? 1;
                                const changeNote = age.versions?.[0]?.changeNote;
                                return (
                                    <tr key={age.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-3 py-3 text-center">
                                            <StatusIcon status={age.status} />
                                        </td>
                                        <td className="px-2 py-3 text-gray-500 text-xs font-mono">v{version}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <FiFileText className="text-blue-400 flex-shrink-0" size={15} />
                                                <span className="font-medium text-gray-800 truncate">{age.title}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            {changeNote
                                                ? <span className="text-xs text-gray-500 truncate block" title={changeNote}>{changeNote}</span>
                                                : <span className="text-xs text-gray-300">—</span>}
                                        </td>
                                        <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(age.date)}</td>
                                        <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(age.updatedAt)}</td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-1 justify-end">
                                                <button
                                                    onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}/view/${age.id}`)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Visualizar"
                                                ><FiEye size={15} /></button>
                                                <button
                                                    onClick={() => navigate(`/app/companies/corporate/atas/age/${companyId}/editar/${age.id}`)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                ><FiEdit2 size={15} /></button>
                                                <button
                                                    onClick={() => setDeleteTarget(age)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Excluir"
                                                ><FiTrash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};