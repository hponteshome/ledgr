import React, { useState } from 'react';

interface SearchRFBButtonProps {
  cnpj: string;
  onDadosRecebidos: (dados: any) => void;
}

const SearchRFBButton: React.FC<SearchRFBButtonProps> = ({ cnpj, onDadosRecebidos }) => {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Lógica de validação técnica
  const validateCNPJ = (cnpj: string): boolean => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    return cleanCNPJ.length === 14;
  };

  const formatToRaw = (cnpj: string): string => {
    return cnpj.replace(/\D/g, '');
  };

  const handleSearch = async () => {
    // Validação inicial
    if (!validateCNPJ(cnpj)) {
      setError('CNPJ inválido! Digite os 14 números.');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const cleanCNPJ = formatToRaw(cnpj);
      const token = localStorage.getItem('@ledgr:token');

      console.log(`🔍 [SearchRFB] Requesting data for: ${cleanCNPJ}`);

      // Chamada centralizada no seu API Gateway / Backend (Porta 4001)
      const response = await fetch(`http://localhost:4001/api/v1/rfb/consulta/${cleanCNPJ}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error('429'); // Too Many Requests
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const result = await response.json();

      console.log('📦 [SearchRFB] Payload received:', result);

      // Suporta tanto o envelope {success: true, data: {}} quanto o objeto direto
      if (result.success || result.cnpj || result.razaoSocial) {
        const finalData = result.data || result;
        onDadosRecebidos(finalData);
        setError('');
      } else {
        setError('Empresa não encontrada na base da Receita Federal.');
      }
    } catch (err: any) {
      console.error('❌ [SearchRFB] Critical Error:', err);

      if (err.message === '429' || err.message?.includes('429')) {
        setError('⚠️ Limite atingido! Aguarde alguns minutos antes de tentar novamente.');
      } else {
        setError('Falha na comunicação com o serviço RFB.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching}
          className={`
            px-4 py-2 rounded-lg font-medium text-white
            transition-all duration-200 flex items-center gap-2 shadow-sm
            ${isSearching
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
            }
          `}
        >
          {isSearching ? (
            <>
              <span className="animate-spin text-lg">⏳</span>
              <span>Buscando...</span>
            </>
          ) : (
            <>
              <span className="text-lg">🔍</span>
              <span>Search RFB</span>
            </>
          )}
        </button>

        {isSearching && (
          <span className="text-xs text-blue-500 animate-pulse font-medium">
            Sincronizando com a base do Governo...
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-md p-2 mt-1 flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}
    </div>
  );
};

export default SearchRFBButton;