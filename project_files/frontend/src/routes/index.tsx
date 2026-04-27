import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { LedgrHome } from '../pages/LedgrHome';
import { Dashboard } from '../pages/Dashboard';
import { CompanyList } from '../pages/companies/CompanyList';
import { UserList } from '../pages/users/UserList';
import { UserForm } from '../pages/users/UserForm';

export const AppRoutes = () => {
    return (
        <Routes>
            {/* Routes with Layout */}
            <Route path="/" element={<Layout />}>
                {/* Landing Page */}
                <Route index element={<LedgrHome />} />

                {/* NESTED /app/* Routes */}
                <Route path="app">
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />

                    {/* Company Routes */}
                    <Route path="companies" element={<CompanyList />} />

                    {/* User Routes */}
                    <Route path="users" element={<UserList />} />
                    <Route path="users/new" element={<UserForm />} />
                    <Route path="users/edit/:id" element={<UserForm />} />

                    {/* Placeholder Modules */}
                    <Route path="financial" element={<div className="p-8 text-gray-500">Financial Module under development</div>} />
                    <Route path="tax" element={<div className="p-8 text-gray-500">Tax Module under development</div>} />
                    <Route path="accounting" element={<div className="p-8 text-gray-500">Accounting Module under development</div>} />
                    <Route path="audit" element={<div className="p-8 text-gray-500">Audit Module under development</div>} />
                    <Route path="settings" element={<div className="p-8 text-gray-500">Settings Module under development</div>} />
                    <Route path="profile" element={<div className="p-8 text-gray-500">Profile Page under development</div>} />
                </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};