// frontend/src/pages/DashboardPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiTrendingDown, FiTrendingUp, FiFileText, FiBook,
  FiLock, FiCheckSquare, FiCalendar, FiAlertTriangle,
  FiArrowRight, FiRefreshCw, FiClock, FiChevronRight,
  FiBarChart2, FiAlertCircle,
} from 'react-icons/fi';
import api from '../services/api';
import { RentalAlertsCard } from '../components/RentalAlertsCard';
import { IndicadoresAlertCard } from '../components/IndicadoresAlertCard';
import { SituacaoFiscalCard } from '../components/SituacaoFiscalCard';
import { ListaRecolhida } from '../components/ListaRecolhida';
import { useCompany } from '../contexts/CompanyContext';
import { useSidebarPermissions } from '../contexts/SidebarPermissionsContext';

interface DashKpi {
  apTotal: number; apCount: number;
  arTotal: number; arCount: number;
  nfPending: number; journalCount: number;
  fechamentoStatus: string | null;
  fechamentoCompetencia: string | null;
  docsAguardando: number;
}
interface ApItem {
  id: string; title: string; supplierName: string | null;
  dueDate: string; amount: number; status: string;
}
interface AgendaEvt {
  id: string; title: string; dueDate: string;
  eventType: string; color: string; amount: number | null;
  isPaid: boolean; route: string;
}
interface AgingBucket { label: string; ap: number; ar: number; color: string; }

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

const diffDays = (iso: string): number => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t = new Date(iso); t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / 86_400_000);
};



const dotColor = (color: string, eventType: string): string => {
  if (eventType === 'CLOSING') return '#2563EB';
  const m: Record<string, string> = {
    GREEN: '#10B981', BLUE: '#2563EB', YELLOW: '#F59E0B',
    RED: '#EF4444', ORANGE: '#F97316', PURPLE: '#7C3AED',
  };
  return m[color] ?? '#6B7280';
};

const statusChip = (s: string | null) => {
  const m: Record<string, { label: string; bg: string; color: string }> = {
    ABERTO:         { label: 'Em aberto',      bg: '#FEF3C7', color: '#92400E' },
    EM_FECHAMENTO:  { label: 'Em fechamento',  bg: '#EFF6FF', color: '#1D4ED8' },
    FECHADO_PREVIO: { label: 'Fechado previo', bg: '#F0FDF4', color: '#166534' },
    FECHADO:        { label: 'Fechado',        bg: '#F0FDF4', color: '#166534' },
    REABERTO:       { label: 'Reaberto',       bg: '#FEF3C7', color: '#92400E' },
  };
  return m[s ?? ''] ?? { label: '—', bg: '#F3F4F6', color: '#374151' };
};

const pill = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 3,
  padding: '2px 8px', borderRadius: 9999,
  fontSize: 11, fontWeight: 500, background: bg, color, whiteSpace: 'nowrap',
});

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9CA3AF', padding: '1.25rem 0 0.5rem' }}>
    {children}
  </p>
);

const DaysBadge: React.FC<{ days: number }> = ({ days }) => {
  if (days < 0)   return <span style={pill('#FEE2E2', '#991B1B')}><FiAlertTriangle size={10} /> Vencido {Math.abs(days)}d</span>;
  if (days === 0) return <span style={pill('#FEE2E2', '#991B1B')}>Vence hoje</span>;
  if (days <= 3)  return <span style={pill('#FEF3C7', '#92400E')}>{days} dia{days > 1 ? 's' : ''}</span>;
  if (days <= 7)  return <span style={pill('#FEF9C3', '#854D0E')}>{days} dias</span>;
  return <span style={pill('#D1FAE5', '#065F46')}>{days} dias</span>;
};

