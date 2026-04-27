// apps/frontend/src/components/hooks/use-ecd-list.ts
import { useState, useEffect } from 'react';
import api from '@/services/api';

export function useEcdList() {
  const [imports, setImports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sped/ecd/imports'); // Endpoint que criaremos abaixo
      setImports(res.data);
    } catch (err) {
      console.error("Erro ao listar importações:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImports();
  }, []);

  return { imports, loading, refresh: fetchImports };
}