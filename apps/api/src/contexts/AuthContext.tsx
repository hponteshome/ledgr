import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import api from '../shared/api';

// Interface atualizada para o padrão Ledgr 1.0
interface User {
  id: string;
  fullName: string; // Antes: nome
  email: string;
  profileId?: string; // Antes: perfil
  profile?: string;
  permissions?: any;
}

interface AuthContextData {
  user: User | null; // Antes: usuario
  token: string | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => void;
  loadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function loadStorageData() {
      const storedToken = localStorage.getItem('@ledgr:token');
      const storedUser = localStorage.getItem('@ledgr:user');

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;

          setToken(storedToken);
          setUser(parsedUser);
        } catch (error) {
          localStorage.removeItem('@ledgr:token');
          localStorage.removeItem('@ledgr:user');
        }
      }
      setLoading(false);
    }

    loadStorageData();
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      // 1. Chamada para a API (Rota em inglês)
      const response = await api.post('/auth/login', { email, password: pass });

      // 2. Desestruturação conforme o novo padrão do backend
      const { access_token, user: loggedUser } = response.data;

      // 3. Persistência e Headers
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      localStorage.setItem('@ledgr:token', access_token);
      localStorage.setItem('@ledgr:user', JSON.stringify(loggedUser));

      // 4. Atualização de Estado (Destrava o CompanyContext)
      setToken(access_token);
      setUser(loggedUser);
    } catch (error: any) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('@ledgr:token');
    localStorage.removeItem('@ledgr:user');
    localStorage.removeItem('@ledgr:activeCompany'); // Limpa também a empresa ativa

    delete api.defaults.headers.common['Authorization'];

    setToken(null);
    setUser(null);
  };

  const loadUser = async () => {
    try {
      setLoading(true);
      const response = await api.get('/auth/me');
      setUser(response.data);
      localStorage.setItem('@ledgr:user', JSON.stringify(response.data));
    } catch (error) {
      signOut();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextData => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};