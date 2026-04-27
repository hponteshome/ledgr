import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { EmpresaProvider } from './contexts/EmpresaContext';
import { AppRoutes } from './routes';
import './index.css';

const App: React.FC = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <EmpresaProvider>
                    <AppRoutes />
                </EmpresaProvider>
            </AuthProvider>
        </BrowserRouter>
    );
};

export default App;
