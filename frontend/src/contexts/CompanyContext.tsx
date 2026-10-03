// src/contexts/CompanyContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { isMasterAdmin } from '../utils/isMasterAdmin';

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
  activeCompetencia: Date | null;
  setActiveCompetencia: (date: Date) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextData>({} as CompanyContextData);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCompetencia, setActiveCompetenciaState] = useState<Date | null>(null);

  const competenciaKey = (companyId: string) => `@ledgr:activeCompetencia:${companyId}`;
  const lastDayOfMonth = (year: number, month: number) => new Date(year, month + 1, 0);

  // CORRIGIDO 25/09/2026: o backend devolve a data (db.Date) como meia-noite
  // UTC (ex: "2025-12-31T00:00:00.000Z"). new Date(iso) direto fica ancorado
  // nesse instante UTC - lido com getters LOCAIS (getDate(), usado em
  // Header.tsx/formatDDMMYYYY) em fuso negativo (Brasil, UTC-3) sempre mostra
  // o dia ANTERIOR (achado real: banco com 2025-12-31 correto, tela
  // mostrando 30/12/2025). Extrai so a parte AAAA-MM-DD e monta a data com
  // o construtor LOCAL (new Date(ano, mes, dia)) - mesmo principio ja usado
  // em rental-contracts.service.ts (toDate()) para campos so-data.
  const parseDateOnly = (value: string): Date => {
    const [y, m, d] = value.substring(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const loadActiveCompetencia = async (companyId: string) => {
    const cached = localStorage.getItem(competenciaKey(companyId));
    if (cached) setActiveCompetenciaState(parseDateOnly(cached));
    try {
      const response = await api.get(`/companies/${companyId}/active-competencia`);
      const iso = response.data?.activeCompetencia;
      const today = new Date();
      const date = iso ? parseDateOnly(iso) : lastDayOfMonth(today.getFullYear(), today.getMonth());
      setActiveCompetenciaState(date);
      localStorage.setItem(competenciaKey(companyId), date.toISOString());
    } catch {
      // Silencioso - mantem o valor em cache local, se houver
    }
  };

  const setActiveCompetencia = async (date: Date) => {
    if (!activeCompany) return;
    setActiveCompetenciaState(date);
    localStorage.setItem(competenciaKey(activeCompany.id), date.toISOString());
    try {
      await api.patch(`/companies/${activeCompany.id}/active-competencia`, {
        activeCompetencia: date.toISOString(),
      });
    } catch {
      // Silencioso - fica salvo localmente, tenta novamente na proxima edicao
    }
  };

  const activateFirstCompany = (companiesList: Company[]) => {
    if (companiesList.length > 0) {
      const firstCompany = companiesList[0];
      console.log('🏢 Ativando primeira empresa:',
        firstCompany.tradeName || firstCompany.legalName || 'Empresa sem nome');

      setActiveCompany(firstCompany);
      localStorage.setItem('@ledgr:activeCompany', JSON.stringify(firstCompany));
      localStorage.setItem('@ledgr:companyId', firstCompany.id);
      localStorage.setItem('@ledgr:lastCompanyId', firstCompany.id);
      loadActiveCompetencia(firstCompany.id);
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
      if (lastCompanyId === 'none' && isMasterAdmin(user)) { // Seguranca 0A: so o Master restaura o Modo Global
        console.log('🌐 Restaurando Modo Global (Nenhuma empresa ativa)');
        setActiveCompany(null);
        setActiveCompetenciaState(null);
      } else if (lastCompanyId) {
        const foundCompany = formattedCompanies.find((c: Company) => c.id === lastCompanyId);

        if (foundCompany) {
          console.log('🔄 Restaurando última empresa:', foundCompany.tradeName || foundCompany.legalName);
          setActiveCompany(foundCompany);
          localStorage.setItem('@ledgr:activeCompany', JSON.stringify(foundCompany));
          localStorage.setItem('@ledgr:companyId', foundCompany.id);
          loadActiveCompetencia(foundCompany.id);
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
    if (!company && !isMasterAdmin(user)) return; // Seguranca 0A: Modo Global so para o Master
    if (company) {
      console.log('🔄 Empresa selecionada:', company.tradeName || company.legalName);
      setActiveCompany(company);
      localStorage.setItem('@ledgr:activeCompany', JSON.stringify(company));
      localStorage.setItem('@ledgr:companyId', company.id);
      localStorage.setItem('@ledgr:lastCompanyId', company.id);
      loadActiveCompetencia(company.id);
    } else {
      console.log('🌐 Modo Global ativado');
      setActiveCompany(null);
      setActiveCompetenciaState(null);
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
      loadCompanies,
      activeCompetencia,
      setActiveCompetencia,
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