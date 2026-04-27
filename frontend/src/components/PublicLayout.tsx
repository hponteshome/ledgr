import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { FiGithub, FiLinkedin, FiMail } from 'react-icons/fi';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex flex-col">
      {/* Header público */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-600">Ledgr</span>
              <span className="text-sm text-gray-500 hidden sm:inline">| Gestão Empresarial</span>
            </Link>

            {/* Links de navegação pública */}
            <nav className="flex items-center gap-4">
              <Link to="/sobre" className="text-gray-600 hover:text-blue-600 transition-colors">
                Sobre
              </Link>
              <Link to="/precos" className="text-gray-600 hover:text-blue-600 transition-colors">
                Preços
              </Link>
              <Link to="/contato" className="text-gray-600 hover:text-blue-600 transition-colors">
                Contato
              </Link>
              <Link
                to="/login"
                className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Entrar
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Conteúdo principal (onde vai o Login) */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer público */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Ledgr</h3>
              <p className="text-sm text-gray-500">
                Plataforma completa de gestão empresarial para pequenas e médias empresas.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/funcionalidades" className="hover:text-blue-600">Funcionalidades</Link></li>
                <li><Link to="/precos" className="hover:text-blue-600">Preços</Link></li>
                <li><Link to="/faq" className="hover:text-blue-600">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/contato" className="hover:text-blue-600">Contato</Link></li>
                <li><Link to="/ajuda" className="hover:text-blue-600">Ajuda</Link></li>
                <li><Link to="/termos" className="hover:text-blue-600">Termos de Uso</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-4">Redes Sociais</h4>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <FiGithub size={20} />
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <FiLinkedin size={20} />
                </a>
                <a href="#" className="text-gray-400 hover:text-blue-600 transition-colors">
                  <FiMail size={20} />
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 mt-8 pt-8 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} Ledgr. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};
