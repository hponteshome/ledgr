// src/pages/companies/corporate/meetings/MeetingList.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiCalendar } from 'react-icons/fi';

export const MeetingList: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Assembleias</h1>
                    <p className="text-sm text-gray-500 mt-1">Gerencie assembleias e reuniões</p>
                </div>
                <button
                    onClick={() => navigate('/app/companies/corporate/meetings/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    <FiPlus size={18} />
                    Nova Assembleia
                </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <p className="text-center text-gray-500 py-12">
                    Nenhuma assembleia agendada
                </p>
            </div>
        </div>
    );
};