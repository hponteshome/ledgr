// Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  FiBriefcase, FiChevronDown, FiUser, FiLogOut, FiSettings,
  FiEye, FiEyeOff, FiCalendar, FiChevronLeft, FiChevronRight,
  FiAlertTriangle, FiInfo, FiX, FiSearch,
} from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { UserPen } from 'lucide-react';

// ── DEV: Controle de versão do seed/bcrypt ────────────────────
const DEV_SEED_VERSION = 'seed-v3-bcryptjs';
const DEV_SEED_STORAGE_KEY = '@ledgr:dev_seed_confirmed';

export const Header: React.FC<{ sidebarOpen: boolean }> = ({ sidebarOpen }) => {
  const { user, signIn, signOut } = useAuth();
  // Extrai o nome do perfil corretamente (se for objeto, pega o name)
  const profileName = (user as any)?.profile?.name || (user as any)?.profile || 'Usuário';
  const { companies, activeCompany, selectCompany } = useCompany();
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [monthInput, setMonthInput] = useState('');
  const [inputError, setInputError] = useState('');
  const navigate = useNavigate();
  const monthInputRef = useRef<HTMLInputElement>(null);

  // States para o Seletor de Empresa (Busca e Filtro)
  const [searchTerm, setSearchTerm] = useState('');

  // Login form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Banners
  const [noCompanyDismissed, setNoCompanyDismissed] = useState(false);
  const [devBannerDismissed, setDevBannerDismissed] = useState(() =>
    localStorage.getItem(DEV_SEED_STORAGE_KEY) === DEV_SEED_VERSION
  );

  const dismissDevBanner = () => {
    localStorage.setItem(DEV_SEED_STORAGE_KEY, DEV_SEED_VERSION);
    setDevBannerDismissed(true);
  };

  // Month/Year state
  const [activeMonth, setActiveMonth] = useState(() => {
    const saved = localStorage.getItem('@ledgr:activeMonth');
    return saved ? new Date(saved) : new Date();
  });

  const [calendarYear, setCalendarYear] = useState(activeMonth.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(activeMonth.getMonth());

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Lógica de Filtro e Ordenação das Empresas (Suporta schema antigo e novo)
  const filteredCompanies = (companies || [])
    .filter(company => {
      const term = searchTerm.toLowerCase();
      const name = (company.legalName || (company as any).razao_social || '').toLowerCase();
      const taxId = (company.taxId || (company as any).cnpj || '').toLowerCase();
      return name.includes(term) || taxId.includes(term);
    })
    .sort((a, b) => {
      const nameA = (a.legalName || (a as any).razao_social || '').toUpperCase();
      const nameB = (b.legalName || (b as any).razao_social || '').toUpperCase();
      return nameA.localeCompare(nameB);
    });

  const formatMonthYearShort = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      month: 'short',
      year: 'numeric'
    }).toUpperCase().replace(/\./g, '');
  };

  const formatMonthInput = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${year}`;
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('@ledgr:savedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('@ledgr:activeMonth', activeMonth.toISOString());
    setCalendarYear(activeMonth.getFullYear());
    setCalendarMonth(activeMonth.getMonth());
    setMonthInput(formatMonthInput(activeMonth));
  }, [activeMonth]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isCompanyOpen) setSearchTerm('');
  }, [isCompanyOpen]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const getWeekday = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { weekday: 'long' });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await signIn(email, password);
      if (rememberMe) localStorage.setItem('@ledgr:savedEmail', email);
      else localStorage.removeItem('@ledgr:savedEmail');
      setPassword('');
      navigate('/app/dashboard');
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401) setLoginError('Credenciais inválidas.');
      else if (status === 429) setLoginError('Muitas tentativas.');
      else setLoginError('Erro ao conectar com o servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsUserOpen(false);
    signOut();
    navigate('/');
  };

  const handleSelectCompany = (company: any) => {
    selectCompany(company);
    setIsCompanyOpen(false);
    setSearchTerm('');
  };

  const handleSelectMonth = (year: number, month: number) => {
    const newDate = new Date(year, month, 1);
    setActiveMonth(newDate);
    setIsMonthOpen(false);
    setInputError('');
  };

  const handlePrevYear = () => setCalendarYear(calendarYear - 1);
  const handleNextYear = () => setCalendarYear(calendarYear + 1);

  const handleMonthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 3) value = value.slice(0, 2) + '/' + value.slice(2);
    setMonthInput(value);
    setInputError('');
  };

  const handleMonthInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const parts = monthInput.split('/');
      if (parts.length === 2) {
        const month = parseInt(parts[0], 10);
        const yearShort = parseInt(parts[1], 10);
        if (month >= 1 && month <= 12 && yearShort >= 0 && yearShort <= 99) {
          const fullYear = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
          setActiveMonth(new Date(fullYear, month - 1, 1));
          setIsMonthOpen(false);
        } else setInputError('Mês inválido.');
      }
    }
  };

  const handleMonthInputBlur = () => {
    if (!monthInput.trim()) setMonthInput(formatMonthInput(activeMonth));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.company-dropdown') && !target.closest('.company-trigger')) setIsCompanyOpen(false);
      if (!target.closest('.month-dropdown') && !target.closest('.month-trigger')) setIsMonthOpen(false);
      if (!target.closest('.user-dropdown') && !target.closest('.user-trigger')) setIsUserOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* Banner DEV */}
      {import.meta.env.DEV && !devBannerDismissed && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-purple-700 text-white text-xs flex items-center gap-3 px-4 py-2 shadow-lg">
          <FiInfo size={13} className="flex-shrink-0" />
          <span>Seed ativo: <code className="bg-purple-900 px-1.5 py-0.5 rounded">{DEV_SEED_VERSION}</code></span>
          <button onClick={dismissDevBanner} className="ml-auto flex items-center gap-1.5 px-2 py-0.5 bg-purple-600 hover:bg-purple-500 rounded font-semibold">
            <FiX size={12} /> OK
          </button>
        </div>
      )}

      {/* Banner Empresa */}
      {user && !activeCompany && !noCompanyDismissed && (
        <div className={`fixed left-0 right-0 z-[90] bg-amber-500 text-white text-xs flex items-center gap-3 px-4 py-2 shadow-md ${import.meta.env.DEV && !devBannerDismissed ? 'top-8' : 'top-0'}`}>
          <FiAlertTriangle size={13} className="flex-shrink-0 animate-pulse" />
          <span className="font-semibold">Nenhuma empresa ativa (Modo Global).</span>
          <button onClick={() => setNoCompanyDismissed(true)} className="ml-auto p-1 hover:bg-amber-600 rounded">
            <FiX size={13} />
          </button>
        </div>
      )}

      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shadow-sm w-full">
        <div className="flex-1 flex justify-center">
          {user ? (
            <div className="flex items-center gap-4">
              {/* COMPANY SELECTOR */}
              <div className="relative company-trigger">
                <button
                  onClick={() => setIsCompanyOpen(!isCompanyOpen)}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 rounded-lg transition-all border border-transparent hover:border-gray-200"
                >
                  <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                    <FiBriefcase size={18} />
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm font-bold text-gray-800 leading-tight">
                      {activeCompany?.legalName || (activeCompany as any)?.razao_social || 'Modo Global'}
                    </p>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                      {activeCompany?.taxId || (activeCompany as any)?.cnpj || 'PLANO MESTRE'}
                    </p>
                  </div>
                  <FiChevronDown size={16} className={`text-gray-400 transition-transform ${isCompanyOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCompanyOpen && (
                  <div className="company-dropdown absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-[110]">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-2">Selecionar Empresa</p>
                      <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="text"
                          placeholder="Buscar nome ou CNPJ..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          autoFocus
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto mt-1 custom-scrollbar">
                      {/* OPÇÃO MODO GLOBAL */}
                      <button
                        onClick={() => handleSelectCompany(null)}
                        className={`w-full text-left px-3 py-3 hover:bg-amber-50 rounded-lg transition-colors border-b border-gray-100 mb-1 ${!activeCompany ? 'bg-amber-50 border-l-4 border-amber-500' : ''
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <FiX size={14} className="text-amber-600" />
                          <p className="font-bold text-amber-800 text-sm">Nenhuma empresa ativa</p>
                        </div>
                        <p className="text-[10px] text-amber-600 mt-0.5 ml-5">Acessar Plano de Contas Mestre</p>
                      </button>

                      {filteredCompanies.length > 0 ? (
                        filteredCompanies.map((company) => (
                          <button
                            key={company.id}
                            onClick={() => handleSelectCompany(company)}
                            className={`w-full text-left px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors ${activeCompany?.id === company.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                              }`}
                          >
                            <p className="font-semibold text-gray-800 text-sm">
                              {company.legalName || (company as any).razao_social}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {company.taxId || (company as any).cnpj}
                            </p>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-center text-sm text-gray-400 font-medium">
                          Nenhuma empresa encontrada
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* MONTH SELECTOR */}
              <div className="relative month-trigger">
                <button
                  onClick={() => setIsMonthOpen(!isMonthOpen)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg transition-all border border-transparent hover:border-gray-200"
                >
                  <FiCalendar size={16} className="text-blue-600" />
                  <span className="text-sm font-bold text-gray-800 hidden sm:block">
                    {formatMonthYearShort(activeMonth)}
                  </span>
                  <FiChevronDown size={14} className={`text-gray-400 transition-transform ${isMonthOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMonthOpen && (
                  <div className="month-dropdown absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50">
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Digite MM/AA</label>
                      <input
                        ref={monthInputRef}
                        type="text"
                        value={monthInput}
                        onChange={handleMonthInputChange}
                        onKeyDown={handleMonthInputKeyDown}
                        onBlur={handleMonthInputBlur}
                        placeholder="12/24"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono"
                        maxLength={5}
                      />
                      {inputError && <p className="text-xs text-red-600 mt-1">{inputError}</p>}
                    </div>
                    <div className="relative mb-4">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                      <div className="relative flex justify-center text-xs"><span className="px-2 bg-white text-gray-400">ou</span></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={handlePrevYear} className="p-1 hover:bg-gray-100 rounded-lg"><FiChevronLeft size={18} /></button>
                        <span className="text-sm font-bold text-gray-700">{calendarYear}</span>
                        <button onClick={handleNextYear} className="p-1 hover:bg-gray-100 rounded-lg"><FiChevronRight size={18} /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {months.map((month, index) => (
                          <button
                            key={index}
                            onClick={() => handleSelectMonth(calendarYear, index)}
                            className={`px-2 py-2 text-xs font-medium rounded-lg ${activeMonth.getMonth() === index && activeMonth.getFullYear() === calendarYear
                              ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'
                              }`}
                          >
                            {month.slice(0, 3)}.
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-xl font-black text-gray-800 leading-tight">LEDGR</h1>
              <p className="text-xs text-gray-500">Management & Control Platform</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* USER SELECTOR / LOGGED USER INFO */}
          {user ? (
            <div className="relative user-trigger">
              <button onClick={() => setIsUserOpen(!isUserOpen)} className="flex items-center gap-3 hover:bg-gray-50 px-3 py-2 rounded-lg transition-all">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-gray-800 leading-tight">{(user as any).fullName || user.email}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                  {/* Profile name displayed below email */}
                  <p className="text-[10px] text-blue-300 font-slim mt-0.5">{profileName}</p>
                </div>
                {/* ÍCONE INICIAL DO NOME (Avatar) */}
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {((user as any).fullName || user.email)[0]?.toUpperCase()}
                </div>
              </button>
              {/* Dropdown de opções (My Profile, Sign Out) */}
              {isUserOpen && (
                <div className="user-dropdown absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50">
                  <div className="px-3 py-3 border-b border-gray-100">
                    <p className="font-semibold text-gray-800 text-sm">{(user as any).fullName || user.email}</p>
                    <p className="text-xs text-blue-600 font-semibold mt-1">{(user as any).role || 'Usuário'}</p>
                    {/* Profile name in dropdown as well for consistency */}
                    <p className="text-xs text-purple-600 font-medium mt-1">Perfil: {profileName}</p>
                  </div>
                  <div className="py-1">
                    <button onClick={() => { setIsUserOpen(false); navigate('/app/profile'); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700">
                      <FiUser size={16} className="text-gray-400" /> My Profile
                    </button>
                  </div>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 text-red-600 rounded-lg text-sm font-semibold">
                      <FiLogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-1 relative">
              <div className="flex items-center gap-2">
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-300 rounded-md w-36" required />
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="px-2 py-1.5 pr-7 text-xs border border-gray-300 rounded-md w-28" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-[10px] text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-3 h-3" />
                  <span>Remember me</span>
                </label>
                <button type="submit" disabled={isLoggingIn} className="px-2 py-1 text-[12px] bg-blue-600 text-white rounded-md font-semibold">
                  {isLoggingIn ? '...' : 'Sign In'}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col items-end text-right border-l border-gray-200 pl-4">
            <p className="text-sm font-bold text-gray-800 leading-tight tabular-nums">
              {getWeekday(currentTime)} - {formatTime(currentTime)}
            </p>
            <p className="text-xs text-gray-500 uppercase tracking-tighter">{formatDate(currentTime)}</p>
          </div>
        </div>
      </header>
    </>
  );
};