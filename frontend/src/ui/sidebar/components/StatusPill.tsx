import React from 'react';
import { clsx } from 'clsx';
import { Activity, AlertCircle } from 'lucide-react';

type Health = 'ok' | 'warning' | 'error';

interface StatusPillProps {
  status: string;
  health?: Health;
  compact?: boolean;
}

const healthStyles: Record<Health, string> = {
  ok: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const StatusPill: React.FC<StatusPillProps> = ({ status, health, compact }) => {
  const style = health ? healthStyles[health] : 'bg-slate-800/60 text-slate-300 border-slate-700/60';
  return (
    <div className={clsx(
      'inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold',
      compact && 'px-2 py-0.5 text-[11px]',
      style
    )}>
      {health === 'error' ? <AlertCircle size={12} /> : <Activity size={12} />}
      <span className="truncate">{status}</span>
    </div>
  );
};
