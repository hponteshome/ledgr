// D:\Projetos\Ledgr\frontend\src\pages\users\ProfilesList.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiShield, FiPlus, FiEdit2, FiLock, FiActivity } from 'react-icons/fi';
import api from '../../services/api';
import { UserCard } from '../../components/UserCard';

export const ProfileList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profiles, setProfiles] = useState<any[]>([]);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-gray-800">Profile Maintenance</h1>
          <p className="text-sm text-gray-500 font-medium">
            Define access levels, permissions, and system roles
          </p>
        </div>
        <button
          onClick={() => navigate('/app/profiles/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <FiPlus size={20} /> New Profile
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" max-Width='100'>
        <UserCard title="Total Profiles" value={profiles.length} icon={FiShield} color="bg-blue-600" />
        <UserCard
          title="Master Admins"
          value={profiles.filter(p => p.name === 'Administrador Master' || p.permissions?.all === true).length}
          icon={FiActivity}
          color="bg-amber-500"
        />
        <UserCard
          title="Full Access"
          value={profiles.filter(p => p.permissions?.all === true).length}
          icon={FiLock}
          color="bg-purple-600"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto" max-Width='100'>
          <table className="w-full text-left border-collapse" max-Width='100'>
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Profile Name / ID</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Level</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Active Permissions</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100" max-Width='100'>
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="p-10 text-center text-gray-400 animate-pulse font-bold">
                    Loading profiles from database...
                  </td>
                </tr>
              ) : profiles.map(profile => (
                <tr key={profile.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4" max-Width='100'>
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
                        <span className="text-gray-400 text-[10px] italic">No specific permissions</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => navigate(`/app/profiles/edit/${profile.id}`)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Edit Profile & Permissions"
                    >
                      <FiEdit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoading && profiles.length === 0 && (
          <div className="p-10 text-center text-gray-500 italic font-medium">
            No profiles found in the database.
          </div>
        )}
      </div>
    </div >
  );
};