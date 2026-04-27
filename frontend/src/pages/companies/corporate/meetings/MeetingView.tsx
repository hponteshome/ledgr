// src/pages/companies/corporate/meetings/MeetingView.tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

export const MeetingView: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/app/companies/corporate/meetings')}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                    <FiArrowLeft size={20} />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Detalhes da Assembleia</h1>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-center text-gray-500 py-12">
                    Detalhes da assembleia em desenvolvimento
                </p>
            </div>
        </div>
    );
};