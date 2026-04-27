// src/pages/companies/corporate/meetings/MeetingForm.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiUsers, FiCalendar, FiClock } from 'react-icons/fi';

export const MeetingForm: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = !!id;
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        type: 'ordinaria',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        location: '',
        description: '',
        status: 'scheduled',
        participants: [] as string[]
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Simular salvamento
        setTimeout(() => {
            console.log('Salvando assembleia:', formData);
            setLoading(false);
            navigate('/app/companies/corporate/meetings');
        }, 1000);
    };

    const getTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            ordinaria: 'assembleia-geral ordinária',
            extraordinaria: 'assembleia-geral extraordinária',
            reuniao: 'reunião de sócios',
            conselho: 'reunião de conselho'
        };
        return types[type] || type;
    };

    return (
        <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate('/app/companies/corporate/meetings')}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <FiArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isEditing ? 'Editar Assembleia' : 'Nova Assembleia'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {isEditing ? 'Altere os dados da assembleia' : 'Preencha os dados para agendar uma nova assembleia'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 space-y-6">
                    {/* Título e Tipo */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Título da Assembleia <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: Assembleia Geral Ordinária para aprovação de contas"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="ordinaria">assembleia-geral ordinária (AGO)</option>
                                <option value="extraordinaria">assembleia-geral extraordinária (AGE)</option>
                                <option value="reuniao">reunião de sócios</option>
                                <option value="conselho">reunião de conselho</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="scheduled">agendada</option>
                                <option value="in_progress">em andamento</option>
                                <option value="completed">realizada</option>
                                <option value="cancelled">cancelada</option>
                            </select>
                        </div>
                    </div>

                    {/* Data, Hora e Local */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Data <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Horário
                            </label>
                            <div className="relative">
                                <FiClock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="time"
                                    name="time"
                                    value={formData.time}
                                    onChange={handleChange}
                                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Local
                            </label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Sede da empresa ou link virtual"
                            />
                        </div>
                    </div>

                    {/* Descrição */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Descrição / Pauta
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={5}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="Descreva os assuntos a serem discutidos, ordens do dia, etc."
                        />
                    </div>

                    {/* Participantes (simplificado) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Participantes
                        </label>
                        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                <FiUsers size={16} />
                                Lista de participantes será carregada dos acionistas cadastrados
                            </p>
                        </div>
                    </div>

                    {/* Informações legais */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-blue-800 mb-2">Informações para Ata</h3>
                        <p className="text-xs text-blue-600">
                            A ata desta assembleia será gerada automaticamente após a realização,
                            contendo todos os dados preenchidos e podendo ser assinada digitalmente
                            pelos participantes com certificado ICP-Brasil ou conta Gov.br.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/app/companies/corporate/meetings')}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                    >
                        <FiSave size={16} />
                        {loading ? 'Salvando...' : (isEditing ? 'Atualizar Assembleia' : 'Agendar Assembleia')}
                    </button>
                </div>
            </form>
        </div>
    );
};