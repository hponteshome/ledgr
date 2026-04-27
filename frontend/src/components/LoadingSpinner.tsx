// apps/frontend/src/components/LoadingSpinner.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm font-medium">Carregando dados...</p>
    </div>
  );
};