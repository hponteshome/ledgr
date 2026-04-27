import React from 'react';
import { IconType } from 'react-icons';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: IconType;
  color: string;
  trend?: { value: number; positive: boolean };
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, icon: Icon, color, trend }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={`p-4 rounded-xl text-white ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <h3 className="text-2xl font-black text-gray-800">{value}</h3>
        {trend && (
          <span className={`text-xs font-bold ${trend.positive ? 'text-green-500' : 'text-red-500'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}%
          </span>
        )}
      </div>
    </div>
  );
};