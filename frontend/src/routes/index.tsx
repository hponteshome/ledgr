// src/routes/index.tsx
import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LedgrHome } from '../pages/LedgrHome';
import DashboardPage from '../pages/DashboardPage';
import AuditPage from '../pages/admin/AuditPage';
import ChatPage from '../pages/chat/ChatPage';
import FinancePage from '../pages/finance/FinancePage';
import BankImport from '../pages/finance/BankImportPage';
import ProvisoesPage from '../pages/finance/ProvisoesPage';
import { CompanyList } from '../pages/companies/CompanyList';
import { CompanyForm } from '../pages/companies/CompanyForm';
import { Register } from '../pages/register/Register';
import { UserList } from '../pages/users/UserList';
import PendentesPage from '../pages/users/PendentesPage';
import { UserForm } from '../pages/users/UserForm';
import { ProfileForm } from '../pages/users/ProfileForm';
import { useAuth } from '../contexts/AuthContext';
import { useSidebarPermissions } from '../contexts/SidebarPermissionsContext';
import { CompanyShow } from '../pages/companies/CompanyShow';
import { CompanyEdit } from '../pages/companies/CompanyEdit';
import { ProfileList } from '../pages/users/ProfileList';
import {
    DocumentsList, CorporateBooks, DocumentUpload, DocumentView, SignatureList, SignatureRequest, CertificateManager, GovBrSign, SignatureValidatePage
} from '../pages/documents';
import {
    StatuteList, StatuteView, StatuteEdit, StatuteHistory, ShareholderList, ShareholderForm, MeetingList, MeetingForm, MeetingView
} from '../pages/companies/corporate';
import { AgeList } from '../pages/companies/corporate/atas/age/AgeList';
import { AgeEdit } from '../pages/companies/corporate/atas/age/AgeEdit';
import { AgeView } from '../pages/companies/corporate/atas/age/AgeView';
import { ContratoList, ContratoEdit, ContratoView } from '../pages/companies/corporate/contratos';
import { PersonList } from '../pages/persons/PersonList';
import { PersonForm } from '../pages/persons/PersonForm';
import { PersonView } from '../pages/persons/PersonView';
import { AuditLogs as AuditList } from '../pages/audit/AuditLogs';
import { BackupRestore } from '../pages/system/BackupRestore';
import { TableManager } from '../pages/system/TableManager';
import Accounts from '../pages/accounting/AccountsPage';
import ImportChartOfAccountsPage from '../pages/accounting/ImportChartOfAccountsPage';
import BalancesPage from '../pages/accounting/BalancesPage';
import TrialBalanceView from '../pages/accounting/TrialBalanceView';
import EcdValidationPage from '../pages/accounting/EcdValidationPage';
import EcdPage from '../pages/sped/EcdPage';
import EcdPreValidatePage from '../pages/sped/EcdPreValidatePage';
import EcfPage from '../pages/sped/EcfPage';
import EfdPage from '../pages/sped/EfdPage';
import { EcdViewerPage } from '../pages/sped/EcdViewerPage';
//import { EcdHistoryPage } from '../pages/sped/EcdHistoryPage';
import JournalPage from '../pages/accounting/JournalPage';
import ImportJournalPage from '../pages/accounting/ImportJournalPage';
import AssetsList from '../pages/assets/AssetsList';
import AssetsView from '../pages/assets/AssetsView';
import MaintenancesPage from '../pages/assets/MaintenancesPage';

