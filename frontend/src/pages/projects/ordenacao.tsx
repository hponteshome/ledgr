// frontend/src/pages/projects/ordenacao.tsx
// Ordenacao por coluna para as tabelas de triagem (06/10/2026). Clicar no titulo ordena (crescente), clicar de novo inverte.
// Numeros como numeros; textos sem diferenciar maiusculas e acentos; vazios sempre no fim, nos dois sentidos.
import React, { useMemo, useState } from 'react';

export type Dir = 'asc' | 'desc';
export interface Ordem { col: string; dir: Dir }
const norm = (v: any) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const vazio = (v: any) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && Number.isNaN(v));

export function useOrdenacao<T>(lista: T[], getters: Record<string, (x: T) => any>, inicial: Ordem) {
  const [ord, setOrd] = useState<Ordem>(inicial);
  const ordenada = useMemo(() => {
    const g = getters[ord.col];
    if (!g) return lista;
    return [...lista].sort((a, b) => {
      const va = g(a); const vb = g(b);
      const ea = vazio(va); const eb = vazio(vb);
      if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : norm(va).localeCompare(norm(vb), 'pt-BR', { numeric: true });
      return ord.dir === 'asc' ? r : -r;
    });
  }, [lista, ord, getters]);
  const alternar = (col: string) => setOrd((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }));
  return { ordenada, ord, alternar };
}

export function ThOrdenavel({ col, rotulo, ord, alternar, style }: { col: string; rotulo: string; ord: Ordem; alternar: (c: string) => void; style?: React.CSSProperties }) {
  const ativo = ord.col === col;
  return (
    <th style={{ ...style, cursor: 'pointer', userSelect: 'none', color: ativo ? '#374151' : style?.color }} onClick={() => alternar(col)}
      title="Clique para ordenar" aria-sort={ativo ? (ord.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      {rotulo}<span style={{ marginLeft: 4, fontSize: 10, opacity: ativo ? 1 : 0.35 }}>{ativo ? (ord.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </th>
  );
}
