import React, { useState } from 'react';
import { mapRFBData, logUnmappedFields } from '../utils/rfbMapper';

interface SearchRFBButtonProps {
  cnpj: string;
  onDadosRecebidos: (dados: any) => void;
  className?: string;  // ← ADICIONE ESTA LINHA
}

const SearchRFBButton: React.FC<SearchRFBButtonProps> = ({
  cnpj,
  onDadosRecebidos,
  className = '' }) => {
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
      const companyId = localStorage.getItem('@ledgr:companyId'); // ← PEGA O COMPANY ID

      console.log(`🔍 [SearchRFB] Requesting data for: ${cleanCNPJ}`);
      console.log(`🔑 [SearchRFB] Token: ${token ? 'Presente' : 'Ausente'}`);
      console.log(`🏢 [SearchRFB] Company ID: ${companyId}`);

      // Chamada para a API na porta 3000 com headers completos
      const response = await fetch(`http://localhost:3000/rfb/consulta/${cleanCNPJ}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-company-id': companyId || '', // ← ADICIONA O HEADER OBRIGATÓRIO
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Tenta obter detalhes do erro
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = JSON.stringify(errorData);
        } catch {
          errorDetails = await response.text();
        }

        console.error('❌ [SearchRFB] Error details:', {
          status: response.status,
          statusText: response.statusText,
          details: errorDetails
        });

        if (response.status === 429) throw new Error('429');
        throw new Error(`HTTP Error: ${response.status} - ${errorDetails}`);
      }

      const result = await response.json();
      console.log('📦 [SearchRFB] Raw payload received:', JSON.stringify(result, null, 2));

      // Loga campos não mapeados para referência futura
      logUnmappedFields(result);

      // Mapeia TODOS os dados recebidos
      const mappedData = mapRFBData(result);
      console.log('📋 [SearchRFB] Mapped data:', JSON.stringify(mappedData, null, 2));

      // Suporta tanto o envelope {success: true, data: {}} quanto o objeto direto
      if (result.success || result.cnpj || result.razaoSocial) {
        const finalData = result.data || result;

        // Combina TODOS os dados disponíveis
        const combinedData = {
          ...finalData,           // Dados originais
          ...mappedData,          // Dados mapeados com campos extras
          rfb_raw: result,        // Payload bruto completo
          rfb_timestamp: new Date().toISOString(), // Timestamp da consulta
          rfb_source: 'Receita Federal' // Fonte dos dados
        };

        console.log('🎯 [SearchRFB] Combined data being sent to form:', Object.keys(combinedData));

        // Envia os dados completos para o formulário
        onDadosRecebidos(combinedData);
        setError('');
      } else {
        setError('Empresa não encontrada na base da Receita Federal.');
      }
    } catch (err: any) {
      console.error('❌ [SearchRFB] Critical Error:', {
        name: err.name,
        message: err.message,
        stack: err.stack
      });

      if (err.message === '429' || err.message?.includes('429')) {
        setError('⚠️ Limite de consultas atingido! Aguarde alguns minutos antes de tentar novamente.');
      } else if (err.message?.includes('400')) {
        setError('❌ Requisição inválida. Verifique o CNPJ e tente novamente.');
      } else if (err.message?.includes('401')) {
        setError('🔒 Sessão expirada. Faça login novamente.');
      } else if (err.message?.includes('404')) {
        setError('🔍 Endpoint não encontrado. Contate o suporte.');
      } else {
        setError('Falha na comunicação com o serviço RFB. Tente novamente mais tarde.');
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
              ${className}  // ← APLIQUE A CLASSE AQUI
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
              <span>Consultar RFB</span>
            </>
          )}
        </button>

        {isSearching && (
          <span className="text-xs text-blue-500 animate-pulse font-medium">
            Obtendo dados da Receita Federal...
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