// ============================================================
// LEDGR — apps/web/src/hooks/useBankImport.ts  (FIX DEFINITIVO)
// Upload usa fetch direto — axios corrompe multipart/form-data
// ============================================================
import { useState, useCallback } from 'react';
import api from '@/services/api';
import type {
  BankStatementSummary, TransactionGroup, UploadResult,
} from '../types/bank-import';

const BASE = 'http://localhost:3000';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('@ledgr:token') ?? '';
  const raw   = localStorage.getItem('@ledgr:activeCompany');
  const co    = raw ? JSON.parse(raw) : null;
  return {
    ...(token   ? { Authorization: `Bearer ${token}` } : {}),
    ...(co?.id  ? { 'x-company-id': co.id }            : {}),
  };
}

export function useBankImport() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const req = useCallback(async <T>(fn: () => Promise<{ data: T }>): Promise<T> => {
    setLoading(true); setError(null);
    try {
      return (await fn()).data;
    } catch (e: any) {
      const msg = e.response?.data?.message ?? e.message ?? 'Erro';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
      throw e;
    } finally { setLoading(false); }
  }, []);

  const listStatements = useCallback(
    () => req<BankStatementSummary[]>(() => api.get('/bank-import/statements')),
    [req],
  );

  // Upload usa fetch puro — axios sobrescreve Content-Type e corrompe o boundary
  const uploadFile = useCallback(async (file: File): Promise<UploadResult> => {
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`${BASE}/bank-import/upload`, {
        method: 'POST',
        headers: getAuthHeaders(), // sem Content-Type — browser define boundary
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? `Erro ${res.status}`);
      return data as UploadResult;
    } catch (e: any) {
      setError(e.message); throw e;
    } finally { setLoading(false); }
  }, []);

  const getGroups = useCallback(
    (id: string) => req<TransactionGroup[]>(() => api.get(`/bank-import/statements/${id}/groups`)),
    [req],
  );

  const classifyGroup = useCallback(
    (id: string, data: Record<string, any>) =>
      req(() => api.patch(`/bank-import/statements/${id}/groups`, data)),
    [req],
  );

  const postStatement = useCallback(
    (id: string, groups: any[]) =>
      req(() => api.post(`/bank-import/statements/${id}/post`, { groups })),
    [req],
  );

  return { listStatements, uploadFile, getGroups, classifyGroup, postStatement, loading, error };
}