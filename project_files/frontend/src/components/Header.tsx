import React, { useState, useEffect } from 'react';
import { FiBriefcase, FiChevronDown, FiUser, FiLogOut, FiSettings, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Header: React.FC<{ sidebarOpen: boolean }> = ({ sidebarOpen }) => {
  const { user, signIn, signOut } = useAuth();
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [isUserOpen, setIsUserOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  // Login form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Alterado de senha -> password
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false); // Alterado de loggingIn -> isLoggingIn
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Month/Year state
  const [activeMonthYear, setActiveMonthYear] = useState(new Date());

  // Formatting function
  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    }).toUpperCase();
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('@ledgr:savedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  const getWeekday = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  const activeCompany = {
    razao_social: 'Empresa ABC Ltda',
    cnpj: '12.345.678/0001-90'
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🖱️ handleLogin called with:', email);
    console.log('🔑 Password length:', password.length); // ← ADICIONE
    console.log('📤 Dados enviados:', { email, password }); // ← ADICIONE
    setLoginError('');
    setIsLoggingIn(true);

    try {
      await signIn(email, password);
      if (rememberMe) {
        localStorage.setItem('@ledgr:savedEmail', email);
      } else {
        localStorage.removeItem('@ledgr:savedEmail');
      }
      setPassword('');
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('❌ Error response:', error.response?.data);
      setLoginError(error.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsUserOpen(false);
    signOut();
    navigate('/'); // Redirects to LedgrHome
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.company-dropdown') && !target.closest('.company-trigger')) {
        setIsCompanyOpen(false);
      }
      if (!target.closest('.user-dropdown') && !target.closest('.user-trigger')) {
        setIsUserOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className="h-16 bg-white border-b border-gray-200 fixed top-0 z-40 flex items-center px-6 shadow-sm"
      style={{
        width: sidebarOpen ? 'calc(100% - 16rem)' : 'calc(100% - 5rem)',
        right: 0,
        transition: 'width 0.3s ease'
      }}
    >

      {/* CENTER - COMPANY (Visible when logged in) */}
      <div className="flex-1 flex justify-center">
        {user ? (
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
                  {activeCompany?.razao_social || 'Select Company'}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">{activeCompany?.cnpj}</p>
                  <span className="text-xs text-blue-600 font-bold">
                    • {formatMonthYear(activeMonthYear)}
                  </span>
                </div>
              </div>
              <FiChevronDown
                size={16}
                className={`text-gray-400 transition-transform duration-200 ${isCompanyOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        ) : (
          <div className="text-center">
            <h1 className="text-xl font-black text-gray-800 leading-tight">LEDGR</h1>
            <p className="text-xs text-gray-500">Management & Control Platform</p>
          </div>
        )}
      </div>

      {/* RIGHT - LOGIN OR USER + DATE/TIME */}
      <div className="flex items-center gap-4">
        {user ? (
          <div className="relative user-trigger">
            <button
              onClick={() => setIsUserOpen(!isUserOpen)}
              className="flex items-center gap-3 hover:bg-gray-50 px-3 py-2 rounded-lg transition-all border border-transparent hover:border-gray-200"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800 leading-tight">{user.fullName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                {user.fullName?.[0]?.toUpperCase()}
              </div>
            </button>

            {isUserOpen && (
              <div className="user-dropdown absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl p-2 z-50">
                <div className="px-3 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-800 text-sm">{user.fullName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                  <p className="text-xs text-blue-600 font-semibold mt-1">{(user as any).role}</p>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setIsUserOpen(false); navigate('/app/profile'); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    <FiUser size={16} className="text-gray-400" />
                    My Profile
                  </button>
                  <button
                    onClick={() => { setIsUserOpen(false); alert('Settings under development'); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    <FiSettings size={16} className="text-gray-400" />
                    Settings
                  </button>
                </div>
                <div className="border-t border-gray-100 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 text-red-600 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <FiLogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-1 relative">
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoggingIn}
                className="px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                required
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoggingIn}
                  className="px-2 py-1.5 pr-7 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-[10px] text-gray-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3 h-3"
                />
                <span>Remember me</span>
              </label>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="px-2 py-1 text-[12px] bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 font-semibold"
              >
                {isLoggingIn ? '...' : 'Sign In'}
              </button>
            </div>
            {loginError && (
              <p className="text-[10px] text-red-600 absolute top-full right-0 mt-0.5">{loginError}</p>
            )}
          </form>
        )}

        {/* DATE AND TIME */}
        <div className="flex flex-col items-end text-right border-l border-gray-200 pl-4">
          <p className="text-sm font-bold text-gray-800 leading-tight tabular-nums">
            {getWeekday(currentTime)} - {formatTime(currentTime)}
          </p>
          <p className="text-xs text-gray-500 uppercase tracking-tighter">{formatDate(currentTime)}</p>
        </div>
      </div>
    </header>
  );
};