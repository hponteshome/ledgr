import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  // ✅ Mostra loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // ✅ Se não tiver usuário, mostra a tela normalmente (login está no header)
  // NÃO redireciona mais - evita loop
  if (!user) {
    return <>{children}</>;
  }

  // ✅ Se tiver usuário, mostra o conteúdo protegido
  return <>{children}</>;
};