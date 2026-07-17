import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiShield, FiArrowLeft, FiClock } from 'react-icons/fi';
import api from '../../services/api';
import toast from 'react-hot-toast';

const WEEKDAYS = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' },
  { value: 6, label: 'Sab' },
];
const MONTHS = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Fev' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' }, { value: 5, label: 'Mai' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Ago' }, { value: 9, label: 'Set' },
  { value: 10, label: 'Out' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dez' },
];

export const ProfileForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [mode, setMode] = useState<'SCHEDULED'|'EXEMPT'>('SCHEDULED');
  const [weekdays, setWeekdays] = useState<number[]>([1,2,3,4,5]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [vacationMonths, setVacationMonths] = useState<number[]>([]);

  useEffect(() => {
    if (!isNew) {
      (async () => {
        try {
          setIsLoading(true);
          const { data } = await api.get(`/profiles/${id}`);
          setName(data.name);
          try {
            const { data: sched } = await api.get(`/profiles/${id}/access-schedule`);
            if (sched) {
              setMode(sched.mode);
              setWeekdays(sched.weekdays);
              setStartTime(sched.startTime);
              setEndTime(sched.endTime);
              setVacationMonths(sched.vacationMonths);
            }
          } catch { /* sem janela configurada ainda - mantem default */ }
        } catch (err) {
          console.error('Erro ao carregar perfil:', err);
          navigate('/app/profiles');
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [id, isNew, navigate]);

  const toggleWeekday = (d: number) => {
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };
  const toggleMonth = (m: number) => {
    setVacationMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a,b)=>a-b));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Informe o nome do perfil.'); return; }

    setIsSaving(true);
    try {
      let profileId = id;
      if (isNew) {
        const { data } = await api.post('/profiles', { name, permissions: {} });
        profileId = data.id;
      } else {
        await api.patch(`/profiles/${id}`, { name });
      }
      await api.post(`/profiles/${profileId}/access-schedule`, { mode, weekdays, startTime, endTime, vacationMonths });
      toast.success('Perfil salvo.');
      navigate('/app/profiles', { state: { refresh: true } });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Nao foi possivel salvar.');
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
            {isNew ? 'Novo Perfil' : 'Editar Perfil'}
          </h2>
        </div>

        <div className="p-8 space-y-8">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase mb-2">Nome do Perfil</label>
            <input
              required
              className="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-2">
              <FiClock className="text-blue-600" />
              <h3 className="text-sm font-black text-gray-700 uppercase">Janela de Acesso</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Horario padrao que todo usuario deste perfil pode fazer login. Um usuario especifico pode ter horario diferente configurado individualmente na tela de Usuarios.
            </p>

            <div className="flex gap-3 mb-4">
              <button type="button" onClick={()=>setMode('SCHEDULED')}
                className={`px-4 py-2 rounded-lg text-sm font-bold border ${mode==='SCHEDULED' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                Horario Restrito
              </button>
              <button type="button" onClick={()=>setMode('EXEMPT')}
                className={`px-4 py-2 rounded-lg text-sm font-bold border ${mode==='EXEMPT' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                Sem Restricao
              </button>
            </div>

            {mode === 'SCHEDULED' && (
              <div className="space-y-4 bg-gray-50 rounded-xl p-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Dias permitidos</label>
                  <div className="flex gap-2">
                    {WEEKDAYS.map(d => (
                      <button key={d.value} type="button" onClick={()=>toggleWeekday(d.value)}
                        className={`w-12 h-9 rounded-lg text-xs font-bold border ${weekdays.includes(d.value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Horario inicio</label>
                    <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Horario fim</label>
                    <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">Meses de ferias (bloqueio total)</label>
                  <div className="flex flex-wrap gap-2">
                    {MONTHS.map(m => (
                      <button key={m.value} type="button" onClick={()=>toggleMonth(m.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${vacationMonths.includes(m.value) ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/app/profiles')} className="px-6 py-2 text-gray-500 font-bold">Cancelar</button>
          <button
            type="submit"
            disabled={isSaving || !name}
            className="px-10 py-2 bg-blue-600 text-white rounded-xl font-black disabled:bg-gray-300 shadow-lg shadow-blue-100"
          >
            {isSaving ? 'SALVANDO...' : 'SALVAR'}
          </button>
        </div>
      </form>
    </div>
  );
};
