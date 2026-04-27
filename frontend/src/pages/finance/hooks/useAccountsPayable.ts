// ============================================================
// LEDGR — apps/web/src/hooks/useAccountsPayable.ts
// ============================================================
import { useState, useCallback } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import type {
  APListResponse, APPositionReport,
  AccountsPayable,
} from '../../pages/finance/types/accounts-payable';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function getHeaders(companyId: string) {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-company-id': companyId,
  };
}

export function useAccountsPayable() {
  const { activeCompany } = useCompany();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const companyId = activeCompany?.id ?? '';

  const request = useCallback(async <T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/finance/accounts-payable${path}`, {
        ...options,
        headers: { ...getHeaders(companyId), ...(options.headers ?? {}) },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Erro ${res.status}`);
      }
      return res.status === 204 ? (undefined as T) : res.json();
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // ── Listagem ─────────────────────────────────────────────────
  const fetchAll = useCallback((filters: Record<string, string> = {}): Promise<APListResponse> => {
    const qs = new URLSearchParams(filters).toString();
    return request<APListResponse>(`?${qs}`);
  }, [request]);

  // ── Detalhe ──────────────────────────────────────────────────
  const fetchOne = useCallback((id: string): Promise<AccountsPayable> => {
    return request<AccountsPayable>(`/${id}`);
  }, [request]);

  // ── Relatório de posição ─────────────────────────────────────
  const fetchPositionReport = useCallback((refDate?: string): Promise<APPositionReport> => {
    const qs = refDate ? `?refDate=${refDate}` : '';
    return request<APPositionReport>(`/position-report${qs}`);
  }, [request]);

  // ── Criar manual ─────────────────────────────────────────────
  const createAP = useCallback((data: Record<string, any>): Promise<AccountsPayable> => {
    return request<AccountsPayable>('', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }, [request]);

  // ── Baixa individual ─────────────────────────────────────────
  const payAP = useCallback((id: string, data: Record<string, any>) => {
    return request(`/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }, [request]);

  // ── Baixa em lote ────────────────────────────────────────────
  const payBatch = useCallback((items: any[]) => {
    return request('/batch/pay', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }, [request]);

  // ── Cancelar ─────────────────────────────────────────────────
  const cancelAP = useCallback((id: string, reason: string) => {
    return request(`/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  }, [request]);

  return {
    fetchAll, fetchOne, fetchPositionReport,
    createAP, payAP, payBatch, cancelAP,
    loading, error,
  };
}
