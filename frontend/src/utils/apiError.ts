// Extrai a mensagem de erro da API, inclusive quando a requisicao usa responseType 'blob' (downloads de
// arquivos SPED): nesse caso o corpo do erro chega como Blob e precisa ser lido e convertido de JSON.
export async function apiErrorMessage(e: any, fallback?: string): Promise<string> {
  let data: any = e?.response?.data;
  try {
    if (typeof Blob !== 'undefined' && data instanceof Blob) data = await data.text();
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { /* texto puro */ } }
  } catch { /* mantem o que houver */ }
  const m = data?.message ?? (typeof data === 'string' && data.trim() ? data : undefined);
  if (Array.isArray(m)) return m.join('\n');
  return m || fallback || e?.message || 'Erro desconhecido';
}
