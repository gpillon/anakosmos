import React from 'react';
import { clsx } from 'clsx';

interface SectionProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const SidebarSection: React.FC<SectionProps> = ({ title, subtitle, actions, className, children }) => (
  <section className={clsx('space-y-3', className)}>
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
    {children}
  </section>
);
