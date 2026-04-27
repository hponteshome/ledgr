// ============================================================
// LEDGR — src/hooks/useFinance.ts  (apps/web)
// ============================================================
import { useState, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import {
  FiscalDocumentListResponse, FiscalDocumentFormData,
  AgendaMonthResponse, AgendaEvent, FiscalDocument,
} from '../types/finance';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function useAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

// ── Fiscal Documents ─────────────────────────────────────────
export function useFiscalDocuments() {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const headers = {
    ...useAuthHeaders(),
    'x-company-id': activeCompany?.id ?? '',
  };

  const fetchDocuments = useCallback(
    async (filters?: Record<string, string>): Promise<FiscalDocumentListResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const qs = filters ? '?' + new URLSearchParams(filters).toString() : '';
        const res = await fetch(`${API}/finance/fiscal-documents${qs}`, { headers });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } catch (e: any) {
        setError(e.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [activeCompany?.id],
  );

  const createDocument = useCallback(
    async (data: FiscalDocumentFormData) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/finance/fiscal-documents`, {
          method: 'POST',
          headers,
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.message ?? 'Erro ao criar documento.');
        }
        return res.json();
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [activeCompany?.id],
  );

  const reintegrate = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const res = await fetch(`${API}/finance/fiscal-documents/${id}/integrate`, {
          method: 'POST',
          headers,
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } finally {
        setLoading(false);
      }
    },
    [activeCompany?.id],
  );

  return { fetchDocuments, createDocument, reintegrate, loading, error };
}

// ── Agenda ───────────────────────────────────────────────────
export function useAgenda() {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const headers = {
    ...useAuthHeaders(),
    'x-company-id': activeCompany?.id ?? '',
  };

  const fetchMonth = useCallback(
    async (month: string): Promise<AgendaMonthResponse | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/finance/agenda?month=${month}`, { headers });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } catch (e: any) {
        setError(e.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [activeCompany?.id],
  );

  const fetchUpcoming = useCallback(
    async (days = 30): Promise<AgendaEvent[] | null> => {
      try {
        const res = await fetch(`${API}/finance/agenda/upcoming?days=${days}`, { headers });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      } catch {
        return null;
      }
    },
    [activeCompany?.id],
  );

  const markPaid = useCallback(
    async (id: string) => {
      const res = await fetch(`${API}/finance/agenda/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isPaid: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [activeCompany?.id],
  );

  const createEvent = useCallback(
    async (data: Partial<AgendaEvent>) => {
      const res = await fetch(`${API}/finance/agenda`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [activeCompany?.id],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const res = await fetch(`${API}/finance/agenda/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(await res.text());
    },
    [activeCompany?.id],
  );

  return { fetchMonth, fetchUpcoming, markPaid, createEvent, deleteEvent, loading, error };
}
