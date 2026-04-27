import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface HomeRouteProps {
  children: React.ReactNode;
}

export const HomeRoute: React.FC<HomeRouteProps> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando...</div>;
  }

  // Se o usuário já está logado e tentou acessar a Home (/), 
  // mandamos ele para o Dashboard.
  if (token) {
    console.log('🔄 Usuário logado acessando raiz, enviando para Dashboard');
    return <Navigate to="/app/dashboard" replace />;
  }

  // Se não está logado, deixa ver a Home/Landing Page normalmente
  return <>{children}</>;
};
