import { Routes, Route, Navigate } from 'react-router-dom';
// import { Layout } from '../components/Layout';
// import { ProtectedRoute } from '../components/ProtectedRoute';
// import { HomeRoute } from '../components/HomeRoute';

// ===== PÁGINAS PÚBLICAS (COMENTADAS TEMPORARIAMENTE) =====
// import { Login } from '../pages/auth/Login';
// import { Registro } from '../pages/registro/Registro';
// import { ForgotPassword } from '../pages/forgot-password/ForgotPassword';
// import { ResetPassword } from '../pages/reset-password/ResetPassword';

// ===== PÁGINAS PRIVADAS =====
import { Dashboard } from '../pages/Dashboard';
// import { EmpresaLista } from '../pages/empresas/EmpresaLista';
// import { EmpresaForm } from '../pages/empresas/EmpresaForm';
// import { UsuarioLista } from '../pages/UsuarioLista';
// import { Auditoria } from '../pages/Auditoria';

export const AppRoutes = () => {
    return (
        <Routes>
            {/* ===== MODO MOCK - DASHBOARD DIRETO (SEM AUTENTICAÇÃO) ===== */}
            <Route path="/" element={<Dashboard />} />
            <Route path="*" element={<Dashboard />} />

            {/* ============================================ */}
            {/* CÓDIGO ORIGINAL COMENTADO - ATIVAR DEPOIS   */}
            {/* ============================================ */}

            {/* ===== ROTAS PÚBLICAS ===== */}
            {/* <Route path="/" element={<Dashboard />} /> */}
            {/* <Route path="/login" element={<Login />} /> */}
            {/* <Route path="/registro" element={<Registro />} /> */}
            {/* <Route path="/esqueci-senha" element={<ForgotPassword />} /> */}
            {/* <Route path="/resetar-senha" element={<ResetPassword />} /> */}

            {/* ===== ROTAS PROTEGIDAS ===== */}
            {/* <Route
                path="/app"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                {/* Empresas */}
                {/* <Route path="empresas" element={<EmpresaLista />} /> */}
                {/* <Route path="empresas/nova" element={<EmpresaForm />} /> */}
                {/* <Route path="empresas/:id" element={<EmpresaForm />} /> */}
                {/* <Route path="empresas/:id/editar" element={<EmpresaForm />} /> */}

                {/* Usuários */}
                {/* <Route path="usuarios" element={<UsuarioLista />} /> */}
                {/* <Route path="usuarios/novo" element={<div>Novo Usuário</div>} /> */}
                {/* <Route path="usuarios/:id" element={<div>Detalhes do Usuário</div>} /> */}

                {/* Outros Módulos */}
                {/* <Route path="financeiro" element={<div>Financeiro</div>} /> */}
                {/* <Route path="fiscal" element={<div>Fiscal</div>} /> */}
                {/* <Route path="auditoria" element={<Auditoria />} /> */}
                {/* <Route path="configuracoes" element={<div>Configurações</div>} /> */}
            {/* </Route> */}

            {/* 404 */}
            {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
        </Routes>
    );
};
