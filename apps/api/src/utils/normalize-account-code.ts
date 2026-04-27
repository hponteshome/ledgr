/**  ////   apps/api/src/utils/normalize-account-code.ts
 * Utilitário para normalizar códigos de contas contábeis
 * Mantém o formato original se já tiver pontos, caso contrário converte
 * Exemplos:
 *   "1.1.1"     → "1.1.1"     (já normalizado)
 *   "111"       → "1.1.1"
 *   "11101"     → "1.1.1.01"
 *   "11101001"  → "1.1.1.01.001"
 */
export function normalizeAccountCode(code: string): string {
  // Se já tem pontos, assume que está correto e retorna
  if (code.includes('.')) {
    return code;
  }

  // Remove qualquer caractere não numérico
  const digits = code.replace(/\D/g, '');
  
  if (digits.length === 0) return code;

  // Constrói o código com pontos baseado na estrutura típica do plano de contas
  const parts: string[] = [];
  
  // Nível 1: 1 dígito
  if (digits.length >= 1) {
    parts.push(digits.substring(0, 1));
  }
  
  // Nível 2: 1 dígito
  if (digits.length >= 2) {
    parts.push(digits.substring(1, 2));
  } else {
    return parts.join('.');
  }
  
  // Nível 3: 1 dígito
  if (digits.length >= 3) {
    parts.push(digits.substring(2, 3));
  } else {
    return parts.join('.');
  }
  
  // Nível 4: 2 dígitos (a partir da posição 3)
  if (digits.length >= 5) {
    parts.push(digits.substring(3, 5));
  } else if (digits.length > 3) {
    parts.push(digits.substring(3));
    return parts.join('.');
  } else {
    return parts.join('.');
  }
  
  // Nível 5: 2 dígitos (a partir da posição 5)
  if (digits.length >= 7) {
    parts.push(digits.substring(5, 7));
  } else if (digits.length > 5) {
    parts.push(digits.substring(5));
    return parts.join('.');
  } else {
    return parts.join('.');
  }
  
  // Nível 6: 2 dígitos (a partir da posição 7)
  if (digits.length >= 9) {
    parts.push(digits.substring(7, 9));
  } else if (digits.length > 7) {
    parts.push(digits.substring(7));
  }
  
  return parts.join('.');
}

/**
 * Função para logging/debug - mostra a transformação
 */
export function debugNormalize(original: string, normalized: string): void {
  if (original !== normalized) {
    console.log(`📊 Código normalizado: "${original}" → "${normalized}"`);
  }
}