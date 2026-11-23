/**  ////   apps/api/src/utils/normalize-account-code.ts
 * CODPURO-02 (23/11/2026): codigo de conta contabil e SEMPRE puro (sem mascara).
 * Antes esta funcao fazia o contrario (inseria pontos: "11101" -> "1.1.1.01") e foi a causa
 * dos planos com ponto da Jose Silva e da Kipstone (corrigidos no CODPURO-01).
 * Agora remove a mascara: "1.1.1.01" -> "11101"; "11101" -> "11101".
 * A mascara e aplicada so na exibicao/digitacao (formatCodeWithMask, em accounting-mask.service).
 * O banco recusa codigo com separador de mascara (CHECK chart_of_accounts_code_puro_chk).
 */
export function normalizeAccountCode(code: string): string {
  return String(code ?? '').replace(/[.\-\/\s]/g, '');
}

/**
 * Funcao para logging/debug - mostra a transformacao
 */
export function debugNormalize(original: string, normalized: string): void {
  if (original !== normalized) {
    console.log(`Codigo normalizado: "${original}" -> "${normalized}"`);
  }
}
