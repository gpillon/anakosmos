import React from 'react';
import { clsx } from 'clsx';

interface MetaRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  truncate?: boolean;
}

export const MetaRow: React.FC<MetaRowProps> = ({ label, value, mono, truncate = true }) => (
  <div className="flex justify-between items-center">
    <span className="text-slate-500">{label}</span>
    <span className={clsx(
      "text-slate-200",
      truncate && "truncate max-w-[60%]",
      mono && "font-mono text-xs"
    )}>
      {value || '-'}
    </span>
  </div>
);
