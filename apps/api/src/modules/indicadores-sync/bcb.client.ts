// apps/api/src/modules/indicadores-sync/bcb.client.ts
// CRIADO 23/11/2026 (IND-AUTO-01): cliente do SGS (Banco Central). O servidor do BCB e lento e instavel:
// IPv4 forcado (o IPv6 nao responde nesta rede), prazo de 60s, 3 tentativas com espera crescente,
// sem cache (o SGS chegou a devolver 304). 404 = nenhum dado no periodo.
import axios from 'axios';
import * as https from 'https';

export interface PontoSgs { data: string; valor: string }

const agente = new https.Agent({ family: 4, keepAlive: true });
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));
const br = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;

export async function buscarSerieSgs(codigo: number, de: Date, ate: Date): Promise<PontoSgs[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${br(de)}&dataFinal=${br(ate)}`;
  let ultimoErro = '';
  for (let t = 1; t <= 3; t++) {
    try {
      const r = await axios.get(url, {
        httpsAgent: agente, timeout: 60000, validateStatus: s => s === 200 || s === 404,
        headers: { 'User-Agent': 'Mozilla/5.0 (LEDGR)', Accept: 'application/json', 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (r.status === 404) return [];
      if (!Array.isArray(r.data)) throw new Error('resposta inesperada do SGS');
      return r.data as PontoSgs[];
    } catch (e: any) {
      ultimoErro = e?.response?.status ? `HTTP ${e.response.status}` : `${e?.code ?? ''} ${e?.message ?? e}`.trim();
      if (t < 3) await espera(3000 * t);
    }
  }
  throw new Error(`SGS ${codigo}: ${ultimoErro} (3 tentativas)`);
}
