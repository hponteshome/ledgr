// src/pages/documents/signatures/components/SignatureStatusBadge.tsx
import React from 'react';
import { 
  FiCheckCircle, 
  FiClock, 
  FiXCircle, 
  FiAlertCircle,
  FiAward,
  FiShield
} from 'react-icons/fi';

interface SignatureStatusBadgeProps {
  status: 'pending' | 'signed' | 'rejected' | 'expired';
  type?: 'ICP_BRASIL' | 'GOV_BR' | 'SIMPLE';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showTooltip?: boolean;
}

export const SignatureStatusBadge: React.FC<SignatureStatusBadgeProps> = ({
  status,
  type,
  size = 'md',
  showIcon = true,
  showTooltip = false
}) => {
  const getStatusConfig = () => {
    const configs = {
      pending: {
        icon: FiClock,
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        label: 'Pendente',
        tooltip: 'Aguardando assinatura'
      },
      signed: {
        icon: FiCheckCircle,
        bg: 'bg-green-100',
        text: 'text-green-700',
        label: 'Assinado',
        tooltip: 'Documento assinado com sucesso'
      },
      rejected: {
        icon: FiXCircle,
        bg: 'bg-red-100',
        text: 'text-red-700',
        label: 'Rejeitado',
        tooltip: 'Assinatura rejeitada'
      },
      expired: {
        icon: FiAlertCircle,
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        label: 'Expirado',
        tooltip: 'Prazo para assinatura expirado'
      }
    };
    return configs[status] || configs.pending;
  };

  const getTypeIcon = () => {
    if (!type) return null;
    
    const icons = {
      ICP_BRASIL: { icon: FiAward, color: 'text-purple-600', tooltip: 'Certificado ICP-Brasil' },
      GOV_BR: { icon: FiShield, color: 'text-green-600', tooltip: 'Assinatura Gov.br' },
      SIMPLE: { icon: null, color: '', tooltip: 'Assinatura Simples' }
    };
    return icons[type];
  };

  const getSizeClasses = () => {
    const sizes = {
      sm: {
        badge: 'px-2 py-0.5 text-xs',
        icon: 12
      },
      md: {
        badge: 'px-3 py-1 text-sm',
        icon: 14
      },
      lg: {
        badge: 'px-4 py-2 text-base',
        icon: 16
      }
    };
    return sizes[size] || sizes.md;
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;
  const typeConfig = getTypeIcon();
  const TypeIcon = typeConfig?.icon;
  const sizeClasses = getSizeClasses();

  const badge = (
    <div className="flex items-center gap-1">
      {showIcon && <StatusIcon size={sizeClasses.icon} className={statusConfig.text} />}
      <span className={`font-medium ${statusConfig.text}`}>
        {statusConfig.label}
      </span>
      {TypeIcon && showIcon && (
        <TypeIcon 
          size={sizeClasses.icon} 
          className={typeConfig.color} 
          style={{ marginLeft: 2 }}
        />
      )}
    </div>
  );

  if (showTooltip) {
    return (
      <div className="relative group">
        <div className={`inline-flex items-center rounded-full ${statusConfig.bg} ${sizeClasses.badge} cursor-help`}>
          {badge}
        </div>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          {statusConfig.tooltip}
          {typeConfig && ` • ${typeConfig.tooltip}`}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center rounded-full ${statusConfig.bg} ${sizeClasses.badge}`}>
      {badge}
    </div>
  );
};

// Componente auxiliar para ícone de tipo de assinatura
export const SignatureTypeIcon: React.FC<{ type: 'ICP_BRASIL' | 'GOV_BR' | 'SIMPLE'; size?: number }> = ({ 
  type, 
  size = 14 
}) => {
  const getIcon = () => {
    switch (type) {
      case 'ICP_BRASIL':
        return <FiAward size={size} className="text-purple-600" title="ICP-Brasil" />;
      case 'GOV_BR':
        return <FiShield size={size} className="text-green-600" title="Gov.br" />;
      default:
        return null;
    }
  };

  return getIcon();
};

// Componente para lista de status (usado em tabelas)
export const SignatureStatusList: React.FC<{ signatures: Array<{ status: string; type?: string }> }> = ({ 
  signatures 
}) => {
  const statusCount = signatures.reduce((acc, sig) => {
    acc[sig.status] = (acc[sig.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'text-yellow-600',
      signed: 'text-green-600',
      rejected: 'text-red-600',
      expired: 'text-gray-600'
    };
    return colors[status as keyof typeof colors] || 'text-gray-600';
  };

  return (
    <div className="flex items-center gap-3">
      {Object.entries(statusCount).map(([status, count]) => (
        <div key={status} className="flex items-center gap-1">
          <span className={`text-sm font-medium ${getStatusColor(status)}`}>
            {count}
          </span>
          <span className="text-xs text-gray-400 capitalize">
            {status}
          </span>
        </div>
      ))}
    </div>
  );
};

export default SignatureStatusBadge;