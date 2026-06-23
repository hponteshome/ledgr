import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiHome, FiBriefcase, FiUsers, FiFileText, FiMenu,
  FiChevronLeft, FiChevronDown, FiChevronRight, FiActivity, FiSettings,
  FiFolder, FiBook, FiPenTool, FiClipboard, FiShield, FiPercent, FiLayers,
  FiUserCheck, FiUpload, FiDatabase, FiPieChart, FiCalendar, FiCheckCircle,
  FiServer, FiEdit2, FiEdit3, FiPackage, FiTool, FiTruck, FiTrendingUp,
  FiAlertCircle, FiTrendingDown, FiLogOut, FiBarChart2, FiArchive, FiBookOpen, FiCpu, FiRepeat, FiLock, FiFilePlus, FiArrowDown, FiMessageSquare, FiHelpCircle,
} from 'react-icons/fi';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { ImportBalancesModal } from './accounting/ImportBalancesModal';
import { useSidebarPermissions } from '../contexts/SidebarPermissionsContext';
import { HelpCenter } from './help/HelpCenter';
import { contextualHelp } from '../help/helpContent';

const MySwal = withReactContent(Swal);

interface SubItem {
  path: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
  isImport?: boolean;
  children?: { path: string; label: string; icon: React.ElementType }[];
}

interface MenuItem {
  path: string;
  icon: React.ElementType;
  label: string;
  dividerBefore?: string;
  children?: SubItem[];
}

