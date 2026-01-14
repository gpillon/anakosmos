import React from 'react';
import { clsx } from 'clsx';

export interface InfoItem {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  dim?: boolean;
}

interface InfoGridProps {
  items: InfoItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}

export const InfoGrid: React.FC<InfoGridProps> = ({ items, columns = 2, className }) => (
  <div className={clsx('grid gap-3', columns === 1 && 'grid-cols-1', columns === 2 && 'grid-cols-2', columns === 3 && 'grid-cols-3', className)}>
    {items.map(item => (
      <div key={item.label} className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{item.label}</span>
        <span className={clsx(
          'text-xs text-slate-200 truncate',
          item.mono && 'font-mono',
          item.dim && 'text-slate-500'
        )}>
          {item.value || <span className="text-slate-500">—</span>}
        </span>
      </div>
    ))}
  </div>
);
