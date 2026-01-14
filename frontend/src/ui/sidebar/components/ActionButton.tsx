import React from 'react';
import { clsx } from 'clsx';

interface ActionButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary';
}

export const ActionButton: React.FC<ActionButtonProps> = ({ icon: Icon, label, onClick, disabled, variant = 'default' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={clsx(
      'flex items-center justify-center gap-2 p-3 rounded-lg text-sm font-medium transition-all border active:scale-95',
      variant === 'primary'
        ? 'bg-blue-600/80 border-blue-500/60 text-white hover:bg-blue-500'
        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-slate-200',
      disabled && 'opacity-50 cursor-not-allowed'
    )}
  >
    <Icon size={16} className={variant === 'primary' ? 'text-white' : 'text-blue-400'} />
    {label}
  </button>
);
