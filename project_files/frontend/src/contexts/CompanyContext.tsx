import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

interface Company {
  id: string;
  legalName: string;      // ← CORRIGIDO
  tradeName: string;
  taxId: string;
  status: string;
}

interface CompanyContextData {
  activeCompany: Company | null;
  companies: Company[];
  selectCompany: (company: Company) => void;
  loading: boolean;
  error: string | null;
  loadCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextData>({} as CompanyContextData);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activateFirstCompany = (companiesList: Company[]) => {
    if (companiesList.length > 0) {
      const firstCompany = companiesList[0];
      console.log('🏢 [CompanyContext] Activating first company:',
        firstCompany.tradeName || firstCompany.legalName || 'Empresa sem nome');

      setActiveCompany(firstCompany);
      localStorage.setItem('@ledgr:activeCompany', JSON.stringify(firstCompany));
      localStorage.setItem('@ledgr:companyId', firstCompany.id);
      localStorage.setItem('@ledgr:lastCompanyId', firstCompany.id);
    }
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📡 [CompanyContext] Fetching available companies...');

      const response = await api.get('/companies/available');

      console.log('✅ [CompanyContext] Companies loaded:', response.data.length);

      const formattedCompanies: Company[] = response.data.map((emp: any) => ({
        id: emp.id,
        legalName: emp.razao_social || emp.legalName,  // ← CORRIGIDO
        tradeName: emp.nome_fantasia || emp.tradeName,
        taxId: emp.cnpj || emp.taxId,                   // ← CORRIGIDO
        status: emp.status
      }));

      setCompanies(formattedCompanies);

      const lastCompanyId = localStorage.getItem('@ledgr:lastCompanyId');

      if (lastCompanyId) {
        const foundCompany = formattedCompanies.find((c: Company) => c.id === lastCompanyId);

        if (foundCompany) {
          console.log('🔄 [CompanyContext] Restoring last used company:',
            foundCompany.tradeName || foundCompany.legalName);  // ← CORRIGIDO
          setActiveCompany(foundCompany);
          localStorage.setItem('@ledgr:activeCompany', JSON.stringify(foundCompany));
          localStorage.setItem('@ledgr:companyId', foundCompany.id);
        } else {
          console.log('⚠️ [CompanyContext] Last company not found, activating first available');
          activateFirstCompany(formattedCompanies);
        }
      } else {
        console.log('📌 [CompanyContext] No previous session, activating first available');
        activateFirstCompany(formattedCompanies);
      }
    } catch (err: any) {
      console.error('❌ [CompanyContext] Failed to load companies:', err);

      if (err.response?.status === 404) {
        setError('Endpoint /companies/available not found. Check backend configuration.');
      } else if (err.response?.status === 401) {
        setError('Unauthorized. Please sign in again.');
      } else {
        setError('Error loading companies. Please try again.');
      }

      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && token) {
      console.log('✅ [CompanyContext] User authenticated, loading companies...');
      loadCompanies();
    } else {
      console.log('⏳ [CompanyContext] Waiting for authentication...');
      setLoading(false);
      setCompanies([]);
      setActiveCompany(null);
      setError(null);
    }
  }, [user, token]);

  const selectCompany = (company: Company) => {
    console.log('🔄 [CompanyContext] Company selected:',
      company.tradeName || company.legalName);  // ← CORRIGIDO
    setActiveCompany(company);
    localStorage.setItem('@ledgr:activeCompany', JSON.stringify(company));
    localStorage.setItem('@ledgr:companyId', company.id);
    localStorage.setItem('@ledgr:lastCompanyId', company.id);
  };

  return (
    <CompanyContext.Provider value={{
      activeCompany,
      companies,
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