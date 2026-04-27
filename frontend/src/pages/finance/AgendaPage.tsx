// ============================================================
// LEDGR — apps/web/src/pages/finance/AgendaPage.tsx
// Substitui o placeholder da aba Agenda Mensal
// ============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { AgendaCalendar } from '../../components/finance/AgendaCalendar';
import { AgendaSidebar } from '../../components/finance/AgendaSidebar';
import { AgendaEventModal } from '../../components/finance/AgendaEventModal';
import { useAgenda } from '../../pages/finance/hooks/useAgenda';
import type { AgendaEvent } from '../../pages/finance/types/finance';

const FIN = '#1A4A3A';
const FIN_ACCENT = '#3DAA7A';
const FIN_LIGHT = '#E8F5EE';

export default function AgendaPage() {
  const [currentMonth, setCurrentMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [byDay, setByDay] = useState<Record<number, AgendaEvent[]>>({});
  const [upcoming, setUpcoming] = useState<AgendaEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const { fetchMonth, fetchUpcoming, loading } = useAgenda();

  const reload = useCallback(async () => {
    const [monthRes, upRes] = await Promise.all([
      fetchMonth(currentMonth),
      fetchUpcoming(45),
    ]);
    if (monthRes) setByDay(monthRes.byDay);
    if (upRes) setUpcoming(upRes);
  }, [currentMonth]);

  useEffect(() => { reload(); }, [reload, refreshKey]);

  const handleDayClick = (date: Date) => {
    setModalDate(date.toISOString().slice(0, 10));
    setSelectedEvent(null);
    setModalOpen(true);
  };

  const handleEventClick = (event: AgendaEvent) => {
    setSelectedEvent(event);
    setModalDate(undefined);
    setModalOpen(true);
  };

  const handleSuccess = () => {
    setModalOpen(false);
    setSelectedEvent(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Calendário principal */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        <AgendaCalendar
          currentMonth={currentMonth}
          byDay={byDay}
          loading={loading}
          onMonthChange={setCurrentMonth}
          onDayClick={handleDayClick}
          onEventClick={handleEventClick}
          onNewEvent={() => { setSelectedEvent(null); setModalDate(undefined); setModalOpen(true); }}
        />
      </div>

      {/* Painel lateral */}
      <AgendaSidebar
        upcoming={upcoming}
        onEventClick={handleEventClick}
        onMarkPaid={() => setRefreshKey(k => k + 1)}
      />

      {/* Modal novo/editar evento */}
      <AgendaEventModal
        open={modalOpen}
        event={selectedEvent}
        defaultDate={modalDate}
        onClose={() => { setModalOpen(false); setSelectedEvent(null); }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
