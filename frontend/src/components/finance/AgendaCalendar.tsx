// ============================================================
// LEDGR — apps/web/src/pages/finance/components/AgendaCalendar.tsx
// ============================================================
import React, { useState } from 'react';
import type { AgendaEvent, AgendaColor } from '../../pages/finance/types/finance';

// ── Paleta Financeiro ─────────────────────────────────────────
const FIN = '#1A4A3A';
const FIN_MID = '#2E7D5C';
const FIN_LIGHT = '#E8F5EE';
const FIN_ACCENT = '#3DAA7A';

// ── Mapa de cores dos post-its ────────────────────────────────
export const COLOR_MAP: Record<AgendaColor, { bg: string; text: string; border: string }> = {
  YELLOW: { bg: '#FFF9C4', text: '#7A6500', border: '#F0C000' },
  BLUE: { bg: '#BBDEFB', text: '#0D47A1', border: '#64B5F6' },
  GREEN: { bg: '#C8E6C9', text: '#1B5E20', border: '#81C784' },
  RED: { bg: '#FFCDD2', text: '#8B0000', border: '#E57373' },
  ORANGE: { bg: '#FFE0B2', text: '#7A3200', border: '#FFB74D' },
  PURPLE: { bg: '#E1BEE7', text: '#4A148C', border: '#CE93D8' },
};

const COLOR_LABEL: Record<AgendaColor, string> = {
  YELLOW: 'NF-e / NFS-e',
  BLUE: 'Pagamentos fixos',
  GREEN: 'Obrigações fiscais',
  RED: 'Urgente / Vencido',
  ORANGE: 'Contas de consumo',
  PURPLE: 'Reuniões / Avisos',
};

// ── Fundo configurável ────────────────────────────────────────
const BG_THEMES = [
  { bg: '#FFFEF5', label: 'Creme', dot: '#F5E9A0' },
  { bg: '#F0F7FF', label: 'Azul claro', dot: '#A8CBEE' },
  { bg: '#F0FFF4', label: 'Verde claro', dot: '#A8DDB5' },
  { bg: '#F5F5F5', label: 'Neutro', dot: '#C8C8C8' },
  { bg: '#FFF0F5', label: 'Rosa', dot: '#F5B8CC' },
];

interface Props {
  currentMonth: string;              // "2026-03"
  byDay: Record<number, AgendaEvent[]>;
  loading: boolean;
  onMonthChange: (month: string) => void;
  onDayClick: (date: Date) => void;
  onEventClick: (event: AgendaEvent) => void;
  onNewEvent: () => void;
}

