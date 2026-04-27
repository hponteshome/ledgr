import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: string;
  fullName: string;
  email: string;
  profileId?: string;
  permissions?: any;
}

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
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
          console.error('Error processing user data from storage', error);
          localStorage.removeItem('@ledgr:token');
          localStorage.removeItem('@ledgr:user');
        }
      }
      setLoading(false);
    }
    loadStorageData();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, user: loggedUser } = response.data;

      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      localStorage.setItem('@ledgr:token', access_token);
      localStorage.setItem('@ledgr:user', JSON.stringify(loggedUser));

      setToken(access_token);
      setUser(loggedUser);

      console.log('✅ Login realizado com sucesso para:', loggedUser.fullName);
    } catch (error: any) {
      console.error('❌ Login error:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    localStorage.removeItem('@ledgr:token');
    localStorage.removeItem('@ledgr:user');
    localStorage.removeItem('@ledgr:activeCompany');
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
      console.error('❌ Error loading user:', error);
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