import React from 'react';
import { IconType } from 'react-icons';

interface UsuarioCardProps {
  title: string;
  value: string | number;
  icon: IconType;
  color: string; // Ex: 'bg-blue-600', 'bg-emerald-500'
  trend?: { value: number; positive: boolean };
}

export const UsuarioCard: React.FC<UsuarioCardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  trend
}) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
      {/* Container do Ícone com a cor dinâmica */}
      <div className={`p-4 rounded-xl text-white ${color} shadow-lg shadow-opacity-20`}>
        <Icon size={24} />
      </div>

      {/* Conteúdo Numérico */}
      <div>
        <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">
          {title}
        </p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-black text-gray-800">
            {value}
          </h3>

          {/* Badge de tendência (opcional, caso queira mostrar crescimento de usuários) */}
          {trend && (
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${trend.positive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
              {trend.positive ? '+' : '-'}{trend.value}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};