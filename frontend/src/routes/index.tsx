// src/routes/AppRoutes.tsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LedgrHome } from '../pages/LedgrHome';
import { Dashboard } from '../pages/Dashboard';
import FinancePage from '../pages/finance/FinancePage';
import BankImport from '../pages/finance/BankImportPage';
import { CompanyList } from '../pages/companies/CompanyList';
import { CompanyForm } from '../pages/companies/CompanyForm';
import { UserList } from '../pages/users/UserList';
import { UserForm } from '../pages/users/UserForm';
import { ProfileForm } from '../pages/users/ProfileForm';
import { useAuth } from '../contexts/AuthContext';
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
import BalancesPage from '../pages/accounting/BalancesPage';
import TrialBalanceView from '../pages/accounting/TrialBalanceView';
import EcdValidationPage from '../pages/accounting/EcdValidationPage';
import EcdPage from '../pages/sped/EcdPage';
import EcfPage from '../pages/sped/EcfPage';
import { EcdViewerPage } from '../pages/sped/EcdViewerPage';
//import { EcdHistoryPage } from '../pages/sped/EcdHistoryPage';
import JournalPage from '../pages/accounting/JournalPage';
import AssetsList from '../pages/assets/AssetsList';
import AssetsView from '../pages/assets/AssetsView';
import MaintenancesPage from '../pages/assets/MaintenancesPage';

import { BalanceComparisonPage } from '../pages/reports/BalanceComparisonPage';
import DiarioGeralPage from '../pages/accounting/DiarioGeralPage';
import RazaoAnaliticoPage from '../pages/accounting/RazaoAnaliticoPage';
import ShareholdersPage from '../pages/corporate/shareholders/ShareholdersPage';
import { RepositorioPage } from '../pages/documentos/RepositorioPage';


///////////////////////////////////////
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useAuth();
    if (loading) return null; // ou um spinner: <div className="flex items-center justify-center h-screen"><FiLoader className="animate-spin" size={32} /></div>

    if (!user) return <Navigate to="/" replace />;
    return <>{children}</>;
};

export const AppRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<Layout />}>
                <Route index element={<LedgrHome />} />
                <Route path="app" element={<Navigate to="/app/dashboard" replace />} />

                {/* Dashboard & Financeiro */}
                <Route path="app/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="app/finance/" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
                <Route path="app/finance/bank-import" element={<ProtectedRoute><BankImport /></ProtectedRoute>} />

                {/* Contabilidade */}
                <Route path="app/accounting/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
                <Route path="app/accounting/balances" element={<ProtectedRoute><BalancesPage /></ProtectedRoute>} />
                <Route path="app/accounting/trial-balance" element={<ProtectedRoute><TrialBalanceView /></ProtectedRoute>} />
                <Route path="app/accounting/journal" element={<ProtectedRoute><JournalPage /></ProtectedRoute>} />
                <Route path="app/reports/balance-comparison" element={<ProtectedRoute><BalanceComparisonPage /></ProtectedRoute>} />
                <Route path="app/accounting/validate-ecd" element={<ProtectedRoute><EcdValidationPage /></ProtectedRoute>} />
                <Route path="app/accounting/diario" element={<ProtectedRoute><DiarioGeralPage /></ProtectedRoute>} />
                <Route path="app/accounting/razao" element={<ProtectedRoute><RazaoAnaliticoPage /></ProtectedRoute>} />

                {/* SPED */}
                <Route path="app/sped/ecd" element={<ProtectedRoute><EcdPage /></ProtectedRoute>} />
                <Route path="app/sped/ecf" element={<ProtectedRoute><EcfPage /></ProtectedRoute>} />
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

                <Route path="app/users" element={<ProtectedRoute><UserList /></ProtectedRoute>} />
                <Route path="app/users/edit/:id" element={<UserForm />} />
                <Route path="app/users/new" element={<ProtectedRoute><UserForm /></ProtectedRoute>} />


                <Route path="app/profiles" element={<ProtectedRoute><ProfileList /></ProtectedRoute>} />
                <Route path="app/profiles/edit/:id" element={<ProfileForm />} />
                <Route path="app/profiles/new" element={<ProtectedRoute><ProfileForm /></ProtectedRoute>} />

                {/* Documentos */}
                <Route path="app/documents" element={<ProtectedRoute><DocumentsList /></ProtectedRoute>} />
                <Route path="app/documents/signatures" element={<ProtectedRoute><SignatureList /></ProtectedRoute>} />
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
                <Route path="app/audit" element={<ProtectedRoute><div className="p-8 text-center text-gray-500"><h2>Audit Module</h2><p>Em desenvolvimento</p></div></ProtectedRoute>} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
};




