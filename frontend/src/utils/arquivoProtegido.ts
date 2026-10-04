// frontend/src/utils/arquivoProtegido.ts
// Seguranca 0A (04/10/2026): arquivos de /uploads (exceto logotipos) so sao entregues com login e vinculo com a
// empresa dona. window.open e <iframe src> nao enviam o token, entao o arquivo e baixado por fetch com o token e
// aberto como blob.
import api from '../services/api';

const API = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

export async function obterArquivoProtegido(url: string): Promise<string> {
  const alvo = /^https?:/i.test(url) ? url : API + url;
  await api.get('/users/me').catch(() => undefined); // renova o token se expirou (o fetch nao passa pelo interceptor)
  const res = await fetch(alvo, { headers: { Authorization: 'Bearer ' + (localStorage.getItem('@ledgr:token') || '') } });
  if (!res.ok) throw new Error(res.status === 404 ? 'Arquivo não encontrado ou sem acesso.' : 'Falha ao abrir o arquivo.');
  return URL.createObjectURL(await res.blob());
}

export async function abrirArquivoProtegido(url: string): Promise<void> {
  const janela = window.open('', '_blank'); // abre antes da requisicao (evita o bloqueio de pop-up)
  try {
    const blobUrl = await obterArquivoProtegido(url);
    if (janela) janela.location.href = blobUrl;
    else window.open(blobUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  } catch (e: any) {
    if (janela) janela.close();
    alert(e?.message || 'Falha ao abrir o arquivo.');
  }
}
