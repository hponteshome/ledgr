import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiHome, FiBriefcase, FiUsers, FiDollarSign, FiFileText, FiMenu,
  FiChevronLeft, FiChevronDown, FiChevronRight, FiActivity, FiSettings,
  FiFolder, FiBook, FiPenTool, FiClipboard, FiShield, FiLayers,
  FiUserCheck, FiUpload, FiDatabase, FiPieChart, FiCalendar,
  FiServer, FiEdit2, FiEdit3, FiPackage, FiTool, FiTruck, FiTrendingUp,
  FiAlertCircle, FiTrendingDown, FiLogOut, FiBarChart2, FiArchive, FiBookOpen, FiCpu,
} from 'react-icons/fi';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { ImportBalancesModal } from './accounting/ImportBalancesModal';

const MySwal = withReactContent(Swal);

interface SubItem {
  path: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
  isImport?: boolean;
  children?: { path: string; label: string; icon: React.ElementType }[]; // ← novo
}

interface MenuItem {
  path: string;
  icon: React.ElementType;
  label: string;
  children?: SubItem[];
}

export const Sidebar: React.FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const cid = activeCompany?.id ?? '';

  const [showImportModal, setShowImportModal] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);

  // Memorizar o menu para evitar recalculações e garantir estabilidade nas referências
  const menuItems = useMemo(() => [
    { path: '/app/dashboard', icon: FiHome, label: 'Dashboard' },
    { path: '/app/companies', icon: FiBriefcase, label: 'Empresas' },
    { path: '/app/users', icon: FiUsers, label: 'Usuários' },
    { path: '/app/profiles', icon: FiShield, label: 'Perfis' },
    { path: '/app/persons', icon: FiUsers, label: 'Pessoas Físicas' },
    {
      path: '/app/finance', icon: FiDollarSign, label: 'Finance',
      children: [
        { path: '/app/finance/fiscal-documents', label: 'Documentos Fiscais', icon: FiFileText },
        { path: '/app/finance/accounts-payable', label: 'Contas a Pagar', icon: FiTrendingDown },
        { path: '/app/finance/agenda', label: 'Agenda Financeira', icon: FiCalendar },
        { path: '/app/finance/bank-import', label: 'Importação Bancária', icon: FiUpload },
      ],
    },
    {
      path: '/app/accounting', icon: FiBarChart2, label: 'Accounting',
      children: [
        { path: '/app/accounting/accounts', label: 'Plano de Contas', icon: FiLayers },
        { path: '/app/accounting/journal', label: 'Lançamentos', icon: FiEdit3 },
        { path: '/app/accounting/trial-balance', label: 'Balancete', icon: FiPieChart },
        { path: '/app/accounting/investimentos/renda-fixa', label: 'Renda Fixa', icon: FiTrendingUp },
        { path: '/app/accounting/investimentos/simulador', label: 'Simulador CDB', icon: FiActivity },
        { path: '/app/accounting/balance-comparison', label: 'Comparativo de Saldos', icon: FiActivity },
      ],
    },
    {
      path: '/app/sistema',
      icon: FiSettings,
      label: 'Sistema',
      accent: '#374151',
      surface: '#F9FAFB',
      children: [
        { path: '/app/sistema/calendario', label: 'Calendario de Feriados', icon: FiCalendar },
        { path: '/app/sistema/indicadores', label: 'Indicadores Economicos', icon: FiBarChart2 },
        { path: '/app/sistema/tabelas', label: 'Tabelas Legais', icon: FiBook },
      ],
    },
    {
      path: '/app/sped', icon: FiDatabase, label: 'SPED',
      children: [
        { path: '/app/sped/ecd', label: 'ECD — Escrituração Contábil', icon: FiDatabase },
        { path: '/app/sped/ecd/History', label: 'ECD — Histórico de Importações', icon: FiDatabase },
        { path: '/app/sped/ecf', label: 'ECF — Escrituração Fiscal', icon: FiFileText },
        { path: '#efd', label: 'EFD — Contribuições', icon: FiFileText, disabled: true },
      ],
    },

    {
      path: '/app/societario', icon: FiLayers, label: 'Societário',
      children: [
        { path: cid ? `/app/societario/${cid}/apresentacao` : '#', label: 'Apresentação Institucional', icon: FiBriefcase, disabled: !cid },
        { path: cid ? `/app/companies/corporate/statute/${cid}` : '#', label: 'Estatuto Social', icon: FiBook, disabled: !cid },
        { path: cid ? `/app/companies/corporate/contratos/${cid}` : '#', label: 'Contrato Social', icon: FiFileText, disabled: !cid },
        {
          path: '/app/societario/livros',
          label: 'Livros e Registros',
          icon: FiLayers,
          children: [
            { path: '/app/societario/livros/acionistas', label: 'Acionistas e Participações', icon: FiUserCheck },
            { path: '#', label: 'Assembleias e Reuniões', icon: FiCalendar, disabled: true },
          ],
        },
      ],
    },

    {
      path: '/app/arquivo', icon: FiArchive, label: 'Arquivo',
      children: [
        {
          path: '/app/arquivo/societario',
          label: 'Societário',
          icon: FiLayers,
          children: [
            { path: '/app/arquivo/societario/contratos', label: 'Contratos / Estatutos', icon: FiFileText },
            { path: '/app/arquivo/societario/atas', label: 'Atas Assinadas', icon: FiBookOpen },
            { path: '/app/arquivo/societario/procuracoes', label: 'Procurações', icon: FiEdit2 },
            { path: '/app/arquivo/societario/acordos', label: 'Acordos de Acionistas', icon: FiClipboard },
            { path: '/app/arquivo/societario/livros', label: 'Livros Encerrados', icon: FiBook },
          ],
        },
        {
          path: '/app/arquivo/contabil',
          label: 'Contábil',
          icon: FiBarChart2,
          children: [
            { path: '/app/arquivo/contabil/balancetes', label: 'Balancetes Aprovados', icon: FiFileText },
            { path: '/app/arquivo/contabil/ecd', label: 'ECDs Assinados', icon: FiDatabase },
            { path: '/app/arquivo/contabil/demonstracoes', label: 'Demonstrações Financeiras', icon: FiPieChart },
          ],
        },
        {
          path: '/app/arquivo/fiscal',
          label: 'Fiscal',
          icon: FiFileText,
          children: [
            { path: '/app/arquivo/fiscal/ecf', label: 'ECFs Assinados', icon: FiDatabase },
            { path: '/app/arquivo/fiscal/obrigacoes', label: 'Obrigações Acessórias', icon: FiAlertCircle },
          ],
        },
        {
          path: '/app/arquivo/rh',
          label: 'RH / Trabalhista',
          icon: FiUsers,
          children: [
            { path: '/app/arquivo/rh/contratos', label: 'Contratos de Trabalho', icon: FiClipboard },
            { path: '/app/arquivo/rh/procuracoes', label: 'Procurações Trabalhistas', icon: FiEdit2 },
            { path: '/app/arquivo/rh/acordos', label: 'Acordos Coletivos', icon: FiBookOpen },
          ],
        },
      ],
    },
    {
      path: '/app/assets', icon: FiPackage, label: 'Ativo Imobilizado',
      children: [
        { path: '/app/assets', label: 'Bens', icon: FiPackage },
        { path: '/app/assets/maintenances', label: 'Manutenções', icon: FiTool },
      ],
    },
    { path: '/app/signatures/validate', icon: FiShield, label: 'Validação de Assinatura' },
  ], [cid]);

  // Auto-expansão com suporte a 2 níveis
  useEffect(() => {
    {
      const currentPath = location.pathname;
      const toExpand: string[] = [];

      menuItems.forEach(item => {
        if (item.children) {
          const childMatch = item.children.some(child => {
            if (currentPath.startsWith(child.path.split("?")[0])) return true;
            if (child.children) {
              return child.children.some(gc => currentPath.startsWith(gc.path.split("?")[0]));
            }
            return false;
          });
          if (childMatch) toExpand.push(item.path);

          item.children.forEach(child => {
            if (child.children) {
              const gcMatch = child.children.some(gc => currentPath.startsWith(gc.path.split("?")[0]));
              if (gcMatch) toExpand.push(child.path);
            }
          });
        }
      });

      if (toExpand.length > 0) setExpanded(toExpand);
    }
  }, [location.pathname, menuItems]);

  const handleSignOut = async () => {
    const result = await MySwal.fire({
      title: 'Sair do Sistema?',
      text: "Sua sessão será encerrada.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#111111',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, sair',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      logout();
      navigate('/auth/login');
    }
  };

  const handleParentClick = (path: string) => {
    if (!open) {
      onToggle();
      setExpanded([path]);
    } else {
      setExpanded(prev => prev.includes(path) ? [] : [path]);
    }
  };

  return (
    <>
      <aside className={`bg-white border-r-[0.5px] border-gray-200 flex flex-col h-full fixed left-0 top-0 z-[60] transition-all duration-300 ${open ? 'w-64' : 'w-20'}`}>

        <div className="h-16 flex items-center justify-between px-5 border-b-[0.5px] border-gray-100 flex-shrink-0">
          {open ? (
            <>
              <span className="text-xl font-black tracking-tighter text-gray-900">LEDGR<span className="text-blue-600">.</span></span>
              <button onClick={onToggle} className="p-1.5 rounded-lg bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors">
                <FiChevronLeft size={20} />
              </button>
            </>
          ) : (
            <button onClick={onToggle} title="Expandir Menu" className="w-9 h-9 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold mx-auto hover:bg-gray-800 transition-colors">
              <FiMenu size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            const isExp = expanded.includes(item.path);

            return (
              <div key={item.path} className="mb-1">
                {item.children ? (
                  <button
                    onClick={() => handleParentClick(item.path)}
                    title={!open ? item.label : ''}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <item.icon size={20} className={active ? 'text-blue-600' : ''} />
                    {open && <span className="text-base font-medium flex-1 text-left">{item.label}</span>}
                    {open && (isExp ? <FiChevronDown size={30} /> : <FiChevronRight size={30} />)}
                  </button>
                ) : (
                  <Link
                    to={item.path}
                    title={!open ? item.label : ''}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${active ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <item.icon size={20} className={active ? 'text-blue-600' : ''} />
                    {open && <span className="text-base font-medium flex-1 text-left">{item.label}</span>}
                  </Link>
                )}

                {open && isExp && item.children && (
                  <div className="ml-6 pl-4 border-l-[0.5px] border-gray-100 mt-1 space-y-1 overflow-hidden transition-all duration-300">

                    {item.children.map(child => (
                      child.isImport ? (
                        <button key="imp" onClick={() => setShowImportModal(true)}
                          className="w-full flex items-center gap-2 py-2 text-[15px] text-gray-400 hover:text-blue-600 font-medium text-left px-3">
                          <child.icon size={20} /> {child.label}
                        </button>
                      ) : child.children ? (
                        // ── Subgrupo de segundo nível ──────────────────────────
                        <div key={child.path}>
                          <button
                            onClick={() => setExpanded(prev =>
                              prev.includes(child.path) ? prev.filter(p => p !== child.path) : [...prev, child.path]
                            )}
                            className="w-full flex items-center gap-2 py-2 text-[15px] px-3 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          >
                            <child.icon size={20} />
                            <span className="flex-1 text-left">{child.label}</span>
                            {expanded.includes(child.path) ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
                          </button>
                          {expanded.includes(child.path) && (
                            <div className="ml-4 pl-3 border-l-[0.5px] border-gray-100 space-y-1">
                              {child.children.map(gc => (
                                <Link key={gc.path} to={gc.path}
                                  className={`flex items-center gap-2 py-2 text-[14px] px-3 rounded-lg transition-all ${location.pathname === gc.path
                                    ? 'text-blue-600 font-bold bg-blue-50'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                    }`}>
                                  <gc.icon size={16} /> {gc.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Link
                          key={child.path}
                          to={child.disabled ? '#' : child.path}
                          className={`flex items-center gap-2 py-2 text-[15px] px-3 rounded-lg transition-all ${child.disabled ? 'opacity-30 cursor-not-allowed'
                            : (location.pathname + location.search) === child.path
                              ? 'text-blue-600 font-bold bg-blue-50'
                              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}>
                          <child.icon size={20} /> {child.label}
                        </Link>
                      )
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t-[0.5px] border-gray-100 flex-shrink-0">
          <button onClick={handleSignOut} title={!open ? 'Sign Out' : ''} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-red-600 font-bold hover:bg-red-50 ${!open && 'justify-center'}`}>
            <FiLogOut size={20} />
            {open && <span className="text-base">Sign Out</span>}
          </button>
        </div>
      </aside>

      {activeCompany && <ImportBalancesModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} companyId={activeCompany.id} />}
    </>
  );
};








