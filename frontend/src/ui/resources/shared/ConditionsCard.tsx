import React from 'react';
import { Activity } from 'lucide-react';
import { clsx } from 'clsx';
import { Card, CardHeader } from './Card';
import { formatDate } from './formatters';

interface Condition {
  type?: string;
  status?: string;
  reason?: string;
  message?: string;
  lastUpdateTime?: string;
  lastTransitionTime?: string;
}

interface ConditionsCardProps {
  conditions: Condition[] | undefined;
  title?: string;
}

export const ConditionsCard: React.FC<ConditionsCardProps> = ({ 
  conditions,
  title = "Conditions"
}) => {
  if (!conditions || conditions.length === 0) return null;

  return (
    <Card>
      <CardHeader 
        icon={<Activity size={16} />} 
        title={title}
        badge={
          <span className="text-xs text-slate-500 ml-2">
            ({conditions.length})
          </span>
        }
      />
      <div className="divide-y divide-slate-800">
        {conditions.map((c, i) => (
          <div key={i} className="px-4 py-3 flex items-center gap-4">
            <div className={clsx(
              "w-2 h-2 rounded-full shrink-0",
              c.status === 'True' ? 'bg-emerald-400' : 'bg-red-400'
            )} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-200 text-sm">{c.type}</span>
                <span className={clsx(
                  "text-xs px-1.5 py-0.5 rounded",
                  c.status === 'True' 
                    ? 'bg-emerald-900/50 text-emerald-400' 
                    : 'bg-red-900/50 text-red-400'
                )}>
                  {c.status}
                </span>
                {c.reason && (
                  <span className="text-xs text-slate-500">
                    ({c.reason})
                  </span>
                )}
              </div>
              {c.message && (
                <div className="text-xs text-slate-500 mt-1 truncate">{c.message}</div>
              )}
            </div>
            <div className="text-xs text-slate-600 shrink-0">
              {formatDate(c.lastUpdateTime || c.lastTransitionTime)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
