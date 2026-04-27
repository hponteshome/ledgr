// src/components/ConfirmDialog.tsx
import React from 'react';
import { FiAlertTriangle, FiInfo, FiAlertCircle } from 'react-icons/fi';

interface ConfirmDialogProps {
  isOpen: boolean;
  options: {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  options,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const { title, message, type = 'danger', confirmText = 'Confirmar', cancelText = 'Cancelar' } = options;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <FiAlertCircle className="text-red-600" size={24} />;
      case 'warning':
        return <FiAlertTriangle className="text-yellow-600" size={24} />;
      case 'info':
        return <FiInfo className="text-blue-600" size={24} />;
    }
  };

  const getColors = () => {
    switch (type) {
      case 'danger':
        return {
          button: 'bg-red-600 hover:bg-red-700',
          icon: 'bg-red-100'
        };
      case 'warning':
        return {
          button: 'bg-yellow-600 hover:bg-yellow-700',
          icon: 'bg-yellow-100'
        };
      case 'info':
        return {
          button: 'bg-blue-600 hover:bg-blue-700',
          icon: 'bg-blue-100'
        };
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-md w-full mx-4 animate-fadeIn">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${colors.icon}`}>
              {getIcon()}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-4 bg-gray-50 rounded-b-xl">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 ${colors.button} text-white rounded-lg font-medium transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};