import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: string;
  fullName: string;
  email: string;
  profileId?: string;
  permissions?: any;
}

// Seguranca 0A.6: resultado do login - direto ou exigindo o segundo fator
export type SignInResult =
  | { status: 'ok' }
  | { status: '2fa'; challengeToken: string }
  | { status: '2fa-setup'; setupToken: string };

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  verify2fa: (challengeToken: string, code: string, trustDevice: boolean, email: string) => Promise<void>;
  setup2fa: (setupToken?: string) => Promise<{ otpauthUrl: string; qrDataUrl: string; secret: string }>;
  activate2fa: (code: string, setupToken: string | undefined, trustDevice: boolean, email: string) => Promise<string[]>;
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

  // Seguranca 0A.6 (03/10/2026): login em dois passos. Token de dispositivo confiavel
  // (24 h, emitido apos o 2FA) guardado por email e enviado no login.
  const chaveConfianca = (email: string) => `@ledgr:2faTrust:${(email || '').trim().toLowerCase()}`;

  const concluirLogin = (data: any, email: string) => {
    const { access_token, user: loggedUser, trustToken } = data;
    if (trustToken) localStorage.setItem(chaveConfianca(email), trustToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    localStorage.setItem('@ledgr:token', access_token);
    localStorage.setItem('@ledgr:user', JSON.stringify(loggedUser));
    setToken(access_token);
    setUser(loggedUser);
  };

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    setLoading(true);
    try {
      const trustToken = localStorage.getItem(chaveConfianca(email)) || undefined;
      const response = await api.post('/auth/login', { email, password, trustToken });
      const data = response.data;
      if (data?.requires2fa) return { status: '2fa', challengeToken: data.challengeToken };
      if (data?.requires2faSetup) return { status: '2fa-setup', setupToken: data.setupToken };
      concluirLogin(data, email);
      return { status: 'ok' };
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verify2fa = async (challengeToken: string, code: string, trustDevice: boolean, email: string) => {
    const response = await api.post('/auth/2fa/verify', { challengeToken, code, trustDevice });
    concluirLogin(response.data, email);
  };

  const setup2fa = async (setupToken?: string) => {
    const response = setupToken
      ? await api.post('/auth/2fa/setup', { setupToken })
      : await api.post('/auth/2fa/me/setup');
    return response.data as { otpauthUrl: string; qrDataUrl: string; secret: string };
  };

  const activate2fa = async (code: string, setupToken: string | undefined, trustDevice: boolean, email: string): Promise<string[]> => {
    if (setupToken) {
      const response = await api.post('/auth/2fa/activate', { setupToken, code, trustDevice });
      concluirLogin(response.data, email);
      return response.data?.recoveryCodes || [];
    }
    const response = await api.post('/auth/2fa/me/activate', { code });
    return response.data?.recoveryCodes || [];
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
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, loadUser, verify2fa, setup2fa, activate2fa }}>
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