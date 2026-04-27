// ============================================================
// LEDGR — apps/web/src/hooks/useAgenda.ts
// Hook dedicado para a Agenda Financeira
// ============================================================
import { useState, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import type { AgendaEvent, AgendaMonthResponse } from '../types/finance';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function getHeaders(companyId: string) {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-company-id': companyId,
  };
}

export function useAgenda() {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const companyId = activeCompany?.id ?? '';

  // ── Busca eventos de um mês ─────────────────────────────────
  const fetchMonth = useCallback(async (month: string): Promise<AgendaMonthResponse | null> => {
    if (!companyId) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/finance/agenda?month=${month}`, {
        headers: getHeaders(companyId),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // ── Próximos vencimentos ────────────────────────────────────
  const fetchUpcoming = useCallback(async (days = 30): Promise<AgendaEvent[] | null> => {
    if (!companyId) return null;
    try {
      const res = await fetch(`${API}/finance/agenda/upcoming?days=${days}`, {
        headers: getHeaders(companyId),
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch {
      return null;
    }
  }, [companyId]);

  // ── Criar evento manual ─────────────────────────────────────
  const createEvent = useCallback(async (data: Partial<AgendaEvent>): Promise<AgendaEvent> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/finance/agenda`, {
        method: 'POST',
        headers: getHeaders(companyId),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Erro ao criar evento.');
      }
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // ── Atualizar evento ────────────────────────────────────────
  const updateEvent = useCallback(async (id: string, data: Partial<AgendaEvent>): Promise<AgendaEvent> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/finance/agenda/${id}`, {
        method: 'PATCH',
        headers: getHeaders(companyId),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Erro ao atualizar evento.');
      }
      return await res.json();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // ── Marcar como pago ────────────────────────────────────────
  const markPaid = useCallback(async (id: string): Promise<void> => {
    await updateEvent(id, { isPaid: true } as any);
  }, [updateEvent]);

  // ── Excluir evento manual ───────────────────────────────────
  const deleteEvent = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/finance/agenda/${id}`, {
        method: 'DELETE',
        headers: getHeaders(companyId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Erro ao excluir evento.');
      }
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  return {
    fetchMonth,
    fetchUpcoming,
    createEvent,
    updateEvent,
    markPaid,
    deleteEvent,
    loading,
    error,
  };
}
