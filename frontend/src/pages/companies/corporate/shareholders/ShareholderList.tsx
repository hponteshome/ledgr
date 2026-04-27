// src/pages/companies/corporate/shareholders/ShareholderList.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiUsers } from 'react-icons/fi';

export const ShareholderList: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Acionistas</h1>
                    <p className="text-sm text-gray-500 mt-1">Gerencie os acionistas da empresa</p>
                </div>
                <button
                    onClick={() => navigate('/app/companies/corporate/shareholders/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <FiPlus size={18} />
                    Novo Acionista
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-center text-gray-500 py-12">
                    Nenhum acionista cadastrado
                </p>
            </div>
        </div>
    );
};