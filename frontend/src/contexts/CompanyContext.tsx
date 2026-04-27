// src/contexts/CompanyContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

interface Company {
  id: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  status: string;
}

interface CompanyContextData {
  activeCompany: Company | null;
  companies: Company[];
  selectCompany: (company: Company | null) => void;
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
      console.log('🏢 Ativando primeira empresa:',
        firstCompany.tradeName || firstCompany.legalName || 'Empresa sem nome');

      setActiveCompany(firstCompany);
      localStorage.setItem('@ledgr:activeCompany', JSON.stringify(firstCompany));
      localStorage.setItem('@ledgr:companyId', firstCompany.id);
      localStorage.setItem('@ledgr:lastCompanyId', firstCompany.id);
    }
  };

  const clearInvalidCache = () => {
    const cached = localStorage.getItem('@ledgr:lastCompanyId');
    // Ignora 'none' pois é nosso marcador de escolha deliberada pelo Modo Global
    if (cached && cached !== 'none' && !cached.includes('-')) {
      console.warn('Cache de empresa inválido removido:', cached);
      localStorage.removeItem('@ledgr:lastCompanyId');
      localStorage.removeItem('@ledgr:companyId');
      localStorage.removeItem('@ledgr:activeCompany');
    }
  };

  const loadCompanies = async () => {
    clearInvalidCache();

    try {
      setLoading(true);
      setError(null);

      console.log('📡 Buscando empresas...');
      const response = await api.get('/companies/available');
      console.log('✅ Empresas carregadas:', response.data.length);

      const formattedCompanies: Company[] = response.data.map((emp: any) => {
        const rawId = emp.id;
        return {
          id: String(rawId),
          legalName: emp.razao_social || emp.legalName,
          tradeName: emp.nome_fantasia || emp.tradeName,
          taxId: emp.cnpj || emp.taxId,
          status: emp.status,
        };
      });

      setCompanies(formattedCompanies);

      const lastCompanyId = localStorage.getItem('@ledgr:lastCompanyId');

      // LÓGICA DE RESTAURAÇÃO: Respeita o 'none' para manter Modo Global após refresh
      if (lastCompanyId === 'none') {
        console.log('🌐 Restaurando Modo Global (Nenhuma empresa ativa)');
        setActiveCompany(null);
      } else if (lastCompanyId) {
        const foundCompany = formattedCompanies.find((c: Company) => c.id === lastCompanyId);

        if (foundCompany) {
          console.log('🔄 Restaurando última empresa:', foundCompany.tradeName || foundCompany.legalName);
          setActiveCompany(foundCompany);
          localStorage.setItem('@ledgr:activeCompany', JSON.stringify(foundCompany));
          localStorage.setItem('@ledgr:companyId', foundCompany.id);
        } else {
          console.log('⚠️ Última empresa não encontrada, ativando primeira disponível');
          activateFirstCompany(formattedCompanies);
        }
      } else {
        console.log('📌 Nenhuma sessão anterior, ativando primeira empresa');
        activateFirstCompany(formattedCompanies);
      }
    } catch (err: any) {
      console.error('❌ Erro ao carregar empresas:', err);
      setError('Error loading companies. Please try again.');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && token) {
      loadCompanies();
    } else {
      setLoading(false);
      setCompanies([]);
      setActiveCompany(null);
    }
  }, [user, token]);

  const selectCompany = (company: Company | null) => {
    if (company) {
      console.log('🔄 Empresa selecionada:', company.tradeName || company.legalName);
      setActiveCompany(company);
      localStorage.setItem('@ledgr:activeCompany', JSON.stringify(company));
      localStorage.setItem('@ledgr:companyId', company.id);
      localStorage.setItem('@ledgr:lastCompanyId', company.id);
    } else {
      console.log('🌐 Modo Global ativado');
      setActiveCompany(null);
      localStorage.removeItem('@ledgr:activeCompany');
      localStorage.removeItem('@ledgr:companyId');
      // Marcamos 'none' para que o sistema não force uma empresa no próximo reload
      localStorage.setItem('@ledgr:lastCompanyId', 'none');
    }
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