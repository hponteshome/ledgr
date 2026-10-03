// frontend/src/pages/projects/workspace/projetoTema.ts
// D8 (03/10/2026): identidade visual, tipos e formatadores do espaco do projeto.
import type { CSSProperties } from 'react';

export const PROJ = '#134E4A';
export const PROJ_ACCENT = '#0F766E';
export const PROJ_LIGHT = '#F0FDFA';

export interface Operacao { id: string; codigo: string; nome: string; tipo: string; status: string; dataBase: string | null; valorControle: string | null; }
export interface Projeto { id: string; codigo: string; nome: string; descricao?: string | null; status: string; operacoes: Operacao[]; }
export interface Credito {
  id: string; numeroOrdem: number | null; dataCredito: string; valor: string; remetenteNomeExtrato: string | null;
  referenciaBancaria: string | null; origem: string; identificacaoPendente: boolean; observacao: string | null;
  remetente: { id: string; nome: string; tipoPessoa: string | null; documentoMascarado: string | null } | null;
  vinculoAtual: { situacao: string; motivo: string; criadoEm: string; adquirente: { id: string; nome: string } | null } | null;
}

export const fmtBRL = (v: number | string | null | undefined) =>
  v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const fmtData = (iso?: string | null) => {
  if (!iso) return '-';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

export const cardSt: CSSProperties = { background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10 };
export const thSt: CSSProperties = {
  padding: '8px 10px', fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.3px',
  textAlign: 'left', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap',
};
export const tdSt: CSSProperties = { padding: '8px 10px', fontSize: 13, borderBottom: '0.5px solid #F3F4F6', verticalAlign: 'top' };
export const erroSt: CSSProperties = { background: '#FCEBEB', color: '#A32D2D', borderRadius: 7, padding: '8px 12px', fontSize: 12 };
export const secTitle: CSSProperties = { fontSize: 12, fontWeight: 700, color: PROJ, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 };
export const inputSt: CSSProperties = { padding: '7px 10px', border: '0.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, background: '#fff' };
export const tituloSt: CSSProperties = { fontSize: 20, fontWeight: 700, color: '#111827' };
export const subtituloSt: CSSProperties = { fontSize: 12, color: '#6B7280', marginTop: 2 };
