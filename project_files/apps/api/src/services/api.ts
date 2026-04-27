import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000', // Certifique-se de que aponta para a porta da API
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@ledgr:token');
  
  // 🚀 A ALTERAÇÃO ESTÁ AQUI:
  // Só adicionamos o header se o token existir E se a URL NÃO for de login
  if (token && !config.url?.includes('/auth/login')) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('✅ Token injetado na requisição:', config.url);
  } else {
    console.log('🔑 Requisição sem token (Login ou deslogado):', config.url);
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;