import { BalanceComparisonPage } from '../pages/reports/BalanceComparisonPage';
import DiarioGeralPage from '../pages/accounting/DiarioGeralPage';
import DrePage from '../pages/accounting/DrePage';
import AgendaPage from '../pages/finance/AgendaPage';
import BalancoPatrimonialPage from '../pages/accounting/BalancoPatrimonialPage';
import RazaoAnaliticoPage from '../pages/accounting/RazaoAnaliticoPage';
import CdbProjecaoPage from '../pages/accounting/investments/CdbProjecaoPage';
import ProLaborePage from '../pages/hr/ProLabore';
import InformeRendimentosPage from '../pages/hr/InformeRendimentosPage';
import { EmployeesPage } from '../pages/hr/EmployeesPage';
import EsocialPage from '../pages/hr/EsocialPage';
import FeriasPage from '../pages/hr/FeriasPage';
import RecessoPage from '../pages/hr/RecessoPage';
import DecimoTerceiroPage from '../pages/hr/DecimoTerceiroPage';
import RaisPage from '../pages/hr/RaisPage';
import DctfWebPage from '../pages/hr/DctfWebPage';
import FolhaPage from '../pages/hr/FolhaPage';
import EmployeeDetailPage from '../pages/hr/EmployeeDetailPage';
import FechamentoPage from '../pages/finance/FechamentoPage';
import ApuracaoImpostosPage from '../pages/finance/ApuracaoImpostosPage';
import LalurConfigPage from '../pages/finance/LalurConfigPage';
import ContasAReceberPage from '../pages/finance/ContasAReceberPage';
import ContasAPagarPage from '../pages/finance/ContasAPagarPage';
import NfseImportPage from '../pages/finance/NfseImportPage';
import NfeImportPage from '../pages/finance/NfeImportPage';
import NfseNacionalPage from '../pages/finance/NfseNacionalPage';
import NfseSpEmissaoPage from '../pages/finance/NfseSpEmissaoPage';
import DocumentosFiscaisPage from '../pages/finance/DocumentosFiscaisPage';
import FluxoCaixaPage from '../pages/finance/FluxoCaixaPage';
import PettyCashPage from '../pages/finance/PettyCashPage';
import RendaFixaPage from '../pages/accounting/investments/RendaFixaPage';
import CdiTabelaPage from '../pages/accounting/investments/CdiTabelaPage';
import { IndicadoresPage } from '../pages/sistema/IndicadoresPage';
import { CalendarioPage } from '../pages/sistema/CalendarioPage';
import { ObrigacoesPage } from '../pages/sistema/ObrigacoesPage';
import { TabelasLegaisPage } from '../pages/sistema/TabelasLegaisPage';
import SidebarPermissionsPage from '../pages/sistema/SidebarPermissionsPage';
import ShareholdersPage from '../pages/corporate/shareholders/ShareholdersPage';
import { RepositorioPage } from '../pages/documentos/RepositorioPage';
import { CertificatesPage } from '../pages/certificates/CertificatesPage';
import VisoesContabeisPage from '../pages/sped/VisoesContabeisPage';


///////////////////////////////////////
const AccessDenied = () => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <span className="text-2xl font-black text-gray-400">!</span>
        </div>
        <h2 className="text-xl font-bold text-gray-700">Acesso Restrito</h2>
        <p className="text-gray-500 mt-2 max-w-md">
            Seu perfil nao tem permissao para acessar esta area. Se voce acredita que isso e um erro, contate o administrador do sistema.
        </p>
    </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    const location = useLocation();
    const { allowed, loading: permLoading, canView } = useSidebarPermissions();
    if (loading) return null; // ou um spinner: <div className="flex items-center justify-center h-screen"><FiLoader className="animate-spin" size={32} /></div>

    if (!user) return <Navigate to="/" replace />;

    if (permLoading) return null;

    const isMaster = allowed.includes('*');
    if (!isMaster && allowed.length > 0 && !canView(location.pathname)) {
        return <AccessDenied />;
    }

    return <>{children}</>;
};

