import React from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  label: string;
  tone?: 'default' | 'info' | 'success' | 'warning' | 'danger';
}

const toneStyles: Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'bg-slate-800 text-slate-300 border-slate-700',
  info: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  danger: 'bg-red-500/10 text-red-300 border-red-500/30',
};

export const Badge: React.FC<BadgeProps> = ({ label, tone = 'default' }) => (
  <span className={clsx('inline-flex items-center text-[11px] px-2 py-0.5 rounded border', toneStyles[tone])}>
    {label}
  </span>
);
