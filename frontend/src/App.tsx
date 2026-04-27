import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { AppRoutes } from './routes';
import { AnimatePresence } from 'framer-motion'; // Importação necessária

function App() {
    return (
        <BrowserRouter >
            <AuthProvider>
                <CompanyProvider>
                    {/* AnimatePresence permite que componentes filhos 
                        animem quando são removidos da árvore (ex: fechar submenu) */}
                    <AnimatePresence mode="wait">
                        <AppRoutes />
                    </AnimatePresence>
                </CompanyProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;