// src/services/api.ts - VERSÃO CORRIGIDA
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
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
      config.headers['x-company-id'] = companyId;
      console.log(`[API] Adding x-company-id: ${companyId}`);
    } else {
      console.log(`[API] Skipping x-company-id for route: ${config.url}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest) {
      console.warn('[API] Token expired or invalid. Redirecting...');
      
      localStorage.removeItem('@ledgr:token');
      localStorage.removeItem('@ledgr:user');
      localStorage.removeItem('@ledgr:activeCompany');
      localStorage.removeItem('@ledgr:companyId');
      
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;