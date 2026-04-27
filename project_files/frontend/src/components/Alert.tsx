import React from 'react';
import { FiAlertCircle, FiCheckCircle, FiInfo, FiXCircle } from 'react-icons/fi';

type AlertType = 'success' | 'error' | 'info' | 'warning';

interface AlertProps {
  type: AlertType;
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-700',
      icon: FiCheckCircle
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600',
      icon: FiAlertCircle
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      icon: FiInfo
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-700',
      icon: FiXCircle
    }
  };

  const Icon = styles[type].icon;

  return (
    <div className={`${styles[type].bg} border ${styles[type].border} ${styles[type].text} px-4 py-3 rounded-lg flex items-center gap-2`}>
      <Icon className="h-5 w-5" />
      <span className="flex-1">{message}</span>
      {onClose && (
        <button onClick={onClose} className="hover:opacity-75">
          <FiXCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
