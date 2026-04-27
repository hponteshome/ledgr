import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@ledgr:token');
  // Recupera a empresa ativa salva pelo CompanyContext
  const activeCompany = localStorage.getItem('@ledgr:activeCompany'); 
  
  if (token && !config.url?.includes('/auth/login')) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // CRITICAL: Adiciona o ID da empresa selecionada em todas as requisições
  if (activeCompany) {
    const company = JSON.parse(activeCompany);
    if (company?.id) {
      config.headers['x-company-id'] = company.id;
      // Log para debug (ajuda a ver se o header está indo nas imagens que você mandou)
      console.log(`[API] Contexto: ${company.name} (${company.id})`);
    }
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor de Resposta: Trata expiração de sessão
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("Sessão expirada ou não autorizada.");
      // Opcional: localStorage.removeItem('@ledgr:token');
      // window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;