const KpiCard: React.FC<{
  accent: string; icon: React.ReactNode; label: React.ReactNode;
  value: React.ReactNode; sub: string; linkColor: string; linkText: string; onClick: () => void;
}> = ({ accent, icon, label, value, sub, linkColor, linkText, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov ? '#F9FAFB' : '#fff', border: '0.5px solid #E5E7EB', borderLeft: '3px solid ' + accent, borderRadius: 10, padding: '0.875rem 1rem', cursor: 'pointer', transition: 'background 0.15s' }}>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>{icon} {label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: '#111', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>{sub}</div>
      <div style={{ fontSize: 11, color: linkColor, marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
        <FiArrowRight size={11} /> {linkText}
      </div>
    </div>
  );
};

const AgendaRow: React.FC<{ evt: AgendaEvt; days: number; isOverdue: boolean; isLast: boolean; onClick: () => void }> = ({ evt, days, isOverdue, isLast, onClick }) => {
  const [hov, setHov] = useState(false);
  const baseBg = isOverdue ? '#FFF5F5' : days === 0 ? '#FFFBEB' : '#fff';
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 1rem', borderBottom: isLast ? 'none' : '0.5px solid #F3F4F6', background: hov ? '#F9FAFB' : baseBg, cursor: 'pointer', transition: 'background 0.12s' }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: dotColor(evt.color, evt.eventType) }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{evt.title}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
          {fmtDate(evt.dueDate)}{evt.amount ? ' · ' + BRL(Number(evt.amount)) : ''}{evt.isPaid ? ' · Pago' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <DaysBadge days={days} />
        <FiChevronRight size={12} color="#D1D5DB" />
      </div>
    </div>
  );
};

const ApRow: React.FC<{ item: ApItem; isLast: boolean; onClick: () => void }> = ({ item, isLast, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', borderBottom: isLast ? 'none' : '0.5px solid #F3F4F6', cursor: 'pointer', background: hov ? '#F9FAFB' : '#fff', transition: 'background 0.12s' }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>{item.supplierName ?? item.title}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF' }}>Vence {fmtDate(item.dueDate)}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#DC2626' }}>{BRL(Number(item.amount))}</div>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const { allowed, loading: permLoading, canView } = useSidebarPermissions();

  // Mesmo fallback do SideBar.tsx: enquanto carrega ou sem permissoes
  // configuradas (allowed vazio), mostra tudo. So filtra quando o perfil
  // tiver permissoes explicitas (allowed nao-vazio e sem '*').
  const show = (path: string) => permLoading || allowed.length === 0 || canView(path);

  const activeMonth = useMemo((): string => {
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
  }, []);

  const [kpi, setKpi] = useState<DashKpi | null>(null);
  const [upcoming, setUpcoming] = useState<ApItem[]>([]);
  const [agendaReal, setAgendaReal] = useState<AgendaEvt[]>([]);
  const [agingBuckets, setAgingBuckets] = useState<AgingBucket[]>([]);
  const [agingTab, setAgingTab] = useState<'ap' | 'ar'>('ap');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());


  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const horizon = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })();

      const [kpiRes, upRes, agRes, agingApRes, agingArRes] = await Promise.allSettled([
        api.get('/dashboard/kpi', { params: { month: activeMonth } }),
        api.get('/finance/accounts-payable', { params: { status: 'OPEN,OVERDUE', limit: 5, orderBy: 'dueDate', order: 'asc' } }),
        // CORRIGIDO 23/10/2026: a API da agenda filtra por ?month= e devolve { events, byDay }
        (async () => {
          const agendaMeses = [0, 1, 2].map(k => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + k);
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
          const rs = await Promise.all(agendaMeses.map(mes => api.get('/finance/agenda', { params: { month: mes } }).catch(() => ({ data: [] }))));
          return { data: rs.flatMap((r: any) => r.data?.events ?? r.data?.data ?? (Array.isArray(r.data) ? r.data : [])) };
        })(),
        api.get('/finance/accounts-payable/aging'),
        api.get('/finance/ar/aging'),
      ]);

      if (kpiRes.status === 'fulfilled') setKpi(kpiRes.value.data);

      if (upRes.status === 'fulfilled') {
        const rows = upRes.value.data?.data ?? upRes.value.data ?? [];
        setUpcoming(Array.isArray(rows) ? rows.slice(0, 5) : []);
      }

      if (agRes.status === 'fulfilled') {
        const ag: any = agRes.value; const rows: any[] = ag?.data?.data ?? ag?.data ?? [];
        setAgendaReal((Array.isArray(rows) ? rows : [])
          .filter((e: any) => { const d = String(e.dueDate ?? '').slice(0, 10); return !!d && d <= horizon && (d >= today || !e.isPaid); })
          .map(e => ({
          id: e.id, title: e.title, dueDate: e.dueDate,
          eventType: e.eventType, color: e.color,
          amount: e.amount ?? null, isPaid: e.isPaid ?? false,
          route: e.eventType === 'CLOSING' ? '/app/finance/fechamento'
            : String(e.title ?? '').startsWith('Recebimento') ? '/app/finance/contas-receber'
            : e.eventType === 'TAX' ? '/app/hr/pro-labore'
            : '/app/finance/agenda',
        })));
      }

      const apD = agingApRes.status === 'fulfilled' ? agingApRes.value.data : {};
      const arD = agingArRes.status === 'fulfilled' ? agingArRes.value.data : {};
      setAgingBuckets([
        { label: 'Vencido',    ap: Number(apD.overdue ?? apD.overdue90plus ?? 0) + Number(apD.overdue60_90 ?? 0) + Number(apD.overdue30_60 ?? 0) + Number(apD.overdue1_30 ?? 0), ar: Number(arD.overdue ?? 0), color: '#EF4444' },
        { label: 'Vence hoje', ap: Number(apD.today ?? apD.dueToday ?? 0),  ar: Number(arD.today ?? 0),  color: '#F59E0B' },
        { label: '1–7 dias',   ap: Number(apD.week  ?? apD.due7    ?? 0),  ar: Number(arD.week  ?? 0),  color: '#FBBF24' },
        { label: '8–30 dias',  ap: Number(apD.month ?? apD.due30   ?? 0),  ar: Number(arD.month ?? 0),  color: '#60A5FA' },
        { label: '+30 dias',   ap: Number(apD.future ?? apD.dueFuture ?? 0), ar: Number(arD.future ?? 0), color: '#D1D5DB' },
      ]);

      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, activeMonth]);

  useEffect(() => { load(); }, [load]);

  const agendaMerged = useMemo(() => [...agendaReal].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()), [agendaReal]);

  // DASH-05: recebimentos de aluguel em aberto vao para bloco proprio; o cronograma fica com os demais eventos
  const ehRecebimento = (e: AgendaEvt) => String(e.title ?? '').startsWith('Recebimento');
  const recebimentosAgenda = agendaMerged.filter(e => ehRecebimento(e) && !e.isPaid);
  const cronograma = agendaMerged.filter(e => !ehRecebimento(e));

  const overdueCount = agendaMerged.filter(e => !e.isPaid && diffDays(e.dueDate) < 0).length;
  const urgentCount  = agendaMerged.filter(e => !e.isPaid && diffDays(e.dueDate) >= 0 && diffDays(e.dueDate) <= 7).length;

  const agingMax = Math.max(...agingBuckets.map(b => agingTab === 'ap' ? b.ap : b.ar), 1);

  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [amY, amM] = activeMonth.split('-');
  const monthLabel = months[parseInt(amM) - 1] + ' / ' + amY;

  const chip = statusChip(kpi?.fechamentoStatus ?? null);

  return (
    <div style={{ width: '100%' }}>  {/* DASH-03: tela inteira (antes maxWidth 1200) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* CABEÇALHO */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111', marginBottom: 2 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            Atualizado as {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {overdueCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#FEE2E2', border: '0.5px solid #FECACA', fontSize: 12, fontWeight: 500, color: '#991B1B' }}>
              <FiAlertTriangle size={13} />
              {overdueCount} evento{overdueCount > 1 ? 's' : ''} vencido{overdueCount > 1 ? 's' : ''} na agenda
            </div>
          )}
          {overdueCount === 0 && urgentCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#FEF3C7', border: '0.5px solid #FCD34D', fontSize: 12, fontWeight: 500, color: '#92400E' }}>
              <FiAlertTriangle size={13} />
              {urgentCount} vencendo em 7 dias
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: '#EFF6FF', border: '0.5px solid #BFDBFE', fontSize: 13, fontWeight: 500, color: '#1D4ED8' }}>
            <FiCalendar size={14} /> {monthLabel}
          </div>
          <button onClick={load} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: '#F9FAFB', border: '0.5px solid #E5E7EB', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
            <FiRefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        </div>
      </div>

      {/* NOVO 23/11/2026 (IND-AUTO-02): indicadores economicos com falha ou atrasados (some quando em dia) */}
      <IndicadoresAlertCard refreshKey={lastUpdate.getTime()} />

      {/* NOVO 13/11/2026 (DASH-03): situacao fiscal - alertas travados, obrigacoes em atraso/a retificar, DARFs em aberto */}
      {show('/app/sistema/obrigacoes') && (
        <div style={{ margin: '0.75rem 0 8px' }}>
          <SituacaoFiscalCard key={activeCompany?.id} refreshKey={lastUpdate.getTime()} />
        </div>
      )}

      {/* NOVO 23/10/2026: alertas de locacao (some quando a empresa nao tem contratos) */}
      {show('/app/assets/rental-contracts') && (
        <div style={{ margin: '0.75rem 0 8px' }}>
          <RentalAlertsCard key={activeCompany?.id} refreshKey={lastUpdate.getTime()} />
        </div>
      )}

      {/* DASH-05 (13/11/2026): recebimentos de aluguel em aberto (eventos da agenda) em bloco proprio, lista recolhida */}
      {show('/app/finance/contas-receber') && recebimentosAgenda.length > 0 && (
        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1rem', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#111' }}>
              <FiTrendingUp size={14} color="#059669" /> Recebimentos de aluguel em aberto
              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>({recebimentosAgenda.length})</span>
            </div>
            <span style={pill('#D1FAE5', '#065F46')}>{BRL(recebimentosAgenda.reduce((s, e) => s + Number(e.amount ?? 0), 0))}</span>
          </div>
          <ListaRecolhida itens={recebimentosAgenda} render={(evt, idx, vis) => {
            const days = diffDays(evt.dueDate);
            return <AgendaRow evt={evt} days={days} isOverdue={days < 0} isLast={idx === vis.length - 1} onClick={() => navigate(evt.route)} />;
          }} />
        </div>
      )}

      {/* AGENDA */}
      {show('/app/finance/agenda') && (
      <>
      <SectionTitle>Agenda financeira - proximos 60 dias</SectionTitle>
      <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#111' }}>
            <FiCalendar size={15} color="#0369A1" /> Cronograma financeiro
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>({cronograma.length})</span>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6B7280', alignItems: 'center' }}>
            {[{ c: '#10B981', l: 'Fiscal / RH' },{ c: '#2563EB', l: 'Contabil' },{ c: '#F59E0B', l: 'Financeiro' },{ c: '#EF4444', l: 'Vencido' }].map(({ c, l }) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} /> {l}
              </span>
            ))}
          </div>
        </div>

        {cronograma.length === 0 && !loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nenhum evento nos proximos 60 dias.</div>
        )}

        <ListaRecolhida itens={cronograma} render={(evt, idx, vis) => {
          const days = diffDays(evt.dueDate);
          const isOverdue = days < 0 && !evt.isPaid;
          const prevDays = idx > 0 ? diffDays(vis[idx - 1].dueDate) : -999;
          const showMarker = days >= 0 && prevDays < 0;
          return (
            <React.Fragment key={evt.id}>
              {showMarker && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 1rem', background: '#F0F9FF', borderBottom: '0.5px solid #BAE6FD' }}>
                  <div style={{ flex: 1, height: '0.5px', background: '#BAE6FD' }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#0369A1', whiteSpace: 'nowrap' }}>
                    Hoje — {new Date().toLocaleDateString('pt-BR')}
                  </span>
                  <div style={{ flex: 1, height: '0.5px', background: '#BAE6FD' }} />
                </div>
              )}
              <AgendaRow evt={evt} days={days} isOverdue={isOverdue}
                isLast={idx === vis.length - 1}
                onClick={() => navigate(evt.route)} />
            </React.Fragment>
          );
        }} />

        <div onClick={() => navigate('/app/finance/agenda')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.65rem 1rem', gap: 5, fontSize: 12, color: '#0369A1', cursor: 'pointer', borderTop: '0.5px solid #E5E7EB' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          <FiCalendar size={13} /> Ver agenda financeira completa
        </div>
      </div>
      </>
      )}

      {/* WIDGET OBRIGAÇÕES */}

      {/* PAINEIS INFERIORES */}
      {(show('/app/finance/accounts-payable') || show('/app/finance/contas-receber')) && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#111' }}>
              <FiClock size={14} color="#DC2626" /> Vencendo nos proximos 7 dias
            </div>
            <span onClick={() => navigate('/app/finance/accounts-payable')} style={{ fontSize: 11, color: '#0369A1', cursor: 'pointer' }}>Ver todas →</span>
          </div>
          {upcoming.length === 0 && !loading && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Nenhum titulo vencendo em 7 dias.</div>
          )}
          {upcoming.map((item, idx) => (
            <ApRow key={item.id} item={item} isLast={idx === upcoming.length - 1}
              onClick={() => navigate('/app/finance/accounts-payable')} />
          ))}
          <div onClick={() => navigate('/app/finance/accounts-payable')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem 1rem', gap: 5, fontSize: 12, color: '#0369A1', cursor: 'pointer', borderTop: '0.5px solid #E5E7EB' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            <FiTrendingDown size={13} /> Ir para contas a pagar
          </div>
        </div>

        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#111' }}>
              <FiBarChart2 size={14} color="#0369A1" /> Aging — posicao atual
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ap', 'ar'] as const)
                .filter(t => t === 'ap' ? show('/app/finance/accounts-payable') : show('/app/finance/contas-receber'))
                .map(t => (
                <button key={t} onClick={() => setAgingTab(t)}
                  style={{ padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: '0.5px solid', background: agingTab === t ? '#EFF6FF' : '#F9FAFB', borderColor: agingTab === t ? '#BFDBFE' : '#E5E7EB', color: agingTab === t ? '#1D4ED8' : '#6B7280' }}>
                  {t === 'ap' ? 'A Pagar' : 'A Receber'}
                </button>
              ))}
            </div>
          </div>
          {agingBuckets.map((b, idx) => {
            const val = agingTab === 'ap' ? b.ap : b.ar;
            const pct = Math.round((val / agingMax) * 100);
            return (
              <div key={b.label} style={{ padding: '0.6rem 1rem', borderBottom: idx < agingBuckets.length - 1 ? '0.5px solid #F3F4F6' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                    {b.label}
                  </span>
                  <span style={{ fontWeight: 500, color: '#111' }}>{BRL(val)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 9999, background: '#F3F4F6' }}>
                  <div style={{ height: 5, borderRadius: 9999, background: b.color, width: pct + '%', transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
          <div onClick={() => navigate(agingTab === 'ap' ? '/app/finance/accounts-payable' : '/app/finance/contas-receber')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem 1rem', gap: 5, fontSize: 12, color: '#0369A1', cursor: 'pointer', borderTop: '0.5px solid #E5E7EB' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
            <FiAlertCircle size={13} /> {agingTab === 'ap' ? 'Ver aging — A Pagar' : 'Ver aging — A Receber'}
          </div>
        </div>

      </div>
      )}

      {/* INDICADORES MOVIDOS PARA O FIM (23/10/2026): o operador ve primeiro o que vence */}
      {/* KPI CARDS */}
      <SectionTitle>Indicadores do mes</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 8 }}>

        {show('/app/finance/accounts-payable') && (
        <KpiCard accent="#0369A1" icon={<FiTrendingDown size={12} color="#0369A1" />}
          label="Contas a pagar"
          value={kpi ? BRL(kpi.apTotal) : '—'}
          sub={kpi ? kpi.apCount + ' titulo' + (kpi.apCount !== 1 ? 's' : '') + ' em aberto' : 'Carregando...'}
          linkColor="#0369A1" linkText="Ver contas a pagar"
          onClick={() => navigate('/app/finance/accounts-payable')} />
        )}

        {show('/app/finance/contas-receber') && (
        <KpiCard accent="#059669" icon={<FiTrendingUp size={12} color="#059669" />}
          label="Contas a receber"
          value={kpi ? BRL(kpi.arTotal) : '—'}
          sub={kpi ? kpi.arCount + ' titulo' + (kpi.arCount !== 1 ? 's' : '') + ' em aberto' : 'Carregando...'}
          linkColor="#059669" linkText="Ver contas a receber"
          onClick={() => navigate('/app/finance/contas-receber')} />
        )}

        {show('/app/finance/fiscal-documents') && (
        <KpiCard accent="#DC2626"
          label="NFs pendentes"
          icon={<><FiFileText size={12} color="#DC2626" />{kpi && kpi.nfPending > 0 && <span style={{ ...pill('#FEE2E2','#991B1B'), fontSize: 10, marginLeft: 4 }}>!</span>}</>}
          value={kpi ? kpi.nfPending : '—'}
          sub="Sem integracao contabil"
          linkColor="#DC2626" linkText="Ver documentos fiscais"
          onClick={() => navigate('/app/finance/fiscal-documents')} />
        )}

        {show('/app/accounting/journal') && (
        <KpiCard accent="#2563EB" icon={<FiBook size={12} color="#2563EB" />}
          label="Lancamentos contabeis"
          value={kpi ? kpi.journalCount : '—'}
          sub={monthLabel}
          linkColor="#2563EB" linkText="Ver lancamentos"
          onClick={() => navigate('/app/accounting/journal')} />
        )}

        {show('/app/finance/fechamento') && (
        <KpiCard accent="#7C3AED" icon={<FiLock size={12} color="#7C3AED" />}
          label="Fechamento mensal"
          value={<span style={{ ...pill(chip.bg, chip.color), fontSize: 13 }}>{chip.label}</span>}
          sub={kpi?.fechamentoCompetencia ? (() => { const [fy, fm] = (kpi.fechamentoCompetencia ?? activeMonth).split('-'); return months[parseInt(fm) - 1] + ' / ' + fy; })() : monthLabel}
          linkColor="#7C3AED" linkText="Ir para fechamento"
          onClick={() => navigate('/app/finance/fechamento')} />
        )}

        {show('/app/arquivo') && (
        <KpiCard accent="#0891B2" icon={<FiCheckSquare size={12} color="#0891B2" />}
          label="Aguard. assinatura"
          value={kpi ? kpi.docsAguardando : '—'}
          sub="Societario — ClickSign"
          linkColor="#0891B2" linkText="Ver arquivo societario"
          onClick={() => navigate('/app/arquivo/societario')} />
        )}

      </div>

    </div>
  );
};

export default DashboardPage;

