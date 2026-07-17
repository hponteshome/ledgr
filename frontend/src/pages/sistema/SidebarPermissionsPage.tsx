import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { useSidebarPermissions } from '../../contexts/SidebarPermissionsContext';

type Level = 'NONE' | 'VIEW' | 'EDIT' | 'DELETE';

const LEVELS: { value: Level; label: string; color: string; width: number }[] = [
  { value: 'NONE', label: 'Nenhum', color: '#9CA3AF', width: 60 },
  { value: 'VIEW', label: 'Visualizar', color: '#3B82F6', width: 78 },
  { value: 'EDIT', label: 'Editar', color: '#F59E0B', width: 60 },
  { value: 'DELETE', label: 'Excluir', color: '#EF4444', width: 60 },
];

interface TreeNode {
  id: string;
  path: string;
  label: string;
  module: string;
  dividerBefore?: string | null;
  children: TreeNode[];
}
interface Profile { id: string; name: string; }
interface UserItem { id: string; fullName: string; profileId: string | null; }
interface PermRow { itemId: string; accessLevel: Level; }

function flattenIds(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  for (const n of nodes) {
    out.push(n.id);
    if (n.children && n.children.length > 0) out.push(...flattenIds(n.children));
  }
  return out;
}

function subtreeIds(node: TreeNode): string[] {
  const out: string[] = [node.id];
  if (node.children && node.children.length > 0) {
    node.children.forEach(c => out.push(...subtreeIds(c)));
  }
  return out;
}

