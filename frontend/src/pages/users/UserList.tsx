import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiUsers, FiUserPlus, FiEdit2, FiShield, FiUserCheck } from 'react-icons/fi';
import api from '../../services/api';
import { UserCard } from '../../components/UserCard';

export const UserList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<any[]>([]);
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

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to deactivate this user?")) {
      try {
        await api.delete(`/users/${id}`);
        setUsers(users.filter(u => u.id !== id));
      } catch (error) {
        alert("Error deleting user.");
      }
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
                      <button
                        onClick={() => navigate(`/app/users/edit/${user.id}`)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Edit User"
                      >
                        <FiEdit2 size={18} />
                      </button>
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
  );
};