export const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/register" element={<Register />} />
        <Route path="/" element={<Layout />}>
                <Route index element={<LedgrHome />} />
                <Route path="app" element={<Navigate to="/app/dashboard" replace />} />

                {/* Dashboard & Financeiro */}
                <Route path="app/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="app/finance/documentos-fiscais" element={<ProtectedRoute><DocumentosFiscaisPage /></ProtectedRoute>} />
                <Route path="app/finance/nfse-nacional" element={<ProtectedRoute><NfseNacionalPage /></ProtectedRoute>} />
                <Route path="app/finance/nfe" element={<ProtectedRoute><NfeImportPage /></ProtectedRoute>} />
                <Route path="app/finance/nfse-sp-emissao" element={<ProtectedRoute><NfseSpEmissaoPage /></ProtectedRoute>} />
                <Route path="app/finance/nfse-sp" element={<ProtectedRoute><NfseImportPage /></ProtectedRoute>} />
                <Route path="app/finance/" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
                <Route path="app/finance/bank-import" element={<ProtectedRoute><BankImport /></ProtectedRoute>} />

                {/* Contabilidade */}
                <Route path="app/accounting/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
                <Route path="app/accounting/accounts/import" element={<ProtectedRoute><ImportChartOfAccountsPage /></ProtectedRoute>} />
                <Route path="app/accounting/balances" element={<ProtectedRoute><BalancesPage /></ProtectedRoute>} />
                <Route path="app/accounting/trial-balance" element={<ProtectedRoute><TrialBalanceView /></ProtectedRoute>} />
                <Route path="app/accounting/journal" element={<ProtectedRoute><JournalPage /></ProtectedRoute>} />
                <Route path="app/accounting/journal/import" element={<ProtectedRoute><ImportJournalPage /></ProtectedRoute>} />
                <Route path="app/reports/balance-comparison" element={<ProtectedRoute><BalanceComparisonPage /></ProtectedRoute>} />
                <Route path="app/accounting/visoes-contabeis" element={<ProtectedRoute><VisoesContabeisPage /></ProtectedRoute>} />
                <Route path="app/accounting/validate-ecd" element={<ProtectedRoute><EcdValidationPage /></ProtectedRoute>} />
                <Route path="app/accounting/dre" element={<ProtectedRoute><DrePage /></ProtectedRoute>} /><Route path="app/accounting/balanco" element={<ProtectedRoute><BalancoPatrimonialPage /></ProtectedRoute>} />
                <Route path="app/accounting/diario" element={<ProtectedRoute><DiarioGeralPage /></ProtectedRoute>} />
                <Route path="app/accounting/investimentos/cdi" element={<ProtectedRoute><CdiTabelaPage /></ProtectedRoute>} />
                <Route path="app/sistema/indicadores" element={<ProtectedRoute><IndicadoresPage /></ProtectedRoute>} />
                <Route path="app/sistema/calendario" element={<ProtectedRoute><CalendarioPage /></ProtectedRoute>} />
                <Route path="app/sistema/obrigacoes" element={<ProtectedRoute><ObrigacoesPage /></ProtectedRoute>} />
                <Route path="app/sistema/tabelas" element={<ProtectedRoute><TabelasLegaisPage /></ProtectedRoute>} />
                    <Route path="app/sistema/sidebar-permissions" element={<ProtectedRoute><SidebarPermissionsPage /></ProtectedRoute>} />
                <Route path="app/finance/fechamento" element={<ProtectedRoute><FechamentoPage /></ProtectedRoute>} />
                <Route path="app/finance/apuracao" element={<ProtectedRoute><ApuracaoImpostosPage /></ProtectedRoute>} />
                <Route path="app/finance/lalur-config" element={<ProtectedRoute><LalurConfigPage /></ProtectedRoute>} />
                <Route path="app/finance/petty-cash" element={<ProtectedRoute><PettyCashPage /></ProtectedRoute>} />
                <Route path="app/finance/fluxo-caixa" element={<ProtectedRoute><FluxoCaixaPage /></ProtectedRoute>} />
                <Route path="app/finance/accounts-payable" element={<ProtectedRoute><ContasAPagarPage /></ProtectedRoute>} />
                <Route path="app/finance/contas-receber" element={<ProtectedRoute><ContasAReceberPage /></ProtectedRoute>} />
                <Route path="app/finance/agenda" element={<ProtectedRoute><AgendaPage /></ProtectedRoute>} />
                <Route path="app/finance/provisoes" element={<ProtectedRoute><ProvisoesPage /></ProtectedRoute>} />
                <Route path="app/hr/pro-labore" element={<ProtectedRoute><ProLaborePage /></ProtectedRoute>} />
                <Route path="app/hr/informe-rendimentos" element={<ProtectedRoute><InformeRendimentosPage /></ProtectedRoute>} />
                <Route path="app/hr/employees" element={<ProtectedRoute><EmployeesPage /></ProtectedRoute>} />
                <Route path="/app/hr/esocial" element={<ProtectedRoute><EsocialPage /></ProtectedRoute>} />
                <Route path="/app/hr/ferias" element={<ProtectedRoute><FeriasPage /></ProtectedRoute>} />
                <Route path="/app/hr/recesso" element={<ProtectedRoute><RecessoPage /></ProtectedRoute>} />
                <Route path="/app/hr/decimo-terceiro" element={<ProtectedRoute><DecimoTerceiroPage /></ProtectedRoute>} />
                <Route path="/app/hr/rais" element={<ProtectedRoute><RaisPage /></ProtectedRoute>} />
                <Route path="/app/hr/dctfweb" element={<ProtectedRoute><DctfWebPage /></ProtectedRoute>} />
                <Route path="/app/hr/folha" element={<ProtectedRoute><FolhaPage /></ProtectedRoute>} />
                <Route path="/app/hr/employees/:id" element={<ProtectedRoute><EmployeeDetailPage /></ProtectedRoute>} />
                <Route path="app/accounting/razao" element={<ProtectedRoute><RazaoAnaliticoPage /></ProtectedRoute>} />


                {/* SPED */}
                <Route path="app/sped/ecd/pre-validate" element={<ProtectedRoute><EcdPreValidatePage /></ProtectedRoute>} />
                <Route path="app/sped/ecd" element={<ProtectedRoute><EcdPage /></ProtectedRoute>} />
                <Route path="app/sped/ecf" element={<ProtectedRoute><EcfPage /></ProtectedRoute>} />
                <Route path="app/sped/efd" element={<ProtectedRoute><EfdPage /></ProtectedRoute>} />
                <Route path="app/sped/ecd/viewer/:id" element={<ProtectedRoute> <EcdViewerPage /></ProtectedRoute>} />

                {/* Empresas */}
                <Route path="app/companies" element={<ProtectedRoute><CompanyList /></ProtectedRoute>} />
                <Route path="app/companies/new" element={<ProtectedRoute><CompanyForm /></ProtectedRoute>} />
                <Route path="app/companies/show/:id" element={<ProtectedRoute><CompanyShow /></ProtectedRoute>} />
                <Route path="app/companies/edit/:id" element={<ProtectedRoute><CompanyEdit /></ProtectedRoute>} />

                {/* Societário */}
                <Route path="app/companies/corporate/statute/:id" element={<ProtectedRoute><StatuteList /></ProtectedRoute>} />
                <Route path="app/companies/corporate/statute/:id/view/:docId" element={<ProtectedRoute><StatuteView /></ProtectedRoute>} />
                <Route path="app/companies/corporate/statute/:id/edit" element={<ProtectedRoute><StatuteEdit /></ProtectedRoute>} />
                <Route path="app/companies/corporate/statute/:id/history/:docId" element={<ProtectedRoute><StatuteHistory /></ProtectedRoute>} />

                <Route path="app/companies/corporate/atas/age/:id" element={<ProtectedRoute><AgeList /></ProtectedRoute>} />
                <Route path="app/companies/corporate/atas/age/:id/nova" element={<ProtectedRoute><AgeEdit /></ProtectedRoute>} />
                <Route path="app/companies/corporate/atas/age/:id/view/:docId" element={<ProtectedRoute><AgeView /></ProtectedRoute>} />

                <Route path="app/companies/corporate/contratos/:companyId" element={<ProtectedRoute><ContratoList /></ProtectedRoute>} />
                <Route path="app/companies/corporate/contratos/:companyId/new" element={<ProtectedRoute><ContratoEdit /></ProtectedRoute>} />
                <Route path="app/companies/corporate/contratos/:companyId/view/:docId" element={<ProtectedRoute><ContratoView /></ProtectedRoute>} />

                {/* Livros Societários */}
                <Route path="app/societario/livros/acionistas" element={<ProtectedRoute><ShareholdersPage /></ProtectedRoute>} />
                <Route path="app/societario/livros/transferencias" element={<ProtectedRoute><ShareholdersPage initialTab="transferencia" /></ProtectedRoute>} />

                {/* Pessoas e Usuários */}
                <Route path="app/persons" element={<ProtectedRoute><PersonList /></ProtectedRoute>} />
                <Route path="app/persons/new" element={<ProtectedRoute><PersonForm /></ProtectedRoute>} />
                <Route path="app/persons/:personId" element={<ProtectedRoute><PersonForm /></ProtectedRoute>} />
                <Route path="app/persons/:personId/view" element={<ProtectedRoute><PersonView /></ProtectedRoute>} />

                <Route path="app/usuarios/pendentes" element={<ProtectedRoute><PendentesPage /></ProtectedRoute>} />
                <Route path="app/users" element={<ProtectedRoute><UserList /></ProtectedRoute>} />
                <Route path="app/users/edit/:id" element={<UserForm />} />
                <Route path="app/users/new" element={<ProtectedRoute><UserForm /></ProtectedRoute>} />


                <Route path="app/profiles" element={<ProtectedRoute><ProfileList /></ProtectedRoute>} />
                <Route path="app/profiles/edit/:id" element={<ProfileForm />} />
                <Route path="app/profiles/new" element={<ProtectedRoute><ProfileForm /></ProtectedRoute>} />

                {/* Documentos */}
                <Route path="app/documents" element={<ProtectedRoute><DocumentsList /></ProtectedRoute>} />
                <Route path="app/documents/signatures" element={<ProtectedRoute><SignatureList /></ProtectedRoute>} />
                <Route path="app/documents/signatures/certificates" element={<ProtectedRoute><CertificatesPage /></ProtectedRoute>} />
                <Route path="app/documents/signatures/request" element={<ProtectedRoute><SignatureRequest /></ProtectedRoute>} />
                <Route path="app/signatures/validate" element={<ProtectedRoute><SignatureValidatePage /></ProtectedRoute>} />
                {/* Repositório de Documentos */}
                <Route path="app/arquivo/societario" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/societario/contratos" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/societario/atas" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/societario/procuracoes" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/societario/acordos" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/livros" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/livros/acoes" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/livros/transferencias" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/livros/atas-ago" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/livros/atas-age" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/livros/presenca" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/contabil" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/contabil/balancetes" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/contabil/ecd" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/contabil/demonstracoes" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/fiscal" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/fiscal/nf" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/fiscal/ecf" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/fiscal/obrigacoes" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/rh" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/rh/contratos" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/rh/procuracoes" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />
                <Route path="app/arquivo/rh/acordos" element={<ProtectedRoute><RepositorioPage /></ProtectedRoute>} />

                {/* Configurações */}
                <Route path="app/settings/data-management" element={<ProtectedRoute><TableManager /></ProtectedRoute>} />
                <Route path="app/settings/:action/:table" element={<ProtectedRoute><TableManager /></ProtectedRoute>} />
                <Route path="app/settings" element={<ProtectedRoute><div className="p-8 text-center text-gray-500"><h2>Settings</h2><p>Selecione uma opção no menu</p></div></ProtectedRoute>} />

                {/* Sistema */}
                <Route path="app/system/backup" element={<ProtectedRoute><BackupRestore /></ProtectedRoute>} />
                <Route path="app/system/audit" element={<ProtectedRoute><AuditList /></ProtectedRoute>} />

                {/* Ativo Imobilizado */}
                <Route path="app/assets" element={<ProtectedRoute><AssetsList /></ProtectedRoute>} />
                <Route path="app/assets/maintenances" element={<ProtectedRoute><MaintenancesPage /></ProtectedRoute>} />
                <Route path="app/assets/:id" element={<ProtectedRoute><AssetsView /></ProtectedRoute>} />

                {/* Módulos em desenvolvimento */}
                <Route path="app/tax" element={<ProtectedRoute><div className="p-8 text-center text-gray-500"><h2>Tax Module</h2><p>Em desenvolvimento</p></div></ProtectedRoute>} />
                <Route path="app/audit" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
                <Route path="app/administracao/auditoria" element={<ProtectedRoute><AuditPage /></ProtectedRoute>} />
                <Route path="app/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
};















