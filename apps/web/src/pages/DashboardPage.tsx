import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiTrendingDown, FiTrendingUp, FiFileText, FiBook,
  FiLock, FiFileCheck, FiCalendar, FiAlertTriangle,
  FiArrowRight, FiRefreshCw, FiClock, FiChevronRight,
  FiBarChart2, FiAlertCircle,
} from 'react-icons/fi';
import api from '../services/api';
import { useCompany } from '../contexts/CompanyContext';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

interface DashKpi {
  apTotal: number;
  apCount: number;
  arTotal: number;
  arCount: number;
  nfPending: number;
  journalCount: number;
  fechamentoStatus: string | null;
  fechamentoMonth: string | null;
  docsAguardando: number;
}

interface ApItem {
  id: string;
  title: string;
  supplierName: string | null;
  dueDate: string;
  netAmount: number;
  status: string;
}

interface AgendaItem {
  id: string;
  title: string;
  dueDate: string;
  eventType: string;
  color: string;
  amount: number | null;
  isPaid: boolean;
  route: string;
}

interface AgingBucket {
  label: string;
  ap: number;
  ar: number;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
};

const diffDays = (iso: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
};

// Último dia útil do mês (recua se cair em fim de semana — feriados não mapeados)
const lastBusinessDay = (year: number, month: number): Date => {
  const last = new Date(year, month, 0); // último dia do mês
  while (last.getDay() === 0 || last.getDay() === 6) last.setDate(last.getDate() - 1);
  return last;
};

// Próxima ocorrência de dia D do mês seguinte ao mês de referência
const nextMonthDay = (refYear: number, refMonth: number, day: number): Date => {
  // refMonth é 0-indexed
  const d = new Date(refYear, refMonth + 1, day);
  return d;
};

// Gera agenda fiscal estática para os próximos 60 dias a partir de hoje
const buildStaticAgenda = (activeMonthStr: string): AgendaItem[] => {
  // activeMonthStr = 'YYYY-MM'
  const [y, m] = activeMonthStr.split('-').map(Number);
  const refYear = y;
  const refMonth = m - 1; // 0-indexed

  const events: Omit<AgendaItem, 'id'>[] = [
    {
      title: 'FGTS — competência ' + activeMonthStr,
      dueDate: nextMonthDay(refYear, refMonth, 7).toISOString(),
      eventType: 'TAX',
      color: 'GREEN',
      amount: null,
      isPaid: false,
      route: '/app/hr/pro-labore',
    },
    {
      title: 'GPS — INSS Pró-labore ' + activeMonthStr,
      dueDate: nextMonthDay(refYear, refMonth, 20).toISOString(),
      eventType: 'TAX',
      color: 'GREEN',
      amount: null,
      isPaid: false,
      route: '/app/hr/pro-labore',
    },
    {
      title: 'DARF IRRF — Pró-labore ' + activeMonthStr,
      dueDate: nextMonthDay(refYear, refMonth, 20).toISOString(),
      eventType: 'TAX',
      color: 'GREEN',
      amount: null,
      isPaid: false,
      route: '/app/hr/pro-labore',
    },
    {
      title: 'EFD Contribuições PIS/COFINS — ' + activeMonthStr,
      dueDate: new Date(refYear, refMonth + 2, 10).toISOString(),
      eventType: 'TAX',
      color: 'GREEN',
      amount: null,
      isPaid: false,
      route: '/app/arquivo/fiscal/obrigacoes',
    },
    {
      title: 'Fechamento Mensal — ' + activeMonthStr,
      dueDate: lastBusinessDay(refYear, refMonth + 1).toISOString(),
      eventType: 'CLOSING',
      color: 'BLUE',
      amount: null,
      isPaid: false,
      route: '/app/finance/fechamento',
    },
    {
      title: 'ECD — entrega anual (prazo 31/05)',
      dueDate: new Date(refYear, 4, 31).toISOString(), // maio
      eventType: 'TAX',
      color: 'BLUE',
      amount: null,
      isPaid: false,
      route: '/app/accounting/importacao/ecd',
    },
    {
      title: 'ECF — entrega anual (prazo 31/07)',
      dueDate: new Date(refYear, 6, 31).toISOString(), // julho
      eventType: 'TAX',
      color: 'BLUE',
      amount: null,
      isPaid: false,
      route: '/app/arquivo/fiscal/ecf',
    },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 60);

  return events
    .filter(e => {
      const d = new Date(e.dueDate);
      return d >= new Date(today.getTime() - 7 * 86_400_000) && d <= horizon;
    })
    .map((e, i) => ({ ...e, id: 'static-' + i }));
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────────────────────

const DaysBadge: React.FC<{ days: number }> = ({ days }) => {
  if (days < 0)
    return (
      <span style={badge('#FEE2E2', '#991B1B')}>
        <FiAlertTriangle size={10} style={{ marginRight: 3 }} />
        Vencido {Math.abs(days)}d
      </span>
    );
  if (days === 0) return <span style={badge('#FEE2E2', '#991B1B')}>Vence hoje</span>;
  if (days <= 3) return <span style={badge('#FEF3C7', '#92400E')}>{days} dia{days > 1 ? 's' : ''}</span>;
  if (days <= 7) return <span style={badge('#FEF9C3', '#854D0E')}>{days} dias</span>;
  return <span style={badge('#D1FAE5', '#065F46')}>{days} dias</span>;
};

const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center',
  padding: '2px 8px', borderRadius: 9999,
  fontSize: 11, fontWeight: 500,
  background: bg, color,
  whiteSpace: 'nowrap',
});

