// src/hooks/useNotification.ts
import { toast } from 'react-hot-toast'; // ou sua lib de toast preferida

interface NotificationOptions {
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export const useNotification = () => {
  const showNotification = ({ title, message, type, duration = 4000 }: NotificationOptions) => {
    const formattedMessage = title ? `${title}\n${message}` : message;
    
    switch (type) {
      case 'success':
        toast.success(formattedMessage, { duration });
        break;
      case 'error':
        toast.error(formattedMessage, { duration });
        break;
      case 'warning':
        toast(formattedMessage, { 
          icon: '⚠️',
          style: { background: '#fef3c7', color: '#92400e' },
          duration 
        });
        break;
      case 'info':
        toast(formattedMessage, { 
          icon: 'ℹ️',
          style: { background: '#dbeafe', color: '#1e40af' },
          duration 
        });
        break;
    }
  };

  return { showNotification };
};