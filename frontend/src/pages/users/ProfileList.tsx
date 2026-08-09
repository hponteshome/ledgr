// D:\Projetos\Ledgr\frontend\src\pages\users\ProfilesList.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiShield, FiPlus, FiEdit2, FiLock, FiActivity, FiEye, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { UserCard } from '../../components/UserCard';

export const ProfileList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profiles,    setProfiles]    = useState<any[]>([]);
  const [viewProfile, setViewProfile] = useState<any>(null);
  const [viewSchedule, setViewSchedule] = useState<any>(null);

  useEffect(() => {
    if (!viewProfile) { setViewSchedule(null); return; }
    api.get(`/profiles/${viewProfile.id}/access-schedule`)
      .then(({data}) => setViewSchedule(data))
      .catch(() => setViewSchedule(null));
  }, [viewProfile]);

  const [isLoading, setIsLoading] = useState(true);

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/profiles');
      setProfiles(response.data);
    } catch (error) {
      console.error('Error loading profile list:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProfiles(); }, []);

  useEffect(() => {
    if (location.state?.refresh) {
      loadProfiles();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleDelete = async (id: string, nome: string) => {
    const ok = await Swal.fire({
      title: `Excluir perfil "${nome}"?`,
      text: 'Usuários vinculados perderão este perfil. Esta ação não pode ser desfeita.',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#DC2626', confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;
    try {
      await api.delete(`/profiles/${id}`);
      setProfiles(prev => prev.filter((p: any) => p.id !== id));
      Swal.fire('Excluído!', `Perfil ${nome} removido.`, 'success');
    } catch (e: any) {
      Swal.fire('Erro', e?.response?.data?.message || 'Falha ao excluir.', 'error');
    }
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Manutenção de Perfis</h1>
          <p className="text-sm text-gray-500 font-medium">
            Defina níveis de acesso, permissões e papéis do sistema
          </p>
        </div>
        <button
          onClick={() => navigate('/app/profiles/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <FiPlus size={20} /> Novo Perfil
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <UserCard title="Total de Perfis" value={profiles.length} icon={FiShield} color="bg-blue-600" />
        <UserCard
          title="Admins Master"
          value={profiles.filter(p => p.name === 'Administrador Master' || p.permissions?.all === true).length}
          icon={FiActivity}
          color="bg-amber-500"
        />
        <UserCard
          title="Acesso Total"
          value={profiles.filter(p => p.permissions?.all === true).length}
          icon={FiLock}
          color="bg-purple-600"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Nome do Perfil / ID</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Permissões Ativas</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="p-10 text-center text-gray-400 animate-pulse font-bold">
                    Carregando perfis...
                  </td>
                </tr>
              ) : profiles.map(profile => (
                <tr key={profile.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{profile.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono tracking-tighter">{profile.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{profile.name}</div>
                    <div className="flex flex-wrap gap-1">
                      {profile.permissions && Object.keys(profile.permissions).length > 0 ? (
                        Object.entries(profile.permissions)
                          .filter(([_, value]) => value === true)
                          .map(([key]) => (
                            <span key={key} className="bg-blue-50 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded uppercase border border-blue-100">
                              {key}
                            </span>
                          ))
                      ) : (
                        <span className="text-gray-400 text-[10px] italic">Nenhuma permissão específica</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                      <button onClick={()=>setViewProfile(profile)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Visualizar perfil">
                        <FiEye size={18} />
                      </button>
                      <button onClick={()=>navigate(`/app/profiles/edit/${profile.id}`)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar perfil e permissões">
                        <FiEdit2 size={18} />
                      </button>
                      <button onClick={()=>handleDelete(profile.id, profile.name)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Excluir perfil">
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && profiles.length === 0 && (
          <div className="p-10 text-center text-gray-500 italic font-medium">
            Nenhum perfil cadastrado.
          </div>
        )}
      </div>
    </div >

    {/* Modal Visualizar Perfil */}
    {viewProfile&&(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
        zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
        onClick={()=>setViewProfile(null)}>
        <div style={{background:'#fff',borderRadius:16,padding:32,minWidth:460,maxWidth:560,
          boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}} onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <h2 style={{fontSize:18,fontWeight:700,color:'#111',margin:0}}>Detalhes do Perfil</h2>
            <button onClick={()=>setViewProfile(null)}
              style={{border:'none',background:'none',fontSize:20,cursor:'pointer',color:'#9CA3AF'}}>✕</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            {[
              {l:'Nome',         v:viewProfile.name||'—'},
              {l:'Descrição',    v:viewProfile.description||'—'},
              {l:'Usuários',     v:String(viewProfile._count?.users||viewProfile.users?.length||0)+' vinculados'},
              {l:'Criado em',    v:viewProfile.createdAt?new Date(viewProfile.createdAt).toLocaleString('pt-BR'):'—'},
            ].map(f=>(
              <div key={f.l} style={{background:'#F9FAFB',borderRadius:8,padding:'10px 14px'}}>
                <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600,marginBottom:2}}>{f.l}</div>
                <div style={{fontSize:13,fontWeight:500,color:'#374151'}}>{f.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:'#F9FAFB',borderRadius:8,padding:'12px 14px',marginBottom:16}}>
            <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600,marginBottom:8}}>Janela de Acesso</div>
            {!viewSchedule ? (
              <div style={{fontSize:12,color:'#9CA3AF',fontStyle:'italic'}}>Nao configurada (bloqueio total ate ser definida)</div>
            ) : viewSchedule.mode === 'EXEMPT' ? (
              <span style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:'#DCFCE7',color:'#15803D',fontWeight:700}}>Sem restricao</span>
            ) : (
              <div style={{fontSize:12,color:'#374151'}}>
                <div>Dias: {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].filter((_,i)=>viewSchedule.weekdays.includes(i)).join(', ')}</div>
                <div>Horario: {viewSchedule.startTime} - {viewSchedule.endTime}</div>
                {viewSchedule.vacationMonths?.length > 0 && (
                  <div>Ferias: {['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
                    .filter((_,i)=>viewSchedule.vacationMonths.includes(i)).join(', ')}</div>
                )}
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setViewProfile(null)}
              style={{padding:'8px 20px',borderRadius:8,border:'0.5px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:13}}>Fechar</button>
            <button onClick={()=>{setViewProfile(null);navigate(`/app/profiles/edit/${viewProfile.id}`);}}
              style={{padding:'8px 20px',borderRadius:8,border:'none',
                background:'#6C63FF',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>✏ Editar</button>
          </div>
        </div>
      </div>
    )}
  </>);
};