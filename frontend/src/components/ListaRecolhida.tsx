// frontend/src/components/ListaRecolhida.tsx
// DASH-05 (13/11/2026): padrao do LEDGR para listas longas - mostra os primeiros N itens (padrao 3)
// e um rodape "+ N mais" / "mostrar menos". A ordem (urgencia primeiro) e responsabilidade de quem chama.
import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface Props<T> {
  itens: T[];
  limite?: number;
  render: (item: T, idx: number, visiveis: T[]) => React.ReactNode;
}

export function ListaRecolhida<T>({ itens, limite = 3, render }: Props<T>) {
  const [aberta, setAberta] = useState(false);
  const visiveis = aberta ? itens : itens.slice(0, limite);
  const ocultos = itens.length - limite;
  return (
    <>
      {visiveis.map((it, i) => <React.Fragment key={i}>{render(it, i, visiveis)}</React.Fragment>)}
      {ocultos > 0 && (
        <div onClick={e => { e.stopPropagation(); setAberta(v => !v); }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '0.5rem 1rem', fontSize: 12,
            color: '#0369A1', cursor: 'pointer', borderTop: '0.5px solid #E5E7EB', background: 'transparent', userSelect: 'none' }}>
          {aberta ? <><FiChevronUp size={13} /> mostrar menos</> : <><FiChevronDown size={13} /> + {ocultos} mais</>}
        </div>
      )}
    </>
  );
}

export default ListaRecolhida;
