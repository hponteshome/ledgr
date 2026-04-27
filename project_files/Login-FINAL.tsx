import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    senha: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); // Limpa erro ao digitar
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔐 Tentando fazer login com:', formData.email);
      
      // Usa a função signIn do AuthContext (que já funciona!)
      await signIn(formData.email, formData.senha);
      
      console.log('✅ Login bem-sucedido!');
      console.log('Token salvo:', localStorage.getItem('@ledgr:token') ? 'SIM' : 'NÃO');
      console.log('User salvo:', localStorage.getItem('@ledgr:user') ? 'SIM' : 'NÃO');
      
      // Redireciona para o dashboard
      navigate('/app/dashboard');
      
    } catch (err: any) {
      console.error('❌ Erro no login:', err);
      
      if (err.response?.status === 401) {
        setError('Email ou senha incorretos');
      } else if (err.response?.status === 404) {
        setError('Usuário não encontrado');
      } else if (err.message?.includes('Network')) {
        setError('Erro de conexão. Verifique se o backend está rodando.');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* LOGO */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-blue-600 mb-2">LEDGR</h1>
          <p className="text-gray-600">Sistema de Gestão Empresarial</p>
        </div>

        {/* CARD DE LOGIN */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Bem-vindo de volta!</h2>
          <p className="text-gray-500 mb-6">Faça login para continuar</p>

          {/* ERRO */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <FiAlertCircle className="flex-shrink-0" size={20} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* FORMULÁRIO */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* EMAIL */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* SENHA */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="senha"
                  value={formData.senha}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {/* LEMBRAR / ESQUECI SENHA */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                Lembrar-me
              </label>
              <Link to="/esqueci-senha" className="text-blue-600 hover:text-blue-700 font-semibold">
                Esqueci minha senha
              </Link>
            </div>

            {/* BOTÃO ENTRAR */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* REGISTRO */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Não tem uma conta?{' '}
            <Link to="/registro" className="text-blue-600 hover:text-blue-700 font-semibold">
              Criar conta
            </Link>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>© 2024 LEDGR. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
};
