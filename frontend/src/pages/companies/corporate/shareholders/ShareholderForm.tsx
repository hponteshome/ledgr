// src/pages/companies/corporate/shareholders/ShareholderForm.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSave } from 'react-icons/fi';

export const ShareholderForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            navigate('/app/companies/corporate/shareholders');
        }, 1000);
    };

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/app/companies/corporate/shareholders')}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                    <FiArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">
                    {id ? 'Editar Acionista' : 'Novo Acionista'}
                </h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <p className="text-center text-gray-500 py-12">
                    Formulário de acionista em desenvolvimento
                </p>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                        type="button"
                        onClick={() => navigate('/app/companies/corporate/shareholders')}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <FiSave size={16} />
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </form>
        </div>
    );
};