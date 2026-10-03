// frontend/src/pages/projects/workspace/ProjetoWorkspace.tsx
// D8 (03/10/2026): espaco SEGREGADO do projeto - layout, menu e painel proprios, sem o menu nem o seletor de
// empresas do LEDGR (rota irma de "/", fora do Layout). Mesma autenticacao e mesma API: a autorizacao continua
// por concessao (ProjEscopoGuard) e RLS no banco.
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FiGrid, FiDollarSign, FiUsers, FiKey, FiAlertCircle, FiRepeat, FiFileText, FiArrowLeft, FiLogOut, FiLayers } from 'react-icons/fi';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import ConcessoesPage from '../ConcessoesPage';
import PainelProjeto from './PainelProjeto';
import CreditosProjeto from './CreditosProjeto';
import ParticipantesProjeto from './ParticipantesProjeto';
import { PROJ, PROJ_ACCENT, Projeto, erroSt } from './projetoTema';

const itemSt = (ativo: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, fontSize: 13,
  color: ativo ? '#fff' : 'rgba(255,255,255,0.72)', background: ativo ? 'rgba(255,255,255,0.14)' : 'transparent',
  textDecoration: 'none', fontWeight: ativo ? 600 : 400,
});
const botaoRodape: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 7, border: 'none',
  background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', fontSize: 12, cursor: 'pointer',
};

const MENU: { to: string; label: string; icon: React.ElementType; end?: boolean }[] = [
  { to: '', label: 'Painel', icon: FiGrid, end: true },
  { to: 'creditos', label: 'Créditos', icon: FiDollarSign },
  { to: 'participantes', label: 'Participantes', icon: FiUsers },
];
const EM_BREVE: { label: string; icon: React.ElementType }[] = [
  { label: 'Pendências', icon: FiAlertCircle },
  { label: 'Extratos e conciliação', icon: FiRepeat },
  { label: 'Documentos', icon: FiFileText },
];

export default function ProjetoWorkspace() {
  const { projetoId = '' } = useParams();
  const auth = useAuth() as any;
  const { user, loading } = auth;
  const navigate = useNavigate();
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [opId, setOpId] = useState('');
  const [erro, setErro] = useState('');
  const master = user?.profile?.permissions?.all === true;

  useEffect(() => {
    if (!user) return;
    setErro('');
    api.get(`/projects/${projetoId}`)
      .then((r) => { setProjeto(r.data); setOpId(r.data?.operacoes?.[0]?.id || ''); })
      .catch((e) => setErro(e?.response?.status === 404 ? 'Projeto não encontrado ou sem acesso.' : e?.response?.data?.message || 'Falha ao carregar o projeto.'));
  }, [projetoId, user]);

  if (loading) return <div style={{ padding: 40, color: '#6B7280' }}>Carregando...</div>;
  if (!user) return <Navigate to="/" replace />;

  const base = `/projetos/${projetoId}`;
  const operacao = projeto?.operacoes.find((o) => o.id === opId) || null;
  const sair = () => { if (typeof auth.signOut === 'function') auth.signOut(); navigate('/'); };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#F8FAFC' }}>
      <Toaster position="top-right" />
      <aside style={{ width: 236, background: PROJ, color: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>Projeto</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, lineHeight: 1.25 }}>{projeto?.nome || '...'}</div>
        </div>
        <nav style={{ padding: 10, flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {MENU.map((m) => (
            <NavLink key={m.label} to={m.to ? `${base}/${m.to}` : base} end={m.end} style={({ isActive }) => itemSt(isActive)}>
              <m.icon size={15} /> {m.label}
            </NavLink>
          ))}
          {master && (
            <NavLink to={`${base}/concessoes`} style={({ isActive }) => itemSt(isActive)}>
              <FiKey size={15} /> Concessões de acesso
            </NavLink>
          )}
          <div style={{ fontSize: 10, letterSpacing: 1, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', margin: '18px 12px 6px' }}>Em breve</div>
          {EM_BREVE.map((m) => (
            <div key={m.label} style={{ ...itemSt(false), opacity: 0.45, cursor: 'default' }}>
              <m.icon size={15} /> {m.label}
            </div>
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {master && <button style={botaoRodape} onClick={() => navigate('/app/dashboard')}><FiArrowLeft size={13} /> Voltar ao LEDGR</button>}
          <button style={botaoRodape} onClick={sair}><FiLogOut size={13} /> Sair</button>
        </div>
      </aside>
      <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        <header style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <FiLayers color={PROJ_ACCENT} size={18} />
          {projeto && projeto.operacoes.length > 1 ? (
            <select value={opId} onChange={(e) => setOpId(e.target.value)} style={{ padding: '6px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13 }}>
              {projeto.operacoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          ) : (
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{operacao?.nome || ''}</div>
          )}
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{user?.fullName || user?.name || user?.email}</div>
            <div style={{ fontSize: 11, color: '#6B7280' }}>{user?.email}</div>
          </div>
        </header>
        <div style={{ padding: 24 }}>
          {erro ? (
            <div style={erroSt}>⚠ {erro}</div>
          ) : !projeto ? (
            <div style={{ color: '#6B7280' }}>Carregando...</div>
          ) : (
            <Routes>
              <Route index element={<PainelProjeto projeto={projeto} operacao={operacao} />} />
              <Route path="creditos" element={<CreditosProjeto operacao={operacao} master={master} />} />
              <Route path="participantes" element={<ParticipantesProjeto operacao={operacao} />} />
              {master && <Route path="concessoes" element={<ConcessoesPage />} />}
              <Route path="*" element={<Navigate to={base} replace />} />
            </Routes>
          )}
        </div>
      </main>
    </div>
  );
}