export const Sidebar: React.FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const cid = activeCompany?.id ?? '';
  const { canView, allowed, loading: permLoading } = useSidebarPermissions();

  const [showImportModal, setShowImportModal] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const helpSlug = Object.entries(contextualHelp).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1];

  const menuItems = useMemo(() => [

    { path: '/app/dashboard', icon: FiHome, label: 'Visão Geral' },
    { path: '/app/chat', icon: FiMessageSquare, label: 'Mensagens' },

    {
      path: '/app/accounting', icon: FiBook, label: 'Contabilidade', dividerBefore: 'Operacional',
      children: [
        { path: '/app/accounting/accounts', label: 'Plano de Contas', icon: FiLayers },
        { path: '/app/accounting/journal', label: 'Lançamentos', icon: FiEdit3 },
        { path: '/app/accounting/trial-balance', label: 'Balancete', icon: FiPieChart },
        { path: '/app/accounting/balance-comparison', label: 'Comparativo de Saldos', icon: FiActivity },
        { path: '/app/accounting/visoes-contabeis', label: 'Visões Contábeis (I052)', icon: FiCpu },
        {
          path: '/app/accounting/relatorios',
          label: 'Relatórios',
          icon: FiBookOpen,
          children: [
            { path: '/app/accounting/diario', label: 'Diário Geral', icon: FiBook },
            { path: '/app/accounting/razao', label: 'Razão Analítico', icon: FiBarChart2 },
            { path: '/app/accounting/dre', label: 'DRE', icon: FiTrendingUp },
            { path: '/app/accounting/balanco', label: 'Balanço Patrimonial', icon: FiPieChart },
          ],
        },
        {
          path: '/app/accounting/investimentos',
          label: 'Investimentos',
          icon: FiTrendingUp,
          children: [
            { path: '/app/accounting/investimentos/renda-fixa', label: 'Renda Fixa', icon: FiTrendingUp },
            { path: '/app/accounting/investimentos/simulador', label: 'Simulador CDB', icon: FiActivity },
          ],
        },
        {
          path: '/app/accounting/importacao',
          label: 'Importação',
          icon: FiUpload,
          children: [
            { path: '/app/accounting/accounts/import', label: 'Importar Plano de Contas', icon: FiLayers },
            { path: '/app/accounting/journal/import', label: 'Importar Lançamentos', icon: FiEdit3 },
          ],
        },
      ],
    },

    {
      path: '/app/finance', icon: FiBarChart2, label: 'Financeiro',
      children: [
        { path: '/app/finance/accounts-payable', label: 'Contas a Pagar', icon: FiTrendingDown },
        { path: '/app/finance/contas-receber', label: 'Contas a Receber', icon: FiTrendingUp },
        { path: '/app/finance/fluxo-caixa', label: 'Fluxo de Caixa', icon: FiActivity },
        { path: '/app/finance/petty-cash', label: 'Fundo Fixo', icon: FiTrendingDown },
        { path: '/app/finance/agenda', label: 'Agenda Financeira', icon: FiCalendar },
        { path: '/app/finance/bank-import', label: 'Importação Bancária', icon: FiUpload },
        { path: '/app/finance/provisoes', label: 'Provisões Recorrentes', icon: FiRepeat },
        { path: '/app/finance/fechamento', label: 'Fechamento Mensal', icon: FiLock },
      ],
    },

    {
      path: '/app/fiscal', icon: FiPercent, label: 'Fiscal',
      children: [
        { path: '/app/fiscal/nfse-nacional', label: 'NFS-e Nacional (RFB)', icon: FiCheckCircle },
        { path: '/app/fiscal/nfe',             label: 'NF-e (Produtos)',          icon: FiPackage },
        { path: '/app/fiscal/nfse-sp-emissao', label: 'Emissão NFS-e SP',        icon: FiFilePlus },
        { path: '/app/fiscal/nfse-sp-csv', label: 'Importar CSV PMSP', icon: FiArrowDown },
        { path: '/app/fiscal/nfse-sp',         label: 'NFS-e São Paulo',          icon: FiUpload },
        { path: '/app/fiscal/documentos-fiscais', label: 'Documentos Fiscais',    icon: FiFileText },
        { path: '/app/fiscal/apuracao',        label: 'Apuração de Impostos',     icon: FiPercent },
        { path: '/app/fiscal/lalur-config',    label: 'Config. Dedutibilidade',   icon: FiSettings },
      ],
    },

    {
      path: '/app/hr', icon: FiUsers, label: 'Departamento Pessoal',
      children: [
        { path: '/app/hr/employees', label: 'Funcionários', icon: FiUsers },
        { path: '/app/hr/pro-labore', label: 'Pró-labore', icon: FiTrendingDown },
        { path: '/app/hr/folha', label: 'Folha de Pagamento', icon: FiTrendingDown },
        { path: '/app/hr/ferias', label: 'Férias', icon: FiCalendar },
        { path: '/app/hr/decimo-terceiro', label: '13º Salário', icon: FiTrendingDown },
        { path: '/app/hr/recesso', label: 'Recessos & Pontes', icon: FiRepeat },
        { path: '/app/hr/esocial', label: 'eSocial', icon: FiFileText },
        { path: '/app/hr/informe-rendimentos', label: 'Informe de Rendimentos', icon: FiFileText },
        { path: '/app/hr/rais', label: 'RAIS', icon: FiFileText },
        { path: '/app/hr/dctfweb', label: 'DCTFWeb', icon: FiCpu },
        { path: '/app/hr/dho', label: 'DHO', icon: FiUserCheck, disabled: true },
      ],
    },

    {
      path: '/app/societario', icon: FiLayers, label: 'Societário', dividerBefore: 'Empresa',
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
      path: '/app/assets', icon: FiPackage, label: 'Patrimônio',
      children: [
        { path: '/app/assets/maintenances', label: 'Manutenções', icon: FiTool },
      ],
    },

    {
      path: '/app/sped', icon: FiDatabase, label: 'SPED / Obrigações', dividerBefore: 'Compliance',
      children: [
        { path: '/app/sped/ecd', label: 'ECD — Escrituração Contábil', icon: FiDatabase },
        { path: '/app/sped/ecd/pre-validate', label: 'ECD — Pré-Validação', icon: FiCheckCircle },
        { path: '/app/sped/ecd/History', label: 'ECD — Histórico', icon: FiArchive },
        { path: '/app/sped/ecf', label: 'ECF — Escrituração Fiscal', icon: FiFileText },
        { path: '/app/sped/efd', label: 'EFD-Contribuições', icon: FiFileText },
        { path: '/app/sistema/obrigacoes', label: 'Obrigações Fiscais', icon: FiCheckCircle },
      ],
    },

    {
      path: '/app/arquivo', icon: FiArchive, label: 'Acervo',
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
      path: '/app/assinaturas', icon: FiShield, label: 'Assinaturas',
      children: [
        { path: '/app/signatures/validate', label: 'Validação de Assinatura', icon: FiCheckCircle },
        { path: '/app/documents/signatures/certificates', label: 'Certificados Digitais', icon: FiShield },
      ],
    },

    {
      path: '/app/administracao', dividerBefore: 'Sistema',
      icon: FiSettings,
      label: 'Administração',
      children: [
        { path: '/app/companies', label: 'Empresas', icon: FiBriefcase },
        { path: '/app/administracao/auditoria', label: 'Auditoria & Logs', icon: FiActivity },
        { path: '/app/users', label: 'Usuários', icon: FiUsers },
        { path: '/app/profiles', label: 'Perfis de Acesso', icon: FiShield },
        { path: '/app/persons', label: 'Pessoas Físicas', icon: FiUserCheck },
        { path: '/app/sistema/sidebar-permissions', label: 'Permissões de Menu', icon: FiLock },
        { path: '/app/sistema/calendario', label: 'Calendário de Feriados', icon: FiCalendar },
        { path: '/app/sistema/indicadores', label: 'Indicadores Econômicos', icon: FiBarChart2 },
        { path: '/app/sistema/tabelas', label: 'Tabelas Legais', icon: FiBook },
        { path: '/app/system/backup', label: 'Backup e Restauração', icon: FiDatabase },
        { path: '/app/settings/data-management', label: 'Manutenção de Dados', icon: FiSettings },
      ],
    },

  ], [cid]);

  const filteredMenu = useMemo(() => {
    if (permLoading || allowed.length === 0) return menuItems;
    return menuItems
      .map(item => {
        if (!item.children) {
          return canView(item.path) ? item : null;
        }
        const filteredChildren = item.children
          .map(child => {
            if (!child.children) {
              return canView(child.path) ? child : null;
            }
            const filteredGc = child.children.filter(gc => canView(gc.path));
            if (filteredGc.length === 0 && !canView(child.path)) return null;
            return { ...child, children: filteredGc };
          })
          .filter(Boolean) as typeof item.children;
        if (filteredChildren.length === 0 && !canView(item.path)) return null;
        return { ...item, children: filteredChildren };
      })
      .filter(Boolean) as typeof menuItems;
  }, [menuItems, canView, permLoading]);

  useEffect(() => {
    const currentPath = location.pathname;
    const toExpand: string[] = [];

    menuItems.forEach(item => {
      if (item.children) {
        const childMatch = item.children.some(child => {
          if (currentPath.startsWith(child.path.split('?')[0])) return true;
          if (child.children) {
            return child.children.some(gc => currentPath.startsWith(gc.path.split('?')[0]));
          }
          return false;
        });
        if (childMatch) toExpand.push(item.path);

        item.children.forEach(child => {
          if (child.children) {
            const gcMatch = child.children.some(gc => currentPath.startsWith(gc.path.split('?')[0]));
            if (gcMatch) toExpand.push(child.path);
          }
        });
      }
    });

    if (toExpand.length > 0) setExpanded(toExpand);
  }, [location.pathname, menuItems]);

  const handleSignOut = async () => {
    const result = await MySwal.fire({
      title: 'Sair do Sistema?',
      text: 'Sua sessão será encerrada.',
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
          {filteredMenu.map((item) => {
            const active = location.pathname.startsWith(item.path);
            const isExp = expanded.includes(item.path);

            return (
              <div key={item.path}>
                {open && item.dividerBefore && (
                  <div className="px-3 pt-4 pb-1">
                    <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                      {item.dividerBefore}
                    </span>
                  </div>
                )}
                <div className="mb-1">
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
              </div>
            );
          })}
        </nav>

        <div className="border-t-[0.5px] border-gray-100 flex-shrink-0">
          <button
            onClick={() => setHelpOpen(true)}
            title={!open ? 'Ajuda' : ''}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-gray-400 hover:text-gray-700 hover:bg-gray-50 ${!open && 'justify-center'}`}
          >
            <FiHelpCircle size={18} />
            {open && <span className="text-sm">Ajuda & Suporte</span>}
          </button>
          <button
            onClick={handleSignOut}
            title={!open ? 'Sair' : ''}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-red-500 hover:bg-red-50 ${!open && 'justify-center'}`}
          >
            <FiLogOut size={18} />
            {open && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>

        {/* Painel de Ajuda */}
        {helpOpen && (
          <>
            <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setHelpOpen(false)} />
            <div className="fixed right-0 top-0 h-full w-96 max-w-full z-50 bg-white shadow-2xl flex flex-col animate-slide-in-right">
              <HelpCenter initialSlug={helpSlug} onClose={() => setHelpOpen(false)} />
            </div>
          </>
        )}
      </aside>

      {activeCompany && <ImportBalancesModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} companyId={activeCompany.id} />}
    </>
  );
};