const dotColor = (color: string, eventType: string): string => {
  if (eventType === 'CLOSING') return '#2563EB';
  const map: Record<string, string> = {
    GREEN: '#10B981', BLUE: '#2563EB', YELLOW: '#F59E0B',
    RED: '#EF4444', ORANGE: '#F97316', PURPLE: '#7C3AED',
  };
  return map[color] ?? '#6B7280';
};

const statusLabel = (s: string | null) => {
  if (!s) return { label: '—', bg: '#F3F4F6', color: '#374151' };
  const map: Record<string, { label: string; bg: string; color: string }> = {
    ABERTO: { label: 'Em aberto', bg: '#FEF3C7', color: '#92400E' },
    EM_FECHAMENTO: { label: 'Em fechamento', bg: '#EFF6FF', color: '#1D4ED8' },
    FECHADO_PREVIO: { label: 'Fechado prévio', bg: '#F0FDF4', color: '#166534' },
    FECHADO: { label: 'Fechado', bg: '#F0FDF4', color: '#166534' },
    REABERTO: { label: 'Reaberto', bg: '#FEF3C7', color: '#92400E' },
  };
  return map[s] ?? { label: s, bg: '#F3F4F6', color: '#374151' };
};

// Seção-título padrão
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: '#9CA3AF',
    padding: '1.25rem 0 0.5rem',
  }}>{children}</p>
);

