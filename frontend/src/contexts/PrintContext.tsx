// frontend/src/contexts/PrintContext.tsx
// CRIADO 31/08/2026: botao de impressao GLOBAL e fixo (FAB), disponivel em
// qualquer tela que registrar seu proprio handler - evita duplicar
// posicionamento/estilo de botao "Imprimir" em cada tela nova. Cada tela usa
// o hook usePrintHandler() pra "plugar" sua propria funcao de impressao
// (normalmente construida com o helper imprimirRelatorio.ts) enquanto
// estiver montada - o botao aparece so quando ha handler registrado.
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { FiPrinter } from 'react-icons/fi';

interface PrintContextValue {
  setPrintHandler: (handler: (() => void) | null, label?: string) => void;
}

const PrintContext = createContext<PrintContextValue | undefined>(undefined);

export const PrintProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handler, setHandlerState] = useState<(() => void) | null>(null);
  const [label, setLabel] = useState<string>('Imprimir');

  const setPrintHandler = useCallback((h: (() => void) | null, lbl?: string) => {
    setHandlerState(() => h);
    if (lbl) setLabel(lbl);
  }, []);

  return (
    <PrintContext.Provider value={{ setPrintHandler }}>
      {children}
      {handler && (
        <button
          onClick={handler}
          title={label}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
            width: 52, height: 52, borderRadius: '50%',
            background: '#111827', color: '#fff', border: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,0.28)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <FiPrinter size={20} />
        </button>
      )}
    </PrintContext.Provider>
  );
};

// CRIADO 31/08/2026: hook que qualquer tela usa para registrar sua funcao de
// impressao no botao global - registra ao montar, desregistra ao desmontar.
// Passar deps garante que o handler seja atualizado quando os dados mudarem
// (ex: apos recalcular).
export function usePrintHandler(handler: (() => void) | null, label?: string, deps: React.DependencyList = []) {
  const ctx = useContext(PrintContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setPrintHandler(handler, label);
    return () => ctx.setPrintHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
