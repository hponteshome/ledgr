import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import api from '../../services/api';

export const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/auth/forgot-password', { email });
            setSuccess(true);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao solicitar recuperação de senha');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full">
                <Link to="/login" className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 mb-8 transition-colors">
                    <FiArrowLeft className="mr-2" /> Voltar para Login
                </Link>

                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                        <h1 className="text-3xl font-bold text-white">Recuperar Senha</h1>
                        <p className="text-blue-100 mt-1">Receba um link de recuperação no seu email</p>
                    </div>

                    <div className="px-8 py-8">
                        {success ? (
                            <div className="text-center">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <FiCheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Email enviado!</h2>
                                <p className="text-gray-600 mb-6">
                                    Enviamos um link de recuperação para <strong className="text-gray-800">{email}</strong>
                                </p>
                                <p className="text-sm text-gray-500">
                                    Verifique sua caixa de entrada e spam. O link expira em 1 hora.
                                </p>
                                <Link
                                    to="/login"
                                    className="inline-block mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Voltar para Login
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center gap-2">
                                        <FiAlertCircle />
                                        <span className="text-sm">{error}</span>
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email cadastrado
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <FiMail className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            id="email"
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="seu@email.com"
                                        />
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500">
                                        Enviaremos um link para você redefinir sua senha.
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                >
                                    {loading ? <LoadingSpinner size="sm" color="white" /> : 'Enviar link de recuperação'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};