// Card base reutilizável
const Card: React.FC<{
  children: React.ReactNode;
  accent?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}> = ({ children, accent, onClick, style }) => (
  <div
    onClick={onClick}
    style={{
      background: '#fff',
      border: '0.5px solid #E5E7EB',
      borderRadius: 10,
      padding: '0.875rem 1rem',
      borderLeft: accent ? `3px solid ${accent}` : '0.5px solid #E5E7EB',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'background 0.15s',
      ...style,
    }}
    onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.background = '#F9FAFB')}
    onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.background = '#fff')}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeCompany } = useCompany();

  // Mês ativo do localStorage (mesmo token do Header)
  const activeMonth: string = (() => {
    const saved = localStorage.getItem('@ledgr:activeMonth');
    if (saved) return saved;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const [kpi, setKpi] = useState<DashKpi | null>(null);
  const [upcoming, setUpcoming] = useState<ApItem[]>([]);
  const [agendaReal, setAgendaReal] = useState<AgendaItem[]>([]);
  const [agendaStatic] = useState<AgendaItem[]>(() => buildStaticAgenda(activeMonth));
  const [agingAp, setAgingAp] = useState<AgingBucket[]>([]);
  const [agingTab, setAgingTab] = useState<'ap' | 'ar'>('ap');
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!activeCompany?.id) return;
    setLoading(true);
    try {
      const [kpiRes, upcomingRes, agendaRes, agingRes] = await Promise.allSettled([
        api.get('/dashboard/kpi', { params: { month: activeMonth } }),
        api.get('/finance/accounts-payable', {
          params: { status: 'OPEN,OVERDUE', limit: 5, orderBy: 'dueDate', order: 'asc' },
        }),
        api.get('/finance/agenda', {
          params: {
            from: new Date().toISOString().slice(0, 10),
            to: (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })(),
            limit: 30,
          },
        }),
        api.get('/finance/accounts-payable/aging'),
      ]);

      if (kpiRes.status === 'fulfilled') setKpi(kpiRes.value.data);
      if (upcomingRes.status === 'fulfilled') {
        const rows = upcomingRes.value.data?.data ?? upcomingRes.value.data ?? [];
        setUpcoming(Array.isArray(rows) ? rows.slice(0, 5) : []);
      }
      if (agendaRes.status === 'fulfilled') {
        const rows = agendaRes.value.data?.data ?? agendaRes.value.data ?? [];
        setAgendaReal(
          (Array.isArray(rows) ? rows : []).map((e: any) => ({
            ...e,
            route: e.eventType === 'TAX' ? '/app/hr/pro-labore'
              : e.eventType === 'CLOSING' ? '/app/finance/fechamento'
              : '/app/finance/agenda',
          }))
        );
      }
      if (agingRes.status === 'fulfilled') {
        const d = agingRes.value.data ?? {};
        setAgingAp([
          { label: 'Vencido',     ap: d.overdue ?? 0,  ar: 0, color: '#EF4444' },
          { label: 'Vence hoje',  ap: d.today ?? 0,    ar: 0, color: '#F59E0B' },
          { label: '1–7 dias',    ap: d.week ?? 0,     ar: 0, color: '#FBBF24' },
          { label: '8–30 dias',   ap: d.month ?? 0,    ar: 0, color: '#60A5FA' },
          { label: '+30 dias',    ap: d.future ?? 0,   ar: 0, color: '#D1D5DB' },
        ]);
      }
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, activeMonth]);

  useEffect(() => { load(); }, [load]);

  // Agenda mesclada e ordenada
  const agendaMerged = React.useMemo(() => {
    const ids = new Set(agendaReal.map(e => e.id));
    const all = [
      ...agendaReal,
      ...agendaStatic.filter(e => !ids.has(e.id)),
    ];
    return all.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [agendaReal, agendaStatic]);

  const urgentCount = agendaMerged.filter(e => {
    const d = diffDays(e.dueDate);
    return d >= 0 && d <= 7 && !e.isPaid;
  }).length;

  const overdueCount = agendaMerged.filter(e => diffDays(e.dueDate) < 0 && !e.isPaid).length;

  const agingMax = Math.max(...agingAp.map(b => b.ap), 1);

  // ── RENDER ──────────────────────────────────────────────────────────────────

  const s = statusLabel(kpi?.fechamentoStatus ?? null);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* ── HEADER CONTEXTUAL ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1rem', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111', marginBottom: 2 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(overdueCount > 0 || urgentCount > 0) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              background: overdueCount > 0 ? '#FEE2E2' : '#FEF3C7',
              border: `0.5px solid ${overdueCount > 0 ? '#FECACA' : '#FCD34D'}`,
              fontSize: 12, fontWeight: 500,
              color: overdueCount > 0 ? '#991B1B' : '#92400E',
            }}>
              <FiAlertTriangle size={13} />
              {overdueCount > 0
                ? `${overdueCount} obrigaç${overdueCount > 1 ? 'ões vencidas' : 'ão vencida'}`
                : `${urgentCount} vencendo em 7 dias`}
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8,
            background: '#EFF6FF', border: '0.5px solid #BFDBFE',
            fontSize: 13, fontWeight: 500, color: '#1D4ED8',
          }}>
            <FiCalendar size={14} />
            {(() => {
              const [y, m] = activeMonth.split('-');
              const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              return `${months[parseInt(m) - 1]} / ${y}`;
            })()}
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8,
              background: '#F9FAFB', border: '0.5px solid #E5E7EB',
              fontSize: 12, color: '#374151', cursor: 'pointer',
            }}
          >
            <FiRefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>

      {/* ── KPI CARDS ────────────────────────────────────────────────────── */}
      <SectionTitle>Indicadores do mês</SectionTitle>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10, marginBottom: 8,
      }}>

        {/* A Pagar */}
        <Card accent="#0369A1" onClick={() => navigate('/app/finance/accounts-payable')}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FiTrendingDown size={12} color="#0369A1" /> Contas a pagar
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#111', lineHeight: 1.1 }}>
            {kpi ? BRL(kpi.apTotal) : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
            {kpi ? `${kpi.apCount} título${kpi.apCount !== 1 ? 's' : ''} em aberto` : 'Carregando...'}
          </div>
          <div style={{ fontSize: 11, color: '#0369A1', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
            <FiArrowRight size={11} /> Ver contas a pagar
          </div>
        </Card>

        {/* A Receber */}
        <Card accent="#059669" onClick={() => navigate('/app/finance/contas-receber')}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FiTrendingUp size={12} color="#059669" /> Contas a receber
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#111', lineHeight: 1.1 }}>
            {kpi ? BRL(kpi.arTotal) : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
            {kpi ? `${kpi.arCount} título${kpi.arCount !== 1 ? 's' : ''} em aberto` : 'Carregando...'}
          </div>
          <div style={{ fontSize: 11, color: '#059669', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
            <FiArrowRight size={11} /> Ver contas a receber
          </div>
        </Card>

        {/* NFs Pendentes */}
        <Card accent="#DC2626" onClick={() => navigate('/app/finance/fiscal-documents')}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FiFileText size={12} color="#DC2626" /> NFs pendentes
            {kpi && kpi.nfPending > 0 && (
              <span style={{ ...badge('#FEE2E2', '#991B1B'), fontSize: 10 }}>!</span>
            )}
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#111', lineHeight: 1.1 }}>
            {kpi ? kpi.nfPending : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Sem integração contábil</div>
          <div style={{ fontSize: 11, color: '#DC2626', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
            <FiArrowRight size={11} /> Ver documentos fiscais
          </div>
        </Card>

        {/* Lançamentos */}
        <Card accent="#2563EB" onClick={() => navigate('/app/accounting/journal')}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FiBook size={12} color="#2563EB" /> Lançamentos contábeis
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#111', lineHeight: 1.1 }}>
            {kpi ? kpi.journalCount : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
            {(() => {
              const [y, m] = activeMonth.split('-');
              const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              return `${months[parseInt(m) - 1]} ${y}`;
            })()}
          </div>
          <div style={{ fontSize: 11, color: '#2563EB', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
            <FiArrowRight size={11} /> Ver lançamentos
          </div>
        </Card>

        {/* Fechamento */}
        <Card accent="#7C3AED" onClick={() => navigate('/app/finance/fechamento')}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FiLock size={12} color="#7C3AED" /> Fechamento mensal
          </div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#111', lineHeight: 1.2, marginTop: 4 }}>
            <span style={{ ...badge(s.bg, s.color), fontSize: 13 }}>{s.label}</span>
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 5 }}>
            {kpi?.fechamentoMonth ?? activeMonth}
          </div>
          <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
            <FiArrowRight size={11} /> Ir para fechamento
          </div>
        </Card>

        {/* Docs aguardando assinatura */}
        <Card accent="#0891B2" onClick={() => navigate('/app/arquivo/societario')}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <FiFileCheck size={12} color="#0891B2" /> Aguard. assinatura
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#111', lineHeight: 1.1 }}>
            {kpi ? kpi.docsAguardando : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Societário — ClickSign</div>
          <div style={{ fontSize: 11, color: '#0891B2', marginTop: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
            <FiArrowRight size={11} /> Ver arquivo societário
          </div>
        </Card>

      </div>

      {/* ── AGENDA ───────────────────────────────────────────────────────── */}
      <SectionTitle>Agenda contábil, fiscal e financeira — próximos 60 dias</SectionTitle>
      <div style={{
        background: '#fff', border: '0.5px solid #E5E7EB',
        borderRadius: 10, overflow: 'hidden', marginBottom: 8,
      }}>
        {/* Header da agenda */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#111' }}>
            <FiCalendar size={15} color="#0369A1" />
            Cronograma de obrigações
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6B7280', alignItems: 'center' }}>
            {[
              { color: '#10B981', label: 'Fiscal / RH' },
              { color: '#2563EB', label: 'Contábil' },
              { color: '#F59E0B', label: 'Financeiro' },
              { color: '#EF4444', label: 'Vencido' },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Lista de eventos */}
        {agendaMerged.length === 0 && !loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
            Nenhum evento nos próximos 60 dias.
          </div>
        )}
        {agendaMerged.map((evt, idx) => {
          const days = diffDays(evt.dueDate);
          const isToday = days === 0;
          const isOverdue = days < 0;
          const showTodayMarker = idx === 0 ||
            (diffDays(agendaMerged[idx - 1].dueDate) < 0 && days >= 0);

          return (
            <React.Fragment key={evt.id}>
              {showTodayMarker && days >= 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 1rem',
                  background: '#F0F9FF', borderBottom: '0.5px solid #BAE6FD',
                }}>
                  <div style={{ flex: 1, height: '0.5px', background: '#BAE6FD' }} />
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#0369A1', whiteSpace: 'nowrap' }}>
                    Hoje — {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <div style={{ flex: 1, height: '0.5px', background: '#BAE6FD' }} />
                </div>
              )}
              <div
                onClick={() => navigate(evt.route)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '0.65rem 1rem',
                  borderBottom: idx < agendaMerged.length - 1 ? '0.5px solid #F3F4F6' : 'none',
                  background: isOverdue ? '#FFF5F5' : isToday ? '#FFFBEB' : '#fff',
                  cursor: 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = isOverdue ? '#FFF5F5' : isToday ? '#FFFBEB' : '#fff')}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: dotColor(evt.color, evt.eventType),
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {evt.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {fmtDate(evt.dueDate)}
                    {evt.amount ? ` · ${BRL(Number(evt.amount))}` : ''}
                    {evt.isPaid ? ' · ✓ Pago' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                  <DaysBadge days={days} />
                  <FiChevronRight size={12} color="#D1D5DB" />
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* Ver agenda completa */}
        <div
          onClick={() => navigate('/app/finance/agenda')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.65rem 1rem', gap: 5,
            fontSize: 12, color: '#0369A1', cursor: 'pointer',
            borderTop: '0.5px solid #E5E7EB',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          <FiCalendar size={13} /> Ver agenda financeira completa
        </div>
      </div>

      {/* ── PAINÉIS INFERIORES ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

        {/* Painel esquerdo — vencimentos 7 dias */}
        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#111' }}>
              <FiClock size={14} color="#DC2626" />
              Vencendo nos próximos 7 dias
            </div>
            <span
              onClick={() => navigate('/app/finance/accounts-payable')}
              style={{ fontSize: 11, color: '#0369A1', cursor: 'pointer' }}
            >
              Ver todas →
            </span>
          </div>

          {upcoming.length === 0 && !loading && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
              Nenhum título vencendo em 7 dias.
            </div>
          )}
          {upcoming.slice(0, 5).map((item, idx) => (
            <div
              key={item.id}
              onClick={() => navigate('/app/finance/accounts-payable')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.6rem 1rem',
                borderBottom: idx < upcoming.length - 1 ? '0.5px solid #F3F4F6' : 'none',
                cursor: 'pointer', transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#111' }}>
                  {item.supplierName ?? item.title}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                  Vence {fmtDate(item.dueDate)}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#DC2626' }}>
                {BRL(Number(item.netAmount))}
              </div>
            </div>
          ))}

          <div
            onClick={() => navigate('/app/finance/accounts-payable')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.6rem 1rem', gap: 5,
              fontSize: 12, color: '#0369A1', cursor: 'pointer',
              borderTop: '0.5px solid #E5E7EB',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <FiTrendingDown size={13} /> Ir para contas a pagar
          </div>
        </div>

        {/* Painel direito — Aging */}
        <div style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: '#111' }}>
              <FiBarChart2 size={14} color="#0369A1" />
              Aging — posição atual
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ap', 'ar'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setAgingTab(tab)}
                  style={{
                    padding: '2px 10px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    border: '0.5px solid',
                    background: agingTab === tab ? '#EFF6FF' : '#F9FAFB',
                    borderColor: agingTab === tab ? '#BFDBFE' : '#E5E7EB',
                    color: agingTab === tab ? '#1D4ED8' : '#6B7280',
                  }}
                >
                  {tab === 'ap' ? 'A Pagar' : 'A Receber'}
                </button>
              ))}
            </div>
          </div>

          {agingAp.map((b, idx) => {
            const val = agingTab === 'ap' ? b.ap : b.ar;
            const pct = agingMax > 0 ? Math.round((val / agingMax) * 100) : 0;
            return (
              <div key={b.label} style={{
                padding: '0.6rem 1rem',
                borderBottom: idx < agingAp.length - 1 ? '0.5px solid #F3F4F6' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: '#6B7280', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                    {b.label}
                  </span>
                  <span style={{ fontWeight: 500, color: '#111' }}>{BRL(val)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 9999, background: '#F3F4F6' }}>
                  <div style={{
                    height: 5, borderRadius: 9999,
                    background: b.color,
                    width: pct + '%',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            );
          })}

          <div
            onClick={() => navigate(agingTab === 'ap' ? '/app/finance/accounts-payable' : '/app/finance/contas-receber')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.6rem 1rem', gap: 5,
              fontSize: 12, color: '#0369A1', cursor: 'pointer',
              borderTop: '0.5px solid #E5E7EB',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <FiAlertCircle size={13} />
            {agingTab === 'ap' ? 'Ver aging completo — A Pagar' : 'Ver aging completo — A Receber'}
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
