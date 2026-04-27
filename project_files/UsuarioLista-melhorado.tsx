import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { 
  FiUserPlus, 
  FiEdit2, 
  FiTrash2, 
  FiUser,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiMail,
  FiPhone,
  FiShield
} from 'react-icons/fi';

interface Usuario {
  id: string;
  nomeCompleto: string;
  email: string;
  perfil: string;
  telefone?: string;
  criadoEm: string;
  profile?: {
    id: string;
    nome?: string;
  };
}

export const UsuarioLista: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await api.get('/usuarios');
      setUsuarios(response.data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      alert('Erro ao carregar usuários. Verifique a conexão com o backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja realmente excluir o usuário "${nome}"?`)) return;

    try {
      await api.delete(`/usuarios/${id}`);
      alert('✅ Usuário excluído com sucesso!');
      carregarUsuarios();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('❌ Erro ao excluir usuário.');
    }
  };

  const getPerfilInfo = (usuario: Usuario) => {
    const isAdmin = usuario.profile?.id !== undefined;
    return {
      nome: isAdmin ? 'Administrador' : 'Usuário Comum',
      badge: isAdmin ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600',
      icon: isAdmin ? FiShield : FiUser
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const usuariosFiltrados = usuarios.filter(usuario => {
    const matchSearch = 
      usuario.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchPerfil = !filtroPerfil || 
      (filtroPerfil === 'admin' && usuario.profile?.id) ||
      (filtroPerfil === 'comum' && !usuario.profile?.id);
    
    return matchSearch && matchPerfil;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* HEADER COM TÍTULO E AÇÕES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Usuários</h1>
          <p className="text-gray-500">
            {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? 'usuário encontrado' : 'usuários encontrados'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={carregarUsuarios}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 transition-colors"
          >
            <FiRefreshCw size={18} />
            Atualizar
          </button>
          <Link
            to="/registro"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-md shadow-blue-200"
          >
            <FiUserPlus size={18} />
            Novo Usuário
          </Link>
        </div>
      </div>

      {/* BARRA DE BUSCA E FILTROS */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          
          {/* Campo de Busca */}
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por Perfil */}
          <div className="relative sm:w-64">
            <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={filtroPerfil}
              onChange={(e) => setFiltroPerfil(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Todos os Perfis</option>
              <option value="admin">Administradores</option>
              <option value="comum">Usuários Comuns</option>
            </select>
          </div>
        </div>
      </div>

      {/* ESTATÍSTICAS RÁPIDAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <FiUser size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total de Usuários</p>
              <p className="text-2xl font-bold text-gray-800">{usuarios.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center">
              <FiShield size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Administradores</p>
              <p className="text-2xl font-bold text-gray-800">
                {usuarios.filter(u => u.profile?.id).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <FiUserPlus size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Usuários Comuns</p>
              <p className="text-2xl font-bold text-gray-800">
                {usuarios.filter(u => !u.profile?.id).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LISTA DE USUÁRIOS */}
      {usuariosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiUser className="text-gray-400 text-3xl" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            {searchTerm || filtroPerfil ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filtroPerfil 
              ? 'Tente ajustar os filtros de busca'
              : 'Comece cadastrando o primeiro usuário'
            }
          </p>
          {!searchTerm && !filtroPerfil && (
            <Link
              to="/registro"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FiUserPlus /> Cadastrar Primeiro Usuário
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Perfil
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cadastro
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {usuariosFiltrados.map((usuario) => {
                  const perfilInfo = getPerfilInfo(usuario);
                  const PerfilIcon = perfilInfo.icon;

                  return (
                    <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                      
                      {/* USUÁRIO */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg">
                            {usuario.nomeCompleto.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-800">
                              {usuario.nomeCompleto}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CONTATO */}
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <FiMail size={14} className="text-gray-400" />
                            {usuario.email}
                          </div>
                          {usuario.telefone && (
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <FiPhone size={14} className="text-gray-400" />
                              {usuario.telefone}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* PERFIL */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${perfilInfo.badge}`}>
                          <PerfilIcon size={14} />
                          {perfilInfo.nome}
                        </span>
                      </td>

                      {/* DATA DE CADASTRO */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {formatDate(usuario.criadoEm)}
                        </span>
                      </td>

                      {/* AÇÕES */}
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <FiEdit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(usuario.id, usuario.nomeCompleto)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FOOTER DA TABELA */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Mostrando <span className="font-semibold">{usuariosFiltrados.length}</span> {usuariosFiltrados.length === 1 ? 'usuário' : 'usuários'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
