// ============================================================
// LEDGR — frontend/src/pages/assets/hooks/useAssets.ts
// ============================================================
import { useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import type {
  FixedAsset,
  AssetsListResponse,
  AssetMaintenance,
  AssetImprovement,
  AssetRetrofitProject,
  AssetAppraisal,
  CreateAssetForm,
} from '../types/asset.types';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function useAuthHeaders() {
  const { token } = useAuth();
  const { activeCompany } = useCompany();
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-company-id': activeCompany?.id ?? '',
  };
}

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Error ${res.status}`);
  }
  return res.json();
}

// ── List hook ─────────────────────────────────────────────────
export function useAssetsList() {
  const headers = useAuthHeaders();
  const [data, setData] = useState<AssetsListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (filters: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
        ),
      ).toString();
      
      const result = await request<AssetsListResponse>(
        `${API}/assets${qs ? `?${qs}` : ''}`,
        { method: 'GET', headers },
      );
      setData(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  return { data, loading, error, fetch };
}

// ── Detail hook ───────────────────────────────────────────────
export function useAssetDetail() {
  const headers = useAuthHeaders();
  const [asset, setAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await request<FixedAsset>(
        `${API}/assets/${id}`,
        { method: 'GET', headers },
      );
      setAsset(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  return { asset, loading, error, fetch, setAsset };
}

// ── Mutations hook ────────────────────────────────────────────
export function useAssetMutations() {
  const headers = useAuthHeaders();
  const [loading, setLoading] = useState(false);

  // Fixed Asset
  const create = useCallback(async (dto: CreateAssetForm): Promise<FixedAsset> => {
    setLoading(true);
    try {
      return await request<FixedAsset>(`${API}/assets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const update = useCallback(async (id: string, dto: Partial<CreateAssetForm>): Promise<FixedAsset> => {
    setLoading(true);
    try {
      return await request<FixedAsset>(`${API}/assets/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const activate = useCallback(async (id: string) => {
    return request(`${API}/assets/${id}/activate`, {
      method: 'POST',
      headers,
    });
  }, [headers]);

  const writeOff = useCallback(async (id: string, dto: any) => {
    setLoading(true);
    try {
      return await request(`${API}/assets/${id}/write-off`, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Maintenance
  const createMaintenance = useCallback(async (dto: any): Promise<AssetMaintenance> => {
    setLoading(true);
    try {
      return await request<AssetMaintenance>(`${API}/assets/maintenances`, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const updateMaintenance = useCallback(async (id: string, dto: any): Promise<AssetMaintenance> => {
    setLoading(true);
    try {
      return await request<AssetMaintenance>(`${API}/assets/maintenances/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);
  const deactivate = useCallback(async (id: string) => {
    return request(`${API}/assets/${id}/deactivate`, { method: 'POST', headers, body: '{}' });
  }, [request, headers]);

  const reactivate = useCallback(async (id: string) => {
    return request(`${API}/assets/${id}/reactivate`, { method: 'POST', headers, body: '{}' });
  }, [request, headers]);

  const removeAsset = useCallback(async (id: string) => {
    return request(`${API}/assets/${id}`, { method: 'DELETE', headers });
  }, [request, headers]);


  const removeMaintenance = useCallback(async (id: string) => {
    return request(`${API}/assets/maintenances/${id}`, {
      method: 'DELETE',
      headers,
    });
  }, [headers]);

  // Improvement
  const createImprovement = useCallback(async (dto: any): Promise<AssetImprovement> => {
    setLoading(true);
    try {
      return await request<AssetImprovement>(`${API}/assets/improvements`, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const capitalizeImprovement = useCallback(async (id: string) => {
    return request(`${API}/assets/improvements/${id}/capitalize`, {
      method: 'POST',
      headers,
    });
  }, [headers]);

  // Retrofit
  const createRetrofit = useCallback(async (dto: any): Promise<AssetRetrofitProject> => {
    setLoading(true);
    try {
      return await request<AssetRetrofitProject>(`${API}/assets/retrofits`, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const updateRetrofitPhase = useCallback(async (
    projectId: string,
    phaseId: string,
    dto: any,
  ) => {
    setLoading(true);
    try {
      return await request(`${API}/assets/retrofits/${projectId}/phases/${phaseId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const completeRetrofit = useCallback(async (id: string) => {
    return request(`${API}/assets/retrofits/${id}/complete`, {
      method: 'POST',
      headers,
    });
  }, [headers]);

  // Appraisal
  const createAppraisal = useCallback(async (dto: any): Promise<AssetAppraisal> => {
    setLoading(true);
    try {
      return await request<AssetAppraisal>(`${API}/assets/appraisals`, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // Depreciation
  const getDepreciationProjection = useCallback(async (assetId: string) => {
    return request<any>(`${API}/assets/${assetId}/depreciation/projection`, {
      method: 'GET',
      headers,
    });
  }, [headers]);

  return {
    loading,
    create,
    update,
    activate,
    writeOff,
    createMaintenance,
    updateMaintenance,
    deactivate,
    reactivate,
    removeAsset,
    removeMaintenance,
    createImprovement,
    capitalizeImprovement,
    createRetrofit,
    updateRetrofitPhase,
    completeRetrofit,
    createAppraisal,
    getDepreciationProjection,
  };
}
