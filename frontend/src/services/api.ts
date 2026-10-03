// src/services/api.ts - VERSÃO CORRIGIDA
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to inject JWT token automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('@ledgr:token');
    const companyId = localStorage.getItem('@ledgr:companyId');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Rotas que NÃO precisam de companyId
    const routesWithoutCompany = [
      '/auth/login',
      '/auth/me',
      '/auth/register'
      // '/system/export'  ← REMOVIDO! Precisa de companyId!
    ];
    
    const shouldSkipCompanyId = routesWithoutCompany.some(route => 
      config.url?.startsWith(route)
    );
    
    // Só NÃO envia companyId se for rota da blacklist
    if (companyId && !shouldSkipCompanyId) {
      // Respeita header ja definido (ex: ContabilTab passando companyId explicito)
      if (!config.headers['x-company-id']) {
        config.headers['x-company-id'] = companyId;
        console.log(`[API] Adding x-company-id: ${companyId}`);
      }
    } else {
      console.log(`[API] Skipping x-company-id for route: ${config.url}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Seguranca 0A.6 (03/10/2026): access token curto + renovacao automatica pelo refresh token.
// Em 401, tenta renovar UMA vez (requisicoes simultaneas compartilham a mesma renovacao) e repete.
// Rotas de autenticacao (login, 2fa, refresh, logout) nunca disparam renovacao nem logout:
// um codigo 2FA errado (401) nao pode derrubar a sessao do usuario logado.
let renovando: Promise<string | null> | null = null;

async function renovarAcesso(): Promise<string | null> {
  const rt = localStorage.getItem('@ledgr:refresh');
  if (!rt) return null;
  try {
    const r = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken: rt });
    const { access_token, refresh_token } = r.data || {};
    if (!access_token || !refresh_token) return null;
    localStorage.setItem('@ledgr:token', access_token);
    localStorage.setItem('@ledgr:refresh', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    return access_token;
  } catch {
    return null;
  }
}

function encerrarSessaoLocal() {
  ['@ledgr:token', '@ledgr:refresh', '@ledgr:user', '@ledgr:activeCompany', '@ledgr:companyId'].forEach((k) => localStorage.removeItem(k));
  if (window.location.pathname !== '/') {
    window.location.href = '/';
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url || '';
    const rotaAuth = ['/auth/login', '/auth/2fa', '/auth/refresh', '/auth/logout'].some((r) => url.includes(r));
    const original: any = error.config;

    if (error.response?.status === 401 && !rotaAuth) {
      if (original && !original._renovado) {
        original._renovado = true;
        if (!renovando) {
          renovando = renovarAcesso().finally(() => { setTimeout(() => { renovando = null; }, 0); });
        }
        const novo = await renovando;
        if (novo) {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${novo}`;
          return api(original);
        }
      }
      console.warn('[API] Sessao expirada. Redirecionando...');
      encerrarSessaoLocal();
    }

    if (error.response?.status === 403) {
      const msg = error.response?.data?.message || 'Acao nao permitida para o seu perfil.';
      toast.error(msg);
    }

    return Promise.reject(error);
  }
);

export default api;
