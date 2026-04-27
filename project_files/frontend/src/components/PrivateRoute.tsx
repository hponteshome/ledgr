import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { token, loading } = useAuth();

  if (loading) return <div>Carregando...</div>;

  // Use 'replace' para não sujar o histórico de navegação
  return token ? children : <Navigate to="/login" replace />;
};
