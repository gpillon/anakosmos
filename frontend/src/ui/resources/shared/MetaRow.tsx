import React from 'react';
import { clsx } from 'clsx';

interface MetaRowProps {
  label: React.ReactNode;
  value?: React.ReactNode;
  mono?: boolean;
  truncate?: boolean;
  children?: React.ReactNode; // Alternative to value prop
}

export const MetaRow: React.FC<MetaRowProps> = ({ label, value, mono, truncate = true, children }) => (
  <div className="flex justify-between items-center">
    <span className="text-slate-500">{label}</span>
    <span className={clsx(
      "text-slate-200",
      truncate && "truncate max-w-[60%]",
      mono && "font-mono text-xs"
    )}>
      {children ?? value ?? '-'}
    </span>
  </div>
);
