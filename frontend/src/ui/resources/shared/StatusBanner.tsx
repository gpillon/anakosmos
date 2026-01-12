import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { getHealthColorClasses } from './formatters';

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

interface StatusBannerProps {
  name: string;
  namespace?: string;
  health: HealthStatus;
  statusText: string;
  children?: React.ReactNode; // For additional controls like replica selector
}

export const StatusBanner: React.FC<StatusBannerProps> = ({ 
  name, 
  namespace,
  health, 
  statusText,
  children 
}) => {
  const colors = getHealthColorClasses(health);

  const Icon = health === 'healthy' ? CheckCircle2 
    : health === 'warning' ? AlertCircle 
    : health === 'error' ? XCircle 
    : HelpCircle;

  return (
    <div className={clsx(
      "rounded-xl p-6 border backdrop-blur-sm",
      colors.bg,
      colors.border
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={clsx(
            "w-16 h-16 rounded-xl flex items-center justify-center",
            colors.icon
          )}>
            <Icon size={32} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{name}</h2>
            <p className="text-sm text-slate-400 mt-1">
              {namespace && `${namespace} • `}{statusText}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
};
