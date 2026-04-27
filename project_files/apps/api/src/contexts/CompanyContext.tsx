import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

// Interface atualizada para o padrão Ledgr 1.0 (English/CamelCase)
interface Company {
  id: string;
  legalName: string; // Antes: razaoSocial
  taxId: string;     // Antes: cnpj
  tradeName?: string;
  isSede?: boolean;
  status: string;
}

interface CompanyContextData {
  activeCompany: Company | null; // Antes: empresaAtiva
  companies: Company[];          // Antes: empresas
  hqCompany: Company | null;     // Antes: empresaSede (HQ = Headquarters)
  selectCompany: (company: Company) => void;
  loading: boolean;
  error: string | null;
  loadCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextData>({} as CompanyContextData);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth(); // Assumindo que o AuthContext também foi para 'user'
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [hqCompany, setHqCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activateCompany = (company: Company) => {
    console.log('✅ Company activated:', company.legalName, company.isSede ? '(HQ)' : '');
    setActiveCompany(company);
    localStorage.setItem('@ledgr:activeCompany', JSON.stringify(company));
    localStorage.setItem('@ledgr:companyId', company.id);
    localStorage.setItem('@ledgr:lastCompanyId', company.id);
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📡 Fetching available companies...');

      // 1. Busca via nova rota em inglês
      const response = await api.get('/companies/available');
      console.log('✅ Companies loaded:', response.data.length);
      setCompanies(response.data);

      // 2. Busca empresa SEDE (HQ)
      let hq: Company | null = null;
      try {
        const hqResponse = await api.get('/companies/sede');
        hq = hqResponse.data;
        setHqCompany(hq);
        console.log('🏢 HQ Company:', hq.legalName);
      } catch (hqError) {
        console.warn('⚠️ No HQ company found');
        if (response.data.length > 0) {
          hq = response.data[0];
          setHqCompany(hq);
        }
      }

      // 3. Lógica de seleção automática
      const lastId = localStorage.getItem('@ledgr:lastCompanyId');

      if (lastId) {
        const found = response.data.find((c: Company) => c.id === lastId);
        if (found) {
          console.log('🔄 Restoring last company:', found.legalName);
          activateCompany(found);
        } else if (hq) {
          activateCompany(hq);
        }
      } else if (hq) {
        activateCompany(hq);
      } else if (response.data.length > 0) {
        activateCompany(response.data[0]);
      }
    } catch (err: any) {
      console.error('❌ Error loading companies:', err);

      if (err.response?.status === 404) {
        setError('Route /companies/available not found. Check backend.');
      } else if (err.response?.status === 401) {
        setError('Unauthorized. Please login again.');
      } else {
        setError('Error loading companies.');
      }

      setCompanies([]);
      setHqCompany(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const storageToken = localStorage.getItem('@ledgr:token');
    const storageUser = JSON.parse(localStorage.getItem('@ledgr:user') || 'null');

    if ((user || storageUser) && (token || storageToken)) {
      loadCompanies();
    } else {
      setLoading(false);
    }
  }, [user, token]);

  const selectCompany = (company: Company) => {
    console.log('🔄 Company selected:', company.legalName);
    activateCompany(company);
  };

  return (
    <CompanyContext.Provider value={{
      activeCompany,
      companies,
      hqCompany,
      selectCompany,
      loading,
      error,
      loadCompanies
    }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};