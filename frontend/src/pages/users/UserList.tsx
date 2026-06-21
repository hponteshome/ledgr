import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiUsers, FiUserPlus, FiEdit2, FiShield, FiUserCheck, FiEye, FiTrash2 } from 'react-icons/fi';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { UserCard } from '../../components/UserCard';

export const UserList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [users,     setUsers]     = useState<any[]>([]);
  const [viewUser,  setViewUser]  = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading user list:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (location.state?.refresh) {
      loadUsers();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const handleDelete = async (id: string, nome: string) => {
    const ok = await Swal.fire({
      title: `Excluir "${nome || 'este usuário'}"?`,
      text: 'Esta ação não pode ser desfeita.',
      icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#DC2626', confirmButtonText: 'Excluir',
      cancelButtonText: 'Cancelar',
    });
    if (!ok.isConfirmed) return;
    try {
      await api.delete(`/users/${id}`);
      await loadUsers();
      Swal.fire('Excluído!', `Usuário ${nome} removido.`, 'success');
    } catch (error: any) {
      Swal.fire('Erro', error?.response?.data?.message || 'Falha ao excluir.', 'error');
    }
  };

  const getProfileName = (user: any) => {
    return user.profile?.name || user.role?.name || 'Sem perfil';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-800">User Maintenance</h1>
          <p className="text-sm text-gray-500 font-medium">
            Manage system access and identification for all users
          </p>
        </div>
        <button
          onClick={() => navigate('/app/users/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <FiUserPlus size={20} /> New User
        </button>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <UserCard
          title="Total Users"
          value={users.length}
          icon={FiUsers}
          color="bg-blue-600"
        />
        <UserCard
          title="Active Sessions"
          value={users.filter(u => u.status === 'active').length}
          icon={FiUserCheck}
          color="bg-green-500"
        />
        <UserCard
          title="Administrators"
          value={users.filter(u => u.profile?.name === 'Administrador Master' || u.role?.name === 'Administrator').length}
          icon={FiShield}
          color="bg-amber-500"
        />
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Nickname</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Full Name</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Email</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Nível</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Perfil</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-400 animate-pulse font-bold">
                    Loading users...
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                    {/* Nickname */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-gray-800">
                        {user.nickname ? `@${user.nickname}` : '—'}
                      </div>
                    </td>

                    {/* Full Name */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">{user.fullName || user.name}</div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </td>

                    {/* Nível */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-800">{user.nickname || user.name}</div>
                    </td>

                    {/* Perfil */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FiShield size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-700">
                          {getProfileName(user)}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${user.status === 'active'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-600'
                        }`}>
                        {user.status === 'active' ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>

                    {/* Ação */}
                    <td className="px-6 py-4 text-right">
                      <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                        <button
                          onClick={() => setViewUser(user)}
                          className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Visualizar usuário"
                        >
                          <FiEye size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/app/users/edit/${user.id}`)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar usuário"
                        >
                          <FiEdit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id, user.fullName || user.email)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir usuário"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && users.length === 0 && (
          <div className="p-10 text-center text-gray-500 italic font-medium">
            No users found in the database.
          </div>
        )}
      </div>
    </div>

    {/* Modal Visualizar Usuario */}
    {viewUser&&(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',
        zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
        onClick={()=>setViewUser(null)}>
        <div style={{background:'#fff',borderRadius:16,padding:32,minWidth:440,maxWidth:600,
          boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}
          onClick={e=>e.stopPropagation()}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <h2 style={{fontSize:18,fontWeight:700,color:'#111',margin:0}}>Detalhes do Usuário</h2>
            <button onClick={()=>setViewUser(null)}
              style={{border:'none',background:'none',fontSize:20,cursor:'pointer',color:'#9CA3AF'}}>✕</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[
              {l:'Nome Completo',  v:viewUser.fullName||viewUser.name||'—'},
              {l:'Nickname',       v:viewUser.nickname?`@${viewUser.nickname}`:'—'},
              {l:'E-mail',         v:viewUser.email||'—'},
              {l:'Documento',      v:viewUser.document||'—'},
              {l:'Nível',          v:viewUser.level||'—'},
              {l:'Status',         v:viewUser.status||'—'},
              {l:'Perfil',         v:viewUser.profile?.name||'Sem perfil'},
              {l:'Último acesso',  v:viewUser.lastAccess?new Date(viewUser.lastAccess).toLocaleString('pt-BR'):'—'},
              {l:'Criado em',      v:viewUser.createdAt?new Date(viewUser.createdAt).toLocaleString('pt-BR'):'—'},
              {l:'2FA',            v:viewUser.twoFactorActive?'Ativo':'Inativo'},
            ].map(f=>(
              <div key={f.l} style={{background:'#F9FAFB',borderRadius:8,padding:'10px 14px'}}>
                <div style={{fontSize:10,color:'#9CA3AF',textTransform:'uppercase',fontWeight:600,marginBottom:2}}>{f.l}</div>
                <div style={{fontSize:13,fontWeight:500,color:'#374151'}}>{f.v}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}>
            <button onClick={()=>setViewUser(null)}
              style={{padding:'8px 20px',borderRadius:8,border:'0.5px solid #E5E7EB',
                background:'#fff',cursor:'pointer',fontSize:13}}>Fechar</button>
            <button onClick={()=>{setViewUser(null);navigate(`/app/users/edit/${viewUser.id}`);}}
              style={{padding:'8px 20px',borderRadius:8,border:'none',
                background:'#6C63FF',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600}}>✏ Editar</button>
          </div>
        </div>
      </div>
    )}
  );
};