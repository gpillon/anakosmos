import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className }) => (
  <div className={clsx(
    "bg-slate-900/50 rounded-xl border border-slate-800",
    className
  )}>
    {children}
  </div>
);

interface CardHeaderProps {
  icon?: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ icon, title, badge, action }) => (
  <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between first:rounded-t-xl">
    <div className="flex items-center gap-2">
      {icon && <span className="text-slate-400">{icon}</span>}
      <span className="font-semibold text-slate-200">{title}</span>
      {badge}
    </div>
    {action}
  </div>
);

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const CardBody: React.FC<CardBodyProps> = ({ children, className, noPadding }) => (
  <div className={clsx(!noPadding && "p-4", className)}>
    {children}
  </div>
);