function LevelSelector({ value, onChange }: { value: Level; onChange: (l: Level) => void }) {
  return (
    <div className="flex gap-1 flex-shrink-0">
      {LEVELS.map(l => {
        const active = value === l.value;
        return (
          <button
            key={l.value}
            onClick={() => onChange(l.value)}
            className="py-1 text-[11px] font-medium rounded-md border transition-colors text-center"
            style={{
              width: l.width,
              backgroundColor: active ? l.color : '#fff',
              borderColor: active ? l.color : '#E5E7EB',
              color: active ? '#fff' : '#6B7280',
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}

function ColumnHeader({
  allIds, perms, onSetAll,
}: {
  allIds: string[];
  perms: Map<string, Level>;
  onSetAll: (level: Level) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Item de menu</span>
      <div className="flex gap-1 flex-shrink-0">
        {LEVELS.map(l => {
          const count = allIds.filter(id => (perms.get(id) ?? 'NONE') === l.value).length;
          const state: 'all' | 'partial' | 'none' =
            allIds.length === 0 ? 'none' : count === 0 ? 'none' : count === allIds.length ? 'all' : 'partial';
          return (
            <label key={l.value} className="flex flex-col items-center justify-center gap-0.5" style={{ width: l.width }}>
              <input
                type="checkbox"
                checked={state === 'all'}
                ref={el => { if (el) el.indeterminate = state === 'partial'; }}
                onChange={() => onSetAll(l.value)}
                className="w-4 h-4 rounded"
                style={{ accentColor: l.color }}
              />
              <span className="text-[10px] text-gray-500">{l.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function TreeRow({
  node, depth, perms, onChangeNode,
}: {
  node: TreeNode;
  depth: number;
  perms: Map<string, Level>;
  onChangeNode: (node: TreeNode, l: Level) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const level = perms.get(node.id) ?? 'NONE';
  const hasChildren = !!(node.children && node.children.length > 0);

  return (
    <div>
      <div
        className="flex items-center justify-between gap-3 py-1.5 pr-3 border-b border-gray-50 hover:bg-gray-50"
        style={{ paddingLeft: 12 + depth * 20 }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {hasChildren ? (
            <button onClick={() => setOpen(o => !o)} className="text-gray-400 hover:text-gray-600 w-4 flex-shrink-0 text-xs">
              {open ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className={hasChildren ? 'text-sm font-semibold text-gray-800 truncate' : 'text-sm text-gray-600 truncate'}>
              {node.label}
            </div>
            <div className="text-[11px] text-gray-400 truncate">{node.path}</div>
          </div>
        </div>
        <LevelSelector value={level} onChange={l => onChangeNode(node, l)} />
      </div>
      {hasChildren && open && node.children.map(c => (
        <TreeRow key={c.id} node={c} depth={depth + 1} perms={perms} onChangeNode={onChangeNode} />
      ))}
    </div>
  );
}

export default function SidebarPermissionsPage() {
  const { invalidate } = useSidebarPermissions();
  const [tab, setTab] = useState<'profiles' | 'users'>('profiles');
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selProfile, setSelProfile] = useState('');
  const [selUser, setSelUser] = useState('');
  const [profilePerms, setProfilePerms] = useState<Map<string, Level>>(new Map());
  const [userPerms, setUserPerms] = useState<Map<string, Level>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/sidebar-permissions/tree').then(r => setTree(r.data));
    api.get('/users').then(r => setUsers(r.data));
    api.get('/profiles').then(r => setProfiles(r.data));
  }, []);

  useEffect(() => {
    if (!selProfile) { setProfilePerms(new Map()); return; }
    api.get(`/sidebar-permissions/profile/${selProfile}`)
      .then(r => setProfilePerms(new Map(r.data.map((p: PermRow) => [p.itemId, p.accessLevel]))));
  }, [selProfile]);

  useEffect(() => {
    if (!selUser) { setUserPerms(new Map()); return; }
    api.get(`/sidebar-permissions/user/${selUser}`)
      .then(r => setUserPerms(new Map(r.data.map((p: PermRow) => [p.itemId, p.accessLevel]))));
  }, [selUser]);

  const allIds = useMemo(() => flattenIds(tree), [tree]);

  const applyCascade = (ids: string[], level: Level, setPerms: React.Dispatch<React.SetStateAction<Map<string, Level>>>) => {
    setPerms(prev => {
      const next = new Map(prev);
      ids.forEach(id => { if (level === 'NONE') next.delete(id); else next.set(id, level); });
      return next;
    });
  };

  const setProfileLevel = useCallback((node: TreeNode, level: Level) => {
    applyCascade(subtreeIds(node), level, setProfilePerms);
  }, []);

  const setUserLevel = useCallback((node: TreeNode, level: Level) => {
    applyCascade(subtreeIds(node), level, setUserPerms);
  }, []);

  const setAllToLevel = useCallback((level: Level, setPerms: (m: Map<string, Level>) => void) => {
    if (level === 'NONE') { setPerms(new Map()); return; }
    const next = new Map<string, Level>();
    allIds.forEach(id => next.set(id, level));
    setPerms(next);
  }, [allIds]);

  const saveProfile = async () => {
    if (!selProfile) return;
    setSaving(true);
    const items = allIds.map(id => ({ itemId: id, accessLevel: profilePerms.get(id) ?? 'NONE' }));
    await api.post(`/sidebar-permissions/profile/${selProfile}`, { items });
    setSaving(false); setSaved(true); invalidate();
    setTimeout(() => setSaved(false), 2000);
  };

  const saveUser = async () => {
    if (!selUser) return;
    setSaving(true);
    const items = allIds.map(id => ({ itemId: id, accessLevel: userPerms.get(id) ?? 'NONE' }));
    await api.post(`/sidebar-permissions/user/${selUser}/bulk`, { items });
    setSaving(false); setSaved(true); invalidate();
    setTimeout(() => setSaved(false), 2000);
  };

  const perms = tab === 'profiles' ? profilePerms : userPerms;
  const setLevel = tab === 'profiles' ? setProfileLevel : setUserLevel;
  const setPerms = tab === 'profiles' ? setProfilePerms : setUserPerms;
  const activeSelection = tab === 'profiles' ? selProfile : selUser;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Permissões de Sidebar</h1>
        <p className="text-sm text-gray-500 mt-1">Controle o nível de acesso de cada perfil ou usuário por item de menu</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['profiles', 'users'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t === 'profiles' ? 'Por Perfil' : 'Por Usuário'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4 mb-4">
        {tab === 'profiles' ? (
          <select value={selProfile} onChange={e => setSelProfile(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]">
            <option value="">Selecione um perfil...</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <select value={selUser} onChange={e => setSelUser(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]">
            <option value="">Selecione um usuário...</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        )}
        {activeSelection && (
          <button
            onClick={tab === 'profiles' ? saveProfile : saveUser}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
          </button>
        )}
      </div>

      {activeSelection && (
        <>
          <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            {tab === 'users' && 'Overrides individuais sobrepõem as permissões do perfil. '}
            Nenhum = item oculto no menu e bloqueado na API (onde já houver guard). Os níveis são cumulativos: Excluir também permite Editar e Visualizar.
            Marque o checkbox no topo de uma coluna para aplicar aquele nível a todos os itens de uma vez.
          </div>

          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <ColumnHeader allIds={allIds} perms={perms} onSetAll={l => setAllToLevel(l, setPerms)} />
            {tree.map(node => (
              <React.Fragment key={node.id}>
                {node.dividerBefore && (
                  <div className="px-3 pt-3 pb-1 bg-gray-50 border-b border-gray-100">
                    <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                      {node.dividerBefore}
                    </span>
                  </div>
                )}
                <TreeRow node={node} depth={0} perms={perms} onChangeNode={setLevel} />
              </React.Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
