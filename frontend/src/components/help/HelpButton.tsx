// frontend/src/components/help/HelpButton.tsx
import React, { useState } from 'react';
import { FiHelpCircle, FiX } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';
import { HelpCenter } from './HelpCenter';
import { contextualHelp } from '../../help/helpContent';

export const HelpButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const contextSlug = Object.entries(contextualHelp).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1];

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(true)}
        title="Ajuda"
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        <FiHelpCircle size={22} />
      </button>

      {/* Painel lateral */}
      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-96 max-w-full z-50 bg-white shadow-2xl flex flex-col animate-slide-in-right">
            <HelpCenter
              initialSlug={contextSlug}
              onClose={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
};
