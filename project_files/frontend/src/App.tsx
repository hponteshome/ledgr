import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { AppRoutes } from './routes';

function App() {
    return (
        <BrowserRouter>

            <AuthProvider>
                <CompanyProvider>
                    <AppRoutes />
                </CompanyProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;