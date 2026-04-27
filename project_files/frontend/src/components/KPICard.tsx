import React from 'react';
import { Link } from 'react-router-dom';
import { IconType } from 'react-icons';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: IconType;
  color: string;
  link: string;
  trend?: {
    value: number;
    positive: boolean;
  };
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  icon: Icon,
  color,
  link,
  trend
}) => {
  return (
    <Link
      to={link}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all hover:scale-[1.02]"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`${color} p-3 rounded-lg text-white`}>
          <Icon size={24} />
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.positive ? '+' : '-'}{trend.value}%
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </Link>
  );
};
