// ============================================================
// LEDGR — apps/web/src/pages/finance/components/AgendaSidebar.tsx
// ============================================================
import React from 'react';
import { COLOR_MAP } from './AgendaCalendar';
import { useAgenda } from '../../pages/finance/hooks/useAgenda';
import type { AgendaEvent } from '../../pages/finance/types/finance';

const FIN = '#1A4A3A';
const FIN_MID = '#2E7D5C';
const FIN_ACCENT = '#3DAA7A';

function fmtBRL(v: string | number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function daysUntil(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d atrasado`, color: '#A32D2D' };
  if (diff === 0) return { label: 'Vence hoje', color: '#854F0B' };
  if (diff <= 3) return { label: `${diff}d`, color: '#854F0B' };
  return { label: `${diff}d`, color: '#666' };
}

interface Props {
  upcoming: AgendaEvent[];
  onEventClick: (event: AgendaEvent) => void;
  onMarkPaid: () => void;
}

export function AgendaSidebar({ upcoming, onEventClick, onMarkPaid }: Props) {
  const { markPaid } = useAgenda();

  const handleMarkPaid = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await markPaid(id);
    onMarkPaid();
  };

  const overdue = upcoming.filter(e => new Date(e.dueDate) < new Date());
  const upcoming7 = upcoming.filter(e => {
    const diff = (new Date(e.dueDate).getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  const later = upcoming.filter(e => {
    const diff = (new Date(e.dueDate).getTime() - Date.now()) / 86400000;
    return diff > 7;
  });

  const sections = [
    { label: 'Atrasados', events: overdue, emptyMsg: '' },
    { label: 'Próximos 7 dias', events: upcoming7, emptyMsg: 'Nada vencendo em 7 dias ✓' },
    { label: 'Mais tarde', events: later.slice(0, 4), emptyMsg: '' },
  ];

  return (
    <div style={{
      width: 240, flexShrink: 0,
      borderLeft: '1px solid rgba(0,0,0,0.09)',
      background: '#FFFEF5',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 14px 10px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: FIN }}>Próximos Vencimentos</div>
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>
          {upcoming.filter(e => !e.isPaid).length} pendentes
        </div>
      </div>

      {/* Seções */}
      <div style={{ flex: 1, padding: '10px 10px 16px', overflowY: 'auto' }}>
        {sections.map(({ label, events, emptyMsg }) => {
          if (events.length === 0 && !emptyMsg) return null;
          return (
            <div key={label} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#aaa',
                textTransform: 'uppercase', letterSpacing: '0.8px',
                marginBottom: 6,
              }}>{label}</div>

              {events.length === 0 ? (
                <div style={{
                  fontSize: 11, color: '#3B6D11', padding: '6px 8px',
                  background: '#EAF3DE', borderRadius: 6
                }}>{emptyMsg}</div>
              ) : (
                events.map(ev => <BigPostIt key={ev.id} event={ev} onClick={() => onEventClick(ev)} onMarkPaid={handleMarkPaid} />)
              )}
            </div>
          );
        })}

        {upcoming.length === 0 && (
          <div style={{ textAlign: 'center', color: '#aaa', fontSize: 12, padding: '24px 0' }}>
            Nenhum vencimento próximo.
          </div>
        )}
      </div>

      {/* Legenda */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        background: '#F9F7EE',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 6 }}>Cores</div>
        {(Object.keys(COLOR_MAP) as (keyof typeof COLOR_MAP)[]).map(color => {
          const labels: Record<string, string> = {
            YELLOW: 'NF-e / NFS-e', BLUE: 'Pag. fixos',
            GREEN: 'Fiscal/Impostos', RED: 'Atrasado',
            ORANGE: 'Consumo', PURPLE: 'Reuniões',
          };
          return (
            <div key={color} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#777', marginBottom: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: COLOR_MAP[color].border, flexShrink: 0 }} />
              {labels[color]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Big Post-it ───────────────────────────────────────────────
function BigPostIt({ event, onClick, onMarkPaid }: {
  event: AgendaEvent;
  onClick: () => void;
  onMarkPaid: (e: React.MouseEvent, id: string) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const c = COLOR_MAP[event.color] ?? COLOR_MAP.YELLOW;
  const until = daysUntil(event.dueDate);
  const isOverdue = until.label.includes('atrasado');

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: event.isPaid ? '#F0F0F0' : c.bg,
        borderRadius: 7,
        padding: '9px 10px',
        marginBottom: 7,
        cursor: 'pointer',
        position: 'relative',
        transition: 'transform 0.15s, box-shadow 0.15s',
        transform: hovered ? 'rotate(0.5deg) scale(1.02)' : 'none',
        boxShadow: hovered ? '2px 3px 8px rgba(0,0,0,0.10)' : '1px 2px 4px rgba(0,0,0,0.06)',
        borderLeft: `3px solid ${event.isPaid ? '#CCC' : isOverdue ? '#E57373' : c.border}`,
        opacity: event.isPaid ? 0.7 : 1,
        // Dobra do post-it
      }}
    >
      {/* "Dobra" no canto */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 10, height: 10,
        background: 'rgba(0,0,0,0.07)',
        clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
        borderRadius: '0 7px 0 0',
      }} />

      <div style={{ fontSize: 9, fontWeight: 700, color: c.text, opacity: 0.55, marginBottom: 2 }}>
        {event.eventType}
      </div>
      <div style={{
        fontSize: 12, fontWeight: 600,
        color: event.isPaid ? '#AAA' : c.text,
        textDecoration: event.isPaid ? 'line-through' : 'none',
        lineHeight: 1.3, marginBottom: 2,
      }}>{event.title}</div>

      {event.amount && (
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: event.isPaid ? '#AAA' : isOverdue ? '#A32D2D' : c.text,
        }}>
          {fmtBRL(event.amount)}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
        <div style={{ fontSize: 10, color: c.text, opacity: 0.6 }}>
          📅 {fmtDate(event.dueDate)}
          <span style={{ marginLeft: 4, color: until.color, fontWeight: 600 }}>
            ({until.label})
          </span>
        </div>

        {!event.isPaid && (
          <button
            onClick={e => onMarkPaid(e, event.id)}
            title="Marcar como pago"
            style={{
              background: 'rgba(255,255,255,0.7)', border: `1px solid ${c.border}`,
              borderRadius: 4, padding: '1px 6px', fontSize: 9,
              color: c.text, cursor: 'pointer', fontWeight: 600,
            }}>✓ Pago</button>
        )}
        {event.isPaid && (
          <span style={{ fontSize: 9, color: '#3B6D11', fontWeight: 600 }}>✓ Pago</span>
        )}
      </div>
    </div>
  );
}
