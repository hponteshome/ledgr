import axios from 'axios';

/**
 * Centralized Axios configuration for Ledgr.
 * In the new single-server architecture, all requests 
 * (Companies, Users, Audit, etc.) pass through the same Gateway.
 */
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

    if (token && !config.url?.includes('/auth/login')) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(`[API] Sending request to: ${config.url} with Token.`);
    } else {
      console.log(`[API] Sending request to: ${config.url} without Token.`);
    }

    // ✅ ADDED: Inject x-company-id ONLY if it's not a listing or auth route
    const routesWithoutCompany = ['/companies', '/auth/login', '/auth/me', '/auth/register'];
    const companyId = localStorage.getItem('@ledgr:companyId');
    
    if (companyId && !routesWithoutCompany.includes(config.url || '')) {
      config.headers['x-company-id'] = companyId;
      console.log(`[API] Adding x-company-id: ${companyId}`);
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
      
      // Clear data and redirect to login
      localStorage.removeItem('@ledgr:token');
      localStorage.removeItem('@ledgr:user');
      localStorage.removeItem('@ledgr:activeCompany');
      localStorage.removeItem('@ledgr:companyId');
      
      // Redirect if not already on the login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;