import React, { useEffect, useState, useCallback } from 'react';
import api from '../../services/api';
import { useSidebarPermissions } from '../../contexts/SidebarPermissionsContext';

interface SidebarItem { id: string; path: string; label: string; module: string; ordem: number; }
interface Profile { id: string; name: string; }
interface UserItem { id: string; fullName: string; profileId: string | null; }
interface ProfilePerm { itemId: string; canView: boolean; }
interface UserPerm { itemId: string; canView: boolean; companyId: string | null; }

const MODULES: Record<string, string> = {
  geral: 'Geral', admin: 'Administração', rh: 'RH', finance: 'Financeiro',
  accounting: 'Contabilidade', sped: 'SPED', assets: 'Ativo Imobilizado',
  sistema: 'Sistema', societario: 'Societário', arquivo: 'Arquivo',
};

export default function SidebarPermissionsPage() {
  const { invalidate } = useSidebarPermissions();
  const [tab, setTab] = useState<'profiles' | 'users'>('profiles');
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selProfile, setSelProfile] = useState('');
  const [selUser, setSelUser] = useState('');
  const [profilePerms, setProfilePerms] = useState<Set<string>>(new Set());
  const [userPerms, setUserPerms] = useState<Map<string, boolean>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/sidebar-permissions/items').then(r => setItems(r.data));
    api.get('/users').then(r => setUsers(r.data));
    api.get('/profiles').then(r => setProfiles(r.data));
  }, []);

  useEffect(() => {
    if (!selProfile) { setProfilePerms(new Set()); return; }
    api.get(`/sidebar-permissions/profile/${selProfile}`)
      .then(r => setProfilePerms(new Set(r.data.map((p: ProfilePerm) => p.itemId))));
  }, [selProfile]);

  useEffect(() => {
    if (!selUser) { setUserPerms(new Map()); return; }
    api.get(`/sidebar-permissions/user/${selUser}`)
      .then(r => {
        const m = new Map<string, boolean>();
        r.data.forEach((p: UserPerm) => m.set(p.itemId, p.canView));
        setUserPerms(m);
      });
  }, [selUser]);

  const toggleProfile = (itemId: string) => {
    setProfilePerms(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const toggleUser = (itemId: string, current: boolean | undefined) => {
    setUserPerms(prev => {
      const next = new Map(prev);
      if (current === undefined) next.set(itemId, false);
      else if (current === true) next.set(itemId, false);
      else next.delete(itemId);
      return next;
    });
  };

  const saveProfile = async () => {
    if (!selProfile) return;
    setSaving(true);
    await api.post(`/sidebar-permissions/profile/${selProfile}`, { itemIds: [...profilePerms] });
    setSaving(false); setSaved(true); invalidate();
    setTimeout(() => setSaved(false), 2000);
  };

  const saveUser = async () => {
    if (!selUser) return;
    setSaving(true);
    for (const [itemId, canView] of userPerms) {
      await api.post(`/sidebar-permissions/user/${selUser}`, { itemId, canView });
    }
    setSaving(false); setSaved(true); invalidate();
    setTimeout(() => setSaved(false), 2000);
  };

  const byModule = items.reduce((acc, item) => {
    if (!acc[item.module]) acc[item.module] = [];
    acc[item.module].push(item);
    return acc;
  }, {} as Record<string, SidebarItem[]>);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Permissões de Sidebar</h1>
        <p className="text-sm text-gray-500 mt-1">Controle quais itens do menu cada perfil ou usuário pode visualizar</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['profiles', 'users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'profiles' ? 'Por Perfil' : 'Por Usuário'}
          </button>
        ))}
      </div>

      {tab === 'profiles' && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <select value={selProfile} onChange={e => setSelProfile(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]">
              <option value="">Selecione um perfil...</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {selProfile && (
              <button onClick={saveProfile} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
              </button>
            )}
          </div>
          {selProfile && Object.entries(byModule).map(([mod, modItems]) => (
            <div key={mod} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{MODULES[mod] ?? mod}</h3>
              <div className="grid grid-cols-2 gap-2">
                {modItems.map(item => (
                  <label key={item.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={profilePerms.has(item.id)} onChange={() => toggleProfile(item.id)}
                      className="w-4 h-4 text-blue-600 rounded" />
                    <div>
                      <div className="text-sm font-medium text-gray-700">{item.label}</div>
                      <div className="text-xs text-gray-400">{item.path}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <select value={selUser} onChange={e => setSelUser(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]">
              <option value="">Selecione um usuário...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
            {selUser && (
              <button onClick={saveUser} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar Overrides'}
              </button>
            )}
          </div>
          {selUser && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              Overrides individuais sobrepõem as permissões do perfil. Deixe desmarcado para herdar do perfil.
              <br/>Verde = liberado, Vermelho = bloqueado, Cinza = herda do perfil.
            </div>
          )}
          {selUser && Object.entries(byModule).map(([mod, modItems]) => (
            <div key={mod} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{MODULES[mod] ?? mod}</h3>
              <div className="grid grid-cols-2 gap-2">
                {modItems.map(item => {
                  const val = userPerms.get(item.id);
                  return (
                    <button key={item.id} onClick={() => toggleUser(item.id, val)}
                      className={`flex items-center gap-3 p-3 border rounded-lg text-left transition-colors ${
                        val === true ? 'border-green-300 bg-green-50' :
                        val === false ? 'border-red-300 bg-red-50' :
                        'border-gray-100 hover:bg-gray-50'
                      }`}>
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        val === true ? 'bg-green-500' : val === false ? 'bg-red-500' : 'bg-gray-300'
                      }`} />
                      <div>
                        <div className="text-sm font-medium text-gray-700">{item.label}</div>
                        <div className="text-xs text-gray-400">{item.path}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
