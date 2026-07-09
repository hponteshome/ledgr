// apps/frontend/src/components/LoadingSpinner.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const SIZE_PX: Record<string, number> = { sm: 16, md: 32, lg: 48 };

export const LoadingSpinner = ({ size, color }: LoadingSpinnerProps = {}) => {
  if (size) {
    return <Loader2 className="animate-spin" style={{ width: SIZE_PX[size], height: SIZE_PX[size], color: color || '#3B82F6' }} />;
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm font-medium">Carregando dados...</p>
    </div>
  );
};