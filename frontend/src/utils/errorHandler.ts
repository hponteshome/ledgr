// src/utils/errorHandler.ts
interface ErrorResponse {
  message: string;
  error?: string;
  statusCode?: number;
  details?: any;
}

export const handleApiError = (error: any): ErrorResponse => {
  // Erro de rede / conexão
  if (!error.response) {
    return {
      message: 'Erro de conexão. Verifique sua internet.',
      error: 'NETWORK_ERROR',
      statusCode: 0
    };
  }

  const { status, data } = error.response;

  // Erros específicos por status
  switch (status) {
    case 400:
      return {
        message: data?.message || 'Requisição inválida. Verifique os dados enviados.',
        error: 'BAD_REQUEST',
        statusCode: 400,
        details: data
      };
      
    case 401:
      return {
        message: 'Sua sessão expirou. Faça login novamente.',
        error: 'UNAUTHORIZED',
        statusCode: 401
      };
      
    case 403:
      // Mensagens específicas para 403
      if (data?.message?.includes('x-company-id')) {
        return {
          message: 'Erro de autenticação: Company ID não encontrado. Tente fazer login novamente.',
          error: 'MISSING_COMPANY_ID',
          statusCode: 403
        };
      }
      if (data?.message?.includes('permission') || data?.message?.includes('permissão')) {
        return {
          message: 'Você não tem permissão para realizar esta ação.',
          error: 'FORBIDDEN',
          statusCode: 403,
          details: 'Seu perfil não possui as permissões necessárias.'
        };
      }
      return {
        message: data?.message || 'Acesso negado.',
        error: 'FORBIDDEN',
        statusCode: 403
      };
      
    case 404:
      return {
        message: 'Recurso não encontrado.',
        error: 'NOT_FOUND',
        statusCode: 404
      };
      
    case 422:
      return {
        message: 'Dados inválidos. Verifique as informações enviadas.',
        error: 'VALIDATION_ERROR',
        statusCode: 422,
        details: data?.details
      };
      
    case 500:
      return {
        message: 'Erro interno do servidor. Tente novamente mais tarde.',
        error: 'SERVER_ERROR',
        statusCode: 500
      };
      
    default:
      return {
        message: data?.message || 'Ocorreu um erro inesperado.',
        error: 'UNKNOWN_ERROR',
        statusCode: status
      };
  }
};