export function AgendaCalendar({
  currentMonth, byDay, loading,
  onMonthChange, onDayClick, onEventClick, onNewEvent,
}: Props) {
  const [bgTheme, setBgTheme] = useState('#FFFEF5');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  const [year, month] = currentMonth.split('-').map(Number);
  const today = new Date();

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long', year: 'numeric',
  });

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    onMonthChange(d.toISOString().slice(0, 7));
  };

  const nextMonth = () => {
    const d = new Date(year, month, 1);
    onMonthChange(d.toISOString().slice(0, 7));
  };

  const calDays = buildCalendarDays(year, month - 1);

  // Conta eventos do mês para o header
  const totalEvents = Object.values(byDay).flat().length;
  const pendingCount = Object.values(byDay).flat().filter(e => !e.isPaid).length;

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>

        {/* Navegação de mês */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={prevMonth} style={navBtn}>‹</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111', textTransform: 'capitalize' }}>
              {monthLabel}
            </div>
            {!loading && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                {totalEvents} eventos · {pendingCount} a pagar
              </div>
            )}
          </div>
          <button onClick={nextMonth} style={navBtn}>›</button>

          {/* Botão hoje */}
          <button onClick={() => onMonthChange(today.toISOString().slice(0, 7))} style={{
            fontSize: 11, padding: '4px 10px', border: `1px solid ${FIN_ACCENT}`,
            borderRadius: 6, background: 'transparent', color: FIN_MID, cursor: 'pointer',
          }}>Hoje</button>
        </div>

        {/* Controles direita */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Seletor de fundo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: '#aaa' }}>Fundo:</span>
            {BG_THEMES.map(({ bg, label, dot }) => (
              <button key={bg} onClick={() => setBgTheme(bg)} title={label} style={{
                width: 18, height: 18, borderRadius: '50%',
                background: dot, cursor: 'pointer',
                border: bgTheme === bg ? `2px solid ${FIN}` : '1.5px solid #ccc',
                padding: 0, flexShrink: 0,
              }} />
            ))}
          </div>

          <button onClick={onNewEvent} style={{
            background: FIN, color: '#fff', border: 'none',
            borderRadius: 7, padding: '7px 14px', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}>+ Novo Evento</button>
        </div>
      </div>

      {/* ── Grid do Calendário ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5 }}>

        {/* Cabeçalho */}
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 600,
            color: i === 0 || i === 6 ? '#C0392B' : '#aaa',
            padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>{d}</div>
        ))}

        {/* Células */}
        {calDays.map(({ date, isCurrentMonth }, idx) => {
          const day = date.getDate();
          const isToday = date.toDateString() === today.toDateString();
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const events = isCurrentMonth ? (byDay[day] ?? []) : [];
          const hasOverdue = events.some(e => !e.isPaid && new Date(e.dueDate) < today);
          const isHovered = hoveredDay === idx && isCurrentMonth;

          return (
            <div
              key={idx}
              onClick={() => isCurrentMonth && onDayClick(date)}
              onMouseEnter={() => setHoveredDay(idx)}
              onMouseLeave={() => setHoveredDay(null)}
              style={{
                minHeight: 88,
                borderRadius: 8,
                padding: 5,
                background: isToday ? FIN_LIGHT : bgTheme,
                border: `1px solid ${isToday ? FIN_ACCENT :
                  isHovered ? FIN_ACCENT :
                    hasOverdue ? '#E57373' :
                      'rgba(0,0,0,0.09)'
                  }`,
                opacity: isCurrentMonth ? 1 : 0.32,
                cursor: isCurrentMonth ? 'pointer' : 'default',
                transition: 'border-color 0.12s, box-shadow 0.12s',
                boxShadow: isHovered && isCurrentMonth ? `0 0 0 2px ${FIN_ACCENT}22` : 'none',
                position: 'relative',
              }}
            >
              {/* Número do dia */}
              {isToday ? (
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: FIN_ACCENT, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, marginBottom: 4,
                }}>{day}</div>
              ) : (
                <div style={{
                  fontSize: 11, fontWeight: isWeekend ? 600 : 500,
                  color: isWeekend ? '#C0392B' : '#777',
                  marginBottom: 4,
                }}>{day}</div>
              )}

              {/* Post-its */}
              {events.slice(0, 3).map(ev => (
                <PostIt key={ev.id} event={ev} onClick={e => { e.stopPropagation(); onEventClick(ev); }} />
              ))}

              {/* +N mais */}
              {events.length > 3 && (
                <div style={{
                  fontSize: 9, color: FIN_MID, fontWeight: 600,
                  marginTop: 1, paddingLeft: 2,
                }}>+{events.length - 3} mais</div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Legenda ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 14, flexWrap: 'wrap',
        marginTop: 14, paddingTop: 12,
        borderTop: '1px solid rgba(0,0,0,0.08)',
      }}>
        {(Object.keys(COLOR_MAP) as AgendaColor[]).map(color => {
          const c = COLOR_MAP[color];
          return (
            <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#666' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.border, flexShrink: 0 }} />
              {COLOR_LABEL[color]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

////ADICIONADO GEMINI AgendaSidebar
export function AgendaSidebar({ events, onEventClick }: AgendaSidebarProps) {
  const today = new Date();
  const upcomingEvents = events
    .filter(e => !e.isPaid && new Date(e.dueDate) >= today)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const overdueEvents = events
    .filter(e => !e.isPaid && new Date(e.dueDate) < today)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div style={{
      width: 260,
      background: '#fff',
      borderLeft: '1px solid #e0e0e0',
      padding: '16px',
      overflowY: 'auto',
      height: '100%',
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#333' }}>
        📋 Próximos Pagamentos
      </h3>

      {overdueEvents.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#C0392B', marginBottom: 8 }}>
            ⚠️ Vencidos ({overdueEvents.length})
          </div>
          {overdueEvents.map(event => (
            <div
              key={event.id}
              onClick={() => onEventClick?.(event)}
              style={{
                padding: '8px 10px',
                background: '#FFEBEE',
                borderRadius: 6,
                marginBottom: 6,
                cursor: 'pointer',
                borderLeft: `3px solid #E57373`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: '#8B0000' }}>
                {event.title}
              </div>
              <div style={{ fontSize: 10, color: '#B71C1C', marginTop: 2 }}>
                Venceu em {formatDate(event.dueDate)}
              </div>
              {event.amount && (
                <div style={{ fontSize: 10, fontWeight: 600, color: '#B71C1C', marginTop: 2 }}>
                  R$ {Number(event.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {upcomingEvents.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#2E7D5C', marginBottom: 8 }}>
            📅 Próximos 5 eventos
          </div>
          {upcomingEvents.map(event => {
            const color = COLOR_MAP[event.color] || COLOR_MAP.YELLOW;
            return (
              <div
                key={event.id}
                onClick={() => onEventClick?.(event)}
                style={{
                  padding: '8px 10px',
                  background: color.bg,
                  borderRadius: 6,
                  marginBottom: 6,
                  cursor: 'pointer',
                  borderLeft: `3px solid ${color.border}`,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: color.text }}>
                  {event.title}
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                  {formatDate(event.dueDate)}
                </div>
                {event.amount && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: color.text, marginTop: 2 }}>
                    R$ {Number(event.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {upcomingEvents.length === 0 && overdueEvents.length === 0 && (
        <div style={{ textAlign: 'center', color: '#aaa', fontSize: 12, padding: '20px 0' }}>
          Nenhum evento pendente
        </div>
      )}
    </div>
  );
}

////////////////// fim AgendaSidebar

// ── Post-it individual ────────────────────────────────────────
function PostIt({ event, onClick }: { event: AgendaEvent; onClick: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  const c = COLOR_MAP[event.color] ?? COLOR_MAP.YELLOW;
  const today = new Date();
  const isOverdue = !event.isPaid && new Date(event.dueDate) < today;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${event.title}${event.amount ? ` — R$ ${Number(event.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}`}
      style={{
        background: event.isPaid ? '#F0F0F0' : c.bg,
        borderLeft: `2.5px solid ${event.isPaid ? '#CCC' : isOverdue ? '#E57373' : c.border}`,
        borderRadius: '0 3px 3px 0',
        padding: '2px 5px',
        fontSize: 10,
        marginBottom: 2,
        lineHeight: 1.35,
        cursor: 'pointer',
        color: event.isPaid ? '#AAA' : isOverdue ? '#8B0000' : c.text,
        textDecoration: event.isPaid ? 'line-through' : 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        // "Dobra" do post-it
        position: 'relative',
        transition: 'transform 0.1s, box-shadow 0.1s',
        transform: hovered ? 'translateX(1px)' : 'none',
        boxShadow: hovered ? `1px 1px 3px rgba(0,0,0,0.12)` : 'none',
      }}
    >
      {isOverdue && !event.isPaid && '⚠ '}{event.title}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function buildCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = first.getDay(); i > 0; i--)
    days.push({ date: new Date(year, month, 1 - i), isCurrentMonth: false });

  for (let d = 1; d <= last.getDate(); d++)
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });

  while (days.length < 42)
    days.push({ date: new Date(year, month + 1, days.length - first.getDay() - last.getDate() + 1), isCurrentMonth: false });

  return days;
}

const navBtn: React.CSSProperties = {
  width: 30, height: 30, border: '1px solid #ddd', borderRadius: 7,
  background: 'transparent', color: '#555', cursor: 'pointer',
  fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
};
