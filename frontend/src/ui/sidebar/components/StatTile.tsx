import React from 'react';
import { clsx } from 'clsx';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}

const toneStyles: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'bg-slate-800/60 border-slate-700/60 text-slate-200',
  good: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  warn: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  bad: 'bg-red-500/10 border-red-500/30 text-red-300',
};

export const StatTile: React.FC<StatTileProps> = ({ label, value, tone = 'default' }) => (
  <div className={clsx('rounded-lg border px-3 py-2 flex flex-col gap-1', toneStyles[tone])}>
    <span className="text-[10px] uppercase tracking-wide">{label}</span>
    <span className="text-lg font-semibold">{value}</span>
  </div>
);
